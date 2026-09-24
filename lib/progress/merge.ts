/**
 * Scalanie postępu z dwóch źródeł (inne urządzenie, plik kopii).
 *
 * Zasada jak w Lidze: NIGDY nie nadpisujemy — sesje, próby i próbne testy to
 * unia po `id`, a statusy jednostek odtwarzamy, przepuszczając wszystkie sesje
 * chronologicznie przez te same reguły, które działają na żywo. Kolejność
 * scalania nie ma znaczenia, a to samo źródło wczytane dwa razy niczego nie
 * psuje.
 *
 * Wyjątki:
 *  - reset: rekordy starsze niż granica odcięcia (progressCutoff: najnowszy
 *    `resetTs` z obu stron, chyba że później przywrócono kopię — `restoreTs`)
 *    odpadają — inaczej wyczyszczony postęp wracał z chmury. Nie odpadają
 *    rekordy strony, która tę granicę już znała (knowsCutoff);
 *  - imię: wygrywa późniejsza ZMIANA IMIENIA (`childNameTs`), a nie stan z
 *    późniejszą sesją;
 *  - fakty tabliczki (mergeFact niżej).
 */

import { factKey } from "@/lib/curriculum/tables";
import { nextFactState } from "@/lib/tables/practice";
import { applySessionToUnits, FACT_EXERCISES, RULES } from "./rules";
import {
  normalizeProgress,
  progressCutoff,
  PROGRESS_SCHEMA_VERSION,
  type Attempt,
  type FactState,
  type ProgressState,
  type UnitState,
} from "./types";

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

/**
 * Unia po `id`, gdy ten sam rekord bywa w dwóch wersjach: sesja zapisana na
 * pagehide, a potem dokończona (upsert, rules.ts: commitToState). Wygrywa
 * wersja późniejsza/pełniejsza — niezależnie od tego, która strona jest która.
 */
function latestById<T extends { id: string }>(items: T[], rank: (item: T) => number[]): T[] {
  const kept = new Map<string, T>();
  for (const item of items) {
    const other = kept.get(item.id);
    if (!other) {
      kept.set(item.id, item);
      continue;
    }
    const [p, q] = [rank(item), rank(other)];
    const diff = p.map((value, i) => value - q[i]).find((value) => value !== 0) ?? 0;
    if (diff > 0 || (diff === 0 && JSON.stringify(item) > JSON.stringify(other))) kept.set(item.id, item);
  }
  return [...kept.values()];
}

const byIdTie = (x: { id: string }, y: { id: string }) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

/** Deterministyczny wybór przy remisie — scalanie musi być przemienne. */
function pickTie(x: FactState, y: FactState): FactState {
  if (x.seen !== y.seen) return x.seen > y.seen ? x : y;
  if (x.right !== y.right) return x.right > y.right ? x : y;
  if (x.box !== y.box) return x.box > y.box ? x : y;
  return JSON.stringify(x) >= JSON.stringify(y) ? x : y;
}

/** Fakt, którego dotyczy próba — null, gdy próba nie zmienia stanu faktów. */
function factOfAttempt(attempt: Attempt): string | null {
  if (!FACT_EXERCISES.has(attempt.exercise) || attempt.correct === null) return null;
  const [x, y] = attempt.item.split("x").map(Number);
  return x && y ? factKey(x, y) : null;
}

function byTime(p: Attempt, q: Attempt): number {
  return p.ts - q.ts || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0);
}

/** Te same reguły co na żywo (applyFactAttempts): „mtc" to próbny test. */
function applyAttempt(state: FactState | undefined, attempt: Attempt): FactState {
  return nextFactState(
    state,
    { correct: attempt.correct === true, ms: attempt.responseMs, ts: attempt.ts },
    attempt.exercise === "mtc" ? "mock" : "practice",
  );
}

/** Próby faktów z dziennika, pogrupowane po fakcie. */
function factLog(attempts: Attempt[]): Map<string, Attempt[]> {
  const log = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    const key = factOfAttempt(attempt);
    if (!key) continue;
    const list = log.get(key);
    if (list) list.push(attempt);
    else log.set(key, [attempt]);
  }
  return log;
}

