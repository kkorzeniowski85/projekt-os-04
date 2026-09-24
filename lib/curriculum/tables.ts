/**
 * Tabliczka mnożenia 2–12 i zasady Multiplication Tables Check (MTC).
 *
 * Źródło zasad MTC: „Multiplication tables check assessment framework"
 * (Standards and Testing Agency, obowiązuje od 2021/22, w 2026/27 bez zmian).
 * Liczby poniżej są przepisane z tego dokumentu, a nie wymyślone — patrz
 * docs/decyzje.md.
 *
 * Bez importów — generator nagrań i audyt czytają ten plik z Node.
 */

export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Kolejność nauki tabliczek. Wzorowana na angielskim programie: Year 2 uczy
 * ×2, ×5, ×10, Year 3 ×3, ×4, ×8, a Year 4 ×6, ×7, ×9, ×11, ×12. W obrębie
 * Year 4 ×11 idzie pierwsza (najprostszy wzór: 3 × 11 = 33), a ×7 i ×12 na
 * końcu — do nich dochodzi najmniej nowych faktów, bo resztę dziecko zna już
 * z odwrotnej strony (7 × 8 = 8 × 7).
 */
export const LEARNING_ORDER = [2, 10, 5, 3, 4, 8, 11, 6, 9, 7, 12] as const;

/**
 * Fakt = NIEUPORZĄDKOWANA para czynników, mniejszy pierwszy: „7x8".
 * 7 × 8 i 8 × 7 to ta sama wiedza — dziecko uczy się 66 faktów zamiast 121,
 * a przemienność jest częścią nauki, nie sztuczką.
 */
export type FactKey = string;

export function factKey(a: number, b: number): FactKey {
  return a <= b ? `${a}x${b}` : `${b}x${a}`;
}

export function parseFact(key: FactKey): [number, number] {
  const [a, b] = key.split("x").map(Number);
  return [a, b];
}

/** Wszystkie 66 faktów tabliczki 2–12. */
export const ALL_FACTS: FactKey[] = (() => {
  const keys: FactKey[] = [];
  for (const a of TABLES) {
    for (const b of TABLES) {
      if (a <= b) keys.push(factKey(a, b));
    }
  }
  return keys;
})();

function orderPosition(table: number): number {
  return (LEARNING_ORDER as readonly number[]).indexOf(table);
}

/**
 * Tabliczka, z którą fakt wchodzi do nauki: WCZEŚNIEJSZA w kolejności z obu
 * czynników. 7 × 8 wchodzi z ×8, bo ×8 jest w kolejności przed ×7.
 */
export function introducedWith(key: FactKey): number {
  const [a, b] = parseFact(key);
  return orderPosition(a) <= orderPosition(b) ? a : b;
}

/** Fakty, które wnosi dana tabliczka (nowe w chwili, gdy do niej dochodzimy). */
export function factsIntroducedBy(table: number): FactKey[] {
  return ALL_FACTS.filter((key) => introducedWith(key) === table);
}

/** Wszystkie fakty z danym czynnikiem — pełna tabliczka „razy t" (11 faktów). */
export function factsOfTable(table: number): FactKey[] {
  return ALL_FACTS.filter((key) => parseFact(key).includes(table));
}

// --- MTC ---------------------------------------------------------------------

export const MTC = {
  questions: 25,
  answerMs: 6000,
  pauseMs: 3000,
  practiceQuestions: 3,
} as const;

/** Tabela 1 ramy MTC: [minimum, maksimum] pytań z tabliczki (pierwszy czynnik). */
export const MTC_TABLE_LIMITS: Record<number, [number, number]> = {
  2: [0, 2],
  3: [1, 3],
  4: [1, 3],
  5: [1, 3],
  6: [2, 4],
  7: [2, 4],
  8: [2, 4],
  9: [2, 4],
  10: [0, 2],
  11: [1, 3],
  12: [2, 4],
};

/** Tabela 2 ramy MTC: pytania z tabliczek KS1 (2, 5, 10) — od 3 do 7 w zestawie. */
export const MTC_KS1 = { tables: [2, 5, 10], min: 3, max: 7 } as const;

export type Question = [number, number];

/**
 * Zestaw 25 pytań zgodny z ramą MTC:
 *  - liczba pytań z każdej tabliczki (pierwszy czynnik) w limitach Tabeli 1,
 *  - pytania z tabliczek KS1 w limitach Tabeli 2 (3–7),
 *  - drugi czynnik: liczba wystąpień każdej liczby w limitach ±1 (przypis 5),
 *  - żadnego powtórzenia ani odwróconej pary w jednym zestawie,
 *  - kolejność losowa (rama: „items are not ordered according to difficulty").
 *
 * Losujemy do skutku: przy tych limitach poprawny zestaw wypada zwykle w
 * pierwszych kilku próbach.
 */
