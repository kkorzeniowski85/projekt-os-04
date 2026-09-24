"use client";

/**
 * Automatyczna synchronizacja postępu między urządzeniami.
 *
 * ZASADA DZIAŁANIA: wspólna "skrzynka" — jeden dokument JSON pod losowym,
 * niezgadywalnym adresem. Każde urządzenie po zmianie wysyła tam SCALONY stan
 * (pobierz → scal → wyślij), a przy każdym otwarciu i co kilka minut pobiera
 * i scala u siebie. Scalanie to unia sesji i prób po `id`, a fakty tabliczki
 * scala się po próbach (lib/progress/merge.ts) — jest przemienne i
 * idempotentne, więc kolejność i powtórzenia nie szkodzą, a stany zbiegają się
 * same. (Przy przyciętym dzienniku prób fakty tabliczki są przybliżeniem —
 * liczniki nie odtworzą historii, która wypadła z dzienników wszystkich
 * stron, a pudełko liczymy od nowa tylko od ostatniego błędu, który leży w
 * obu dziennikach; patrz mergeFact.)
 *
 * ADRES SKRZYNKI WYMYŚLAMY SAMI — to najważniejsza decyzja w tym pliku i
 * wynik bolesnej lekcji z poprzedniej wersji, która kazała usłudze utworzyć
 * skrzynkę i oddać jej adres w nagłówku odpowiedzi. Tamto podejście miało trzy
 * wady, których tu już nie ma:
 *
 *  1. Włączenie synchronizacji było zapytaniem sieciowym, więc mogło się nie
 *     udać — a wtedy rodzic zostawał z komunikatem o błędzie i bez linku.
 *     Teraz włączenie to wylosowanie kodu lokalnie: nie ma czego zepsuć.
 *  2. Adres przychodził w nagłówku `Location`, który potrafią wyciąć antywirusy
 *     i firmowe proxy podsłuchujące HTTPS. Skrzynka powstawała, ale aplikacja
 *     nigdy nie poznawała jej adresu.
 *  3. Skasowanie skrzynki po stronie usługi (poprzednia usługa robiła to po
 *     24 godzinach!) na zawsze unieważniało adres i wymuszało parowanie od
 *     nowa. Teraz adres jest nasz: kolejny zapis po prostu odtwarza skrzynkę
 *     w tym samym miejscu, a urządzenia dalej się rozumieją.
 *
 * ŹRÓDŁEM PRAWDY pozostaje urządzenie (localStorage). Skrzynka to wyłącznie
 * transport — jej utrata nie gubi ani jednej sesji.
 *
 * PAROWANIE: link z kodem w części #sync=... — kliknięcie go na drugim
 * urządzeniu podłącza je na stałe.
 *
 * AKADEMIA: kod skopiowany z Ligi Dźwięków (KONWENCJE: kopia, nie wspólny
 * kod). Różnice: własny przedrostek skrzynek i kluczy oraz przejmowanie kodu
 * rodziny z Ligi na tym samym urządzeniu (adoptFromLiga).
 *
 * PRYWATNOŚĆ: w skrzynce lądują statystyki nauki i imię wpisane w ustawieniach.
 * Adres jest losowy (120 bitów), ale to usługa zewnętrzna i kto zna adres, ten
 * czyta i pisze — więc nie trzymamy tam niczego wrażliwego.
 */

import { mergeProgress, parseProgressFile, progressVersionOf } from "./merge";
import { PROGRESS_SCHEMA_VERSION } from "./types";
import type { ProgressState } from "./types";

const ENDPOINT = "https://textdb.dev/api/data";
/** Własna przestrzeń w usłudze — skrzynki Ligi mają przedrostek „liga-dzwiekow-". */
const KEY_PREFIX = "akademia-ligi-";
const STORAGE_KEY = "school.sync.v1";
/**
 * Kod rodziny Ligi Dźwięków. Obie aplikacje stoją na tej samej domenie, więc
 * Akademia go WIDZI — i może z niego skorzystać, zamiast kazać rodzicowi
 * parować urządzenia drugi raz. Tylko czytamy; klucza Ligi nigdy nie ruszamy.
 */