/** Stan faktów odtworzony od zera z prób, chronologicznie. */
function rebuildFacts(attempts: Attempt[]): Record<string, FactState> {
  const facts: Record<string, FactState> = {};
  for (const attempt of [...attempts].sort(byTime)) {
    const key = factOfAttempt(attempt);
    if (key) facts[key] = applyAttempt(facts[key], attempt);
  }
  return facts;
}

/**
 * Czy strona znała już granicę odcięcia, zanim się z nami spotkała. Wtedy jej
 * rekordy sprzed granicy nie są postępem sprzed resetu: przy resecie zniknęły,
 * a przy scaleniu, które granicę przyniosło, odpadły. Zostają tylko te
 * zapisane PO poznaniu resetu — na urządzeniu, którego zegar spóźnia się
 * względem urządzenia, które reset zrobiło (albo gdy reset dostał znacznik z
 * przyszłości: resetAll w store.tsx), i sesja trwająca w chwili resetu. To
 * postęp po resecie, więc zostaje — inaczej świeża sesja dziecka znikałaby
 * przy najbliższej synchronizacji.
 */
function knowsCutoff(side: ProgressState, cutoff: number): boolean {
  return cutoff > 0 && progressCutoff(side) >= cutoff;
}

/**
 * Fakty strony, która nie widziała najnowszego resetu (drugie urządzenie bez
 * synchronizacji między resetem a treningiem, urządzenie offline, stara kopia
 * z pliku). Jej stan faktów niesie historię sprzed resetu, więc odtwarzamy go
 * od zera z jej własnych prób od granicy. Bez tego fakty ćwiczone jako
 * pierwsze po „Wyczyść postęp" wracały z pudełkami sprzed resetu.
 */
function cleanFacts(side: ProgressState, cutoff: number): Record<string, FactState> {
  if (cutoff === 0 || knowsCutoff(side, cutoff)) return side.facts;
  return rebuildFacts(side.attempts.filter((attempt) => attempt.ts >= cutoff));
}

type FactSide = {
  facts: Record<string, FactState>;
  /** Dziennik prób tej strony (bez prób sprzed granicy odcięcia, które odpadają). */
  attempts: Attempt[];
  /** Najstarsza próba w dzienniku — wcześniejsze mogły zostać przycięte. */
  horizon: number;
  /**
   * Od kiedy liczą się liczniki faktów tej strony: jej własna granica odcięcia
   * sprzed scalenia. Wcześniejszych prób w nich nie ma — np. telefon po
   * „Wyczyść postęp" przy wczytywaniu kopii sprzed resetu z przywróceniem.
   */
  countsFrom: number;
};

/**
 * Jeden fakt z dwóch stron.
 *
 * Stan faktu trzymamy wprost, bo dziennik prób jest przycinany (na urządzeniu
 * RULES.attemptLogLimit, w skrzynce jeszcze krócej — sync.ts: doWyslania).
 * Rozbieżność rozpoznajemy po `id` prób: próba faktu obecna w dzienniku jednej
 * strony, a nieobecna w drugiej, to historia, której stan drugiej strony nie
 * zawiera (np. tablet ćwiczył tydzień bez sieci, a telefon w tym czasie też).
 *
 *  - Dziennik strony jest PEŁNY dla faktu, gdy stan faktu da się z niego
 *    odtworzyć co do pola (tyle samo prób co `seen` nie wystarcza: w
 *    dzienniku bywają próby, których stan nie zawiera — pominięte niżej — a
 *    część historii bywa już tylko w liczbach). Gdy jest pełny po obu
 *    stronach, odtwarzamy stan od zera z unii prób: wynik jest taki, jakby
 *    wszystko działo się na jednym urządzeniu.
 *  - Inaczej część historii jest już tylko w liczbach. Strona, która nie ma
 *    czego doczytać (zna każdą próbę drugiej strony, której mogłoby brakować
 *    w jej liczbach — patrz lacks) i ma co najmniej tyle odpowiedzi, wygrywa w
 *    całości. W pozostałych przypadkach bazą jest stan z WCZEŚNIEJSZĄ ostatnią
 *    odpowiedzią, a brakujące mu próby dokładamy: późniejsze od jego ostatniej
 *    odpowiedzi tymi samymi regułami co na żywo, wcześniejsze tylko do
 *    liczników (overlay). Pudełko i termin liczymy potem od nowa od ostatniego
 *    błędu treningu, który leży w obu dziennikach (withSchedule): po błędzie
 *    zależą już tylko od późniejszych prób, a te mamy w komplecie — więc
 *    błędna odpowiedź z urządzenia offline obniża pudełko jak na żywo także
 *    przy przyciętych dziennikach.
 *
 * Liczniki (`seen`, `right`) nigdy nie maleją. Przy przyciętych dziennikach
 * wynik jest przybliżeniem: historii, która wypadła z dzienników, nie da się
 * odtworzyć, a bez błędu w części wspólnej dzienników pudełko zostaje z bazy.
 * Scalanie nie liczy jednak prób podwójnie i nie zależy od kolejności stron.
 */
