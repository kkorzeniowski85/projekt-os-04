"use client";

/**
 * Magazyn postępu — jedyne miejsce dostępu do danych (KONWENCJE.md). Gdy
 * dojdzie backend, przepisuje się ten jeden plik.
 *
 * Sesja zapisuje się JEDNYM commitem na końcu (commitSession), a nie po każdym
 * kliknięciu: do skrzynki synchronizacji trafiają zamknięte, niepodzielne
 * paczki, a przerwana sesja bez zapisu nie zostawia śladu.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { mergeProgress } from "./merge";
import { accuracyOf, commitToState } from "./rules";
import {
  emptyProgress,
  normalizeProgress,
  PROGRESS_SCHEMA_VERSION,
  STORAGE_KEY,
  type Attempt,
  type DeviceRole,
  type MockRecord,
  type ModuleId,
  type ProgressState,
  type SessionKind,
  type SessionMode,
  type SessionRecord,
} from "./types";

/** Moduł, jednostkę i tryb dokleja commitSession — ekran ćwiczenia ich nie zna. */
export type PendingAttempt = Omit<Attempt, "id" | "mode" | "module" | "unitId">;

export type SessionCommit = {
  module: ModuleId;
  unitId: string;
  kind: SessionKind;
  mode: SessionMode;
  device: DeviceRole;
  startedTs: number;
  endedTs: number;
  attempts: PendingAttempt[];
};

export type SessionOutcome = {
  session: SessionRecord;
  accuracy: number | null;
  /** Fakty tabliczki, które w tej sesji weszły do pudełka „płynnie". */
  newlyFluent: string[];
  /** Tylko dla próbnego testu MTC. */
  mock?: MockRecord;
};

type ProgressContextValue = {
  /** Dopóki false, dane z localStorage jeszcze się nie wczytały. */
  ready: boolean;
  state: ProgressState;
  /**
   * `flush`: zapis do localStorage od razu, nie w kolejnym renderze — przy
   * zamykaniu strony (pagehide) render może już nie nastąpić.
   */
  commitSession: (commit: SessionCommit, options?: { flush?: boolean }) => SessionOutcome;
  /** Scala postęp z pliku (unia sesji). Zwraca liczbę dodanych sesji. */
  importProgress: (incoming: ProgressState) => number;
  setChildName: (name: string) => void;
  resetAll: () => void;
  /** Ręczne kopnięcie synchronizacji (np. zaraz po jej włączeniu). */
  requestSync: () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function load(): ProgressState {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as ProgressState;
    if (parsed.version !== PROGRESS_SCHEMA_VERSION) {
      // Migracji jeszcze nie ma. KONWENCJE zabraniają cichego kasowania danych
      // dziecka, więc surowy zapis odkładamy pod klucz zapasowy.
      try {
        window.localStorage.setItem(`${STORAGE_KEY}.backup.v${parsed.version}`, raw);
      } catch {
        // brak miejsca — trudno
      }
      return { ...emptyProgress(parsed.childName), version: PROGRESS_SCHEMA_VERSION };
    }
    return normalizeProgress(parsed);
  } catch {
    return emptyProgress();
  }
}

