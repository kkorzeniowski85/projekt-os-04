/**
 * Sesje działu tabliczki: codzienny trening i lekcja „Liczymy co N".
 *
 * Trening wygląda jak MTC (sam zapis „7 × 8 =" i klawiatura) — dziecko ma
 * przyjść na test do rzeczy znajomych. Lekcja liczenia uczy ZROZUMIENIA i
 * angielskich słów wokół mnożenia (count in sevens, lots of, groups of),
 * których sam test nie używa, ale lekcja matematyki w Year 4 — codziennie.
 */

import {
  factKey,
  introducedWith,
  TABLE_TIPS,
  type Question,
} from "@/lib/curriculum/tables";
import { pl } from "@/lib/pl";
import type { FactState } from "@/lib/progress/types";
import {
  pickSome,
  say,
  sayNumber,
  shuffle,
  type ChoiceOption,
  type Exercise,
} from "@/lib/session/exercise";
import { buildPracticeSet, FACT_RULES } from "./practice";

/** „count in sevens" — liczebnik w liczbie mnogiej. */
export const TABLE_PLURAL: Record<number, string> = {
  2: "twos",
  3: "threes",
  4: "fours",
  5: "fives",
  6: "sixes",
  7: "sevens",
  8: "eights",
  9: "nines",
  10: "tens",
  11: "elevens",
  12: "twelves",
};

export function factExercise(
  [a, b]: Question,
  index: number,
  facts: Record<string, FactState>,
  exercise = "fact",
  isNew = (facts[factKey(a, b)]?.box ?? 0) === 0,
): Exercise {
  return {
    id: `${exercise}-${index}-${a}x${b}`,
    kind: "typed",
    exercise,
    item: `${a}x${b}`,
    heading: isNew && exercise === "fact" ? "✨ Nowy fakt" : undefined,
    visual: { kind: "big", text: `${a} × ${b} =` },
    answer: a * b,
    fastMs: FACT_RULES.fastMs,
    revealText: `${a} × ${b} = ${a * b}`,
    revealSound: { kind: "fact", a, b },
    explainPl: TABLE_TIPS[introducedWith(factKey(a, b))],
    explainWhen: "wrong",
  };
}

/** Codzienny trening: 20 pytań (12 na telefonie) dobranych przez pudełka. */
export function buildTrainingSession(
  facts: Record<string, FactState>,
  options: { size: number; table?: number | null; now?: number; holdNew?: boolean },
): Exercise[] {
  const questions = buildPracticeSet(facts, {
    size: options.size,
    now: options.now ?? Date.now(),
    table: options.table ?? null,
    holdNew: options.holdNew,
  });
  // „Nowy fakt" tylko przy pierwszym pojawieniu w sesji — przy powtórce w
  // drugiej turze to już znajomy fakt.
  const shown = new Set<string>();
  return questions.map((question, index) => {
    const key = factKey(question[0], question[1]);
    const isNew = (facts[key]?.box ?? 0) === 0 && !shown.has(key);
    shown.add(key);
    return factExercise(question, index, facts, "fact", isNew);
  });
}

// --- Lekcja „Liczymy co N" -------------------------------------------------------

/** Liczby, które łatwo pomylić ze słuchu z daną: 16/60, 14/40, 13/30, 45/54… */
export function confusableNumbers(value: number, step: number): number[] {
  const candidates = new Set<number>();
  const teenTy: Record<number, number> = { 13: 30, 14: 40, 15: 50, 16: 60, 17: 70, 18: 80, 19: 90 };
  for (const [teen, ty] of Object.entries(teenTy)) {
    if (Number(teen) === value) candidates.add(ty);
    if (ty === value) candidates.add(Number(teen));
  }
  if (value >= 10 && value < 100) {
    const reversed = Number(String(value).split("").reverse().join(""));
    if (reversed !== value && reversed >= 10) candidates.add(reversed);
  }
  candidates.add(value + step);
  if (value - step > 0) candidates.add(value - step);
  candidates.add(value + 10);
  if (value > 10) candidates.add(value - 10);
  candidates.delete(value);
  return [...candidates].filter((n) => n > 0 && n <= 150);
}

function numberChoice(value: number, step: number, id: string, exercise: string): Exercise {
  const distractors = pickSome(confusableNumbers(value, step), 2);
  const options: ChoiceOption[] = shuffle([value, ...distractors]).map((n) => ({
    id: String(n),
    label: String(n),
  }));
  return {
    id,
    kind: "choice",
    exercise,
    item: String(value),
    heading: "Którą liczbę słyszysz?",
    sound: sayNumber(value),
    listenOnly: true,
    options,
    answer: String(value),
    columns: 3,
  };
}