function mergeFact(
  x: FactState | undefined,
  y: FactState | undefined,
  logX: Attempt[],
  logY: Attempt[],
  sideX: FactSide,
  sideY: FactSide,
): FactState | undefined {
  if (!x || !y) return x ?? y;
  const union = uniqueById([...logX, ...logY]).sort(byTime);
  const withCounts = (state: FactState): FactState => ({
    ...state,
    seen: Math.max(state.seen, x.seen, y.seen),
    right: Math.max(state.right, x.right, y.right),
  });

  const fullX = rebuildsTo(logX, x);
  const fullY = rebuildsTo(logY, y);
  if (fullX && fullY) return withCounts(replay(union) ?? pickTie(x, y));

  const X: FactView = { state: x, log: logX, known: new Set(logX.map((attempt) => attempt.id)), full: fullX, side: sideX };
  const Y: FactView = { state: y, log: logY, known: new Set(logY.map((attempt) => attempt.id)), full: fullY, side: sideY };
  const xLacks = lacks(X, Y, union);
  const yLacks = lacks(Y, X, union);
  if (!xLacks && !yLacks) return withCounts(pickTie(x, y));
  if (!xLacks && x.seen >= y.seen) return withCounts(x);
  if (!yLacks && y.seen >= x.seen) return withCounts(y);

  // Harmonogram odtwarzamy tylko z prób, które mają oba dzienniki (dziennik
  // pełny obejmuje całą historię faktu, więc nie zawęża).
  const common = Math.max(fullX ? -Infinity : sideX.horizon, fullY ? -Infinity : sideY.horizon);
  const latest = Math.max(x.lastTs, y.lastTs);
  const onBase = (base: FactView) => withSchedule(withCounts(overlay(base, union)), union, common, latest);

  // Ten sam stan z różnymi dziennikami: obie bazy dają swój wynik, a wybór
  // między nimi nie może zależeć od kolejności stron.
  if (JSON.stringify(x) === JSON.stringify(y)) return pickTie(onBase(X), onBase(Y));
  let baseIsX: boolean;
  if (x.lastTs !== y.lastTs) baseIsX = x.lastTs < y.lastTs;
  else if (fullX !== fullY) baseIsX = fullY;
  else if (x.seen !== y.seen) baseIsX = x.seen > y.seen;
  else baseIsX = pickTie(x, y) === x;
  return onBase(baseIsX ? X : Y);
}

/** Jedna strona przy scalaniu jednego faktu. */
type FactView = {
  state: FactState;
  /** Próby tego faktu z dziennika strony. */
  log: Attempt[];
  known: Set<string>;
  /** Dziennik to cała historia faktu (rebuildsTo) — w liczbach nie ma nic więcej. */
  full: boolean;
  side: FactSide;
};

/**
 * Czy próba spoza dziennika strony może już siedzieć w jej liczbach. Tak
 * tylko wtedy, gdy jest starsza niż dziennik (przycięty), a nie starsza niż
 * początek liczników strony (countsFrom) i dziennik nie jest pełny.
 */
function maybeCounted(view: FactView, ts: number): boolean {
  return !view.full && ts < view.side.horizon && ts >= view.side.countsFrom;
}

