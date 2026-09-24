/**
 * Model postępu Akademii.
 *
 * Ten sam format co w Lidze Dźwięków (KONWENCJE.md): stan w localStorage pod
 * kluczem `school.progress.v1`, zapis zamkniętymi paczkami (cała sesja naraz),
 * każdy rekord z własnym `id` i znacznikiem czasu, pole `version` na migracje.
 *
 * Przedrostek `school.` nie jest ozdobą: Akademia i Liga stoją na tej samej
 * domenie (kkorzeniowski85.github.io), więc dzielą localStorage. Kolizja
 * kluczy oznaczałaby, że jedna aplikacja nadpisuje postęp drugiej.
 */

export type ModuleId = "tables" | "maths" | "reading" | "tasks";

/** Tryb pracy: dziecko samo vs. wspólnie z rodzicem. */
export type SessionMode = "solo" | "parent";

export type DeviceRole = "phone" | "tablet" | "desktop";

export type UnitStatus = "new" | "learning" | "mastered" | "needs-help";

/**
 * Rodzaj sesji. Ma znaczenie dla reguł tabliczki: trening podnosi i obniża
 * pudełka faktów, a próbny test MTC tylko obniża (ujawnia słabe miejsca).
 */
export type SessionKind = "practice" | "count" | "mock" | "lesson";

export type Attempt = {
  id: string;
  ts: number;
  module: ModuleId;
  /** Jednostka w module: temat, czytanka, „practice", „count-7", „mock"… */
  unitId: string;
  /** Rodzaj ćwiczenia, np. „fact", „mtc", „number-listen", „reading-find". */
  exercise: string;
  /** Czego dotyczyła próba: „7x8", „thirteen", id pytania… */
  item: string;
  /**
   * Co dziecko odpowiedziało. Przy tabliczce odróżnia pomyłkę o jedną grupę
   * (7 × 8 = 48) od braku odpowiedzi — to dwie różne diagnozy.
   */
  answer?: string;
  /** null = ćwiczenie ocenia rodzic albo nikt (np. czytanie na głos solo). */
  correct: boolean | null;
  responseMs: number;
  mode: SessionMode;
};

export type SessionRecord = {
  id: string;
  module: ModuleId;
  unitId: string;
  kind: SessionKind;
  mode: SessionMode;
  device: DeviceRole;
  startedTs: number;
  endedTs: number;
  correct: number;
  /** Liczba ocenianych prób. */
  scored: number;
};

/** Stan jednostki (tematu, czytanki, liczenia) — te same reguły co w Lidze. */
export type UnitState = {
  unitKey: string;
  status: UnitStatus;
  sessions: number;
  lastAccuracy: number | null;
  bestAccuracy: number | null;
  recentAccuracies: number[];
  lastSeenTs: number | null;
};

/**
 * Stan jednego faktu tabliczki (nieuporządkowana para, np. „7x8").
 * Pudełko Leitnera 0–5: 0 = jeszcze nie ćwiczony, 4+ = odpowiada płynnie.
 *
 * Trzymany wprost, a nie odtwarzany z dziennika prób: dziennik jest przycinany
 * (limit rozmiaru synchronizacji), a stan faktu musi przetrwać wszystkie
 * miesiące do czerwca 2028.
 */
export type FactState = {
  box: number;
  dueTs: number;
  lastTs: number;
  seen: number;
  right: number;
  lastMs: number | null;
  bestMs: number | null;
};

export type MockRecord = {
  id: string;
  ts: number;
  score: number;
  total: number;
  device: DeviceRole;
  mode: SessionMode;
  /** Pytania bez punktu, np. „7×8" — w kolejności z testu. */
  missed: string[];
};