const LIGA_SYNC_KEY = "phonics.sync.v2";
/** Usługa odrzuca ładunki powyżej ~1 MB; zostawiamy zapas na koperty. */
const LIMIT_BAJTOW = 800_000;

export type SyncError = "brak-sieci" | "usluga-odmowila" | "za-duzo-danych" | "nowsza-wersja";

export type SyncStatus = {
  enabled: boolean;
  code: string | null;
  lastOkTs: number | null;
  lastError: SyncError | null;
  /** Szczegół techniczny do panelu rodzica — bez niego diagnoza to zgadywanie. */
  lastErrorDetail: string | null;
  syncing: boolean;
  /** Kod przejęty automatycznie z Ligi Dźwięków na tym urządzeniu. */
  fromLiga: boolean;
  /** Rodzic wyłączył synchronizację ręcznie — Akademia nie włączy się sama. */
  optedOut: boolean;
  /**
   * Kiedy kod rodziny zmienił się na tym urządzeniu za Ligą albo po „Użyj
   * kodu z Ligi" (null = nie zmienił się). Urządzenia podłączone wcześniej
   * kodem z Akademii zostały na starym kodzie — panel o tym przypomina, dopóki
   * rodzic nie potwierdzi.
   */
  codeChangedTs: number | null;
  /**
   * Ile sesji tego urządzenia zachowano przy dołączeniu do rodziny, która
   * wcześniej wyczyściła postęp (patrz pendingJoin) — do informacji w panelu.
   */
  keptOnJoin: { sessions: number; resetTs: number } | null;
};

let status: SyncStatus = {
  enabled: false,
  code: null,
  lastOkTs: null,
  lastError: null,
  lastErrorDetail: null,
  syncing: false,
  fromLiga: false,
  optedOut: false,
  codeChangedTs: null,
  keptOnJoin: null,
};

const listeners = new Set<(s: SyncStatus) => void>();

function emit(zmiany: Partial<SyncStatus>) {
  status = { ...status, ...zmiany };
  listeners.forEach((cb) => cb(status));
}

export function subscribeSync(cb: (s: SyncStatus) => void): () => void {
  listeners.add(cb);
  cb(status);
  return () => listeners.delete(cb);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

// --- kod rodziny -----------------------------------------------------------

/**
 * 24 znaki z 32-elementowego alfabetu = 120 bitów losowości. Alfabet jest
 * potęgą dwójki (maska &31), więc znaki są równie prawdopodobne — bez tego
 * reszta z dzielenia faworyzowałaby początek alfabetu. Nie ma "l", "o", "0"
 * ani "1", bo kod bywa przepisywany ręcznie z ekranu na ekran.
 */
const ALFABET = "abcdefghijkmnpqrstuvwxyz23456789";

function newCode(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABET[b & 31]).join("");
}

type SavedSync = { code?: string | null; fromLiga?: boolean; optOut?: boolean; codeChangedTs?: number };

export function loadSyncCode(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedSync;
    const code = saved.code ?? null;
    emit({
      enabled: Boolean(code),
      code,
      fromLiga: Boolean(saved.fromLiga),
      optedOut: !code && Boolean(saved.optOut),
      codeChangedTs: code && typeof saved.codeChangedTs === "number" ? saved.codeChangedTs : null,
    });
    return code;
  } catch {
    return null;
  }
}

function saveSyncCode(code: string | null, fromLiga = false, codeChangedTs: number | null = null): void {
  try {
    if (code) {
      const saved: SavedSync = { code, fromLiga };
      if (codeChangedTs) saved.codeChangedTs = codeChangedTs;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }
    // Wyłączenie zapamiętujemy jawnie — inaczej przejęcie kodu z Ligi przy
    // następnym starcie włączałoby synchronizację wbrew decyzji rodzica.
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: null, optOut: true }));
  } catch {
    // brak localStorage — synchronizacja i tak nie ma sensu
  }
  emit({
    enabled: Boolean(code),
    code,
    fromLiga,
    optedOut: !code,
    codeChangedTs: code ? codeChangedTs : null,
    lastError: null,
    lastErrorDetail: null,
    keptOnJoin: code === status.code ? status.keptOnJoin : null,
  });
}