/**
 * Czy stronie `own` brakuje czegoś, co zna `other`: próby z dziennika drugiej
 * strony, której nie ma w swoich liczbach, albo historii drugiej strony spoza
 * jej dziennika (other.state.seen ponad długość dziennika), gdy tej na pewno
 * nie ma u siebie — własny dziennik pełny albo ostatnia odpowiedź drugiej
 * strony jest starsza niż początek własnych liczników — a własny dziennik
 * nie ma dość prób, które mogłyby nią być. Bez tego drugiego warunku świeży
 * stan (po resecie, nowe urządzenie) „wygrywał w całości" z kopią o
 * przyciętym dzienniku i jej historia faktu po cichu przepadała.
 */
function lacks(own: FactView, other: FactView, union: Attempt[]): boolean {
  if (union.some((attempt) => !own.known.has(attempt.id) && !maybeCounted(own, attempt.ts))) return true;
  const extra = other.state.seen - other.log.length;
  if (extra <= 0) return false;
  // Historia drugiej strony spoza jej dziennika to nie tylko próby, które z
  // niego wypadły: stan faktów przychodzi też ze skrzynki, która wozi krótszy
  // dziennik (sync.ts: doWyslania). Wiadomo tylko, że nie jest późniejsza niż
  // jej ostatnia odpowiedź.
  if (!own.full && other.state.lastTs >= own.side.countsFrom) return false;
  // Własne próby, które mogą być tą samą historią (np. telefon ma w pełnym
  // dzienniku to, co tablet dostał ze skrzynki tylko w liczbach).
  const shared = own.log.filter(
    (attempt) => !other.known.has(attempt.id) && attempt.ts <= other.state.lastTs,
  ).length;
  return extra > shared;
}

/** Stan jednego faktu z jego prób (już posortowanych po czasie). */
function replay(attempts: Attempt[]): FactState | undefined {
  let state: FactState | undefined;
  for (const attempt of attempts) state = applyAttempt(state, attempt);
  return state;
}

/** Czy dziennik faktu to cała jego historia — stan wychodzi z niego co do pola. */
function rebuildsTo(log: Attempt[], fact: FactState): boolean {
  if (log.length !== fact.seen) return false;
  const rebuilt = replay([...log].sort(byTime));
  if (!rebuilt) return fact.seen === 0;
  return (Object.keys(rebuilt) as (keyof FactState)[]).every((key) => rebuilt[key] === fact[key]);
}

/**
 * Pudełko, termin i ostatnia odpowiedź od ostatniego błędu treningu w
 * części wspólnej dzienników (ts ≥ `common`). Błąd treningu zawsze daje
 * pudełko 1 z terminem od siebie (nextFactState), więc od niego harmonogram
 * wychodzi dokładnie, niezależnie od historii sprzed. Błąd w próbnym teście
 * się nie nadaje: przy pudełku 0 niczego nie zmienia. Liczniki zostają.
 * Gdy ostatniej odpowiedzi którejś strony (`latest`) nie ma w unii, po błędzie
 * była historia, której nie widać (stan ze skrzynki bez prób) — wtedy nic
 * nie ruszamy.
 */
function withSchedule(state: FactState, union: Attempt[], common: number, latest: number): FactState {
  let from = -1;
  for (let i = union.length - 1; i >= 0 && union[i].ts >= common; i--) {
    if (union[i].correct === false && union[i].exercise !== "mtc") {
      from = i;
      break;
    }
  }
  if (from === -1) return state;
  const tail = replay(union.slice(from))!;
  if (tail.lastTs < latest) return state;
  return { ...state, box: tail.box, dueTs: tail.dueTs, lastTs: tail.lastTs, lastMs: tail.lastMs };
}

/** Brakujące bazie próby z unii: po jej ostatniej odpowiedzi na żywo, wcześniejsze do liczników. */
function overlay(view: FactView, union: Attempt[]): FactState {
  let state = view.state;
  for (const attempt of union) {
    if (view.known.has(attempt.id) || maybeCounted(view, attempt.ts)) continue;
    if (attempt.ts > state.lastTs) {
      state = applyAttempt(state, attempt);
      continue;
    }
    const correct = attempt.correct === true;
    state = {
      ...state,
      seen: state.seen + 1,
      right: state.right + (correct ? 1 : 0),
      bestMs:
        correct && (state.bestMs === null || attempt.responseMs < state.bestMs) ? attempt.responseMs : state.bestMs,
    };
  }
  return state;
}

