"use client";

/**
 * Jeden ekran ćwiczenia — wszystkie rodzaje zadań Akademii.
 *
 * Zasady z Ligi Dźwięków (sprawdzone z dzieckiem, patrz historia repozytorium):
 *  - liczy się PIERWSZA odpowiedź; kolejne kliknięcia nic nie zmieniają —
 *    także po cofnięciu (↩) i powrocie: ekran wraca w stanie z pierwszej próby;
 *  - po błędzie dziecko nie przeczekuje — samo wskazuje / wpisuje poprawną
 *    odpowiedź (bramka naprawy), a dopiero potem idzie dalej;
 *  - wyjaśnienie nigdy nie znika samo: ekran czeka na „Dalej" po błędzie i po
 *    trafieniu, jeśli jest co przeczytać (uwaga rodzica z testów Ligi);
 *  - bez wyjaśnienia po trafieniu tempo zostaje — przejście samo;
 *  - okno „Przerwać ćwiczenie?" wstrzymuje ekran pod spodem: klawiatura nie
 *    odpowiada, nic nie przechodzi dalej, czas odpowiedzi stoi.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerBox, NumberPad } from "@/components/NumberPad";
import { BigButton, Card, ParentTip, Speaker } from "@/components/ui";
import {
  playFastDing,
  playFeedbackTone,
  playSequence,
  playSound,
  playText,
  stopAudio,
} from "@/lib/audio";
import type { PendingAttempt } from "@/lib/progress/store";
import type { SessionMode } from "@/lib/progress/types";
import {
  normalizeWord,
  shuffle,
  type ChoiceOption,
  type Exercise,
  type MarkStyle,
} from "@/lib/session/exercise";
import { VisualView } from "./VisualView";

type Common = {
  mode: SessionMode;
  onAnswer: (attempt: PendingAttempt) => void;
  onNext: () => void;
  /** Otwarte okno przerwania: ekran stoi. */
  paused: boolean;
  /** Pierwsza próba z tego ekranu, gdy dziecko wraca na niego po ↩. */
  firstAttempt?: PendingAttempt;
};

type Props<K extends Exercise["kind"]> = Common & { exercise: Extract<Exercise, { kind: K }> };

export function ExerciseScreen({
  exercise,
  mode,
  onAnswer,
  onNext,
  paused = false,
  firstAttempt,
}: {
  exercise: Exercise;
  mode: SessionMode;
  onAnswer: (attempt: PendingAttempt) => void;
  onNext: () => void;
  paused?: boolean;
  firstAttempt?: PendingAttempt;
}) {
  // „Dalej" najwyżej raz na ekran: klik, Enter i automatyczne przejście mogą
  // się zbiec w czasie, a każde dodatkowe wywołanie przeskakiwało ekran.
  const firedRef = useRef(false);
  const next = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onNext();
  }, [onNext]);
  const common: Common = { mode, onAnswer, onNext: next, paused, firstAttempt };

  switch (exercise.kind) {
    case "learn":
      return <LearnExercise exercise={exercise} {...common} />;
    case "choice":
      return <ChoiceExercise exercise={exercise} {...common} />;
    case "typed":
      return <TypedExercise exercise={exercise} {...common} />;
    case "order":
      return <OrderExercise exercise={exercise} {...common} />;
    case "tapword":
      return <TapWordExercise exercise={exercise} {...common} />;
    case "act":
      return <ActExercise exercise={exercise} {...common} />;
    case "passage":
      return <PassageExercise exercise={exercise} {...common} />;
  }
}

// --- Klocki wspólne ------------------------------------------------------------