/** Rodzic podłączył pozostałe urządzenia na nowo — przypomnienie znika. */
export function dismissCodeChange(): void {
  if (status.code) saveSyncCode(status.code, status.fromLiga);
}

function isOptedOut(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Boolean((JSON.parse(raw) as { optOut?: boolean }).optOut) : false;
  } catch {
    return false;
  }
}

/** Kod rodziny Ligi Dźwięków na tym urządzeniu (tylko odczyt). */
export function ligaSyncCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LIGA_SYNC_KEY);
    return raw ? ((JSON.parse(raw) as { code?: string }).code ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Przejęcie kodu rodziny z Ligi Dźwięków. Skutek: urządzenie, na którym Liga
 * jest sparowana, synchronizuje też Akademię — bez QR, bez przepisywania.
 * Skrzynki są osobne (inny przedrostek), wspólny jest tylko kod rodziny.
 *
 * Kod przejęty z Ligi idzie za Ligą: gdy rodzic zmieni tam obieg (nowy kod,
 * link, krótki kod), Akademia przechodzi razem z nią — inaczej urządzenia po
 * cichu rozjechałyby się na dwie skrzynki. Kodu ustawionego w Akademii ręcznie
 * i jawnego wyłączenia nie ruszamy.
 *
 * Wołane przed każdym obiegiem i po zmianie klucza Ligi w innej karcie
 * (store.tsx), nie tylko przy starcie — otwarta karta też idzie za Ligą.
 * Urządzenia podłączone kodem z Akademii (QR, krótki kod) nie widzą Ligi tego
 * urządzenia i zostają na starym kodzie: stąd przypomnienie (codeChangedTs).
 */
export function adoptFromLiga(): boolean {
  if (typeof window === "undefined") return false;
  const liga = ligaSyncCode();
  if (!liga) return false;
  const own = loadSyncCode();
  if (own === liga) return false;
  if (own && !status.fromLiga) return false;
  if (!own && isOptedOut()) return false;
  saveSyncCode(liga, true, own ? Date.now() : null);
  noteJoin(liga);
  return true;
}

/**
 * Akademia ma własny kod, a Liga na tym urządzeniu inny: urządzenia mogą być
 * w dwóch osobnych obiegach. Panel rodzica pokazuje wtedy ostrzeżenie.
 */
export function ligaCodeMismatch(): boolean {
  if (!status.code || status.fromLiga) return false;
  const liga = ligaSyncCode();
  return Boolean(liga) && liga !== status.code;
}

/** Przejście na kod rodziny z Ligi (decyzja rodzica po ostrzeżeniu). */
export function switchToLigaCode(): boolean {
  const liga = ligaSyncCode();
  if (!liga) return false;
  const own = status.code;
  saveSyncCode(liga, true, own && own !== liga ? Date.now() : null);
  noteJoin(liga);
  return true;
}

/**
 * Włączenie synchronizacji. Gdy na urządzeniu jest sparowana Liga, bierzemy
 * jej kod rodziny (jeden obieg dla obu aplikacji); inaczej losujemy nowy i od
 * razu go zapisujemy. Celowo NIE czekamy na sieć — link parowania ma się
 * pojawić natychmiast, a pierwsza wysyłka pojedzie w tle.
 */
export function enableSync(): string {
  const liga = ligaSyncCode();
  const code = liga ?? newCode();
  saveSyncCode(code, Boolean(liga));
  noteJoin(code);
  return code;
}

export function disableSync(): void {
  saveSyncCode(null);
  noteJoin(null);
}

/**
 * Przejęcie kodu z linku parowania (#sync=...). Wywoływane raz przy starcie.
 * Zwraca true, gdy urządzenie właśnie zostało sparowane.
 */
export function adoptFromHash(): boolean {
  if (typeof window === "undefined") return false;
  const match = window.location.hash.match(/[#&]sync=([a-zA-Z0-9-]{16,})/);
  if (!match) return false;
  saveSyncCode(match[1]);
  noteJoin(match[1]);
  // Sprzątamy adres, żeby kod nie wisiał w pasku i historii.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

export function pairingLink(): string | null {
  if (!status.code || typeof window === "undefined") return null;
  const base = window.location.pathname.replace(/rodzic\/?$/, "");
  return `${window.location.origin}${base}#sync=${status.code}`;
}

// --- do której rodziny należy reset ----------------------------------------

/**
 * Kod rodziny, w której zapadły znaczniki resetu i przywrócenia zapisane w
 * postępie tego urządzenia (null = zapadły bez synchronizacji). Ten sam
 * mechanizm co w Lidze Dźwięków (phonics.sync.markers.v1).
 *
 * Bez tego „Wyczyść postęp" na nowym tablecie (np. po próbnych sesjach, przy
 * wyłączonej synchronizacji) po podłączeniu — także samoczynnym, za Ligą —
 * stawał się resetem CAŁEJ rodziny: scalanie bierze najnowszy reset z obu
 * stron, więc skasowałoby historię pozostałych urządzeń i skrzynki. Store
 * przed obiegiem porównuje ten kod z bieżącym i przy różnicy zdejmuje
 * znaczniki (runSync) — sesji sprzed lokalnego resetu i tak już tu nie ma,
 * więc nic nie wraca.
 *
 * Osobny klucz, a nie pole postępu: postęp trafia do plików kopii, a kod
 * rodziny to klucz do skrzynki i nie powinien leżeć na Dysku.
 */
const MARKERS_KEY = "school.sync.markers.v1";

export function markersFamily(): string | null {
  try {
    const raw = localStorage.getItem(MARKERS_KEY);
    return raw ? ((JSON.parse(raw) as { code?: string | null }).code ?? null) : null;
  } catch {
    return null;
  }
}

export function setMarkersFamily(code: string | null): void {
  try {
    localStorage.setItem(MARKERS_KEY, JSON.stringify({ code }));
  } catch {
    // brak localStorage — synchronizacja i tak nie działa
  }
}

// --- dołączenie do rodziny ---------------------------------------------------

/**
 * Kod rodziny, do której to urządzenie właśnie dołączyło (QR, krótki kod,
 * włączenie synchronizacji, kod przejęty z Ligi), a jeszcze nie scaliło się z
 * jej skrzynką.
 *
 * Odwrotność markersFamily: reset zrobiony w rodzinie, ZANIM urządzenie do
 * niej dołączyło, nie dotyczy jego historii. Bez tego telefon z historią,
 * podłączony do tabletu, na którym ktoś wcześniej wyczyścił próbne sesje, po
 * cichu tracił wszystkie sesje sprzed tamtego resetu. Store przy pierwszym
 * scaleniu zachowuje je przywróceniem (runSync), a panel mówi o tym rodzicowi.
 *
 * Zapisujemy to W CHWILI zmiany kodu, a nie wnioskujemy z braku
 * markersFamily: urządzenie tuż po aktualizacji aplikacji też nie ma tego
 * klucza, a reset jego własnej rodziny ma je objąć. Z tego samego powodu
 * ponowne podłączenie do rodziny, w której urządzenie już było, to nie
 * dołączenie.
 */
const JOIN_KEY = "school.sync.joining.v1";

function noteJoin(code: string | null): void {
  try {
    if (code && markersFamily() !== code) localStorage.setItem(JOIN_KEY, JSON.stringify({ code }));
    else localStorage.removeItem(JOIN_KEY);
  } catch {
    // brak localStorage — synchronizacja i tak nie działa
  }
}

export function pendingJoin(): string | null {
  try {
    const raw = localStorage.getItem(JOIN_KEY);
    return raw ? ((JSON.parse(raw) as { code?: string | null }).code ?? null) : null;
  } catch {
    return null;
  }
}

/** Dołączenie do `code` załatwione — pierwsze scalenie ze skrzynką się odbyło. */
export function finishJoin(code: string, kept: SyncStatus["keptOnJoin"]): void {
  try {
    if (pendingJoin() === code) localStorage.removeItem(JOIN_KEY);
  } catch {
    // brak localStorage — synchronizacja i tak nie działa
  }
  if (kept) emit({ keptOnJoin: kept });
}

// --- krótki kod do przepisania ---------------------------------------------

/**
 * Kod QR nie pomoże urządzeniu bez aparatu (typowy pecet), a długiego kodu
 * rodziny nikt nie przepisze z ekranu. Dlatego obok QR generujemy 6-znakowy
 * kod, który jest tylko PRZEKAZKĄ: leży w osobnej szufladzie skrzynki i
 * zawiera właściwy kod rodziny. Wpisuje się go raz, na drugim urządzeniu.
 *
 * Alfabet bez I, O, 0 i 1 — te znaki mylą się przy przepisywaniu z ekranu.
 */
const KOD_ALFABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Jak długo przekazka jest ważna. Pod 6 znakami leży pełny kod rodziny, a więc
 * dostęp do skrzynki z imieniem i statystykami — nie może tam leżeć
 * bezterminowo. Godzina wystarczy, żeby przepisać kod z ekranu na ekran.
 *
 * Godzinę pilnuje urządzenie, które kod pokazało (panel chowa go i czyści
 * szufladę — expireShortCode). Urządzenie, które kod wpisuje, porównuje czas
 * przekazki z WŁASNYM zegarem, a ten bywa przesunięty o całą strefę (komputer
 * z dwoma systemami: zegar sprzętowy w czasie lokalnym) — więc odrzuca
 * dopiero przekazki starsze o ponad dobę (KOD_ZEGARY_MS). Inaczej komputer ze
 * zegarem +1 h nigdy by się nie podłączył, a każdy wpisany kod by przepadał.
 */
export const KOD_WAZNOSC_MS = 60 * 60 * 1000;
const KOD_ZEGARY_MS = 24 * 60 * 60 * 1000;

function szufladaKodu(short: string): string {
  return mailboxUrl(`para-${short}`);
}

export function normalizeShortCode(wpisane: string): string {
  return wpisane.trim().toUpperCase().replace(/[^A-Z2-9]/g, "");
}

/** Zwraca 6-znakowy kod do przepisania albo null, gdy nie udało się go zapisać. */
export async function createShortCode(): Promise<string | null> {
  // Kod rodziny z chwili kliknięcia — zmiana w tle (za Ligą) nie może podmienić
  // przekazki w połowie; panel i tak pokazuje krótki kod tylko dla tego kodu.
  const code = status.code;
  if (!code) return null;

  for (let proba = 0; proba < 3; proba++) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const short = Array.from(bytes, (b) => KOD_ALFABET[b & 31]).join("");

    // Trafienie w kod używany właśnie przez kogoś innego jest skrajnie mało
    // prawdopodobne (ponad miliard kombinacji), ale nadpisanie cudzej przekazki
    // odcięłoby komuś parowanie — więc sprawdzamy, czy szuflada jest wolna.
    const zajete = await readMailbox(szufladaKodu(short));
    if (!zajete.ok) return null;
    if (zajete.dane.trim()) continue;

    const zapis = await writeMailbox(
      szufladaKodu(short),
      JSON.stringify({ code, ts: Date.now() }),
    );
    if (zapis.ok) return short;
  }
  return null;
}

/**
 * Przekazka krótkiego kodu z Ligi Dźwięków. Kod rodziny jest wspólny, więc
 * krótki kod pokazany w Lidze podłącza też Akademię — rodzic nie musi
 * pamiętać, w której aplikacji go wygenerował.
 */
function szufladaKoduLigi(short: string): string {
  return `${ENDPOINT}/liga-dzwiekow-${encodeURIComponent(`para-${short}`)}`;
}

export type ShortCodeResult = "ok" | "expired" | "not-found";

/**
 * Koniec ważności krótkiego kodu po stronie urządzenia, które go pokazało
 * (minęła godzina albo rodzic wziął nowy kod): pusta szuflada = kodu nie ma.
 * Nieudane czyszczenie nie szkodzi — urządzenie wpisujące i tak odrzuci
 * przekazkę sprzed ponad doby.
 */
export async function expireShortCode(short: string): Promise<void> {
  await writeMailbox(szufladaKodu(normalizeShortCode(short)), "");
}

/**
 * Podłączenie tego urządzenia kodem przepisanym z drugiego ekranu. Przekazka
 * jest jednorazowa: po udanym przejęciu czyścimy WŁASNĄ szufladę (szuflad
 * Ligi nie ruszamy — to jej dane). Przekazek starszych niż godzina plus
 * zapas na zegary (KOD_ZEGARY_MS) nie przyjmujemy.
 */
export async function adoptShortCode(wpisane: string, now = Date.now()): Promise<ShortCodeResult> {
  const short = normalizeShortCode(wpisane);
  if (short.length !== 6) return "not-found";

  let wlasna = true;
  let odczyt = await readMailbox(szufladaKodu(short));
  if (odczyt.ok && !odczyt.dane.trim()) {
    wlasna = false;
    odczyt = await readMailbox(szufladaKoduLigi(short));
  }
  if (!odczyt.ok || !odczyt.dane.trim()) return "not-found";

  let dane: { code?: unknown; ts?: unknown };
  try {
    dane = JSON.parse(odczyt.dane) as { code?: unknown; ts?: unknown };
  } catch {
    return "not-found";
  }
  if (typeof dane?.code !== "string" || !dane.code) return "not-found";
  const wazna = typeof dane.ts === "number" && now - dane.ts <= KOD_WAZNOSC_MS + KOD_ZEGARY_MS;
  if (wazna) {
    saveSyncCode(dane.code);
    noteJoin(dane.code);
  }
  // Nieudane czyszczenie nie psuje parowania — przekazka i tak wygaśnie.
  if (wlasna) await writeMailbox(szufladaKodu(short), "");
  return wazna ? "ok" : "expired";
}

// --- rozmowa ze skrzynką ---------------------------------------------------

export async function timeoutFetch(
  url: string,
  init: RequestInit = {},
  ms = 20000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Adres skrzynki rodziny. `sufiks` pozwala trzymać obok siebie kilka szuflad
 * pod jednym kodem — postęp leży w gołym adresie, a nagrania w osobnych
 * (każde nagranie we własnym, bo razem nie zmieściłyby się w limicie).
 */
export function mailboxUrl(code: string, sufiks = ""): string {
  return `${ENDPOINT}/${KEY_PREFIX}${encodeURIComponent(code + sufiks)}`;
}

function adres(code: string): string {
  return mailboxUrl(code);
}

export type Wynik<T> =
  | { ok: true; dane: T }
  | { ok: false; rodzaj: SyncError; opis: string };

/**
 * Surowa treść ze skrzynki. Pusty łańcuch = skrzynka jeszcze nieużywana —
 * to normalny stan, nie błąd.
 */
export async function readMailbox(url: string): Promise<Wynik<string>> {
  let response: Response;
  try {
    response = await timeoutFetch(url);
  } catch (blad) {
    return { ok: false, rodzaj: "brak-sieci", opis: opisWyjatku(blad) };
  }
  if (!response.ok) {
    return { ok: false, rodzaj: "usluga-odmowila", opis: `odczyt HTTP ${response.status}` };
  }

  const text = (await response.text()).trim();
  if (!text) return { ok: true, dane: "" };

  // Usługa oddaje treść w kopercie {"value":"<nasza treść>"}; gdyby kiedyś
  // zaczęła oddawać samą treść, druga gałąź to obsłuży.
  try {
    const koperta = JSON.parse(text) as { value?: unknown };
    if (typeof koperta?.value === "string") return { ok: true, dane: koperta.value };
  } catch {
    // nie koperta — bierzemy tekst jak leci
  }
  return { ok: true, dane: text };
}

export async function writeMailbox(url: string, tresc: string): Promise<Wynik<true>> {
  try {
    const response = await timeoutFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: tresc }),
    });
    if (!response.ok) {
      return { ok: false, rodzaj: "usluga-odmowila", opis: `zapis HTTP ${response.status}` };
    }
    return { ok: true, dane: true };
  } catch (blad) {
    return { ok: false, rodzaj: "brak-sieci", opis: opisWyjatku(blad) };
  }
}