/** Fakty tabliczki z dwóch stron, każdy osobno (mergeFact). */
function mergeFacts(a: FactSide, b: FactSide): Record<string, FactState> {
  const logA = factLog(a.attempts);
  const logB = factLog(b.attempts);
  const merged: Record<string, FactState> = {};
  for (const key of new Set([...Object.keys(a.facts), ...Object.keys(b.facts)])) {
    const fact = mergeFact(a.facts[key], b.facts[key], logA.get(key) ?? [], logB.get(key) ?? [], a, b);
    if (fact) merged[key] = fact;
  }
  return merged;
}

export function mergeProgress(a: ProgressState, b: ProgressState): ProgressState {
  const resetTs = Math.max(a.resetTs ?? 0, b.resetTs ?? 0);
  const restoreTs = Math.max(a.restoreTs ?? 0, b.restoreTs ?? 0);
  const cutoff = progressCutoff({ resetTs, restoreTs });
  const nameFrom =
    (a.childNameTs ?? 0) !== (b.childNameTs ?? 0)
      ? (a.childNameTs ?? 0) > (b.childNameTs ?? 0)
        ? a
        : b
      : a.childName >= b.childName
        ? a
        : b;

  // Rekord zostaje, gdy jest nie starszy niż granica albo przyszedł od strony,
  // która granicę już znała (knowsCutoff).
  const kept = (side: ProgressState) => knowsCutoff(side, cutoff);
  const keptIds = new Set(
    [a, b].filter(kept).flatMap((side) => [...side.sessions, ...side.mocks].map((record) => record.id)),
  );

  const sessions = latestById([...a.sessions, ...b.sessions], (session) => [session.endedTs, session.scored])
    .filter((session) => session.endedTs >= cutoff || keptIds.has(session.id))
    .sort((x, y) => x.endedTs - y.endedTs || byIdTie(x, y));
  let units: Record<string, UnitState> = {};
  for (const session of sessions) units = applySessionToUnits(units, session);

  const sideOf = (side: ProgressState): FactSide => {
    const attempts = kept(side) ? side.attempts : side.attempts.filter((attempt) => attempt.ts >= cutoff);
    const facts = cleanFacts(side, cutoff);
    return {
      facts,
      attempts,
      horizon: attempts.reduce((min, attempt) => Math.min(min, attempt.ts), Infinity),
      // Fakty odtworzone od granicy (cleanFacts) liczą się od niej.
      countsFrom: facts === side.facts ? progressCutoff(side) : cutoff,
    };
  };
  const sideA = sideOf(a);
  const sideB = sideOf(b);
  const facts = mergeFacts(sideA, sideB);

  return {
    version: PROGRESS_SCHEMA_VERSION,
    childName: nameFrom.childName,
    childNameTs: nameFrom.childNameTs ?? 0,
    resetTs,
    restoreTs,
    updatedTs: Math.max(a.updatedTs, b.updatedTs),
    units,
    facts,
    mocks: latestById([...a.mocks, ...b.mocks], (mock) => [mock.ts, mock.total])
      .filter((mock) => mock.ts >= cutoff || keptIds.has(mock.id))
      .sort((x, y) => x.ts - y.ts || byIdTie(x, y)),
    sessions,
    attempts: uniqueById([...sideA.attempts, ...sideB.attempts])
      .sort(byTime)
      .slice(-RULES.attemptLogLimit),
  };
}

export type ImportResult = {
  /** Sesje z pliku, których tu nie było. */
  added: number;
  /** Sesje z tego urządzenia, które po wczytaniu zniknęły (plik niesie nowszy reset). */
  removed: number;
};

