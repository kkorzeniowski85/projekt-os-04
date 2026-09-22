"use client";

/**
 * Przebieg jednej sesji — wspólny dla wszystkich działów Akademii.
 *
 * W Lidze Dźwięków ta sama logika siedziała osobno w dwóch silnikach sesji;
 * tu działy są cztery, więc wyjęta raz (KONWENCJE: kopia do trzeciego użycia —
 * to jest właśnie trzecie).
 *
 * Zasady przeniesione z Ligi, sprawdzone z dzieckiem:
 *  - `frontier` = pierwszy nieukończony ekran (jedyny „na żywo"), `index` =
 *    ekran oglądany; wszystko przed frontier to POWTÓRKA — do posłuchania,
 *    bez ponownego punktowania;
 *  - liczy się PIERWSZA odpowiedź na ekranie (mapa próba-na-ekran), więc
 *    naprawa błędu i cofanie nie zmieniają wyniku;
 *  - runda bonusowa: do trzech ekranów, które poszły źle, wraca na końcu —
 *    bez punktów, po to, żeby ostatni kontakt z trudnym materiałem był udany;
 *  - przerwanie: zapisz to, co zrobione, albo wyjdź bez śladu.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { primeSpeech, stopAudio, unlockAudio } from "@/lib/audio";
import type { PendingAttempt, SessionOutcome } from "@/lib/progress/store";
import type { SessionMode } from "@/lib/progress/types";

export type SessionFlow<S> = {
  stage: "intro" | "running" | "done";
  mode: SessionMode;
  screens: S[];
  frontier: number;
  index: number;
  screen: S | undefined;
  isReview: boolean;
  inBonus: boolean;
  outcome: SessionOutcome | null;
  interrupting: boolean;
  start: (mode: SessionMode) => void;
  onAnswer: (attempt: PendingAttempt) => void;
  onNext: () => void;
  goBack: () => void;
  goForward: () => void;
  openInterrupt: () => void;
  closeInterrupt: () => void;
  /** Zapis przerwanej sesji („Zapisz i wyjdź"). */
  saveNow: () => void;
  scoredCount: () => number;
  attemptAt: (index: number) => PendingAttempt | undefined;
};

export function useSessionFlow<S>(options: {
  build: (mode: SessionMode) => S[];
  commit: (attempts: PendingAttempt[], mode: SessionMode, startedTs: number) => SessionOutcome;
  /** Ekran do rundy bonusowej dla nieudanej próby; null/brak = bez bonusu. */
  bonusFor?: (screen: S) => S | null;
}): SessionFlow<S> {
  // Funkcje z opcji zwykle są tworzone na nowo przy każdym renderze — ref
  // pozwala ich używać bez przebudowywania efektów przy każdym renderze.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [stage, setStage] = useState<"intro" | "running" | "done">("intro");
  const [mode, setMode] = useState<SessionMode>("parent");
  const [screens, setScreens] = useState<S[]>([]);
  const [frontier, setFrontier] = useState(0);
  const [index, setIndex] = useState(0);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  const [interrupting, setInterrupting] = useState(false);

  const attemptsRef = useRef(new Map<number, PendingAttempt>());
  const frontierRef = useRef(0);
  const startedRef = useRef(0);
  const modeRef = useRef<SessionMode>("parent");
  const bonusStartRef = useRef<number | null>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    primeSpeech();
    return () => stopAudio();
  }, []);

  const collected = useCallback(
    () =>
      [...attemptsRef.current.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, attempt]) => attempt),
    [],
  );

  const start = useCallback((chosenMode: SessionMode) => {
    // Start to gest użytkownika — jedyny moment, w którym iOS pozwala
    // odblokować dźwięk na resztę sesji.
    unlockAudio();
    stopAudio();
    modeRef.current = chosenMode;
    setMode(chosenMode);
    setScreens(optionsRef.current.build(chosenMode));
    attemptsRef.current = new Map();
    frontierRef.current = 0;
    bonusStartRef.current = null;
    committedRef.current = false;
    startedRef.current = Date.now();
    setFrontier(0);
    setIndex(0);
    setOutcome(null);
    setInterrupting(false);
    setStage("running");
  }, []);

  const onAnswer = useCallback((attempt: PendingAttempt) => {
    // Runda bonusowa nie zapisuje prób — wynik zapadł przy pierwszym podejściu.
    if (bonusStartRef.current !== null && frontierRef.current >= bonusStartRef.current) return;
    const map = attemptsRef.current;
    if (!map.has(frontierRef.current)) map.set(frontierRef.current, attempt);
  }, []);

  const onNext = useCallback(() => {
    stopAudio();
    const next = frontierRef.current + 1;
    frontierRef.current = next;
    setFrontier(next);
    setIndex(next);
  }, []);

  const commitOnce = useCallback((): SessionOutcome | null => {
    if (committedRef.current) return null;
    committedRef.current = true;
    return optionsRef.current.commit(collected(), modeRef.current, startedRef.current);
  }, [collected]);

  useEffect(() => {
    if (stage !== "running" || screens.length === 0 || frontier < screens.length) return;
    const bonusFor = optionsRef.current.bonusFor;
    if (bonusStartRef.current === null && bonusFor) {
      const extra = [...attemptsRef.current.entries()]
        .filter(([, attempt]) => attempt.correct === false)
        .slice(0, 3)
        .map(([i]) => bonusFor(screens[i]))
        .filter((screen): screen is S => screen !== null && screen !== undefined);
      if (extra.length > 0) {
        bonusStartRef.current = screens.length;
        setScreens((previous) => [...previous, ...extra]);
        return;
      }
    }
    const result = commitOnce();
    if (result) setOutcome(result);
    setStage("done");
  }, [stage, frontier, screens, commitOnce]);

  const screen = screens[index];

  return {
    stage,
    mode,
    screens,
    frontier,
    index,
    screen,
    isReview: index < frontier,
    inBonus: bonusStartRef.current !== null && index >= bonusStartRef.current,
    outcome,
    interrupting,
    start,
    onAnswer,
    onNext,
    goBack: () => {
      stopAudio();
      setIndex((previous) => Math.max(0, previous - 1));
    },
    goForward: () => {
      stopAudio();
      setIndex((previous) => Math.min(frontierRef.current, previous + 1));
    },
    openInterrupt: () => setInterrupting(true),
    closeInterrupt: () => setInterrupting(false),
    saveNow: () => {
      stopAudio();
      commitOnce();
    },
    scoredCount: () =>
      [...attemptsRef.current.values()].filter((attempt) => attempt.correct !== null).length,
    attemptAt: (i: number) => attemptsRef.current.get(i),
  };
}