/** `null` w danych = skrzynka jeszcze pusta (nikt nic nie wysłał). To nie błąd. */
async function pobierz(code: string): Promise<Wynik<ProgressState | null>> {
  const surowy = await readMailbox(adres(code));
  if (!surowy.ok) return surowy;
  if (!surowy.dane.trim()) return { ok: true, dane: null };
  const stan = parseProgressFile(surowy.dane);
  if (!stan) {
    // Stan z NOWSZEJ wersji aplikacji (inne urządzenie już się zaktualizowało):
    // nie wolno go nadpisać starszym — to byłaby cicha utrata danych.
    const wersja = progressVersionOf(surowy.dane);
    if (wersja !== null && wersja > PROGRESS_SCHEMA_VERSION) {
      return { ok: false, rodzaj: "nowsza-wersja", opis: `skrzynka w wersji ${wersja}` };
    }
  }
  return { ok: true, dane: stan };
}

/**
 * Ładunek do wysyłki. Gdy stan urośnie ponad limit usługi, przycinamy DZIENNIK
 * PRÓB (od najstarszych). Sesje, z których odtwarza się stan tematów, i stan
 * faktów tabliczki zostają nietknięte, a każde urządzenie ma swoje próby u
 * siebie. Przycięcie nie jest jednak całkiem darmowe: scalanie faktów
 * rozpoznaje rozbieżności po próbach (merge.ts: mergeFact), więc przy krótkim
 * dzienniku w skrzynce częściej wychodzi przybliżenie zamiast dokładnego
 * odtworzenia. Nic się przy tym nie liczy podwójnie ani nie maleje.
 */
