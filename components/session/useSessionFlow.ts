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
 *    bez punktów, po to, żeby ostatni kontakt z trudnym materiałem był udany.
 *    Wynik zapisuje się już PRZED bonusem — wyjście w rundzie „bez punktów"
 *    nie może kasować ukończonej sesji;
 *  - przerwanie: „Zapisz i wyjdź" albo „Wyjdź bez zapisu". Wyjście w inny
 *    sposób ZAPISUJE zrobioną pracę — okna przerwania wtedy nie ma, a cicha
 *    utrata dwudziestu odpowiedzi to dokładnie to, przed czym okno miało
 *    chronić. Drogi są trzy:
 *      · systemowe „wstecz" tabletu albo link poza sesję — zapis przy
 *        odmontowaniu;
 *      · odświeżenie, zamknięcie karty — zapis przy pagehide;
 *      · Home / inna aplikacja, po której system po cichu ubija kartę (bez
 *        pagehide i bez sprzątania Reacta) — szkic sesji zapisywany
 *        synchronicznie przy każdej odpowiedzi i przy zejściu strony z ekranu
 *        (lib/session/draft.ts, osobny klucz na sesję); magazyn zatwierdza
 *        go przy następnym starcie albo gdy inna karta wróci na ekran.
 *    Sesja ma stałe id, więc zapisy są upsertem: po pagehide strona może
 *    wrócić z bfcache, a kolejne zapisy uzupełniają TĘ SAMĄ sesję.
 *    Trwająca sesja trzyma blokadę (Web Lock, draft.ts), żeby magazyn w
 *    innej karcie nie zatwierdził jej szkicu, zanim dziecko skończy albo
 *    wybierze „Wyjdź bez zapisu". Przy pagehide blokadę zwalniamy (sesja jest
 *    już wtedy zapisana, a blokada nie może trzymać strony poza bfcache);
 *    po powrocie z bfcache bierzemy ją znowu.
 *    Sesja bez ani jednej odpowiedzi nie zostawia śladu nigdy;
 *  - czas odpowiedzi liczy się od pierwszego pokazania ekranu (↩ i powrót go
 *    nie zerują — czas na powtórce się wlicza), ale stoi przy otwartym oknie
 *    przerwania i gdy strona jest w tle (zgaszony tablet, inna aplikacja).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { primeSpeech, stopAudio, unlockAudio } from "@/lib/audio";
import type { PendingAttempt, SessionOutcome } from "@/lib/progress/store";
import type { SessionMode } from "@/lib/progress/types";
import {
  clearDraft,
  holdSessionLock,
  newSessionId,
  writeDraft,
  type SessionDraft,
} from "@/lib/session/draft";
import { useBusy } from "@/lib/sessionBusy";

/** Co zapisać: cała sesja do tej chwili, zawsze pod tym samym `id`. */
export type SessionSnapshot = {
  id: string;
  mode: SessionMode;
  startedTs: number;
  attempts: PendingAttempt[];
};

/** Część szkicu, której przebieg nie zna (dokłada ją SessionRunner). */
export type DraftMeta = Omit<SessionDraft, "id" | "mode" | "startedTs" | "attempts">;

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
  /** „Zapisz i wyjdź". Bez żadnej odpowiedzi nic nie zapisuje. */
  saveNow: () => void;
  /** „Wyjdź bez zapisu": wyjście z ekranu niczego nie zapisze. */
  discard: () => void;
  /** Czy jest coś do zapisania (choć jedna odpowiedź). */
  hasWork: () => boolean;
  /** Czy sesja jest zapisana i od zapisu nie przybyło odpowiedzi. */
  isSaved: () => boolean;
  /** Czy część sesji jest już zapisana (np. pagehide, potem powrót strony). */
  savedPart: () => boolean;
  scoredCount: () => number;
  attemptAt: (index: number) => PendingAttempt | undefined;
  /** Czas odpowiedzi na ekranie frontier (ms, bez pauz i czasu w tle). */
  answerMs: () => number;
};

/**
 * Stoper odpowiedzi ekranu frontier. Żyje w przebiegu, nie w ekranie:
 * ↩ odmontowuje ekran ćwiczenia, a powrót montuje go od nowa — zegar w
 * ekranie startowałby wtedy od zera (fałszywie szybka odpowiedź awansowała
 * fakt). Jeden stoper na oba powody wstrzymania: okno otwarte w chwili
 * blokady ekranu nie może odjąć czasu dwa razy.
 */
type Stopwatch = { start: number; since: number | null; dialog: boolean; hidden: boolean };

function newStopwatch(dialog: boolean): Stopwatch {
  const now = Date.now();
  // Ekran pokazany w ukrytej karcie (samo przejście w tle) czeka na powrót.
  const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  return { start: now, since: dialog || hidden ? now : null, dialog, hidden };
}

