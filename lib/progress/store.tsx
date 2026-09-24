"use client";

/**
 * Magazyn postępu — jedyne miejsce dostępu do danych (KONWENCJE.md). Gdy
 * dojdzie backend, przepisuje się ten jeden plik.
 *
 * Sesja zapisuje się commitem całej sesji (commitSession), a nie po każdym
 * kliknięciu: do skrzynki synchronizacji trafiają całe paczki, a sesja
 * porzucona przez „Wyjdź bez zapisu" nie zostawia śladu. Sesja z `id` może
 * zapisać się więcej niż raz (pagehide, a po powrocie strony z bfcache
 * dokończenie) — to upsert po id (rules.ts: commitToState), nie duplikat.
 *
 * Odpowiedzi trwającej sesji leżą też w szkicu (lib/session/draft.ts): strona
 * ubita w tle nie dostaje ani pagehide, ani sprzątania Reacta, więc szkic
 * pozostawiony przez martwą stronę zatwierdzamy przy następnym wczytaniu i
 * przy powrocie karty na ekran (długo otwarta karta podejmuje szkic po
 * karcie, która zginęła) — ale tylko wtedy, gdy tej sesji nie prowadzi żadna
 * karta (Web Lock, draft.ts). Inaczej rodzic otwierający raport zatwierdzałby
 * sesję, którą dziecko w drugiej karcie może jeszcze porzucić.
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
import {
  canTellIdle,
  clearDraft,
  commitOfDraft,
  draftIds,
  readDraft,
  whenSessionIdle,
  type SessionDraft,
} from "@/lib/session/draft";
import { mergeProgress, previewImport, sessionsDiff, withRestore, type ImportResult } from "./merge";
import { accuracyOf, commitToState } from "./rules";
import {
  emptyProgress,
  normalizeProgress,
  progressCutoff,
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
  /**
   * Stałe id sesji (useSessionFlow nadaje je przy starcie). Z nim ponowny
   * zapis tej samej sesji jest upsertem, a próby dostają id `${id}-${n}`
   * (n = pozycja; próby tylko się dopisują, więc pozycja jest stała).
   * Bez niego (próbny test) — zapis jednorazowy z losowymi id.
   */
  id?: string;
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
   * zamykaniu strony (pagehide) render może już nie nastąpić. Zapis z `id`
   * jest zawsze natychmiastowy (kasuje szkic sesji) i jest upsertem.
   */
  commitSession: (commit: SessionCommit, options?: { flush?: boolean }) => SessionOutcome;
  /**
   * Scala postęp z pliku kopii (mergeProgress). Uwaga: to NIE jest czysta unia —
   * plik z nowszym „Wyczyść postęp" usuwa tu sesje sprzed niego, a sesje z
   * pliku sprzed tutejszego resetu odpadają, chyba że `restore` (przywrócenie
   * kopii, rozchodzi się na pozostałe urządzenia). Panel pyta o to rodzica
   * wcześniej (previewImport). Zwraca, ile sesji doszło, a ile ubyło.
   */
  importProgress: (incoming: ProgressState, options?: { restore?: boolean }) => ImportResult;
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

function save(state: ProgressState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Brak miejsca / tryb prywatny — sesja i tak doliczy się w pamięci.
    return false;
  }
}

