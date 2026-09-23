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
 *  - reset: rekordy starsze niż najnowszy `resetTs` z obu stron odpadają —
 *    inaczej wyczyszczony postęp wracał z chmury;
 *  - imię: wygrywa późniejsza ZMIANA IMIENIA (`childNameTs`), a nie stan z
 *    późniejszą sesją;
 *  - fakty tabliczki (mergeFacts niżej).
 */

import { factKey } from "@/lib/curriculum/tables";
import { nextFactState } from "@/lib/tables/practice";
import { applySessionToUnits, FACT_EXERCISES, RULES } from "./rules";
import {
  normalizeProgress,
  PROGRESS_SCHEMA_VERSION,
  type Attempt,
  type FactState,
  type ProgressState,
  type UnitState,
} from "./types";

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

/** Deterministyczny wybór przy remisie — scalanie musi być przemienne. */
function pickTie(x: FactState, y: FactState): FactState {
  if (x.seen !== y.seen) return x.seen > y.seen ? x : y;
  if (x.right !== y.right) return x.right > y.right ? x : y;
  if (x.box !== y.box) return x.box > y.box ? x : y;
  return JSON.stringify(x) >= JSON.stringify(y) ? x : y;
}

/**
 * Fakty tabliczki. Stan faktu nie jest w całości odtwarzalny z dziennika prób
 * (dziennik jest przycinany), więc zwykle wygrywa stan z późniejszą ostatnią
 * odpowiedzią — przy ćwiczeniu na jednym urządzeniu naraz to jest pełna,
 * nowsza historia.
 *
 * Gorzej, gdy dwa urządzenia ćwiczyły NIEZALEŻNIE (np. tablet bez sieci przez
 * tydzień): jedna późniejsza odpowiedź z telefonu wymazałaby tydzień pudełek.
 * Rozpoznajemy to po liczbie odpowiedzi: jeśli w dzienniku po ostatniej
 * odpowiedzi starszego stanu jest więcej prób, niż nowszy stan ma „ponad"
 * starszy, to nowszy nie zawiera historii starszego. Wtedy nakładamy te próby
 * na starszy stan (tymi samymi regułami co na żywo). Przy remisie decyduje
 * dłuższa historia, więc kolejne scalenia zbiegają się do tego samego stanu.
 */
function mergeFacts(
  a: Record<string, FactState>,
  b: Record<string, FactState>,
  attempts: Attempt[],
): Record<string, FactState> {
  const merged: Record<string, FactState> = { ...a };
  for (const [key, theirs] of Object.entries(b)) {
    const mine = merged[key];
    if (!mine) {
      merged[key] = theirs;
      continue;
    }
    if (mine.lastTs === theirs.lastTs) {
      merged[key] = pickTie(mine, theirs);
      continue;
    }
    const [older, newer] = mine.lastTs < theirs.lastTs ? [mine, theirs] : [theirs, mine];
    const later = attempts
      .filter((attempt) => {
        if (!FACT_EXERCISES.has(attempt.exercise) || attempt.correct === null) return false;
        if (attempt.ts <= older.lastTs || attempt.ts > newer.lastTs) return false;
        const [x, y] = attempt.item.split("x").map(Number);
        return Boolean(x && y) && factKey(x, y) === key;
      })
      .sort((p, q) => p.ts - q.ts || (p.id < q.id ? -1 : 1));
    const diverged =
      later.length > newer.seen - older.seen && later[later.length - 1]?.ts === newer.lastTs;
    if (!diverged) {
      merged[key] = newer;
      continue;
    }
    let state = older;
    for (const attempt of later) {
      state = nextFactState(
        state,
        { correct: attempt.correct === true, ms: attempt.responseMs, ts: attempt.ts },
        attempt.exercise === "mtc" ? "mock" : "practice",
      );
    }
    merged[key] = state;
  }
  return merged;
}

export function mergeProgress(a: ProgressState, b: ProgressState): ProgressState {
  const resetTs = Math.max(a.resetTs ?? 0, b.resetTs ?? 0);
  const nameFrom =
    (a.childNameTs ?? 0) !== (b.childNameTs ?? 0)
      ? (a.childNameTs ?? 0) > (b.childNameTs ?? 0)
        ? a
        : b
      : a.childName >= b.childName
        ? a
        : b;

  const sessions = uniqueById([...a.sessions, ...b.sessions])
    .filter((session) => session.endedTs >= resetTs)
    .sort((x, y) => x.endedTs - y.endedTs);
  let units: Record<string, UnitState> = {};
  for (const session of sessions) units = applySessionToUnits(units, session);

  const allAttempts = uniqueById([...a.attempts, ...b.attempts]).filter((attempt) => attempt.ts >= resetTs);
  const facts = Object.fromEntries(
    Object.entries(mergeFacts(a.facts, b.facts, allAttempts)).filter(([, fact]) => fact.lastTs >= resetTs),
  );

  return {
    version: PROGRESS_SCHEMA_VERSION,
    childName: nameFrom.childName,
    childNameTs: nameFrom.childNameTs ?? 0,
    resetTs,
    updatedTs: Math.max(a.updatedTs, b.updatedTs),
    units,
    facts,
    mocks: uniqueById([...a.mocks, ...b.mocks])
      .filter((mock) => mock.ts >= resetTs)
      .sort((x, y) => x.ts - y.ts),
    sessions,
    attempts: allAttempts.sort((x, y) => x.ts - y.ts).slice(-RULES.attemptLogLimit),
  };
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
