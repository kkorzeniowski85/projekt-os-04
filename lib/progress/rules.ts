/**
 * Reguły postępu — ten sam szkielet co w Lidze Dźwięków, żeby rodzic nie
 * musiał uczyć się dwóch różnych logik.
 *
 * Dwa rodzaje stanu:
 *  - JEDNOSTKI (tematy, czytanki, liczenie skokami): status nowy / w trakcie /
 *    opanowany / trudny, liczony z celności ostatnich sesji — jak w Lidze;
 *  - FAKTY tabliczki: pudełka Leitnera (lib/tables/practice.ts), bo tabliczka
 *    to 66 osobnych faktów, a nie jeden temat.
 *
 * Wszystkie progi w jednym miejscu (RULES), żeby dało się je zmienić po
 * pierwszych tygodniach z dzieckiem bez grzebania w logice.
 */

import { factKey } from "@/lib/curriculum/tables";
import { nextFactState } from "@/lib/tables/practice";
import {
  emptyUnitState,
  unitKeyOf,
  type Attempt,
  type FactState,
  type MockRecord,
  type ProgressState,
  type SessionRecord,
  type UnitState,
  type UnitStatus,
} from "./types";

export const RULES = {
  /** Od tego wyniku sesja liczy się jako „dobra". */
  masteryAccuracy: 0.8,
  /** Tyle dobrych sesji pod rząd = jednostka opanowana. */
  masterySessions: 2,
  /** Poniżej tego wyniku sesja liczy się jako „trudna". */
  strugglingAccuracy: 0.6,
  /** Tyle trudnych sesji pod rząd = sygnał „potrzebna pomoc rodzica". */
  strugglingSessions: 2,
  /** Ile ostatnich wyników trzymamy na potrzeby reguł. */
  historyWindow: 3,
  /**
   * Minimalna liczba ocenianych zadań, żeby sesja zmieniła status jednostki.
   * Przerwana sesja z dwoma trafieniami nie jest dowodem opanowania.
   */
  minScoredForStatus: 4,
  /**
   * Ile prób trzymamy w dzienniku. Mniej niż w Lidze: trening tabliczki
   * produkuje ~20 prób dziennie, a cały stan musi się mieścić w skrzynce
   * synchronizacji. Stan faktów nie zależy od dziennika, więc przycięcie
   * niczego nie gubi.
   */
  attemptLogLimit: 1500,
} as const;

export function accuracyOf(session: SessionRecord): number | null {
  return session.scored > 0 ? session.correct / session.scored : null;
}

function nextStatus(history: number[]): UnitStatus {
  const recent = history.slice(-RULES.historyWindow);
  if (recent.length === 0) return "new";

  const lastGood = recent.slice(-RULES.masterySessions);
  if (
    lastGood.length === RULES.masterySessions &&
    lastGood.every((value) => value >= RULES.masteryAccuracy)
  ) {
    return "mastered";
  }

  const lastHard = recent.slice(-RULES.strugglingSessions);
  if (
    lastHard.length === RULES.strugglingSessions &&
    lastHard.every((value) => value < RULES.strugglingAccuracy)
  ) {
    return "needs-help";
  }

  return "learning";
}

/** Stan jednostki po sesji. Krótka (przerwana) sesja nie rusza oceny. */
export function applySessionToUnits(
  units: Record<string, UnitState>,
  session: SessionRecord,
): Record<string, UnitState> {
  const key = unitKeyOf(session.module, session.unitId);
  const previous = units[key] ?? emptyUnitState(key);
  const accuracy = accuracyOf(session);
  const scored =
    accuracy !== null && session.scored >= RULES.minScoredForStatus ? accuracy : null;

  const recentAccuracies =
    scored === null
      ? previous.recentAccuracies
      : [...previous.recentAccuracies, scored].slice(-RULES.historyWindow);

  return {
    ...units,
    [key]: {
      ...previous,
      sessions: previous.sessions + 1,
      lastAccuracy: scored ?? previous.lastAccuracy,
      bestAccuracy:
        scored === null ? previous.bestAccuracy : Math.max(scored, previous.bestAccuracy ?? 0),
      recentAccuracies,
      lastSeenTs: session.endedTs,
      status: nextStatus(recentAccuracies),
    },
  };
}