/** Gra dźwięk pytania na starcie; gdy przeglądarka zablokuje — prosi o stuknięcie. */
function useAutoSound(exercise: Exercise, enabled = true): [boolean, () => void] {
  const [needsTap, setNeedsTap] = useState(false);
  useEffect(() => {
    if (!exercise.sound || !enabled) return;
    let cancelled = false;
    void playSound(exercise.sound).then((result) => {
      if (!cancelled) setNeedsTap(result.source === "unavailable");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise]);
  return [needsTap, () => setNeedsTap(false)];
}

/**
 * Początek odliczania czasu odpowiedzi. Czas z otwartym oknem przerwania się
 * nie liczy — inaczej zawyżałby responseMs i odbierał fakt płynności.
 */
function useAnswerClock(paused: boolean) {
  const startRef = useRef(Date.now());
  const pausedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (paused) {
      pausedAtRef.current = Date.now();
    } else if (pausedAtRef.current !== null) {
      startRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
  }, [paused]);
  return startRef;
}

function PromptBlock({
  exercise,
  needsTap,
  clearTap,
}: {
  exercise: Exercise;
  needsTap: boolean;
  clearTap: () => void;
}) {
  const [showPl, setShowPl] = useState(false);
  const replay = () => {
    clearTap();
    if (exercise.sound) void playSound(exercise.sound);
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {exercise.heading && <p className="text-sm font-bold text-paper/60">{exercise.heading}</p>}

      {exercise.listenOnly && exercise.sound && (
        <div className={needsTap ? "animate-pulse-ring rounded-blob" : undefined}>
          <Speaker onPlay={replay} label="Posłuchaj" size="lg" />
        </div>
      )}

      {exercise.visual && exercise.visual.kind !== "passage" && <VisualView visual={exercise.visual} />}

      {exercise.promptEn && !exercise.listenOnly && (
        <div className="flex max-w-2xl items-start gap-3">
          {exercise.sound && (
            <div className={needsTap ? "animate-pulse-ring rounded-full" : undefined}>
              <Speaker size="sm" onPlay={replay} ariaLabel="Posłuchaj pytania" />
            </div>
          )}
          <p className="font-reading pt-0.5 text-left text-2xl font-bold leading-snug sm:text-3xl">
            {exercise.promptEn}
          </p>
        </div>
      )}

      {needsTap && <p className="text-sm font-bold text-hero-gold">Stuknij 🔊, żeby posłuchać</p>}

      {exercise.promptPl && (
        <button
          type="button"
          onClick={() => setShowPl((value) => !value)}
          className="rounded-full bg-white/10 px-3 py-1 text-xs text-paper/70"
          aria-expanded={showPl}
        >
          {showPl ? exercise.promptPl : "🇵🇱 po polsku"}
        </button>
      )}
    </div>
  );
}

/**
 * Tekst czytanki POD odpowiedziami i przyciskiem „Dalej": nad nimi spychał
 * odpowiedzi poza ekran tabletu. Zaglądanie do tekstu zostaje na wyciągnięcie
 * ręki, ale najpierw widać pytanie i opcje.
 */
export function PassageBelow({ exercise }: { exercise: Exercise }) {
  return exercise.visual?.kind === "passage" ? <VisualView visual={exercise.visual} /> : null;
}

/**
 * „Dalej" — działa też Enterem, bo przy tabliczce ręka jest na klawiaturze.
 * Nasłuch rusza po 250 ms (Enter, który zatwierdził odpowiedź, już się
 * odbył) i ignoruje autopowtarzanie przytrzymanego klawisza — inaczej
 * przytrzymany Enter przeskakiwał wyjaśnienie po błędzie.
 */
function NextButton({
  onNext,
  paused,
  label = "Dalej ▸",
}: {
  onNext: () => void;
  paused: boolean;
  label?: string;
}) {
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;
  useEffect(() => {
    if (paused) return;
    let armed = false;
    const timer = setTimeout(() => {
      armed = true;
    }, 250);
    function onKey(event: KeyboardEvent) {
      if (!armed || event.key !== "Enter" || event.repeat) return;
      event.preventDefault();
      onNextRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [paused]);
  return <BigButton onClick={onNext}>{label}</BigButton>;
}

function AfterAnswer({
  exercise,
  mode,
  wrong,
}: {
  exercise: Exercise;
  mode: SessionMode;
  wrong: boolean;
}) {
  const explain = exercise.explainPl && (wrong || exercise.explainWhen !== "wrong");
  return (
    <>
      {explain && (
        <p
          className={`animate-pop-in max-w-xl rounded-2xl p-3 text-left text-sm leading-relaxed ${
            wrong ? "bg-hero-gold/15 text-paper" : "bg-white/5 text-paper/80"
          }`}
        >
          {wrong ? "💡 " : "✓ "}
          {exercise.explainPl}
        </p>
      )}
      {mode === "parent" && exercise.parentPl && (
        <div className="w-full max-w-xl">
          <ParentTip>
            <p>{exercise.parentPl}</p>
          </ParentTip>
        </div>
      )}
    </>
  );
}

/**
 * Po trafieniu: samo przejście (tempo), chyba że na ekranie zostaje coś do
 * przeczytania. Po błędzie: zawsze „Dalej". W czasie pauzy nic nie rusza.
 */
function useAutoAdvance(
  resolved: boolean,
  wasWrong: boolean,
  hold: boolean,
  onNext: () => void,
  paused: boolean,
  delayMs = 1000,
): boolean {
  const waits = resolved && (wasWrong || hold);
  useEffect(() => {
    if (!resolved || waits || paused) return;
    const timer = setTimeout(onNext, delayMs);
    return () => clearTimeout(timer);
  }, [resolved, waits, paused, onNext, delayMs]);
  return waits;
}

/**
 * Ekran czeka na „Dalej", gdy po trafieniu jest coś do przeczytania: wyjaśnienie
 * (w każdym trybie — znikające po sekundzie nic nie uczy, 7-latek czyta wolno)
 * albo wskazówka dla rodzica (w trybie wspólnym).
 */
function holdsScreen(exercise: Exercise, mode: SessionMode): boolean {
  if (exercise.explainPl && exercise.explainWhen !== "wrong") return true;
  return mode === "parent" && Boolean(exercise.parentPl);
}

// --- Poznaj -------------------------------------------------------------------

/** Treść ekranu „Poznaj" — wspólna dla ekranu na żywo i powtórki po ↩. */
export function LearnBody({ exercise }: { exercise: Extract<Exercise, { kind: "learn" }> }) {
  return (
    <>
      {exercise.countAlong && <CountAlong numbers={exercise.countAlong} />}
      {exercise.bodyPl && <p className="max-w-xl text-lg text-paper/85">{exercise.bodyPl}</p>}
      {exercise.examples && exercise.examples.length > 0 && (
        <ul className="flex w-full max-w-xl flex-col gap-2 text-left">
          {exercise.examples.map((example) => (
            <li key={example.en} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
              <Speaker size="sm" onPlay={() => void playText(example.en)} ariaLabel={`Posłuchaj: ${example.en}`} />
              {example.visual && <VisualView visual={example.visual} small />}
              <span>
                <span className="font-reading block text-xl font-bold">{example.en}</span>
                {example.pl && <span className="text-sm text-hero-cyan">{example.pl}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function LearnExercise({ exercise, mode, onNext, paused }: Props<"learn">) {
  const [needsTap, clearTap] = useAutoSound(exercise);
  return (
    <Card className="no-select flex flex-col items-center gap-5 text-center">
      <PromptBlock exercise={exercise} needsTap={needsTap} clearTap={clearTap} />
      <LearnBody exercise={exercise} />
      {mode === "parent" && exercise.parentPl && (
        <div className="w-full max-w-xl">
          <ParentTip>
            <p>{exercise.parentPl}</p>
          </ParentTip>
        </div>
      )}
      <NextButton onNext={onNext} paused={paused} />
    </Card>
  );
}

/**
 * Liczenie skokami z podświetleniem: „seven, fourteen, twenty-one…". Dziecko
 * liczy razem z nagraniem na głos — rytm ciągu to pierwszy krok do faktów.
 */
export function CountAlong({ numbers }: { numbers: number[] }) {
  const [current, setCurrent] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);

  const play = () => {
    void playSequence(
      numbers.map((value, index) => ({
        kind: "number" as const,
        value,
        onStart: () => setCurrent(index),
      })),
      120,
    ).then((finished) => {
      if (finished) setCurrent(null);
    });
  };

  useEffect(() => () => stopAudio(), []);

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-3">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {numbers.map((value, index) => (
          <span
            key={value}
            className={`flex min-h-14 min-w-16 items-center justify-center rounded-2xl text-2xl font-black tabular-nums transition ${
              current === index ? "scale-110 bg-hero-gold text-night" : "bg-white/10"
            }`}
          >
            {hidden && current !== index ? "?" : value}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Speaker onPlay={play} label="Liczymy razem" />
        <button
          type="button"
          onClick={() => setHidden((value) => !value)}
          className="rounded-blob bg-white/10 px-4 py-3 text-sm font-bold"
          aria-pressed={hidden}
        >
          {hidden ? "👀 pokaż liczby" : "🙈 zakryj liczby"}
        </button>
      </div>
    </div>
  );
}

// --- Wybór ------------------------------------------------------------------------

const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

function ChoiceExercise({ exercise, mode, onAnswer, onNext, paused, firstAttempt }: Props<"choice">) {
  const [needsTap, clearTap] = useAutoSound(exercise, !firstAttempt);
  const [picked, setPicked] = useState<string | null>(firstAttempt?.answer ?? null);
  const [repaired, setRepaired] = useState(false);
  const startRef = useAnswerClock(paused);

  const correct = picked !== null && picked === exercise.answer;
  const inRepair = picked !== null && !correct && !repaired;
  const resolved = correct || repaired;
  const waits = useAutoAdvance(resolved, picked !== null && !correct, holdsScreen(exercise, mode), onNext, paused);

  function pick(option: ChoiceOption) {
    if (paused) return;
    if (inRepair) {
      if (option.id !== exercise.answer) return;
      setRepaired(true);
      playFeedbackTone("good");
      return;
    }
    if (picked !== null) return;
    const isRight = option.id === exercise.answer;
    setPicked(option.id);
    playFeedbackTone(isRight ? "good" : "try-again");
    onAnswer({
      ts: Date.now(),
      exercise: exercise.exercise,
      item: exercise.item,
      answer: option.id,
      correct: isRight,
      responseMs: Date.now() - startRef.current,
    });
    // Ze słuchu: po błędzie jeszcze raz to samo nagranie — teraz z pytaniem
    // „które to było?" w głowie dziecko słyszy różnicę.
    if (!isRight && exercise.sound && exercise.listenOnly) {
      setTimeout(() => void playSound(exercise.sound!), 450);
    }
  }

  return (
    <Card className="no-select flex flex-col items-center gap-5 text-center">
      <PromptBlock exercise={exercise} needsTap={needsTap} clearTap={clearTap} />

      <div className={`grid w-full max-w-3xl gap-3 ${COLUMNS[exercise.columns ?? (exercise.options.length === 4 ? 2 : exercise.options.length)] ?? COLUMNS[2]}`}>
        {exercise.options.map((option) => {
          const isAnswer = option.id === exercise.answer;
          const state =
            picked === null
              ? "idle"
              : isAnswer && resolved
                ? "correct"
                : isAnswer && inRepair
                  ? "target"
                  : option.id === picked
                    ? "wrong"
                    : "dim";
          return (
            <ChoiceButton
              key={option.id}
              option={option}
              state={state}
              mark={exercise.mark}
              showSub={mode === "parent" || picked !== null}
              disabled={resolved || (inRepair && !isAnswer)}
              onPick={() => pick(option)}
            />
          );
        })}
      </div>

      {inRepair && (
        <p className="text-sm font-bold text-hero-gold">
          👆 Stuknij dobrą odpowiedź, żeby iść dalej.
        </p>
      )}

      {picked !== null && <AfterAnswer exercise={exercise} mode={mode} wrong={!correct} />}
      {waits && <NextButton onNext={onNext} paused={paused} />}
      <PassageBelow exercise={exercise} />
    </Card>
  );
}

function ChoiceButton({
  option,
  state,
  mark,
  showSub,
  disabled,
  onPick,
}: {
  option: ChoiceOption;
  state: "idle" | "correct" | "target" | "wrong" | "dim";
  mark?: MarkStyle;
  showSub: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const tone = {
    idle: "bg-white/15 text-paper shadow-[0_6px_0_rgba(0,0,0,0.3)]",
    correct: "bg-hero-lime text-night",
    target: "bg-hero-lime/80 text-night animate-pulse-ring",
    wrong: "bg-hero-pink text-night",
    dim: "bg-white/5 text-paper/40",
  }[state];
  const marked = mark && state === "correct";

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className={`relative flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-blob py-4 transition active:translate-y-1 ${option.sound ? "pl-14 pr-4" : "px-4"} ${tone} ${
          marked && mark === "colour" ? "!bg-hero-gold" : ""
        }`}
      >
        {option.emoji && (
          <span className={`text-5xl ${marked && mark === "circle" ? "rounded-full ring-4 ring-night ring-offset-4 ring-offset-hero-lime" : ""}`} aria-hidden>
            {option.emoji}
          </span>
        )}
        {option.visual && <VisualView visual={option.visual} small />}
        <span
          className={`font-reading text-xl font-black ${marked && mark === "underline" ? "underline decoration-4 underline-offset-4" : ""}`}
        >
          {option.label}
        </span>
        {option.sub && showSub && <span className="text-xs font-bold opacity-75">{option.sub}</span>}
        {marked && mark === "tick" && (
          <span className="animate-pop-in absolute right-3 top-2 text-4xl font-black text-night" aria-hidden>
            ✓
          </span>
        )}
        {marked && mark === "cross" && (
          <span className="animate-pop-in absolute inset-0 flex items-center justify-center text-7xl font-black text-night/80" aria-hidden>
            ✗
          </span>
        )}
      </button>
      {option.sound && (
        <div className="absolute left-2 top-2">
          <Speaker size="sm" onPlay={() => void playSound(option.sound!)} ariaLabel={`Posłuchaj: ${option.label}`} />
        </div>
      )}
    </div>
  );
}

// --- Wpisz liczbę ----------------------------------------------------------------

type TypedPhase = "answer" | "correct" | "repair" | "repaired";

function TypedExercise({ exercise, mode, onAnswer, onNext, paused, firstAttempt }: Props<"typed">) {
  const [needsTap, clearTap] = useAutoSound(exercise, !firstAttempt);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<TypedPhase>(
    firstAttempt ? (firstAttempt.correct === false ? "repair" : "correct") : "answer",
  );
  const [given, setGiven] = useState(firstAttempt?.answer ?? "");
  const [fast, setFast] = useState(false);
  const [shake, setShake] = useState(false);
  const startRef = useAnswerClock(paused);

  const resolved = phase === "correct" || phase === "repaired";
  const wasWrong = phase === "repair" || phase === "repaired";
  const waits = useAutoAdvance(
    resolved,
    wasWrong,
    holdsScreen(exercise, mode),
    onNext,
    paused,
    exercise.fastMs ? 650 : 1000,
  );

  function submit(value: string) {
    if (value === "" || paused) return;
    if (phase === "answer") {
      const ms = Date.now() - startRef.current;
      const isRight = Number(value) === exercise.answer;
      onAnswer({
        ts: Date.now(),
        exercise: exercise.exercise,
        item: exercise.item,
        answer: value,
        correct: isRight,
        responseMs: ms,
      });
      if (isRight) {
        playFeedbackTone("good");
        if (exercise.fastMs && ms <= exercise.fastMs) {
          setFast(true);
          setTimeout(playFastDing, 120);
        }
        setPhase("correct");
      } else {
        playFeedbackTone("try-again");
        setGiven(value);
        setValue("");
        setPhase("repair");
        if (exercise.revealSound) setTimeout(() => void playSound(exercise.revealSound!), 400);
      }
      return;
    }
    if (phase === "repair") {
      if (Number(value) === exercise.answer) {
        playFeedbackTone("good");
        setPhase("repaired");
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setValue("");
      }
    }
  }

  const boxState =
    phase === "correct" || phase === "repaired" ? "correct" : phase === "repair" ? "repair" : "idle";
  const inlineBig = exercise.visual?.kind === "big";

  return (
    <Card className="no-select flex flex-col items-center gap-4 text-center">
      {inlineBig ? (
        <>
          {exercise.heading && <p className="text-sm font-bold text-paper/60">{exercise.heading}</p>}
          <div className="flex flex-wrap items-center justify-center gap-3 text-5xl sm:text-6xl">
            <VisualView visual={exercise.visual!} />
            <span className={shake ? "animate-shake" : undefined}>
              <AnswerBox value={resolved ? String(exercise.answer) : value} state={boxState} />
            </span>
            {fast && (
              <span className="animate-pop-in text-4xl" aria-label="Błyskawicznie!">
                ⚡
              </span>
            )}
          </div>
          {exercise.promptEn && (
            <PromptBlock exercise={{ ...exercise, visual: undefined, heading: undefined }} needsTap={needsTap} clearTap={clearTap} />
          )}
        </>
      ) : (
        <>
          <PromptBlock exercise={exercise} needsTap={needsTap} clearTap={clearTap} />
          <div className="flex items-center gap-3 text-4xl">
            <span className={shake ? "animate-shake" : undefined}>
              <AnswerBox value={resolved ? String(exercise.answer) : value} state={boxState} />
            </span>
            {fast && <span className="animate-pop-in">⚡</span>}
          </div>
        </>
      )}

      {phase === "repair" && (
        <div className="animate-pop-in flex max-w-md flex-col items-center gap-2 rounded-2xl bg-hero-gold/15 p-3">
          {given !== "" && (
            <p className="text-sm text-paper/80">
              Wpisane: <strong className="text-hero-pink">{given}</strong>
            </p>
          )}
          <p className="text-2xl font-black text-hero-gold">
            {exercise.revealText ?? `= ${exercise.answer}`}
          </p>
          {exercise.revealSound && (
            <Speaker size="sm" onPlay={() => void playSound(exercise.revealSound!)} ariaLabel="Posłuchaj odpowiedzi" />
          )}
          <p className="text-sm font-bold text-hero-gold">
            Wpisz {exercise.answer} i Enter, żeby iść dalej.
          </p>
        </div>
      )}

      {(phase === "answer" || phase === "repair") && (
        <NumberPad value={value} onChange={setValue} onEnter={submit} disabled={paused} />
      )}

      {resolved && <AfterAnswer exercise={exercise} mode={mode} wrong={wasWrong} />}
      {waits && <NextButton onNext={onNext} paused={paused} />}
    </Card>
  );
}

// --- Ułóż po kolei -----------------------------------------------------------------

function OrderExercise({ exercise, mode, onAnswer, onNext, paused, firstAttempt }: Props<"order">) {
  const [needsTap, clearTap] = useAutoSound(exercise, !firstAttempt);
  const shuffled = useMemo(() => {
    const ids = exercise.items.map((item) => item.id).join();
    for (let i = 0; i < 10; i++) {
      const candidate = shuffle(exercise.items);
      if (candidate.map((item) => item.id).join() !== ids) return candidate;
    }
    return [...exercise.items].reverse();
  }, [exercise]);
  const [placed, setPlaced] = useState<string[]>(
    firstAttempt?.correct === true ? exercise.items.map((item) => item.id) : [],
  );
  const [mistake, setMistake] = useState(firstAttempt?.correct === false);
  const [flash, setFlash] = useState<string | null>(null);
  const reportedRef = useRef(Boolean(firstAttempt));
  const startRef = useAnswerClock(paused);

  const done = placed.length === exercise.items.length;
  const expected = exercise.items[placed.length];
  const waits = useAutoAdvance(done, mistake, holdsScreen(exercise, mode), onNext, paused, 1200);

  function report(correct: boolean) {
    if (reportedRef.current) return;
    reportedRef.current = true;
    onAnswer({
      ts: Date.now(),
      exercise: exercise.exercise,
      item: exercise.item,
      answer: correct ? "ok" : "error",
      correct,
      responseMs: Date.now() - startRef.current,
    });
  }

  function tap(id: string) {
    if (paused || done || placed.includes(id)) return;
    if (id === expected.id) {
      const next = [...placed, id];
      setPlaced(next);
      if (next.length === exercise.items.length) {
        report(!mistake);
        playFeedbackTone("good");
      }
      return;
    }
    // Pierwszy błąd przesądza wynik; potem podpowiadamy, który jest następny.
    setMistake(true);
    report(false);
    playFeedbackTone("try-again");
    setFlash(id);
    setTimeout(() => setFlash(null), 500);
  }

  const labelOf = (id: string) => exercise.items.find((item) => item.id === id)!;

  return (
    <Card className="no-select flex flex-col items-center gap-5 text-center">
      <PromptBlock exercise={exercise} needsTap={needsTap} clearTap={clearTap} />

      <ol className="flex w-full max-w-2xl flex-col gap-2">
        {exercise.items.map((_, index) => {
          const id = placed[index];
          return (
            <li
              key={index}
              className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2 text-left ${
                id ? "bg-hero-lime/20" : "border-2 border-dashed border-white/15"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 font-black">
                {index + 1}
              </span>
              {id && <span className="font-reading text-lg font-bold">{labelOf(id).label}</span>}
            </li>
          );
        })}
      </ol>

      {!done && (
        <div className="flex w-full max-w-2xl flex-col gap-2">
          {shuffled
            .filter((item) => !placed.includes(item.id))
            .map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                {item.sound && (
                  <Speaker size="sm" onPlay={() => void playSound(item.sound!)} ariaLabel={`Posłuchaj: ${item.label}`} />
                )}
                <button
                  type="button"
                  onClick={() => tap(item.id)}
                  className={`font-reading min-h-14 flex-1 rounded-2xl px-4 py-3 text-left text-lg font-bold transition active:translate-y-0.5 ${
                    flash === item.id
                      ? "bg-hero-pink text-night"
                      : mistake && item.id === expected.id
                        ? "animate-pulse-ring bg-hero-lime/70 text-night"
                        : "bg-white/15 shadow-[0_4px_0_rgba(0,0,0,0.3)]"
                  }`}
                >
                  {item.label}
                </button>
              </div>
            ))}
        </div>
      )}

      {mistake && !done && (
        <p className="text-sm font-bold text-hero-gold">👆 Podświetlony jest następny — stuknij go.</p>
      )}

      {done && <AfterAnswer exercise={exercise} mode={mode} wrong={mistake} />}
      {waits && <NextButton onNext={onNext} paused={paused} />}
      <PassageBelow exercise={exercise} />
    </Card>
  );
}

// --- Find and copy ---------------------------------------------------------------

function TapWordExercise({ exercise, mode, onAnswer, onNext, paused, firstAttempt }: Props<"tapword">) {
  const [needsTap, clearTap] = useAutoSound(exercise, !firstAttempt);
  // Pierwsze stuknięcie: klucz tokenu („zdanie:słowo" — to samo słowo może stać
  // w tekście dwa razy, a podświetlić trzeba to jedno) i czy było trafne.
  const [first, setFirst] = useState<{ key: string; right: boolean } | null>(
    firstAttempt ? { key: "", right: firstAttempt.correct === true } : null,
  );
  const [found, setFound] = useState<string | null>(
    firstAttempt?.correct === true ? (firstAttempt.answer ?? exercise.answers[0]) : null,
  );
  const startRef = useAnswerClock(paused);

  const answers = useMemo(() => new Set(exercise.answers.map(normalizeWord)), [exercise.answers]);
  const firstRight = first?.right ?? false;
  const inRepair = first !== null && !firstRight && found === null;
  const resolved = found !== null;
  const waits = useAutoAdvance(resolved, first !== null && !firstRight, holdsScreen(exercise, mode), onNext, paused, 1400);

  function tap(token: string, key: string) {
    if (paused) return;
    const isRight = answers.has(normalizeWord(token));
    if (first === null) {
      setFirst({ key, right: isRight });
      onAnswer({
        ts: Date.now(),
        exercise: exercise.exercise,
        item: exercise.item,
        answer: normalizeWord(token),
        correct: isRight,
        responseMs: Date.now() - startRef.current,
      });
      playFeedbackTone(isRight ? "good" : "try-again");
      if (isRight) setFound(token);
      return;
    }
    if (inRepair && isRight) {
      playFeedbackTone("good");
      setFound(token);
    }
  }

  return (
    <Card className="no-select flex flex-col items-center gap-5 text-center">
      <PromptBlock exercise={exercise} needsTap={needsTap} clearTap={clearTap} />

      <div className="w-full max-w-2xl rounded-2xl bg-black/20 p-4 text-left">
        <p className="mb-2 text-sm font-bold text-paper/60">📖 {exercise.title} — stuknij słowo</p>
        <div className="flex flex-col gap-2">
          {exercise.sentences.map((sentence, s) => (
            <p key={s} className="font-reading flex flex-wrap items-center gap-x-1 gap-y-1 text-xl leading-snug">
              <Speaker size="sm" onPlay={() => void playText(sentence)} ariaLabel={`Posłuchaj: ${sentence}`} />
              {sentence.split(" ").map((token, w) => {
                const key = `${s}:${w}`;
                const right = answers.has(normalizeWord(token));
                const style =
                  first?.key === key
                    ? first.right
                      ? "bg-hero-lime text-night"
                      : "bg-hero-pink text-night"
                    : resolved && found !== null && normalizeWord(found) === normalizeWord(token) && right
                      ? "bg-hero-lime text-night"
                      : inRepair && right
                        ? "animate-pulse-ring bg-hero-lime/50 text-night"
                        : "hover:bg-white/10";
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={resolved}
                    onClick={() => tap(token, key)}
                    className={`rounded-lg px-1 py-0.5 transition ${style}`}
                  >
                    {token}
                  </button>
                );
              })}
            </p>
          ))}
        </div>
      </div>

      {inRepair && (
        <p className="text-sm font-bold text-hero-gold">👆 Podświetlone słowo pasuje — stuknij je.</p>
      )}

      {resolved && found && (
        <p className="animate-pop-in rounded-2xl bg-white/10 px-4 py-2 text-lg">
          ✏️ Copy: <span className="font-reading font-black text-hero-lime">{normalizeWord(found)}</span>
        </p>
      )}

      {first !== null && resolved && <AfterAnswer exercise={exercise} mode={mode} wrong={!firstRight} />}
      {waits && <NextButton onNext={onNext} paused={paused} />}
    </Card>
  );
}

// --- Polecenie w ruchu (ocenia rodzic) ---------------------------------------------

/**
 * Rodzic mówi polecenie (albo puszcza nagranie), dziecko wykonuje. Ocenia
 * rodzic — aplikacja świadomie nie słucha dziecka (zasada briefu).
 */
function ActExercise({ exercise, onAnswer, onNext, paused, firstAttempt }: Props<"act">) {
  const [needsTap, clearTap] = useAutoSound(exercise, !firstAttempt);
  const [result, setResult] = useState<boolean | null>(
    firstAttempt ? firstAttempt.correct === true : null,
  );
  const startRef = useAnswerClock(paused);

  function judge(correct: boolean) {
    if (paused || result !== null) return;
    setResult(correct);
    playFeedbackTone(correct ? "good" : "try-again");
    onAnswer({
      ts: Date.now(),
      exercise: exercise.exercise,
      item: exercise.item,
      correct,
      responseMs: Date.now() - startRef.current,
    });
  }

  return (
    <Card className="no-select flex flex-col items-center gap-5 text-center">
      <PromptBlock exercise={exercise} needsTap={needsTap} clearTap={clearTap} />
      {result === null ? (
        <>
          <p className="max-w-md text-sm text-paper/70">
            Polecenie pada po angielsku — dziecko je wykonuje. Nie tłumacz; jeśli trzeba, powtórz
            albo pokaż gestem.
          </p>
          <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <BigButton tone="yes" onClick={() => judge(true)} full>
              ✓ Zrobione
            </BigButton>
            <BigButton tone="quiet" onClick={() => judge(false)} full>
              ↺ Jeszcze nie
            </BigButton>
          </div>
        </>
      ) : (
        <>
          <div className="animate-pop-in text-6xl" aria-hidden>
            {exercise.emoji}
          </div>
          <p className="max-w-md text-lg text-hero-cyan">{exercise.actionPl}</p>
          {!result && (
            <p className="max-w-md text-sm text-paper/70">
              Zróbcie to razem: polecenie jeszcze raz, pokaż ruch, dziecko naśladuje.
            </p>
          )}
          <NextButton onNext={onNext} paused={paused} />
        </>
      )}
    </Card>
  );
}

// --- Tekst do wysłuchania -----------------------------------------------------------

function PassageExercise({ exercise, onNext, paused }: Props<"passage">) {
  const [current, setCurrent] = useState<number | null>(null);
  const [showPl, setShowPl] = useState(false);
  const [heard, setHeard] = useState(false);

  const playAll = () => {
    void playSequence(
      exercise.sentences.map((sentence, index) => ({
        kind: "text" as const,
        value: sentence.en,
        onStart: () => setCurrent(index),
      })),
      350,
    ).then((finished) => {
      // Podświetlenie zeruje tylko naturalny koniec — przerwaniem (stuknięte
      // zdanie, „Jeszcze raz") zajmuje się to, co przerwało.
      if (finished) {
        setCurrent(null);
        setHeard(true);
      }
    });
  };

  useEffect(() => {
    // Najpierw uchem (Simple View of Reading): tekst czyta się sam na starcie.
    const timer = setTimeout(playAll, 400);
    return () => {
      clearTimeout(timer);
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise]);

  return (
    <Card className="no-select flex flex-col items-center gap-4 text-center">
      <p className="text-sm font-bold text-paper/60">Posłuchaj tekstu. Pytania będą potem.</p>
      <h2 className="font-reading text-3xl font-black">{exercise.title}</h2>
      <div className="flex flex-wrap justify-center gap-2">
        <Speaker onPlay={playAll} label={heard ? "Jeszcze raz" : "Posłuchaj całości"} />
        <button
          type="button"
          onClick={() => setShowPl((value) => !value)}
          className="rounded-blob bg-white/10 px-4 py-3 text-sm font-bold"
          aria-pressed={showPl}
        >
          🇵🇱 {showPl ? "ukryj polski" : "po polsku"}
        </button>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-2 text-left">
        {exercise.sentences.map((sentence, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              setCurrent(index);
              void playText(sentence.en, { wait: true }).then(() =>
                setCurrent((now) => (now === index ? null : now)),
              );
            }}
            className={`rounded-2xl px-3 py-2 text-left transition ${
              current === index ? "bg-hero-gold/25 ring-2 ring-hero-gold" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <span className="font-reading block text-xl leading-snug">{sentence.en}</span>
            {showPl && <span className="block text-sm text-hero-cyan">{sentence.pl}</span>}
          </button>
        ))}
      </div>

      <p className="text-xs text-paper/50">Stuknij zdanie, żeby usłyszeć je jeszcze raz.</p>
      <NextButton onNext={onNext} paused={paused} label="Do pytań ▸" />
    </Card>
  );
}
