"use client";

/**
 * Próbny Multiplication Tables Check — odtworzony według ramy STA:
 *  - 3 pytania próbne, potem 25 pytań w formacie „a × b =",
 *  - 6 sekund na odpowiedź, po każdej 3 sekundy przerwy,
 *  - Enter albo koniec czasu zatwierdza,
 *  - w trakcie zero informacji zwrotnej; wynik na 25 dopiero na końcu,
 *  - zestaw z generatora pilnującego limitów z ramy (lib/curriculum/tables.ts).
 *
 * Celowo bez nagród dźwiękowych i bez błyskawic: dziecko ma poznać, jak test
 * WYGLĄDA naprawdę, żeby w czerwcu nie było niespodzianek.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerBox, NumberPad } from "@/components/NumberPad";
import { BigButton, Card, ParentTip, Speaker } from "@/components/ui";
import { playFact, stopVictoryFanfare, unlockAudio } from "@/lib/audio";
import { buildMtcForm, factKey, MTC, type Question } from "@/lib/curriculum/tables";
import { useProgress, type PendingAttempt, type SessionOutcome } from "@/lib/progress/store";
import type { SessionMode } from "@/lib/progress/types";
import { useDeviceRole } from "@/lib/useDeviceRole";

type Stage = "intro" | "practice" | "ready" | "check" | "result";

/** Pytania próbne: łatwe, z tabliczek, których w samym teście jest mało. */
function practiceQuestions(): Question[] {
  const pool: Question[] = [
    [2, 3],
    [10, 4],
    [5, 2],
    [2, 6],
    [10, 7],
    [5, 5],
  ];
  return [...pool].sort(() => Math.random() - 0.5).slice(0, MTC.practiceQuestions);
}

export default function MockCheckPage() {
  const { commitSession, state } = useProgress();
  const { role } = useDeviceRole();
  const [stage, setStage] = useState<Stage>("intro");
  const [mode, setMode] = useState<SessionMode>("solo");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  const [answers, setAnswers] = useState<{ q: Question; answer: string; correct: boolean }[]>([]);
  const startedRef = useRef(0);

  const start = (chosen: SessionMode) => {
    unlockAudio();
    stopVictoryFanfare();
    setMode(chosen);
    setQuestions(practiceQuestions());
    setStage("practice");
  };

  const finishCheck = useCallback(
    (attempts: PendingAttempt[], results: { q: Question; answer: string; correct: boolean }[]) => {
      setAnswers(results);
      setOutcome(
        commitSession({
          module: "tables",
          unitId: "mock",
          kind: "mock",
          mode,
          device: role,
          startedTs: startedRef.current,
          endedTs: Date.now(),
          attempts,
        }),
      );
      setStage("result");
    },
    [commitSession, mode, role],
  );

  if (stage === "intro") {
    return <Intro onStart={start} lastScores={state.mocks.slice(-5).map((mock) => mock.score)} />;
  }

  if (stage === "practice") {
    return (
      <QuestionRun
        key="practice"
        questions={questions}
        label="Pytanie próbne"
        onDone={() => setStage("ready")}
      />
    );
  }

  if (stage === "ready") {
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
        <p className="text-5xl">🏁</p>
        <h1 className="text-3xl font-black">Rozgrzewka skończona</h1>
        <p className="text-paper/80">
          Teraz {MTC.questions} prawdziwych pytań. Każde znika po {MTC.answerMs / 1000} sekundach —
          jeśli nie wiesz, nic się nie dzieje, pytanie samo przejdzie dalej.
        </p>
        <BigButton
          onClick={() => {
            setQuestions(buildMtcForm());
            startedRef.current = Date.now();
            setStage("check");
          }}
        >
          Start
        </BigButton>
      </Card>
    );
  }

  if (stage === "check") {
    return (
      <QuestionRun
        key="check"
        questions={questions}
        label="Question"
        scored
        onDone={(attempts, results) => finishCheck(attempts, results)}
      />
    );
  }

  return <Result outcome={outcome} answers={answers} mocks={state.mocks} onAgain={() => setStage("intro")} />;
}

function Intro({
  onStart,
  lastScores,
}: {
  onStart: (mode: SessionMode) => void;
  lastScores: number[];
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
      <Link href="/tabliczka/" className="flex min-h-11 items-center self-start rounded-full bg-white/10 px-5 text-sm">
        ← Wróć
      </Link>
      <p className="text-6xl">📝</p>
      <h1 className="text-3xl font-black">Próbny test MTC</h1>
      <p className="max-w-lg text-lg text-paper/85">
        Tak jak w szkole w Year 4: {MTC.questions} działań, {MTC.answerMs / 1000} sekund na każde.
        Najpierw {MTC.practiceQuestions} pytania na rozgrzewkę. Wpisz wynik i naciśnij Enter.
      </p>
      {lastScores.length > 0 && (
        <p className="text-sm text-paper/60">Ostatnie wyniki: {lastScores.join(", ")} (na 25)</p>
      )}
      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <BigButton onClick={() => onStart("solo")} full>
          Zaczynam
        </BigButton>
        <BigButton tone="quiet" onClick={() => onStart("parent")} full>
          Z rodzicem obok
        </BigButton>
      </div>
      <ParentTip>
        <p className="mb-2">
          W prawdziwym teście nie wolno pomagać, więc tutaj też nie — to pomiar, nie lekcja. Test zmienia
          plan nauki tylko w jedną stronę: fakty z błędem wracają do częstszych powtórek, a trafienia
          niczego nie „zaliczają” (awans jest za regularny trening).
        </p>
        <p>Wystarczy raz na 2–3 tygodnie. Częściej — dziecko uczy się testu zamiast tabliczki.</p>
      </ParentTip>
    </div>
  );
}