function doWyslania(state: ProgressState): Wynik<string> {
  let tresc = JSON.stringify(state);
  // Zostawiamy tyle najnowszych prób, ile się zmieści (a nie sztywne 200) —
  // im dłuższy dziennik w skrzynce, tym częściej scalanie faktów jest dokładne.
  let zostaw = state.attempts.length;
  while (tresc.length > LIMIT_BAJTOW && zostaw > 0) {
    zostaw = zostaw > 200 ? Math.floor(zostaw * 0.8) : 0;
    tresc = JSON.stringify({ ...state, attempts: zostaw > 0 ? state.attempts.slice(-zostaw) : [] });
  }
  if (tresc.length > LIMIT_BAJTOW) {
    return {
      ok: false,
      rodzaj: "za-duzo-danych",
      opis: `${Math.round(tresc.length / 1024)} kB po przycięciu`,
    };
  }
  return { ok: true, dane: tresc };
}

async function wyslij(code: string, state: ProgressState): Promise<Wynik<true>> {
  const ladunek = doWyslania(state);
  if (!ladunek.ok) return ladunek;

  try {
    const response = await timeoutFetch(adres(code), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: ladunek.dane }),
    });
    if (!response.ok) {
      return { ok: false, rodzaj: "usluga-odmowila", opis: `zapis HTTP ${response.status}` };
    }
    return { ok: true, dane: true };
  } catch (blad) {
    return { ok: false, rodzaj: "brak-sieci", opis: opisWyjatku(blad) };
  }
}