export function buildCountingSession(table: number): Exercise[] {
  const multiples = Array.from({ length: 12 }, (_, i) => table * (i + 1));
  const plural = TABLE_PLURAL[table];
  const lots = 3 + Math.floor(Math.random() * 3); // 3–5 grup
  const screens: Exercise[] = [];

  screens.push({
    id: "count-intro",
    kind: "learn",
    exercise: "count-learn",
    item: `count-${table}`,
    heading: `Liczymy co ${table}`,
    promptEn: `Count in ${plural}.`,
    sound: say(`Count in ${plural}.`),
    countAlong: multiples,
    bodyPl: `Stuknij „Liczymy razem” i liczcie na głos razem z nagraniem. Potem zakryj liczby i spróbujcie z pamięci. „Count in ${plural}” = liczyć co ${table}.`,
    parentPl:
      "Liczenie skokami to w angielskiej szkole podstawa tabliczki — dzieci znają ciągi na pamięć jak piosenkę, a fakt „7 × 6” wyprowadzają, licząc 6 skoków. Dobrze jest liczyć przy tym na palcach: szósty palec = szósta liczba.",
  });

  screens.push({
    id: "count-lots",
    kind: "learn",
    exercise: "count-learn",
    item: `lots-${table}`,
    heading: "„lots of” = razy",
    visual: { kind: "array", rows: lots, cols: table, emoji: table > 8 ? "🔹" : "🔵" },
    promptEn: `${lots} lots of ${table} is ${lots * table}.`,
    sound: say(`${lots} lots of ${table} is ${lots * table}.`),
    bodyPl: `${pl(lots, "rząd", "rzędy", "rzędów")} po ${pl(table, "kropka", "kropki", "kropek")}: ${lots} × ${table} = ${lots * table}. Po angielsku to samo działanie mówi się na kilka sposobów:`,
    examples: [
      { en: `${lots} lots of ${table}`, pl: `${lots} × ${table}` },
      { en: `${lots} groups of ${table}`, pl: `${lots} × ${table}` },
      { en: `${lots} times ${table}`, pl: `${lots} × ${table}` },
      { en: `${lots} multiplied by ${table}`, pl: `${lots} × ${table}` },
    ],
  });

  // Luka w ciągu — dwa razy, w różnych miejscach.
  for (const start of pickSome([0, 2, 4, 6, 8], 2)) {
    const window = multiples.slice(start, start + 4);
    const gap = 1 + Math.floor(Math.random() * 3);
    screens.push({
      id: `count-gap-${start}`,
      kind: "typed",
      exercise: "count-gap",
      item: `${table}:${window[gap]}`,
      heading: "Jaka liczba jest w luce?",
      promptEn: "What number is missing?",
      sound: say("What number is missing?"),
      visual: { kind: "sequence", items: window.map((n, i) => (i === gap ? null : n)) },
      answer: window[gap],
      revealText: window.join(", "),
      explainPl: `Każdy krok to +${table}: ${window.join(" → ")}.`,
    });
  }

  const groups = 2 + Math.floor(Math.random() * 8); // 2–9
  screens.push({
    id: "count-lots-q",
    kind: "typed",
    exercise: "count-lots",
    item: `${groups}x${table}`,
    promptEn: `What is ${groups} lots of ${table}?`,
    sound: say(`What is ${groups} lots of ${table}?`),
    visual: { kind: "array", rows: groups, cols: table, emoji: "🔵" },
    answer: groups * table,
    revealText: `${groups} × ${table} = ${groups * table}`,
    revealSound: { kind: "fact", a: groups, b: table },
    explainPl: `„${groups} lots of ${table}” to ${pl(groups, "grupa", "grupy", "grup")} po ${table}: ${groups} × ${table}.`,
  });

  // Słuch: wielokrotności tabliczki podane słownie (13/30, 16/60…).
  pickSome(multiples.slice(1), 2).forEach((value, i) => {
    screens.push(numberChoice(value, table, `count-listen-${i}`, "number-listen"));
  });

  // Fakty z tej tabliczki, obie kolejności.
  pickSome(multiples.map((_, i) => i + 1).filter((k) => k >= 2), 4).forEach((k, i) => {
    const question: Question = i % 2 === 0 ? [k, table] : [table, k];
    screens.push(factExercise(question, i, {}, "count-fact"));
  });

  const k = 3 + Math.floor(Math.random() * 8);
  screens.push({
    id: "count-division",
    kind: "typed",
    exercise: "count-division",
    item: `${table * k}/${table}`,
    promptEn: `How many ${plural} are there in ${table * k}?`,
    sound: say(`How many ${plural} are there in ${table * k}?`),
    answer: k,
    revealText: `${table * k} ÷ ${table} = ${k}`,
    explainPl: `„How many ${plural} in ${table * k}?” — ile razy ${table} mieści się w ${table * k}. Licz skokami co ${table}, aż dojdziesz do ${table * k}: zrobisz ${pl(k, "skok", "skoki", "skoków")}. To dzielenie: ${table * k} ÷ ${table} = ${k}.`,
  });

  return screens;
}

/** Wszystkie teksty, które mogą paść w lekcjach liczenia — dla generatora nagrań. */
export function countingPhrases(): string[] {
  const phrases: string[] = ["What number is missing?"];
  for (const table of Object.keys(TABLE_PLURAL).map(Number)) {
    const plural = TABLE_PLURAL[table];
    phrases.push(`Count in ${plural}.`);
    for (let lots = 3; lots <= 5; lots++) {
      phrases.push(`${lots} lots of ${table} is ${lots * table}.`);
      phrases.push(`${lots} lots of ${table}`, `${lots} groups of ${table}`, `${lots} times ${table}`, `${lots} multiplied by ${table}`);
    }
    for (let groups = 2; groups <= 9; groups++) phrases.push(`What is ${groups} lots of ${table}?`);
    for (let k = 3; k <= 10; k++) phrases.push(`How many ${plural} are there in ${table * k}?`);
  }
  return phrases;
}