function save(state: ProgressState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Brak miejsca / tryb prywatny — sesja i tak doliczy się w pamięci.
  }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(() => emptyProgress());
  const [ready, setReady] = useState(false);

  // Najświeższy stan dla synchronizacji i dla commitSession — domknięcia w
  // timerach widziałyby inaczej stan z chwili rejestracji.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

  // Postęp otwarty na dwóch kartach naraz (rodzic w raporcie, dziecko ćwiczy).
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setState(load());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((updater: (previous: ProgressState) => ProgressState) => {
    setState((previous) => {
      const next = updater(previous);
      if (next === previous) return previous;
      save(next);
      return next;
    });
  }, []);

  // --- automatyczna synchronizacja między urządzeniami ----------------------

  const runSync = useCallback(() => {
    void (async () => {
      const { syncNow } = await import("./sync");
      await syncNow(stateRef.current, (merged) => {
        update((previous) => {
          const next = mergeProgress(previous, merged);
          return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
        });
      });
    })();
  }, [update]);

  useEffect(() => {
    if (!ready) return;
    void import("./sync").then(({ adoptFromHash, adoptFromLiga, loadSyncCode }) => {
      adoptFromHash();
      // Liga Dźwięków sparowana na tym urządzeniu = Akademia też, bez klikania.
      adoptFromLiga();
      if (loadSyncCode()) runSync();
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") runSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", runSync);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") runSync();
    }, 3 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", runSync);
      clearInterval(timer);
    };
  }, [ready, runSync]);

  // Wysyłka po każdej zmianie postępu (z odstępem, żeby seria zmian poszła raz).
  useEffect(() => {
    // Po „Wyczyść postęp" też trzeba wysłać — inaczej skrzynka oddałaby stary stan.
    if (!ready || (state.sessions.length === 0 && !state.resetTs)) return;
    const timer = setTimeout(runSync, 2000);
    return () => clearTimeout(timer);
  }, [state, ready, runSync]);

  const commitSession = useCallback(
    (commit: SessionCommit, options?: { flush?: boolean }): SessionOutcome => {
      const attempts: Attempt[] = commit.attempts.map((attempt) => ({
        ...attempt,
        id: newId(),
        mode: commit.mode,
        module: commit.module,
        unitId: commit.unitId,
      }));
      const scored = attempts.filter((attempt) => attempt.correct !== null);
      const session: SessionRecord = {
        id: newId(),
        module: commit.module,
        unitId: commit.unitId,
        kind: commit.kind,
        mode: commit.mode,
        device: commit.device,
        startedTs: commit.startedTs,
        endedTs: commit.endedTs,
        correct: scored.filter((attempt) => attempt.correct).length,
        scored: scored.length,
      };

      // Wynik dla ekranu nagrody liczymy od razu, ze stanu sprzed zapisu —
      // updater setState React wykonuje później, więc nie wolno na nim polegać
      // przy zwracaniu wartości.
      const before = stateRef.current;
      const after = commitToState(before, session, attempts);
      const newlyFluent = Object.keys(after.facts).filter(
        (key) => (after.facts[key]?.box ?? 0) >= 4 && (before.facts[key]?.box ?? 0) < 4,
      );

      if (options?.flush) save(after);
      update((previous) => commitToState(previous, session, attempts));

      return {
        session,
        accuracy: accuracyOf(session),
        newlyFluent,
        mock: commit.kind === "mock" ? after.mocks[after.mocks.length - 1] : undefined,
      };
    },
    [update],
  );

  const importProgress = useCallback(
    (incoming: ProgressState): number => {
      const added = mergeProgress(stateRef.current, incoming).sessions.length - stateRef.current.sessions.length;
      update((previous) => mergeProgress(previous, incoming));
      return added;
    },
    [update],
  );

  const setChildName = useCallback(
    (name: string) => update((previous) => ({ ...previous, childName: name, childNameTs: Date.now() })),
    [update],
  );

  // Znacznik resetu rozchodzi się przez synchronizację: pozostałe urządzenia
  // przy scaleniu odrzucą wszystko sprzed tej chwili.
  const resetAll = useCallback(
    () =>
      update((previous) => ({
        ...emptyProgress(previous.childName),
        childNameTs: previous.childNameTs,
        resetTs: Date.now(),
        updatedTs: Date.now(),
      })),
    [update],
  );

  const value = useMemo<ProgressContextValue>(
    () => ({
      ready,
      state,
      commitSession,
      importProgress,
      setChildName,
      resetAll,
      requestSync: runSync,
    }),
    [ready, state, commitSession, importProgress, setChildName, resetAll, runSync],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress musi być użyte wewnątrz <ProgressProvider>");
  }
  return context;
}