function opisWyjatku(blad: unknown): string {
  if (blad instanceof DOMException && blad.name === "AbortError") return "przekroczony czas (20 s)";
  if (blad instanceof Error) return blad.message;
  return String(blad);
}

// --- silnik ----------------------------------------------------------------

/**
 * Czy mamy coś, czego skrzynka jeszcze nie widziała?
 *
 * Celowo patrzymy tylko na sesje, imię i znaczniki resetu/przywrócenia, a NIE
 * na dziennik prób. Próby i tak zawsze przyjeżdżają razem z sesją (zapisuje je
 * ten sam commit), więc nic nam nie umyka — a gdybyśmy je tu liczyli,
 * przycięcie dziennika przy limicie rozmiaru zapętliłoby wysyłkę: skrzynka
 * miałaby na stałe mniej prób niż my, więc każdy obieg uznawałby, że trzeba
 * wysłać jeszcze raz. Sesja dokończona po wcześniejszym zapisie (to samo `id`,
 * późniejszy koniec) też jest nowością.
 */
function mamyWiecej(merged: ProgressState, zdalny: ProgressState): boolean {
  const znane = new Map(zdalny.sessions.map((s) => [s.id, s]));
  return (
    merged.sessions.some((s) => {
      const tam = znane.get(s.id);
      return !tam || tam.endedTs !== s.endedTs || tam.scored !== s.scored;
    }) ||
    merged.childName !== zdalny.childName ||
    (merged.childNameTs ?? 0) !== (zdalny.childNameTs ?? 0) ||
    (merged.resetTs ?? 0) > (zdalny.resetTs ?? 0) ||
    (merged.restoreTs ?? 0) > (zdalny.restoreTs ?? 0)
  );
}

