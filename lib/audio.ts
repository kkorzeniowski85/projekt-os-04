/**
 * Warstwa audio Akademii.
 *
 * Zasada z briefu (ta sama co w Lidze): audio WYCHODZĄCE tak, ocena wymowy
 * dziecka — nie. Mikrofon nie jest tu używany wcale.
 *
 * Źródła dźwięku, w tej kolejności:
 *  1. Nagranie z /public/audio (brytyjski głos neuronowy z generatora),
 *  2. Synteza mowy przeglądarki (en-GB) — awaryjnie. W Akademii to uczciwe
 *     wyjście, bo wszystko, co gramy, to liczby, słowa i zdania; nie ma tu
 *     czystych głosek, których syntezator nie umie.
 *
 * Kategorie nagrań:
 *  - /audio/numbers/<n>.mp3 — liczby słownie po brytyjsku („one hundred and five"),
 *  - /audio/facts/<a>x<b>.mp3 — fakt tabliczki („seven times eight is fifty-six"),
 *  - /audio/phrases/<slug>.mp3 — zdania, pytania, polecenia (slug: lib/curriculum/slug.ts).
 */

import { numberToWords } from "./curriculum/numbers";
import { audioSlug } from "./curriculum/slug";
import type { Sound } from "./session/exercise";

export type PlaybackSource = "clip" | "tts" | "unavailable";
export type PlaybackResult = { source: PlaybackSource };