/** Ćwiczenia, których próby zmieniają stan faktów tabliczki. */
export const FACT_EXERCISES = new Set(["fact", "mtc"]);

/**
 * Fakty po sesji. Próba trafia do faktu, jeśli dotyczy tabliczki („fact" w
 * treningu, „mtc" w próbnym teście) i jest oceniona. `item` ma postać „7x8"
 * albo „8x7" — obie kolejności to ten sam fakt.
 */
export function applyFactAttempts(
  facts: Record<string, FactState>,
  attempts: Attempt[],
  kind: SessionRecord["kind"],
): Record<string, FactState> {
  const next = { ...facts };
  for (const attempt of attempts) {
    if (!FACT_EXERCISES.has(attempt.exercise) || attempt.correct === null) continue;
    const [a, b] = attempt.item.split("x").map(Number);
    if (!a || !b) continue;
    const key = factKey(a, b);
    next[key] = nextFactState(
      next[key],
      { correct: attempt.correct, ms: attempt.responseMs, ts: attempt.ts },
      kind,
    );
  }
  return next;
}

/** Rekord próbnego testu z prób sesji (25 pytań „mtc"). */
export function mockRecordOf(
  session: SessionRecord,
  attempts: Attempt[],
): MockRecord {
  const checked = attempts.filter((attempt) => attempt.exercise === "mtc");
  return {
    id: session.id,
    ts: session.endedTs,
    score: checked.filter((attempt) => attempt.correct).length,
    total: checked.length,
    device: session.device,
    mode: session.mode,
    missed: checked
      .filter((attempt) => !attempt.correct)
      .map((attempt) => attempt.item.replace("x", "×")),
  };
}

/**
 * Cała zmiana stanu po zapisie sesji — jedno miejsce, z którego korzysta
 * magazyn (store.tsx). Zwraca nowy stan; nie mutuje poprzedniego.
 *
 * Zapis to UPSERT po `id` sesji: ta sama sesja bywa zapisywana więcej niż raz
 * (pagehide, a po powrocie strony z bfcache dokończenie; szkic odzyskany po
 * ubiciu karty). Rekord sesji jest wtedy podmieniany, do dziennika i do faktów
 * trafiają TYLKO próby o nowych id — fakt nie dostaje tej samej odpowiedzi
 * dwa razy — a statusy jednostek liczymy od nowa ze wszystkich sesji
 * chronologicznie, jak przy scalaniu (merge.ts).
 */
export function commitToState(
  previous: ProgressState,
  session: SessionRecord,
  attempts: Attempt[],
): ProgressState {
  const known = new Set(previous.attempts.map((attempt) => attempt.id));
  const fresh = attempts.filter((attempt) => !known.has(attempt.id));
  const at = previous.sessions.findIndex((existing) => existing.id === session.id);
  const sessions =
    at === -1
      ? [...previous.sessions, session]
      : previous.sessions.map((existing, index) => (index === at ? session : existing));

  let units = previous.units;
  if (at === -1) {
    units = applySessionToUnits(previous.units, session);
  } else {
    units = {};
    for (const each of [...sessions].sort((x, y) => x.endedTs - y.endedTs)) {
      units = applySessionToUnits(units, each);
    }
  }

  let mocks = previous.mocks;
  if (session.kind === "mock") {
    const mock = mockRecordOf(session, attempts);
    mocks = previous.mocks.some((existing) => existing.id === mock.id)
      ? previous.mocks.map((existing) => (existing.id === mock.id ? mock : existing))
      : [...previous.mocks, mock];
  }

  return {
    ...previous,
    updatedTs: session.endedTs,
    units,
    facts: applyFactAttempts(previous.facts, fresh, session.kind),
    mocks,
    sessions,
    attempts: [...previous.attempts, ...fresh].slice(-RULES.attemptLogLimit),
  };
}