function holdStopwatch(watch: Stopwatch, reason: "dialog" | "hidden", on: boolean): void {
  const was = watch.dialog || watch.hidden;
  watch[reason] = on;
  const is = watch.dialog || watch.hidden;
  if (!was && is) {
    watch.since = Date.now();
  } else if (was && !is && watch.since !== null) {
    watch.start += Date.now() - watch.since;
    watch.since = null;
  }
}

export function useSessionFlow<S>(options: {
  build: (mode: SessionMode) => S[];
  /**
   * Zapis sesji. Bywa wołany kilka razy z tym samym `id` (wejście w bonus,
   * pagehide, a po powrocie strony dokończenie) — magazyn robi upsert.
   */
  commit: (snapshot: SessionSnapshot, flush?: boolean) => SessionOutcome;
  /** Dane do szkicu sesji; bez nich szkicu nie ma. */
  draft?: DraftMeta;
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

  const idRef = useRef("");
  const attemptsRef = useRef(new Map<number, PendingAttempt>());
  const frontierRef = useRef(0);
  const startedRef = useRef(0);
  const modeRef = useRef<SessionMode>("parent");
  const bonusStartRef = useRef<number | null>(null);
  /** Ile odpowiedzi było przy ostatnim zapisie (0 = jeszcze nic). */
  const savedCountRef = useRef(0);
  const outcomeRef = useRef<SessionOutcome | null>(null);
  const discardRef = useRef(false);
  const interruptingRef = useRef(false);
  const watchRef = useRef<Stopwatch | null>(null);
  /** Zwalnia blokadę „sesja żyje"; null = nie trzymamy. */
  const lockRef = useRef<(() => void) | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // Aktualizacja service workera nie przeładuje strony w trakcie sesji.
  useBusy(stage === "running");

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

  const unsaved = () => attemptsRef.current.size > savedCountRef.current;

  const holdLock = useCallback(() => {
    if (lockRef.current || !idRef.current) return;
    lockRef.current = holdSessionLock(idRef.current);
  }, []);

  const releaseLock = useCallback(() => {
    lockRef.current?.();
    lockRef.current = null;
  }, []);

  /** Szkic sesji — synchronicznie, bo strona może zaraz zniknąć bez ostrzeżenia. */
  const saveDraft = useCallback(() => {
    const meta = optionsRef.current.draft;
    if (!meta || stageRef.current !== "running" || discardRef.current) return;
    if (attemptsRef.current.size <= savedCountRef.current) return;
    writeDraft({
      ...meta,
      id: idRef.current,
      mode: modeRef.current,
      startedTs: startedRef.current,
      attempts: collected(),
    });
  }, [collected]);

  const start = useCallback((chosenMode: SessionMode) => {
    // Start to gest użytkownika — jedyny moment, w którym iOS pozwala
    // odblokować dźwięk na resztę sesji.
    unlockAudio();
    stopAudio();
    releaseLock();
    idRef.current = newSessionId();
    holdLock();
    modeRef.current = chosenMode;
    setMode(chosenMode);
    setScreens(optionsRef.current.build(chosenMode));
    attemptsRef.current = new Map();
    frontierRef.current = 0;
    bonusStartRef.current = null;
    savedCountRef.current = 0;
    outcomeRef.current = null;
    discardRef.current = false;
    interruptingRef.current = false;
    watchRef.current = newStopwatch(false);
    startedRef.current = Date.now();
    stageRef.current = "running";
    setFrontier(0);
    setIndex(0);
    setOutcome(null);
    setInterrupting(false);
    setStage("running");
  }, [holdLock, releaseLock]);

  const onAnswer = useCallback(
    (attempt: PendingAttempt) => {
      // Runda bonusowa nie zapisuje prób — wynik zapadł przy pierwszym podejściu.
      if (bonusStartRef.current !== null && frontierRef.current >= bonusStartRef.current) return;
      const map = attemptsRef.current;
      if (map.has(frontierRef.current)) return;
      map.set(frontierRef.current, attempt);
      saveDraft();
    },
    [saveDraft],
  );

  const onNext = useCallback(() => {
    stopAudio();
    const next = frontierRef.current + 1;
    frontierRef.current = next;
    // Nowy ekran frontier pokazuje się od razu (index = frontier).
    watchRef.current = newStopwatch(interruptingRef.current);
    setFrontier(next);
    setIndex(next);
  }, []);

  /**
   * Zapis sesji: tylko gdy od poprzedniego przybyło odpowiedzi; bez żadnej
   * odpowiedzi — wcale. Ten sam `id` za każdym razem (upsert w magazynie).
   */
  const commit = useCallback(
    (flush = false): SessionOutcome | null => {
      const count = attemptsRef.current.size;
      if (count === 0 || count === savedCountRef.current) return outcomeRef.current;
      savedCountRef.current = count;
      const result = optionsRef.current.commit(
        {
          id: idRef.current,
          mode: modeRef.current,
          startedTs: startedRef.current,
          attempts: collected(),
        },
        flush,
      );
      // Nowe płynne fakty z wcześniejszego zapisu tej sesji też się należą.
      const earlier = outcomeRef.current?.newlyFluent ?? [];
      outcomeRef.current = {
        ...result,
        newlyFluent: [...new Set([...earlier, ...result.newlyFluent])],
      };
      return outcomeRef.current;
    },
    [collected],
  );

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
        commit();
        bonusStartRef.current = screens.length;
        setScreens((previous) => [...previous, ...extra]);
        return;
      }
    }
    commit();
    releaseLock();
    setOutcome(outcomeRef.current ?? emptyOutcome());
    setStage("done");
  }, [stage, frontier, screens, commit, releaseLock]);

  // Wyjście z sesji inną drogą niż okno przerwania: zapisać zrobioną pracę.
  useEffect(() => {
    const saveOnLeave = () => {
      if (stageRef.current === "running" && !discardRef.current) commit(true);
    };
    const onPageHide = () => {
      saveOnLeave();
      releaseLock();
    };
    // Powrót z bfcache: sesja trwa dalej, więc znowu „żyje".
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && stageRef.current === "running" && !discardRef.current) holdLock();
    };
    // Zejście z ekranu (Home, inna aplikacja, zgaszony tablet): stoper staje,
    // a szkic łapie wszystko — po tym zdarzeniu strona może zniknąć bez śladu.
    // Obsługa w samym zdarzeniu, bez stanu Reacta: render może już nie nastąpić.
    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      if (watchRef.current) holdStopwatch(watchRef.current, "hidden", hidden);
      if (hidden) saveDraft();
    };
    // pagehide: odświeżenie, zamknięcie karty. Zapis synchroniczny (flush),
    // bo strona może zniknąć, zanim React dokończy render. Jeśli wróci z
    // bfcache, dalsze odpowiedzi dopiszą się do tej samej sesji.
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      // Odmontowanie: systemowe „wstecz" albo link poza sesję.
      saveOnLeave();
      releaseLock();
    };
  }, [commit, saveDraft, holdLock, releaseLock]);

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
    // Pod oknem przerwania nic się nie przesuwa (okno i tak wyłącza treść pod
    // spodem — inert — to druga linia obrony).
    goBack: () => {
      if (interruptingRef.current) return;
      stopAudio();
      setIndex((previous) => Math.max(0, previous - 1));
    },
    goForward: () => {
      if (interruptingRef.current) return;
      stopAudio();
      setIndex((previous) => Math.min(frontierRef.current, previous + 1));
    },
    openInterrupt: () => {
      interruptingRef.current = true;
      if (watchRef.current) holdStopwatch(watchRef.current, "dialog", true);
      setInterrupting(true);
    },
    closeInterrupt: () => {
      interruptingRef.current = false;
      if (watchRef.current) holdStopwatch(watchRef.current, "dialog", false);
      setInterrupting(false);
    },
    saveNow: () => {
      stopAudio();
      commit(true);
    },
    discard: () => {
      stopAudio();
      discardRef.current = true;
      // Synchronicznie — inaczej porzucona sesja wróciłaby po restarcie.
      // Blokada dopiero po skasowaniu szkicu: wolna blokada = szkic do odzysku.
      clearDraft(idRef.current);
      releaseLock();
    },
    hasWork: () => attemptsRef.current.size > 0,
    isSaved: () => savedCountRef.current > 0 && !unsaved(),
    savedPart: () => savedCountRef.current > 0,
    scoredCount: () =>
      [...attemptsRef.current.values()].filter((attempt) => attempt.correct !== null).length,
    attemptAt: (i: number) => attemptsRef.current.get(i),
    answerMs: () => {
      const watch = watchRef.current;
      if (!watch) return 0;
      return (watch.since ?? Date.now()) - watch.start;
    },
  };
}

/** Wynik sesji bez żadnej odpowiedzi — nic nie zapisano, ale ekran końca się należy. */
function emptyOutcome(): SessionOutcome {
  const now = Date.now();
  return {
    session: {
      id: "",
      module: "tables",
      unitId: "",
      kind: "lesson",
      mode: "parent",
      device: "tablet",
      startedTs: now,
      endedTs: now,
      correct: 0,
      scored: 0,
    },
    accuracy: null,
    newlyFluent: [],
  };
}