// Na GitHub Pages aplikacja siedzi w podkatalogu (patrz next.config.ts).
const CLIP_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/audio`;

export function numberClipPath(n: number): string {
  return `${CLIP_BASE}/numbers/${n}.mp3`;
}

export function factClipPath(a: number, b: number): string {
  return `${CLIP_BASE}/facts/${a}x${b}.mp3`;
}

export function textClipPath(text: string): string {
  return `${CLIP_BASE}/phrases/${audioSlug(text)}.mp3`;
}

/** "unknown" = nie wiadomo (brak sieci, limit czasu, błąd serwera). */
type ClipState = "yes" | "no" | "unknown";

/** Dłużej nie czekamy na odpowiedź — potem gra zapas (synteza). */
const HEAD_TIMEOUT_MS = 3000;
/** Tyle pamiętamy „nie wiadomo", żeby każde stuknięcie nie czekało od nowa. */
const UNKNOWN_TTL_MS = 30_000;
/**
 * Tyle pamiętamy „nie ma". Nie do przeładowania strony: tuż po wdrożeniu
 * service worker może jeszcze odpowiadać wg poprzedniego manifestu, a nowe
 * nagranie grałaby wtedy synteza przez całą sesję aplikacji.
 */
const NO_TTL_MS = 10 * 60_000;

type ClipEntry = { state: Promise<ClipState>; expires: number };

const clipAvailability = new Map<string, ClipEntry>();

/**
 * Jedno zapytanie HEAD z limitem czasu. Service worker odpowiada na nie z
 * manifestu wdrożenia (deploy.json), bez sieci; bez niego pyta serwer.
 */
async function probeClip(path: string): Promise<ClipState> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timer = setTimeout(() => controller?.abort(), HEAD_TIMEOUT_MS);
  try {
    const response = await fetch(path, { method: "HEAD", signal: controller?.signal });
    if (response.ok) return "yes";
    return response.status === 404 || response.status === 410 ? "no" : "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Czy nagranie istnieje. „Jest" pamiętamy do przeładowania strony, „nie ma"
 * (404) przez NO_TTL_MS. Błąd sieci albo limit czasu to „nie wiadomo": nie
 * utrwalamy go (chwilowy brak zasięgu oznaczałby nagranie jako brakujące, a
 * offline plik i tak może być w pamięci service workera), ale pamiętamy przez
 * UNKNOWN_TTL_MS — bez service workera (pierwsze otwarcie) przy łączu, które
 * wisi, każde stuknięcie czekałoby inaczej od nowa na limit czasu. Z service
 * workerem HEAD odpowiada od razu z manifestu, a na samo nagranie spoza
 * pamięci SW czeka najwyżej kilka sekund (CLIP_WAIT_MS w public/sw.js).
 */
function clipState(path: string): Promise<ClipState> {
  if (typeof window === "undefined") return Promise.resolve("no");
  const known = clipAvailability.get(path);
  if (known && known.expires > Date.now()) return known.state;
  const entry: ClipEntry = { state: probeClip(path), expires: Infinity };
  void entry.state.then((state) => {
    if (state === "unknown") entry.expires = Date.now() + UNKNOWN_TTL_MS;
    if (state === "no") entry.expires = Date.now() + NO_TTL_MS;
  });
  clipAvailability.set(path, entry);
  return entry.state;
}

export async function clipExists(path: string): Promise<boolean> {
  return (await clipState(path)) === "yes";
}

/**
 * JEDEN współdzielony element audio. Wzorzec pod iOS: Safari pozwala grać
 * elementowi, który choć raz zagrał w geście użytkownika — późniejsza podmiana
 * `src` już gestu nie wymaga. Nowy element tworzony po setTimeout bywa blokowany.
 */
let sharedAudio: HTMLAudioElement | null = null;

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

type PlayStatus = "ok" | "blocked" | "failed" | "interrupted";

/** Numer bieżącego odtworzenia — nowsze przerywa starsze. */
let playToken = 0;

/**
 * Kończy czekanie bieżącego odtworzenia z `wait`. Przerwanie (interrupt niżej,
 * nowsze nagranie) woła je od razu, nie czekając na zdarzenie „pause": Chrome gubi
 * je, gdy tuż po pause() zmienia się `src`, i przerwana sekwencja kończyła się
 * dopiero z „ended" następnego nagrania — podświetlenie w liczeniu skokami
 * wisiało wtedy jeszcze ok. sekundy.
 */
let settlePending: (() => void) | null = null;

/**
 * Gra plik; z `wait` czeka do końca nagrania (albo do przerwania przez inne
 * odtworzenie). Czekanie jest potrzebne sekwencjom: liczeniu skokami i
 * czytaniu tekstu zdanie po zdaniu.
 */
async function playUrl(url: string, wait: boolean): Promise<PlayStatus> {
  const token = ++playToken;
  settlePending?.();
  const audio = getSharedAudio();
  // Nagranie przerywa też awaryjny głos z poprzedniego odtworzenia.
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  audio.pause();
  audio.muted = false;
  audio.src = url;

  const finished = wait
    ? new Promise<void>((resolve) => {
        const done = () => {
          audio.removeEventListener("ended", done);
          audio.removeEventListener("error", done);
          audio.removeEventListener("pause", onPause);
          clearTimeout(safety);
          if (settlePending === done) settlePending = null;
          resolve();
        };
        settlePending = done;
        // Pauza wywołana przez NOWSZE odtworzenie = przerwanie. Naturalny
        // koniec nagrania też wysyła „pause", ale wtedy token jest aktualny.
        const onPause = () => {
          if (token !== playToken) done();
        };
        // Polisa na przeglądarki, które gubią zdarzenie „ended".
        const safety = setTimeout(done, 20000);
        audio.addEventListener("ended", done);
        audio.addEventListener("error", done);
        audio.addEventListener("pause", onPause);
      })
    : null;

  try {
    await audio.play();
  } catch (error) {
    const name = (error as DOMException)?.name;
    // pause() albo nowy src w trakcie ładowania to przerwanie, nie brak
    // nagrania — inaczej przerwany tekst czytałby potem syntezator.
    if (name === "AbortError" || token !== playToken) return "interrupted";
    return name === "NotAllowedError" ? "blocked" : "failed";
  }
  if (finished) await finished;
  return token === playToken ? "ok" : "interrupted";
}

// --- Synteza mowy ------------------------------------------------------------

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  // Brytyjski angielski ma priorytet — dziecko idzie do szkoły w Anglii.
  cachedVoice =
    voices.find((voice) => voice.lang === "en-GB") ??
    voices.find((voice) => voice.lang.startsWith("en-GB")) ??
    voices.find((voice) => voice.lang.startsWith("en")) ??
    null;
  return cachedVoice;
}

export function primeSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  pickVoice();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    cachedVoice = null;
    pickVoice();
  });
}

export type VoiceStatus = { supported: boolean; voiceName: string | null; isBritish: boolean };

export function getVoiceStatus(): VoiceStatus {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return { supported: false, voiceName: null, isBritish: false };
  }
  const voice = pickVoice();
  return {
    supported: true,
    voiceName: voice?.name ?? null,
    isBritish: Boolean(voice?.lang?.startsWith("en-GB")),
  };
}

function speak(text: string, rate: number, wait: boolean): Promise<boolean> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve(false);
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "en-GB";
  utterance.rate = rate;
  if (!wait) {
    window.speechSynthesis.speak(utterance);
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const safety = setTimeout(() => resolve(true), 15000);
    utterance.onend = () => {
      clearTimeout(safety);
      resolve(true);
    };
    utterance.onerror = () => {
      clearTimeout(safety);
      resolve(true);
    };
    window.speechSynthesis.speak(utterance);
  });
}

// --- Sekwencje ---------------------------------------------------------------

/** Numer bieżącej sekwencji — ręczne odtworzenie albo stopAudio ją przerywa. */
let sequenceToken = 0;

async function playClipOrSpeak(
  path: string,
  fallbackText: string,
  options: { wait: boolean; rate: number },
): Promise<PlaybackResult> {
  // Generacja z chwili wywołania: manual(), playSequence i stopAudio podbijają
  // sequenceToken, więc nieaktualne wywołanie nie zagra i nie zacznie mówić
  // po tym, jak ktoś je przerwał (także gdy sprawdzanie pliku jeszcze trwało).
  const generation = sequenceToken;
  const stale = () => generation !== sequenceToken;
  const state = await clipState(path);
  if (stale()) return { source: "clip" };
  // „Nie wiadomo" (brak sieci): i tak próbujemy — plik może być w pamięci
  // service workera. Nieudane odtworzenie kończy się syntezą niżej.
  if (state !== "no") {
    const status = await playUrl(path, options.wait);
    if (status === "ok" || status === "interrupted") return { source: "clip" };
    // Zablokowane = potrzebny gest; synteza też byłaby zablokowana.
    if (status === "blocked") return { source: "unavailable" };
  }
  if (stale()) return { source: "clip" };
  return (await speak(fallbackText, options.rate, options.wait))
    ? { source: "tts" }
    : { source: "unavailable" };
}

type PlayOptions = { wait?: boolean };

/**
 * Ucisza od razu to, co gra (nagranie i syntezę), i kończy czekanie na nie.
 * Od razu, a nie dopiero przy starcie nowego nagrania: nowe najpierw pyta o
 * plik (HEAD), a zapasem bywa synteza, która elementu audio w ogóle nie
 * rusza — przerwane liczenie grało i świeciło wtedy dalej do końca liczby.
 */
function interrupt(): void {
  playToken += 1;
  settlePending?.();
  if (sharedAudio) sharedAudio.pause();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Publiczne odtwarzanie przerywa trwającą sekwencję: dziecko, które stuknie
 * głośnik w trakcie czytania tekstu, chce usłyszeć TO, co stuknęło.
 */
function manual<T>(run: () => Promise<T>): Promise<T> {
  sequenceToken += 1;
  interrupt();
  return run();
}

export function playNumber(n: number, options: PlayOptions = {}): Promise<PlaybackResult> {
  return manual(() =>
    playClipOrSpeak(numberClipPath(n), numberToWords(n), { wait: options.wait ?? false, rate: 0.85 }),
  );
}

export function playFact(a: number, b: number, options: PlayOptions = {}): Promise<PlaybackResult> {
  return manual(() =>
    playClipOrSpeak(
      factClipPath(a, b),
      `${numberToWords(a)} times ${numberToWords(b)} is ${numberToWords(a * b)}`,
      { wait: options.wait ?? false, rate: 0.85 },
    ),
  );
}

export function playText(text: string, options: PlayOptions = {}): Promise<PlaybackResult> {
  return manual(() =>
    playClipOrSpeak(textClipPath(text), text, { wait: options.wait ?? false, rate: 0.8 }),
  );
}

/** Dźwięk opisany w ćwiczeniu (lib/session/exercise.ts). */
export function playSound(sound: Sound, options: PlayOptions = {}): Promise<PlaybackResult> {
  switch (sound.kind) {
    case "number":
      return playNumber(sound.value, options);
    case "fact":
      return playFact(sound.a, sound.b, options);
    case "text":
      return playText(sound.value, options);
  }
}

/** Ścieżka nagrania dla dźwięku z ćwiczenia — do audytu. */
export function soundClipPath(sound: Sound): string {
  switch (sound.kind) {
    case "number":
      return numberClipPath(sound.value);
    case "fact":
      return factClipPath(sound.a, sound.b);
    case "text":
      return textClipPath(sound.value);
  }
}

export type SequenceStep =
  | { kind: "number"; value: number; onStart?: () => void }
  | { kind: "text"; value: string; onStart?: () => void };

/**
 * Sekwencja nagrań z krótką przerwą — liczenie skokami („three, six,
 * nine…"), czytanie tekstu zdanie po zdaniu. Zwraca false, gdy ktoś ją
 * przerwał (inne odtworzenie, wyjście z ekranu).
 */
export async function playSequence(steps: SequenceStep[], gapMs = 220): Promise<boolean> {
  const token = ++sequenceToken;
  interrupt();
  for (const step of steps) {
    if (token !== sequenceToken) return false;
    step.onStart?.();
    if (step.kind === "number") {
      await playClipOrSpeak(numberClipPath(step.value), numberToWords(step.value), {
        wait: true,
        rate: 0.85,
      });
    } else {
      await playClipOrSpeak(textClipPath(step.value), step.value, { wait: true, rate: 0.8 });
    }
    if (token !== sequenceToken) return false;
    await new Promise((resolve) => setTimeout(resolve, gapMs));
  }
  return token === sequenceToken;
}

/** Zatrzymuje wszystko, co gra (np. przy wyjściu z ekranu). */
export function stopAudio(): void {
  sequenceToken += 1;
  interrupt();
}

let unlockAttempted = false;

/**
 * Odblokowanie audio — wywoływane w geście użytkownika (start sesji). Gra
 * wyciszone krótkie nagranie, budzi syntezę i kontekst sygnałów. Best-effort.
 */
export function unlockAudio(): void {
  if (typeof window === "undefined" || unlockAttempted) return;
  unlockAttempted = true;
  try {
    const audio = getSharedAudio();
    audio.muted = true;
    audio.src = numberClipPath(1);
    const unlockSrc = audio.src;
    audio
      .play()
      .then(() => {
        if (audio.src === unlockSrc) {
          audio.pause();
          audio.currentTime = 0;
        }
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  } catch {
    // brak wsparcia — trudno
  }
  try {
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(""));
  } catch {
    // jw.
  }
  const context = getToneContext();
  if (context?.state === "suspended") void context.resume();
}

// --- Sygnały i fanfara (Web Audio, bez plików) ---------------------------------

/**
 * Jeden AudioContext na całą sesję — iOS ma twardy limit równoczesnych
 * kontekstów, więc nowy przy każdym sygnale kończy się ciszą.
 */
let toneContext: AudioContext | null = null;

function getToneContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (toneContext) return toneContext;
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  toneContext = new AudioCtx();
  return toneContext;
}

type NoteSpec = { freq: number; at: number; dur: number; vol?: number; type?: OscillatorType };

function scheduleNote(context: AudioContext, destination: AudioNode, note: NoteSpec): OscillatorNode {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = note.type ?? "triangle";
  oscillator.frequency.value = note.freq;
  const start = context.currentTime + note.at;
  const volume = note.vol ?? 0.16;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + note.dur + 0.05);
  return oscillator;
}

/** Krótki sygnał zwrotny: dobrze / spróbuj jeszcze raz. */
export function playFeedbackTone(kind: "good" | "try-again"): void {
  const context = getToneContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  const notes = kind === "good" ? [660, 880] : [330, 262];
  oscillator.frequency.setValueAtTime(notes[0], context.currentTime);
  oscillator.frequency.setValueAtTime(notes[1], context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.32);
}

/** Szybki „błysk" za odpowiedź płynną (≤ 3,5 s) — nagroda za tempo, nie tylko za wynik. */
export function playFastDing(): void {
  const context = getToneContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();
  scheduleNote(context, context.destination, { freq: 1046.5, at: 0, dur: 0.12, vol: 0.1, type: "sine" });
  scheduleNote(context, context.destination, { freq: 1568, at: 0.07, dur: 0.18, vol: 0.08, type: "sine" });
}

/** Dzwoneczek pojawiającej się gwiazdki — kolejne brzmią coraz wyżej. */
export function playStarDing(index: number): void {
  const context = getToneContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();
  const freqs = [523.25, 659.25, 783.99];
  const freq = freqs[Math.min(index, freqs.length - 1)];
  scheduleNote(context, context.destination, { freq, at: 0, dur: 0.35, vol: 0.14 });
  scheduleNote(context, context.destination, { freq: freq * 2, at: 0, dur: 0.25, vol: 0.05, type: "sine" });
}

let stopVictory: (() => void) | null = null;

export function stopVictoryFanfare(): void {
  stopVictory?.();
  stopVictory = null;
}

/**
 * Krótka fanfara zwycięstwa (~4 s). Melodia w całości oryginalna — żadnych
 * fraz z istniejącej muzyki filmowej. Krótsza niż w Lidze: w Akademii sesje są
 * krótsze i częstsze (codzienny trening tabliczki), a dziesięć sekund muzyki
 * po pięciominutowym treningu szybko by zmęczyło.
 */
export async function playVictoryFanfare(): Promise<void> {
  stopVictoryFanfare();
  const context = getToneContext();
  if (!context) return;
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }
  const master = context.createGain();
  master.gain.value = 1;
  const soft = context.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = 2600;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -5;
  limiter.ratio.value = 12;
  soft.connect(master);
  master.connect(limiter);
  limiter.connect(context.destination);

  const T = "sawtooth" as const;
  const notes: NoteSpec[] = [
    { freq: 392.0, at: 0.0, dur: 0.15, vol: 0.14, type: T },
    { freq: 523.25, at: 0.16, dur: 0.15, vol: 0.15, type: T },
    { freq: 659.25, at: 0.32, dur: 0.15, vol: 0.16, type: T },
    { freq: 783.99, at: 0.48, dur: 0.45, vol: 0.18, type: T },
    { freq: 659.25, at: 1.0, dur: 0.18, vol: 0.15, type: T },
    { freq: 783.99, at: 1.2, dur: 0.18, vol: 0.16, type: T },
    { freq: 1046.5, at: 1.42, dur: 1.2, vol: 0.2, type: T },
    { freq: 130.81, at: 0.0, dur: 0.9, vol: 0.12, type: T },
    { freq: 196.0, at: 1.0, dur: 0.4, vol: 0.12, type: T },
    { freq: 261.63, at: 1.42, dur: 1.2, vol: 0.1, type: T },
    { freq: 659.25, at: 1.42, dur: 1.2, vol: 0.07, type: T },
  ];
  const oscillators = notes.map((note) => scheduleNote(context, soft, note));
  stopVictory = () => {
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.12);
    oscillators.forEach((oscillator) => {
      try {
        oscillator.stop(now + 0.15);
      } catch {
        // już zatrzymany
      }
    });
  };
}

// --- Panel rodzica -------------------------------------------------------------

/** Odtwarza dokładnie ten plik, bez planu awaryjnego — do przesłuchiwania nagrań. */
export async function playClipFile(path: string): Promise<boolean> {
  sequenceToken += 1;
  if (!(await clipExists(path))) return false;
  return (await playUrl(path, false)) === "ok";
}

/** Wynik sprawdzenia nagrań; `unknown` = nie da się sprawdzić (brak internetu). */
export type ClipAudit = { found: string[]; missing: string[]; unknown: string[] };

/** Tyle zapytań naraz — ponad tysiąc równoległych zatkałoby słabe łącze. */
const AUDIT_BATCH = 24;

/**
 * Które pliki są na miejscu. Osobne zapytania (bez pamięci clipState), żeby
 * wynik był aktualny, i partiami. Brak odpowiedzi to nie „brakuje": liczymy
 * go osobno, a gdy nie odpowiada cała partia (brak internetu), resztę od razu
 * oznaczamy jako niesprawdzoną, zamiast czekać na limit czasu przy każdej.
 */
export async function auditClips(paths: string[]): Promise<ClipAudit> {
  const result: ClipAudit = { found: [], missing: [], unknown: [] };
  for (let start = 0; start < paths.length; start += AUDIT_BATCH) {
    const batch = paths.slice(start, start + AUDIT_BATCH);
    const states = await Promise.all(batch.map(probeClip));
    batch.forEach((path, index) => {
      const state = states[index];
      (state === "yes" ? result.found : state === "no" ? result.missing : result.unknown).push(path);
    });
    if (states.every((state) => state === "unknown")) {
      result.unknown.push(...paths.slice(start + AUDIT_BATCH));
      break;
    }
  }
  return result;
}