export function buildMtcForm(random: () => number = Math.random): Question[] {
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];

  for (let attempt = 0; attempt < 2000; attempt++) {
    const counts: Record<number, number> = {};
    let total = 0;
    for (const table of TABLES) {
      counts[table] = MTC_TABLE_LIMITS[table][0];
      total += counts[table];
    }
    while (total < MTC.questions) {
      const open = TABLES.filter((table) => counts[table] < MTC_TABLE_LIMITS[table][1]);
      counts[pick(open)] += 1;
      total += 1;
    }

    const ks1 = MTC_KS1.tables.reduce((sum, table) => sum + counts[table], 0);
    if (ks1 < MTC_KS1.min || ks1 > MTC_KS1.max) continue;

    const used = new Set<FactKey>();
    const questions: Question[] = [];
    let failed = false;
    for (const table of TABLES) {
      for (let i = 0; i < counts[table]; i++) {
        const free = TABLES.filter((second) => !used.has(factKey(table, second)));
        if (free.length === 0) {
          failed = true;
          break;
        }
        const second = pick(free);
        used.add(factKey(table, second));
        questions.push([table, second]);
      }
      if (failed) break;
    }
    if (failed) continue;

    const secondCounts: Record<number, number> = {};
    questions.forEach(([, second]) => {
      secondCounts[second] = (secondCounts[second] ?? 0) + 1;
    });
    const secondOk = TABLES.every((n) => {
      const count = secondCounts[n] ?? 0;
      const [min, max] = MTC_TABLE_LIMITS[n];
      return count >= min - 1 && count <= max + 1;
    });
    if (!secondOk) continue;

    // Fisher-Yates — kolejność bez związku z trudnością.
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    return questions;
  }
  throw new Error("buildMtcForm: nie udało się zbudować zestawu");
}

/** Sprawdzenie zestawu z zasadami ramy — używa go audyt i test generatora. */
export function checkMtcForm(questions: Question[]): string[] {
  const errors: string[] = [];
  if (questions.length !== MTC.questions) errors.push(`pytań ${questions.length}, a ma być 25`);

  const firstCounts: Record<number, number> = {};
  const secondCounts: Record<number, number> = {};
  const seen = new Set<FactKey>();
  for (const [a, b] of questions) {
    if (!TABLES.includes(a as (typeof TABLES)[number]) || !TABLES.includes(b as (typeof TABLES)[number])) {
      errors.push(`${a}×${b} spoza tabliczek 2–12`);
    }
    const key = factKey(a, b);
    if (seen.has(key)) errors.push(`${a}×${b} powtórzone albo odwrócone`);
    seen.add(key);
    firstCounts[a] = (firstCounts[a] ?? 0) + 1;
    secondCounts[b] = (secondCounts[b] ?? 0) + 1;
  }
  for (const table of TABLES) {
    const [min, max] = MTC_TABLE_LIMITS[table];
    const first = firstCounts[table] ?? 0;
    const second = secondCounts[table] ?? 0;
    if (first < min || first > max) errors.push(`×${table} jako pierwszy czynnik: ${first} (limit ${min}–${max})`);
    if (second < min - 1 || second > max + 1) {
      errors.push(`×${table} jako drugi czynnik: ${second} (limit ${min - 1}–${max + 1})`);
    }
  }
  const ks1 = MTC_KS1.tables.reduce((sum, table) => sum + (firstCounts[table] ?? 0), 0);
  if (ks1 < MTC_KS1.min || ks1 > MTC_KS1.max) errors.push(`KS1: ${ks1} (limit 3–7)`);
  return errors;
}

// --- Podpowiedzi strategii dla rodzica ----------------------------------------

/**
 * Jak angielska szkoła uczy „opornych" tabliczek — do pokazania rodzicowi po
 * błędzie. Strategia, nie sztuczka: każda wyprowadza trudny fakt z łatwego.
 */
export const TABLE_TIPS: Record<number, string> = {
  2: "Razy 2 to podwajanie: 2 × 7 = 7 + 7.",
  3: "Razy 3: podwój i dodaj jeszcze raz — 3 × 7 = 7 + 7 + 7 = 21.",
  4: "Razy 4 to „double double”: podwój dwa razy — 4 × 6 → 12 → 24.",
  5: "Razy 5 to połowa razy 10: 5 × 8 = połowa z 80 = 40. Wynik zawsze kończy się na 0 albo 5.",
  6: "Razy 6: razy 5 i jeszcze jedna grupa — 6 × 7 = 35 + 7 = 42.",
  7: "Razy 7: razy 5 plus razy 2 — 7 × 8 = 40 + 16 = 56. Wierszyk: „5, 6, 7, 8 — 56 = 7 × 8”.",
  8: "Razy 8: podwój trzy razy — 8 × 6 → 12 → 24 → 48.",
  9: "Razy 9: razy 10 minus jedna grupa — 9 × 7 = 70 − 7 = 63. Sprawdzenie do 9 × 10: cyfry wyniku sumują się do 9 (6 + 3).",
  10: "Razy 10: każda cyfra przesuwa się o jedno miejsce w lewo, a puste miejsce jedności zajmuje 0 — 7 × 10 = 70 (7 jedności → 7 dziesiątek). Mów „cyfry przesuwają się”, a nie „dopisz zero”.",
  11: "Razy 11 do 9: powtórz cyfrę — 11 × 4 = 44. Potem: 11 × 11 = 121, 11 × 12 = 132.",
  12: "Razy 12: razy 10 plus razy 2 — 12 × 7 = 70 + 14 = 84.",
};