/** Ile sesji doszło, a ile ubyło między dwoma stanami (po `id`). */
export function sessionsDiff(before: ProgressState, after: ProgressState): ImportResult {
  const was = new Set(before.sessions.map((session) => session.id));
  const is = new Set(after.sessions.map((session) => session.id));
  return {
    added: after.sessions.filter((session) => !was.has(session.id)).length,
    removed: before.sessions.filter((session) => !is.has(session.id)).length,
  };
}

export type ImportPreview = ImportResult & {
  /** Sesje z pliku sprzed „Wyczyść postęp" — zwykłe scalenie je pominie. */
  olderSessions: number;
  /** Granica odcięcia po wczytaniu (0 = brak). */
  mergedCutoff: number;
};

/**
 * Co zrobi wczytanie kopii, zanim cokolwiek zmienimy. Panel pyta rodzica,
 * gdy plik ma sesje sprzed wyczyszczenia postępu (przywrócić?) albo niesie
 * nowszy reset (usunie sesje z tego urządzenia).
 */
export function previewImport(local: ProgressState, incoming: ProgressState): ImportPreview {
  const merged = mergeProgress(local, incoming);
  const mergedCutoff = progressCutoff(merged);
  const known = new Set([...local.sessions, ...merged.sessions].map((session) => session.id));
  return {
    ...sessionsDiff(local, merged),
    // Scalanie odrzuca sesje tylko przez granicę odcięcia.
    olderSessions: incoming.sessions.filter((session) => !known.has(session.id)).length,
    mergedCutoff,
  };
}

/**
 * Kopia do wczytania z przywróceniem: znacznik przywrócenia późniejszy od
 * każdego resetu po obu stronach, więc granica odcięcia znika — także na
 * pozostałych urządzeniach, bo znacznik rozchodzi się przez synchronizację.
 */
export function withRestore(local: ProgressState, incoming: ProgressState, now = Date.now()): ProgressState {
  const latestReset = Math.max(local.resetTs ?? 0, incoming.resetTs ?? 0);
  return { ...incoming, restoreTs: Math.max(incoming.restoreTs ?? 0, now, latestReset + 1) };
}

/** Treść pliku kopii — czytelny JSON, żeby dało się zajrzeć do środka. */
export function buildProgressExport(state: ProgressState): string {
  return JSON.stringify(state, null, 2);
}

export function progressFileName(now = new Date()): string {
  return `akademia-ligi-postep-${now.toISOString().slice(0, 10)}.json`;
}

/** Wersja schematu zapisana w tekście (null, gdy to nie JSON z wersją). */
export function progressVersionOf(text: string): number | null {
  try {
    const data = JSON.parse(text.replace(/^\uFEFF/, "").trim()) as { version?: unknown };
    return typeof data?.version === "number" ? data.version : null;
  } catch {
    return null;
  }
}

/** Plik kopii Ligi Dźwięków — ta sama wersja schematu, inna aplikacja. */
export function looksLikeLigaFile(text: string): boolean {
  try {
    const data = JSON.parse(text.replace(/^\uFEFF/, "").trim()) as Record<string, unknown>;
    return Boolean(data) && typeof data === "object" && ("sounds" in data || "topics" in data);
  } catch {
    return false;
  }
}

/**
 * Walidacja pliku lub zawartości skrzynki. Zwraca null przy śmieciach,
 * pliku innej aplikacji (Liga Dźwięków ma tę samą wersję schematu!) albo
 * nowszej wersji; brakujące pola uzupełnia (normalizeProgress) — nie odrzuca
 * poprawnych danych tylko dlatego, że pochodzą ze starszej wersji.
 */
export function parseProgressFile(text: string): ProgressState | null {
  try {
    // BOM i białe znaki zdarzają się po przejściu pliku przez edytory/Dysk.
    const data = JSON.parse(text.replace(/^\uFEFF/, "").trim()) as ProgressState;
    if (typeof data !== "object" || data === null) return null;
    if (data.version !== PROGRESS_SCHEMA_VERSION) return null;
    if (!Array.isArray(data.sessions)) return null;
    if (typeof data.childName !== "string") return null;
    if (looksLikeLigaFile(text)) return null;
    if (typeof data.facts !== "object" || data.facts === null || !Array.isArray(data.mocks)) return null;
    return normalizeProgress(data);
  } catch {
    return null;
  }
}
