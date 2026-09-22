/**
 * Scalanie postępu z dwóch źródeł (inne urządzenie, plik kopii).
 *
 * Zasada jak w Lidze: NIGDY nie nadpisujemy — sesje, próby i próbne testy to
 * unia po `id`, a statusy jednostek odtwarzamy, przepuszczając wszystkie sesje
 * chronologicznie przez te same reguły, które działają na żywo. Kolejność
 * scalania nie ma znaczenia, a to samo źródło wczytane dwa razy niczego nie
 * psuje.
 *
 * Wyjątek: fakty tabliczki. Ich stan nie jest odtwarzalny z dziennika prób
 * (dziennik jest przycinany), więc scalamy je fakt po fakcie — wygrywa stan z
 * późniejszą ostatnią odpowiedzią. Dziecko ćwiczy na jednym urządzeniu naraz,
 * więc „nowszy wygrywa" w praktyce nie gubi niczego.
 */

import { applySessionToUnits, RULES } from "./rules";
import {
  normalizeProgress,
  PROGRESS_SCHEMA_VERSION,
  type FactState,
  type ProgressState,
  type UnitState,
} from "./types";

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function mergeFacts(
  a: Record<string, FactState>,
  b: Record<string, FactState>,
): Record<string, FactState> {
  const merged: Record<string, FactState> = { ...a };
  for (const [key, state] of Object.entries(b)) {
    const mine = merged[key];
    if (!mine || state.lastTs > mine.lastTs) merged[key] = state;
  }
  return merged;
}

export function mergeProgress(a: ProgressState, b: ProgressState): ProgressState {
  const newer = a.updatedTs >= b.updatedTs ? a : b;

  const sessions = uniqueById([...a.sessions, ...b.sessions]).sort(
    (x, y) => x.endedTs - y.endedTs,
  );
  let units: Record<string, UnitState> = {};
  for (const session of sessions) units = applySessionToUnits(units, session);

  return {
    version: PROGRESS_SCHEMA_VERSION,
    childName: newer.childName,
    updatedTs: Math.max(a.updatedTs, b.updatedTs),
    units,
    facts: mergeFacts(a.facts, b.facts),
    mocks: uniqueById([...a.mocks, ...b.mocks]).sort((x, y) => x.ts - y.ts),
    sessions,
    attempts: uniqueById([...a.attempts, ...b.attempts])
      .sort((x, y) => x.ts - y.ts)
      .slice(-RULES.attemptLogLimit),
  };
}

/** Treść pliku kopii — czytelny JSON, żeby dało się zajrzeć do środka. */
export function buildProgressExport(state: ProgressState): string {
  return JSON.stringify(state, null, 2);
}

export function progressFileName(now = new Date()): string {
  return `akademia-ligi-postep-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Walidacja pliku lub zawartości skrzynki. Zwraca null przy śmieciach, a
 * brakujące pola uzupełnia (normalizeProgress) — nie odrzuca poprawnych danych
 * tylko dlatego, że pochodzą ze starszej wersji.
 */
export function parseProgressFile(text: string): ProgressState | null {
  try {
    // BOM i białe znaki zdarzają się po przejściu pliku przez edytory/Dysk.
    const data = JSON.parse(text.replace(/^﻿/, "").trim()) as ProgressState;
    if (typeof data !== "object" || data === null) return null;
    if (data.version !== PROGRESS_SCHEMA_VERSION) return null;
    if (!Array.isArray(data.sessions)) return null;
    if (typeof data.childName !== "string") return null;
    return normalizeProgress(data);
  } catch {
    return null;
  }
}