/**
 * Jedna seria pytań z twardym limitem czasu i przerwą. Stan bieżącej
 * odpowiedzi trzymany też w refie, bo zatwierdza ją timer, a nie tylko Enter.
 */
function QuestionRun({
  questions,
  label,
  scored = false,
  onDone,
}: {
  questions: Question[];
  label: string;
  scored?: boolean;
  onDone: (attempts: PendingAttempt[], results: { q: Question; answer: string; correct: boolean }[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"answer" | "pause">("answer");
  const [value, setValue] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);
  const valueRef = useRef("");
  const shownRef = useRef(Date.now());
  const attemptsRef = useRef<PendingAttempt[]>([]);
  const resultsRef = useRef<{ q: Question; answer: string; correct: boolean }[]>([]);
  const submittedRef = useRef(false);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Rodzic przekazuje nową funkcję przy każdym renderze; bez refa każdy
  // render w trakcie przerwy zaczynałby odliczanie 3 s od nowa.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const question = questions[index];

  const submit = useCallback(
    (timedOut: boolean) => {
      if (submittedRef.current || !question) return;
      // Limit czasu odpalony z dużym opóźnieniem = strona była uśpiona (tablet
      // zgaszony, aplikacja w tle). To nie jest „brak odpowiedzi" dziecka.
      if (timedOut && Date.now() - shownRef.current > MTC.answerMs + 1500) {
        setConfirmExit(true);
        return;
      }
      submittedRef.current = true;
      const [a, b] = question;
      const answer = valueRef.current;
      const correct = answer !== "" && Number(answer) === a * b;
      if (scored) {
        attemptsRef.current.push({
          ts: Date.now(),
          exercise: "mtc",
          item: `${a}x${b}`,
          answer: timedOut && answer === "" ? "" : answer,
          correct,
          responseMs: timedOut ? MTC.answerMs : Date.now() - shownRef.current,
        });
        resultsRef.current.push({ q: question, answer, correct });
      }
      setPhase("pause");
    },
    [question, scored],
  );

  // Limit 6 s na odpowiedź.
  useEffect(() => {
    if (phase !== "answer" || confirmExit) return;
    shownRef.current = Date.now();
    submittedRef.current = false;
    answerTimerRef.current = setTimeout(() => submit(true), MTC.answerMs);
    return () => clearTimeout(answerTimerRef.current);
  }, [phase, index, confirmExit, submit]);

  // 3 s przerwy, potem następne pytanie albo koniec. Otwarte okno „Przerwać
  // test?" wstrzymuje też przerwę — inaczej ostatnia przerwa zapisywała test
  // mimo obietnicy „wynik przerwanego testu się nie zapisze".
  useEffect(() => {
    if (phase !== "pause" || confirmExit) return;
    pauseTimerRef.current = setTimeout(() => {
      if (index + 1 >= questions.length) {
        onDoneRef.current(attemptsRef.current, resultsRef.current);
        return;
      }
      valueRef.current = "";
      setValue("");
      setIndex(index + 1);
      setPhase("answer");
    }, MTC.pauseMs);
    return () => clearTimeout(pauseTimerRef.current);
  }, [phase, index, confirmExit, questions.length]);

  // Karta w tle (rodzic przełączył okno, dziecko zgasiło tablet) = przerwa.
  // Bez tego test toczył się dalej w ukryciu: wszystkie pytania kończyły się
  // limitem czasu, a fałszywy wynik obniżał pudełka faktów. Timery czyścimy od
  // razu w obsłudze zdarzenia — strona może zostać zamrożona przed renderem.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      clearTimeout(answerTimerRef.current);
      clearTimeout(pauseTimerRef.current);
      setConfirmExit(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const change = (next: string) => {
    valueRef.current = next;
    setValue(next);
  };

  if (!question) return null;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
      <header className="flex w-full items-center justify-between">
        <button type="button" onClick={() => setConfirmExit(true)} className="text-sm text-paper/60 underline">
          ← Przerwij
        </button>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold tabular-nums">
          {label} {index + 1} {scored ? `of ${questions.length}` : `/ ${questions.length}`}
        </span>
      </header>

      {confirmExit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-night/85 p-4 backdrop-blur-sm"
        >
          <Card className="max-w-md">
            <h2 className="mb-2 text-2xl font-black">Przerwać test?</h2>
            <p className="mb-5 text-paper/75">
              Test stoi. Wynik przerwanego testu się nie zapisze — pół testu nie mówi, ile dziecko umie.
              „Wróć do testu” daje bieżącemu pytaniu pełne 6 sekund.
            </p>
            <div className="flex flex-col gap-3">
              <BigButton href="/tabliczka/" tone="quiet" full>
                Wyjdź bez zapisu
              </BigButton>
              <BigButton
                onClick={() => {
                  // Wracamy do tego samego pytania z pełnym czasem — liczy się
                  // uczciwy pomiar, a nie sekundy stracone na okno.
                  change("");
                  setConfirmExit(false);
                }}
                full
              >
                Wróć do testu
              </BigButton>
            </div>
          </Card>
        </div>
      )}

      <Card className="flex w-full flex-col items-center gap-6 py-10">
        {phase === "answer" ? (
          <div className="flex flex-wrap items-center justify-center gap-4 text-5xl font-black tabular-nums sm:text-6xl">
            <span className="font-reading">
              {question[0]} × {question[1]} =
            </span>
            <AnswerBox value={value} />
          </div>
        ) : (
          <p className="flex h-16 items-center text-lg text-paper/40" aria-live="polite">
            {index + 1 >= questions.length ? "…" : "Next question…"}
          </p>
        )}
      </Card>

      <NumberPad
        value={value}
        onChange={change}
        onEnter={(typed) => {
          valueRef.current = typed;
          if (typed !== "") submit(false);
        }}
        disabled={phase !== "answer" || confirmExit}
        maxLength={3}
      />
    </div>
  );
}

function Result({
  outcome,
  answers,
  mocks,
  onAgain,
}: {
  outcome: SessionOutcome | null;
  answers: { q: Question; answer: string; correct: boolean }[];
  mocks: { score: number; ts: number }[];
  onAgain: () => void;
}) {
  const score = outcome?.mock?.score ?? answers.filter((answer) => answer.correct).length;
  const missed = answers.filter((answer) => !answer.correct);
  const previous = mocks.length >= 2 ? mocks[mocks.length - 2].score : null;
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return missed.filter(({ q }) => {
      const key = factKey(q[0], q[1]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [missed]);

  const message =
    score === 25
      ? "Komplet! Tak wygląda gotowość na czerwiec."
      : score >= 21
        ? "Świetny wynik — na poziomie średniej krajowej albo wyżej."
        : score >= 15
          ? "Dobra baza. Trening zajmie się faktami, które uciekły."
          : "To pomiar na starcie — każdy trening będzie przesuwał ten wynik w górę.";

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
      <p className="text-6xl">📝</p>
      <h1 className="text-3xl font-black">Wynik próbnego testu</h1>
      <p className="text-7xl font-black tabular-nums">
        {score}
        <span className="text-3xl text-paper/50"> / 25</span>
      </p>
      {previous !== null && (
        <p className="text-sm text-paper/70">
          Poprzednio: {previous} / 25 {score > previous ? "— lepiej! 🚀" : ""}
        </p>
      )}
      <p className="max-w-md text-lg text-hero-gold">{message}</p>

      {unique.length > 0 && (
        <Card className="w-full">
          <h2 className="mb-3 text-lg font-black">Te fakty wracają do treningu</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {unique.map(({ q, answer }) => (
              <li key={`${q[0]}x${q[1]}`} className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 px-3 py-2">
                <span className="font-reading text-xl font-black tabular-nums">
                  {q[0]} × {q[1]} = {q[0] * q[1]}
                </span>
                <span className="text-xs text-paper/50">{answer === "" ? "brak odpowiedzi" : `wpisane: ${answer}`}</span>
                <Speaker size="sm" onPlay={() => void playFact(q[0], q[1])} ariaLabel={`Posłuchaj: ${q[0]} razy ${q[1]}`} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <BigButton href="/tabliczka/trening/" full>
          ⚡ Do treningu
        </BigButton>
        <BigButton tone="quiet" onClick={onAgain} full>
          Jeszcze raz
        </BigButton>
      </div>

      <ParentTip>
        <p className="mb-2">
          W MTC nie ma progu zaliczenia — szkoła i rodzic dostają sam wynik na 25. Dla porównania: w
          roku szkolnym 2024/25 średni wynik w Anglii wyniósł 21,0, a komplet 25/25 miało 37% dzieci.
          Dzieci z innym językiem ojczystym niż angielski wypadły średnio lepiej (22,0) — test jest
          czysto liczbowy.
        </p>
        <p>
          „Brak odpowiedzi” zwykle znaczy, że fakt jest znany, ale za wolno — to robota dla treningu z
          błyskawicami, nie dla tłumaczenia od zera.
        </p>
      </ParentTip>
    </div>
  );
}