/**
 * Pełny obieg: pobierz → scal → (jeśli mamy coś nowego) wyślij.
 * `applyMerged` oddaje scalony stan do magazynu aplikacji — wołający decyduje,
 * czy faktycznie coś się zmieniło i czy zapisać.
 *
 * `prepareLocal` (opcjonalne) dostaje pobraną skrzynkę PRZED scaleniem i
 * zwraca stan lokalny do scalenia — store korzysta z tego przy dołączaniu do
 * rodziny (patrz pendingJoin).
 *
 * Bez blokad i wersjonowania: gdy dwa urządzenia zapiszą naraz, jedno nadpisze
 * drugie. Nic nie ginie, bo każde ma swój postęp u siebie i przy następnym
 * obiegu (po sesji albo co 3 minuty) zobaczy brak i dośle go ponownie.
 */
export async function syncNow(
  localState: ProgressState,
  applyMerged: (merged: ProgressState) => void,
  prepareLocal?: (remote: ProgressState) => ProgressState,
): Promise<void> {
  const code = status.code ?? loadSyncCode();
  if (!code || status.syncing) return;
  emit({ syncing: true });

  try {
    const zdalne = await pobierz(code);
    if (!zdalne.ok) {
      emit({ lastError: zdalne.rodzaj, lastErrorDetail: zdalne.opis });
      return;
    }

    const local = zdalne.dane && prepareLocal ? prepareLocal(zdalne.dane) : localState;
    const merged = zdalne.dane ? mergeProgress(local, zdalne.dane) : local;
    applyMerged(merged);

    if (zdalne.dane && !mamyWiecej(merged, zdalne.dane)) {
      emit({ lastOkTs: Date.now(), lastError: null, lastErrorDetail: null });
      return;
    }

    const wyslany = await wyslij(code, merged);
    if (wyslany.ok) emit({ lastOkTs: Date.now(), lastError: null, lastErrorDetail: null });
    else emit({ lastError: wyslany.rodzaj, lastErrorDetail: wyslany.opis });
  } finally {
    emit({ syncing: false });
  }
}