export type ProgressState = {
  version: number;
  childName: string;
  /** Kiedy rodzic ostatnio zmienił imię — rozstrzyga imię przy scalaniu. */
  childNameTs: number;
  /**
   * Kiedy rodzic wyczyścił postęp (0 = nigdy). Rekordy starsze niż ta chwila
   * są pomijane przy scalaniu — bez tego skasowany postęp wracał z chmury
   * przy najbliższej synchronizacji.
   */
  resetTs: number;
  /**
   * Kiedy rodzic przywrócił kopię sprzed wyczyszczenia (0 = nigdy). Późniejsze
   * przywrócenie znosi granicę resetu — patrz progressCutoff. Samo wyzerowanie
   * resetTs nic by nie dało: scalanie bierze większy znacznik z obu stron.
   */
  restoreTs: number;
  updatedTs: number;
  units: Record<string, UnitState>;
  facts: Record<string, FactState>;
  mocks: MockRecord[];
  sessions: SessionRecord[];
  attempts: Attempt[];
};

export const PROGRESS_SCHEMA_VERSION = 1;

export const STORAGE_KEY = "school.progress.v1";

export function unitKeyOf(module: ModuleId, unitId: string): string {
  return `${module}:${unitId}`;
}

/**
 * Granica odcięcia: rekordy starsze od niej odpadają przy scalaniu. To
 * `resetTs`, chyba że później przywrócono kopię (`restoreTs`) — wtedy 0, czyli
 * nic nie odpada. Wszędzie tej funkcji, a nie gołego `resetTs`.
 */
export function progressCutoff(state: Pick<ProgressState, "resetTs" | "restoreTs">): number {
  const reset = state.resetTs ?? 0;
  return reset > (state.restoreTs ?? 0) ? reset : 0;
}

/**
 * Domyślna nazwa jest neutralna, bo repozytorium jest publiczne. Imię (albo
 * pseudonim) wpisuje się w trybie rodzica; nie trafia do repozytorium, ale
 * przy włączonej synchronizacji jedzie w skrzynce textdb.dev (sync.ts).
 */
export function emptyProgress(childName = "Bohater"): ProgressState {
  return {
    version: PROGRESS_SCHEMA_VERSION,
    childName,
    childNameTs: 0,
    resetTs: 0,
    restoreTs: 0,
    updatedTs: 0,
    units: {},
    facts: {},
    mocks: [],
    sessions: [],
    attempts: [],
  };
}

export function emptyUnitState(unitKey: string): UnitState {
  return {
    unitKey,
    status: "new",
    sessions: 0,
    lastAccuracy: null,
    bestAccuracy: null,
    recentAccuracies: [],
    lastSeenTs: null,
  };
}

export function emptyFactState(): FactState {
  return { box: 0, dueTs: 0, lastTs: 0, seen: 0, right: 0, lastMs: null, bestMs: null };
}

const MODULES = new Set<string>(["tables", "maths", "reading", "tasks"]);

/**
 * Uzupełnia pola brakujące w stanie z zewnątrz (plik, skrzynka, starsza
 * wersja). Uzupełniamy zamiast odrzucać — dane dziecka nie znikają po cichu.
 * Odrzucamy tylko rekordy spoza modelu Akademii (np. sesje Ligi Dźwięków z
 * pomylonego pliku kopii): bez modułu nie da się ich policzyć ani pokazać.
 */
export function normalizeProgress(state: ProgressState): ProgressState {
  const named = typeof state.childName === "string" && state.childName !== "Bohater";
  return {
    ...emptyProgress(state.childName ?? "Bohater"),
    ...state,
    // Imię wpisane przed wprowadzeniem znacznika wygrywa z domyślnym „Bohater".
    childNameTs: typeof state.childNameTs === "number" ? state.childNameTs : named ? 1 : 0,
    resetTs: typeof state.resetTs === "number" ? state.resetTs : 0,
    restoreTs: typeof state.restoreTs === "number" ? state.restoreTs : 0,
    units: state.units && typeof state.units === "object" ? state.units : {},
    facts: state.facts && typeof state.facts === "object" ? state.facts : {},
    mocks: Array.isArray(state.mocks) ? state.mocks : [],
    sessions: (Array.isArray(state.sessions) ? state.sessions : []).filter(
      (session) =>
        session &&
        typeof session.id === "string" &&
        MODULES.has(session.module) &&
        typeof session.unitId === "string" &&
        typeof session.kind === "string",
    ),
    attempts: (Array.isArray(state.attempts) ? state.attempts : []).filter(
      (attempt) => attempt && typeof attempt.id === "string" && MODULES.has(attempt.module),
    ),
  };
}
