/**
 * „Misja dnia" na ekranie głównym: 2–3 krótkie kroki (razem ok. 15 minut).
 *
 * Zasada: tabliczka codziennie (krótko — praktyka rozłożona działa lepiej niż
 * długa raz w tygodniu), a pozostałe działy na zmianę, zaczynając od tego,
 * który najdłużej czekał. Dziecko nie musi wybierać — rodzic też nie.
 *
 * Nowa tabliczka: najpierw lekcja „Liczymy co N" (zrozumienie), dopiero potem
 * trening (utrwalanie) — dlatego lekcja stoi w misji PRZED treningiem.
 */

import { CLASSROOM_UNITS } from "@/lib/curriculum/classroom";
import { MATHS_TOPICS } from "@/lib/curriculum/maths";
import { READING_TEXTS } from "@/lib/curriculum/reading";
import { LEARNING_ORDER } from "@/lib/curriculum/tables";
import { RULES } from "@/lib/progress/rules";
import { focusTable } from "@/lib/tables/practice";
import {
  unitKeyOf,
  type ModuleId,
  type ProgressState,
  type SessionRecord,
} from "@/lib/progress/types";

export type MissionStep = {
  module: ModuleId;
  emoji: string;
  title: string;
  subtitle: string;
  href: string;
  done: boolean;
};

function isToday(ts: number, now: number): boolean {
  return new Date(ts).toDateString() === new Date(now).toDateString();
}

/**
 * Sesja, która naprawdę coś zrobiła — przerwana po dwóch zadaniach nie odhacza
 * misji (ten sam próg, od którego sesja zmienia ocenę tematu).
 */
function counts(session: SessionRecord): boolean {
  return session.scored >= RULES.minScoredForStatus;
}

const MODULE_UNITS: Record<Exclude<ModuleId, "tables">, { id: string; title: string; href: string; emoji: string }[]> = {
  maths: MATHS_TOPICS.map((topic) => ({ id: topic.id, title: topic.titlePl, href: `/matematyka/${topic.id}/`, emoji: topic.emoji })),
  reading: READING_TEXTS.map((text) => ({ id: text.id, title: text.titleEn, href: `/czytanie/${text.id}/`, emoji: text.emoji })),
  tasks: CLASSROOM_UNITS.map((unit) => ({ id: unit.id, title: unit.titlePl, href: `/polecenia/${unit.id}/`, emoji: unit.emoji })),
};

const MODULE_NAME: Record<Exclude<ModuleId, "tables">, string> = {
  maths: "Matematyka po angielsku",
  reading: "Czytanie",
  tasks: "Język klasy",
};

/** Następna jednostka w dziale: pierwsza nieopanowana (trudne mają pierwszeństwo). */
function nextUnit(state: ProgressState, module: Exclude<ModuleId, "tables">) {
  const units = MODULE_UNITS[module];
  const statusOf = (id: string) => state.units[unitKeyOf(module, id)]?.status ?? "new";
  return (
    units.find((unit) => statusOf(unit.id) === "needs-help") ??
    units.find((unit) => statusOf(unit.id) !== "mastered") ??
    // Wszystko opanowane: powtórka tego, co najdawniej.
    [...units].sort(
      (a, b) =>
        (state.units[unitKeyOf(module, a.id)]?.lastSeenTs ?? 0) - (state.units[unitKeyOf(module, b.id)]?.lastSeenTs ?? 0),
    )[0]
  );
}

/**
 * Lekcja „Liczymy co N" do zrobienia: pierwsza tabliczka w kolejności nauki —
 * do tabliczki, z której trening wprowadza teraz nowe fakty, włącznie — która
 * nie ma jeszcze lekcji z oceną. Gdy wszystkie fakty już weszły, pierwsza
 * tabliczka bez lekcji w ogóle (żeby ×12 też kiedyś wypadła).
 */
export function nextCountingLesson(state: ProgressState): number | null {
  const focus = focusTable(state.facts);
  const lastIndex = focus ? LEARNING_ORDER.indexOf(focus as (typeof LEARNING_ORDER)[number]) : LEARNING_ORDER.length - 1;
  const lessonDone = (table: number) => {
    const unit = state.units[unitKeyOf("tables", `count-${table}`)];
    return Boolean(unit) && unit.status !== "new";
  };
  return LEARNING_ORDER.slice(0, lastIndex + 1).find((table) => !lessonDone(table)) ?? null;
}

export function dailyMission(state: ProgressState, now = Date.now()): MissionStep[] {
  const today = state.sessions.filter((session) => isToday(session.endedTs, now) && counts(session));
  const steps: MissionStep[] = [];

  // Krok 1: lekcja nowej tabliczki (zrobiona dziś zostaje na liście z ✅).
  const lessonToday = today.find((session) => session.module === "tables" && session.kind === "count");
  const lessonTable = lessonToday ? Number(lessonToday.unitId.replace("count-", "")) : nextCountingLesson(state);
  if (lessonTable) {
    steps.push({
      module: "tables",
      emoji: "🔢",
      title: `Liczymy co ${lessonTable}`,
      subtitle: "nowa tabliczka — najpierw zrozumieć",
      href: `/tabliczka/liczenie/${lessonTable}/`,
      done: Boolean(lessonToday),
    });
  }

  // Krok 2: codzienny trening.
  steps.push({
    module: "tables",
    emoji: "⚡",
    title: "Trening tabliczki",
    subtitle: "ok. 5 minut",
    href: "/tabliczka/trening/",
    done: today.some((session) => session.module === "tables" && session.kind === "practice"),
  });

  // Krok 3: dział, który najdłużej czekał (zrobiony dziś zostaje jako „zrobione").
  const lastOf = (module: ModuleId) =>
    Math.max(0, ...state.sessions.filter((session) => session.module === module).map((session) => session.endedTs));
  const others = (["tasks", "maths", "reading"] as const).slice().sort((a, b) => lastOf(a) - lastOf(b));
  const doneToday = others.find((module) => today.some((session) => session.module === module));
  const module = doneToday ?? others[0];
  const doneSession = doneToday
    ? today.filter((session) => session.module === doneToday).slice(-1)[0]
    : undefined;
  const unit =
    (doneSession && MODULE_UNITS[module].find((candidate) => candidate.id === doneSession.unitId)) ??
    nextUnit(state, module);
  if (unit) {
    steps.push({
      module,
      emoji: unit.emoji,
      title: unit.title,
      subtitle: MODULE_NAME[module],
      href: unit.href,
      done: Boolean(doneToday),
    });
  }
  return steps;
}