/** Rekordy sesji i prób z zapisu sesji (id — patrz SessionCommit). */
export function recordsOf(commit: SessionCommit): { session: SessionRecord; attempts: Attempt[] } {
  const attempts: Attempt[] = commit.attempts.map((attempt, n) => ({
    ...attempt,
    id: commit.id ? `${commit.id}-${n}` : newId(),
    mode: commit.mode,
    module: commit.module,
    unitId: commit.unitId,
  }));
  const scored = attempts.filter((attempt) => attempt.correct !== null);
  const session: SessionRecord = {
    id: commit.id ?? newId(),
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
  return { session, attempts };
}

/**
 * Stan z zatwierdzonym szkicem albo ten sam obiekt, gdy nie ma czego dodać.
 * Upsert po id (commitToState), więc szkic odzyskany drugi raz albo szkic
 * sesji już zapisanej niczego nie dubluje.
 */
function withDraft(state: ProgressState, draft: SessionDraft): ProgressState {
  const { session, attempts } = recordsOf(commitOfDraft(draft));
  // Pusty szkic albo sprzed „Wyczyść postęp" — nic do odzyskania.
  // Sesja już zapisana w całości (szkic przeżył zapis) — też nic.
  const known = new Set(state.attempts.map((attempt) => attempt.id));
  const saved =
    state.sessions.some((existing) => existing.id === session.id) &&
    attempts.every((attempt) => known.has(attempt.id));
  if (attempts.length === 0 || session.endedTs < progressCutoff(state) || saved) return state;
  return commitToState(state, session, attempts);
}

/**
 * Szkic sesji pozostawiony przez martwą stronę → zwykła sesja, od razu w
 * localStorage. Szkic znika dopiero, gdy stan jest zapisany. `id`: szkic tej
 * sesji (tej, której blokadę trzymamy — whenSessionIdle). Sprawdzenie, czy
 * sesja nie trwa w innej karcie, jest po stronie wołającego.
 */
export function recoverSessionDraft(state: ProgressState, id: string): ProgressState {
  const draft = readDraft(id);
  if (!draft) return state;
  const next = withDraft(state, draft);
  if (next === state || save(next)) clearDraft(id);
  return next;
}

/**
 * Najpóźniejszy znacznik czasu wśród sesji, prób i próbnych testów (0, gdy nic
 * nie ma), ale nie dalej niż dobę naprzód: jeden rekord z urządzenia z zegarem
 * przestawionym o lata do przodu nie może przesunąć resetu w przyszłość —
 * reset odcinałby wtedy wszystkie sesje rodziny aż do tej daty. Jak w Lidze.
 */
function newestRecordTs(state: ProgressState): number {
  const newest = Math.max(
    0,
    ...state.sessions.map((session) => session.endedTs),
    ...state.attempts.map((attempt) => attempt.ts),
    ...state.mocks.map((mock) => mock.ts),
  );
  return Math.min(newest, Date.now() + 24 * 60 * 60 * 1000);
}

/** Zapamiętuje, że znaczniki resetu/przywrócenia zapadły w bieżącej rodzinie (albo bez niej). */
async function noteMarkersFamily(): Promise<void> {
  const { loadSyncCode, setMarkersFamily } = await import("./sync");
  setMarkersFamily(loadSyncCode());
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

  // Odzysk szkiców przy wczytaniu i przy powrocie karty na ekran — nie w
  // load(), które działa też na zdarzenie storage z innej karty. Szkic sesji,
  // która trwa w jakiejś karcie (jej blokada zajęta), zostaje — zapisze go ta
  // karta albo, jeśli zginie, następne wczytanie lub powrót na ekran. Powrót
  // na ekran liczy się tylko z Web Locks: bez nich karta zatwierdzałaby
  // własną, wciąż trwającą sesję (canTellIdle).
  useEffect(() => {
    const recoverIdle = () => {
      for (const id of draftIds()) {
        whenSessionIdle(id, () => {
          // Szkic czytany na nowo: mógł się zmienić, zanim blokada była wolna.
          const current = readDraft(id);
          if (!current) return;
          // Najpierw zapis w localStorage (tam szkic może zniknąć dopiero po
          // zapisie), potem to samo w pamięci — oba to upsert, więc bez dubli.
          recoverSessionDraft(load(), id);
          update((previous) => withDraft(previous, current));
        });
      }
    };
    recoverIdle();
    if (!canTellIdle()) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") recoverIdle();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [update]);

  // --- automatyczna synchronizacja między urządzeniami ----------------------

  const runSync = useCallback(() => {
    const pass = async (): Promise<void> => {
      const { adoptFromLiga, finishJoin, loadSyncCode, markersFamily, pendingJoin, setMarkersFamily, syncNow } =
        await import("./sync");
      // Przed każdym obiegiem: kod mógł się zmienić w innej karcie Akademii
      // albo w Lidze Dźwięków (kod przejęty z Ligi idzie za nią) — inaczej
      // otwarta karta wysyłałaby do starej skrzynki aż do przeładowania.
      loadSyncCode();
      adoptFromLiga();
      const family = loadSyncCode();
      if (!family) return;

      // Reset albo przywrócenie zrobione poza tą rodziną (bez synchronizacji
      // albo w innym obiegu) dotyczy tylko tego urządzenia: zdejmujemy znaczniki
      // PRZED pierwszym scaleniem ze skrzynką, inaczej skasowałyby historię
      // pozostałych urządzeń (sync.ts: markersFamily). Sesji sprzed resetu tu
      // już nie ma, więc nic nie wraca.
      if (markersFamily() !== family) {
        const current = stateRef.current;
        if (current.resetTs || current.restoreTs) {
          stateRef.current = { ...current, resetTs: 0, restoreTs: 0 };
          update((previous) =>
            previous.resetTs || previous.restoreTs ? { ...previous, resetTs: 0, restoreTs: 0 } : previous,
          );
        }
        setMarkersFamily(family);
      }

      // I w drugą stronę: reset zrobiony w rodzinie, zanim to urządzenie do
      // niej dołączyło, nie kasuje jego historii (sync.ts: pendingJoin). Gdy
      // skrzynka odcięłaby sesje stąd, przy pierwszym scaleniu zachowujemy je
      // przywróceniem — jak przy wczytaniu kopii ze zgodą rodzica. Kosztem
      // jest to, że wrócą też sesje sprzed tamtego resetu z urządzeń rodziny,
      // które od resetu nie były w sieci; to lepsze niż ciche skasowanie
      // całej historii. Tak samo w Lidze.
      const joining = pendingJoin() === family;
      let kept: { sessions: number; resetTs: number } | null = null;
      const keepOnJoin = (remote: ProgressState): ProgressState => {
        const current = stateRef.current;
        if (loadSyncCode() !== family) return current;
        const { removed, mergedCutoff } = previewImport(current, remote);
        if (removed === 0) return current;
        const restoreTs = Math.max(Date.now(), (remote.resetTs ?? 0) + 1, (current.resetTs ?? 0) + 1);
        const restored = (previous: ProgressState) =>
          (previous.restoreTs ?? 0) >= restoreTs ? previous : { ...previous, restoreTs };
        stateRef.current = restored(current);
        update(restored);
        kept = { sessions: removed, resetTs: mergedCutoff };
        return stateRef.current;
      };

      let stale = false;
      await syncNow(
        stateRef.current,
        (merged) => {
          // Obieg zaczęty dla innej rodziny (w międzyczasie podłączenie w
          // drugiej karcie albo zmiana za Ligą): jego wynik niesie znaczniki
          // starej rodziny, które przed chwilą zdjęliśmy — przyjęcie go
          // wyczyściłoby historię nowej.
          if (loadSyncCode() !== family) {
            stale = true;
            return;
          }
          // Od razu, nie dopiero po renderze: podgląd importu i wynik importu
          // czytają stateRef i muszą widzieć np. reset, który właśnie przyszedł.
          stateRef.current = mergeProgress(stateRef.current, merged);
          update((previous) => {
            const next = mergeProgress(previous, merged);
            return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
          });
          if (joining) finishJoin(family, kept);
        },
        joining ? keepOnJoin : undefined,
      );
      // Obieg nowej rodziny odbił się od obiegu starej — robimy go od razu,
      // zamiast czekać na zegar.
      if (stale || loadSyncCode() !== family) return pass();
    };
    void pass();
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
    // Liga i Akademia stoją na tej samej domenie, więc zmiana kodu rodziny w
    // Lidze (albo w innej karcie Akademii) dociera tu zdarzeniem storage.
    // Nazwy kluczy jak w sync.ts (LIGA_SYNC_KEY, STORAGE_KEY).
    const onSyncKey = (event: StorageEvent) => {
      if (event.key === "phonics.sync.v2" || event.key === "school.sync.v1") runSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", runSync);
    window.addEventListener("storage", onSyncKey);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") runSync();
    }, 3 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", runSync);
      window.removeEventListener("storage", onSyncKey);
      clearInterval(timer);
    };
  }, [ready, runSync]);

  // Wysyłka po każdej zmianie postępu (z odstępem, żeby seria zmian poszła raz).
  useEffect(() => {
    // Po „Wyczyść postęp" też trzeba wysłać — inaczej skrzynka oddałaby stary
    // stan. Imię wpisane przed pierwszą sesją też jedzie.
    if (!ready || (state.sessions.length === 0 && !state.resetTs && !state.childNameTs)) return;
    const timer = setTimeout(runSync, 2000);
    return () => clearTimeout(timer);
  }, [state, ready, runSync]);

  const commitSession = useCallback(
    (commit: SessionCommit, options?: { flush?: boolean }): SessionOutcome => {
      const { session, attempts } = recordsOf(commit);

      // Wynik dla ekranu nagrody liczymy od razu, ze stanu sprzed zapisu —
      // updater setState React wykonuje później, więc nie wolno na nim polegać
      // przy zwracaniu wartości.
      const before = stateRef.current;
      const after = commitToState(before, session, attempts);
      const newlyFluent = Object.keys(after.facts).filter(
        (key) => (after.facts[key]?.box ?? 0) >= 4 && (before.facts[key]?.box ?? 0) < 4,
      );
      // Kolejny zapis w tym samym takcie (przed renderem) liczy już od tego stanu.
      stateRef.current = after;

      // Sesja z id ma szkic: skasować go wolno dopiero, gdy stan jest już w
      // localStorage — updater niżej zapisuje dopiero przy renderze.
      if (options?.flush || commit.id) {
        if (save(after) && commit.id) clearDraft(commit.id);
      }
      update((previous) => commitToState(previous, session, attempts));

      return {
        session,
        accuracy: accuracyOf(session),
        newlyFluent,
        mock: commit.kind === "mock" ? after.mocks.find((mock) => mock.id === session.id) : undefined,
      };
    },
    [update],
  );

  const importProgress = useCallback(
    (incoming: ProgressState, options?: { restore?: boolean }): ImportResult => {
      const before = stateRef.current;
      const source = options?.restore ? withRestore(before, incoming) : incoming;
      const after = mergeProgress(before, source);
      stateRef.current = after;
      update((previous) => mergeProgress(previous, source));
      // Znaczniki z pliku (nowszy reset, przywrócenie) zapadają w bieżącej
      // rodzinie — bez tego pierwszy obieg uznałby je za obce i zdjął.
      if (after.resetTs !== before.resetTs || after.restoreTs !== before.restoreTs) void noteMarkersFamily();
      return sessionsDiff(before, after);
    },
    [update],
  );

  // Znacznik zmiany imienia rośnie zawsze, także gdy obecne imię ustawiło
  // urządzenie ze spieszącym się zegarem — inaczej nowsza zmiana przegrałaby
  // przy scalaniu ze starszą.
  const setChildName = useCallback(
    (name: string) =>
      update((previous) => ({
        ...previous,
        childName: name,
        childNameTs: Math.max(Date.now(), (previous.childNameTs ?? 0) + 1),
      })),
    [update],
  );

  // Znacznik resetu rozchodzi się przez synchronizację: pozostałe urządzenia
  // przy scaleniu odrzucą wszystko sprzed tej chwili (progressCutoff). Reset
  // musi wypaść po ostatnim przywróceniu (inaczej granica znika) i po każdym
  // rekordzie, który tu jest — także zapisanym przez urządzenie ze spieszącym
  // się zegarem — inaczej „Wyczyść postęp" zostawiałby część sesji. Granica
  // może przez to leżeć chwilę „w przyszłości": sesje zapisane potem na
  // urządzeniach, które reset już znają, i tak zostają (merge.ts: knowsCutoff).
  // Tak samo w Lidze.
  const resetAll = useCallback(() => {
    const reset = (previous: ProgressState): ProgressState => ({
      ...emptyProgress(previous.childName),
      childNameTs: previous.childNameTs,
      restoreTs: previous.restoreTs,
      resetTs: Math.max(
        Date.now(),
        (previous.resetTs ?? 0) + 1,
        (previous.restoreTs ?? 0) + 1,
        newestRecordTs(previous) + 1,
      ),
      updatedTs: Date.now(),
    });
    stateRef.current = reset(stateRef.current);
    update(reset);
    void noteMarkersFamily();
  }, [update]);

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
