/**
 * Matematyka po angielsku — treść działu SPARK.
 *
 * Nie uczymy tu matematyki od zera (dziecko ma ją z polskiej szkoły), tylko
 * JĘZYKA, w którym angielska lekcja ją podaje: liczb ze słuchu, słów działań
 * („the difference between", „share equally"), zadań z treścią, zegara i
 * zapisu, który w Anglii wygląda inaczej niż w Polsce (2.5 zamiast 2,5,
 * ÷ zamiast :, „half past three" = 3:30, a nie 2:30).
 *
 * Wszystkie zdania brytyjskie, w rejestrze angielskiej klasy Year 3–4.
 * Każdy tekst, który pada w ćwiczeniu, ma nagranie (generator zbiera je z
 * `mathsPhrases()`), więc dziecko, które jeszcze słabo czyta, może słuchać.
 */

import { HUNDREDS_POOL, numbersWithAudio, numberToWords, TEEN_TY_PAIRS } from "./numbers";
import {
  pickSome,
  say,
  sayNumber,
  shuffle,
  type ChoiceOption,
  type Exercise,
} from "@/lib/session/exercise";

export type MathsTopic = {
  id: string;
  titlePl: string;
  emoji: string;
  goalPl: string;
  parentIntroPl: string;
  build: () => Exercise[];
};

const AUDIO_NUMBERS = new Set(numbersWithAudio());

// --- Liczby ze słuchu ------------------------------------------------------------

/** Liczby łatwe do pomylenia z `value` — tylko takie, które mają nagranie. */
function confusables(value: number): number[] {
  const out = new Set<number>();
  for (const [teen, ty] of TEEN_TY_PAIRS) {
    if (value === teen) out.add(ty);
    if (value === ty) out.add(teen);
  }
  const digits = String(value);
  if (digits.length >= 2) {
    const swapped = Number(digits.slice(0, -2) + digits.slice(-1) + digits.slice(-2, -1));
    out.add(swapped);
  }
  if (value >= 100) {
    // 406 ↔ 460 ↔ 46: zero w środku, zero na końcu, zgubiona setka.
    const rest = value % 100;
    const hundreds = Math.floor(value / 100);
    if (rest < 10) out.add(hundreds * 100 + rest * 10);
    if (rest % 10 === 0) out.add(hundreds * 100 + rest / 10);
    out.add(Number(`${hundreds}${rest || ""}`));
  }
  out.add(value + 1);
  out.add(value + 10);
  if (value >= 10) out.add(value - 10);
  out.delete(value);
  return [...out].filter((n) => n >= 0 && AUDIO_NUMBERS.has(n));
}

/**
 * Dwa dystraktory: najpierw pułapki ucha, a gdy ich brak (np. 888), liczby
 * z nagraniem możliwie bliskie tej samej wielkości.
 */
function distractors(value: number, count = 2): number[] {
  const picked = pickSome(confusables(value), count);
  if (picked.length >= count) return picked;
  const pool = (value >= 100 ? HUNDREDS_POOL : [...AUDIO_NUMBERS])
    .filter((n) => n !== value && !picked.includes(n))
    .sort((a, b) => Math.abs(a - value) - Math.abs(b - value));
  return [...picked, ...pool.slice(0, count - picked.length)];
}

function hearNumberChoice(value: number, id: string): Exercise {
  const options: ChoiceOption[] = shuffle([value, ...distractors(value)]).map((n) => ({
    id: String(n),
    label: String(n),
  }));
  return {
    id,
    kind: "choice",
    exercise: "number-listen",
    item: String(value),
    heading: "Którą liczbę słyszysz?",
    sound: sayNumber(value),
    listenOnly: true,
    options,
    answer: String(value),
    columns: 3,
    explainPl: `${value} = ${numberToWords(value)}`,
    explainWhen: "wrong",
  };
}

function hearNumberTyped(value: number, id: string): Exercise {
  return {
    id,
    kind: "typed",
    exercise: "number-type",
    item: String(value),
    heading: "Posłuchaj i wpisz liczbę",
    sound: sayNumber(value),
    listenOnly: true,
    answer: value,
    revealText: `${value} — ${numberToWords(value)}`,
    revealSound: sayNumber(value),
    explainPl: value >= 100 && value % 100 !== 0 ? "W setkach Brytyjczycy mówią „and”: one hundred AND five = 105." : undefined,
    explainWhen: "wrong",
  };
}

function readNumberChoice(value: number, id: string): Exercise {
  const others = distractors(value);
  return {
    id,
    kind: "choice",
    exercise: "number-read",
    item: String(value),
    heading: "Jak to się mówi po angielsku?",
    visual: { kind: "big", text: value >= 1000 ? value.toLocaleString("en-GB") : String(value) },
    options: shuffle([value, ...others]).map((n) => ({
      id: String(n),
      label: numberToWords(n),
      sound: sayNumber(n),
    })),
    answer: String(value),
    columns: 1,
  };
}

function numbersTopic(id: string, range: number[], counts: { hear: number; type: number; read: number }): () => Exercise[] {
  return () => {
    const values = pickSome(range, counts.hear + counts.type + counts.read);
    const screens: Exercise[] = [];
    values.slice(0, counts.hear).forEach((v, i) => screens.push(hearNumberChoice(v, `${id}-hear-${i}`)));
    values
      .slice(counts.hear, counts.hear + counts.read)
      .forEach((v, i) => screens.push(readNumberChoice(v, `${id}-read-${i}`)));
    values
      .slice(counts.hear + counts.read)
      .forEach((v, i) => screens.push(hearNumberTyped(v, `${id}-type-${i}`)));
    return screens;
  };
}

function teensTensSession(): Exercise[] {
  const screens: Exercise[] = [
    {
      id: "teen-ty-learn",
      kind: "learn",
      exercise: "learn",
      item: "teen-ty",
      heading: "-teen czy -ty?",
      promptEn: "thirteen — thirty",
      bodyPl:
        "Najczęstsza pułapka ucha. W „thirTEEN” akcent pada na koniec, a „-teen” jest długie jak „tiin”. W „THIRty” akcent jest na początku, a końcówka krótka i cicha. Posłuchaj par:",
      examples: TEEN_TY_PAIRS.slice(0, 4).map(([teen, ty]) => ({
        en: `${numberToWords(teen)}, ${numberToWords(ty)}`,
        pl: `${teen}, ${ty}`,
      })),
      parentPl:
        "Pomaga przesadzenie akcentu: rodzic mówi „thir-TEEN!” z naciskiem na koniec i „THIR-ty” z naciskiem na początek, dziecko pokazuje liczbę na palcach (13 = dziesięć i trzy, 30 = trzy dziesiątki).",
    },
  ];
  const pairs = shuffle([...TEEN_TY_PAIRS, ...TEEN_TY_PAIRS]).slice(0, 8);
  pairs.forEach(([teen, ty], i) => {
    const value = Math.random() < 0.5 ? teen : ty;
    screens.push({
      id: `teen-ty-${i}`,
      kind: "choice",
      exercise: "teen-ty",
      item: String(value),
      heading: "Którą liczbę słyszysz?",
      sound: sayNumber(value),
      listenOnly: true,
      options: [teen, ty].map((n) => ({ id: String(n), label: String(n), sound: sayNumber(n) })),
      answer: String(value),
      columns: 2,
      explainPl:
        value === teen
          ? `${numberToWords(teen)} — akcent na końcu, długie „-teen”.`
          : `${numberToWords(ty)} — akcent na początku, krótkie „-ty”.`,
      explainWhen: "wrong",
    });
  });
  return screens;
}

// --- Słowa działań ------------------------------------------------------------------

export type OperationItem = {
  id: string;
  en: string;
  answer: number;
  /** Co oznacza słowo-klucz. */
  keyPl: string;
  /** Rozpisanie działania. */
  workingPl: string;
};

export const OPERATIONS: OperationItem[] = [
  { id: "add", en: "What is 8 add 5?", answer: 13, keyPl: "add = dodać", workingPl: "8 + 5 = 13" },
  { id: "plus", en: "What is 7 plus 6?", answer: 13, keyPl: "plus = plus", workingPl: "7 + 6 = 13" },
  { id: "total", en: "What is the total of 9 and 6?", answer: 15, keyPl: "the total of = suma, razem", workingPl: "9 + 6 = 15" },
  { id: "sum", en: "What is the sum of 12 and 8?", answer: 20, keyPl: "the sum of = suma (to NIE jest odejmowanie!)", workingPl: "12 + 8 = 20" },
  { id: "more-than", en: "What is 10 more than 47?", answer: 57, keyPl: "10 more than = o 10 więcej niż", workingPl: "47 + 10 = 57" },
  { id: "take-away", en: "What is 15 take away 7?", answer: 8, keyPl: "take away = zabierz, odejmij", workingPl: "15 − 7 = 8" },
  { id: "subtract-from", en: "Subtract 6 from 20.", answer: 14, keyPl: "subtract 6 from 20 = odejmij 6 OD 20 (kolejność odwrotna niż w zdaniu!)", workingPl: "20 − 6 = 14" },
  { id: "minus", en: "What is 18 minus 9?", answer: 9, keyPl: "minus = minus", workingPl: "18 − 9 = 9" },
  { id: "difference", en: "What is the difference between 15 and 9?", answer: 6, keyPl: "the difference between = różnica: od większej odejmij mniejszą", workingPl: "15 − 9 = 6" },
  { id: "less-than", en: "What is 100 less than 350?", answer: 250, keyPl: "100 less than = o 100 mniej niż", workingPl: "350 − 100 = 250" },
  { id: "lots-of", en: "What is 4 lots of 6?", answer: 24, keyPl: "lots of = razy (4 grupy po 6)", workingPl: "4 × 6 = 24" },
  { id: "groups-of", en: "What is 3 groups of 7?", answer: 21, keyPl: "groups of = grupy po… (razy)", workingPl: "3 × 7 = 21" },
  { id: "multiply", en: "Multiply 8 by 3.", answer: 24, keyPl: "multiply by = pomnóż przez", workingPl: "8 × 3 = 24" },
  { id: "times", en: "What is 9 times 4?", answer: 36, keyPl: "times = razy", workingPl: "9 × 4 = 36" },
  { id: "product", en: "What is the product of 6 and 5?", answer: 30, keyPl: "the product of = iloczyn (wynik mnożenia)", workingPl: "6 × 5 = 30" },
  { id: "share", en: "Share 12 equally between 3. How many does each get?", answer: 4, keyPl: "share equally = podziel po równo", workingPl: "12 ÷ 3 = 4" },
  { id: "divide", en: "Divide 20 by 4.", answer: 5, keyPl: "divide by = podziel przez", workingPl: "20 ÷ 4 = 5" },
  { id: "how-many-in", en: "How many fives are there in 35?", answer: 7, keyPl: "how many fives in 35 = ile piątek mieści się w 35 (dzielenie)", workingPl: "35 ÷ 5 = 7" },
  { id: "double", en: "Double 14.", answer: 28, keyPl: "double = podwój (razy 2)", workingPl: "14 × 2 = 28" },
  { id: "half", en: "What is half of 18?", answer: 9, keyPl: "half of = połowa", workingPl: "18 ÷ 2 = 9" },
  { id: "halve", en: "Halve 30.", answer: 15, keyPl: "halve = podziel na pół", workingPl: "30 ÷ 2 = 15" },
  { id: "one-more", en: "What is one more than 99?", answer: 100, keyPl: "one more than = o jeden więcej niż", workingPl: "99 + 1 = 100" },
];

function operationsSession(): Exercise[] {
  const learn: Exercise = {
    id: "ops-learn",
    kind: "learn",
    exercise: "learn",
    item: "operation-words",
    heading: "Słowa działań",
    promptEn: "add, take away, lots of, share",
    bodyPl:
      "Na lekcji w Anglii rzadko pada sam znak „+”. Nauczyciel mówi słowami — a każde działanie ma kilka nazw:",
    examples: [
      { en: "add, plus, the total of, the sum of", pl: "dodawanie (+)" },
      { en: "take away, subtract, minus, the difference between", pl: "odejmowanie (−)" },
      { en: "times, lots of, groups of, multiply by", pl: "mnożenie (×)" },
      { en: "share equally, divide by, how many in", pl: "dzielenie (÷)" },
    ],
  };
  return [
    learn,
    ...pickSome(OPERATIONS, 9).map(
      (item, i): Exercise => ({
        id: `ops-${item.id}-${i}`,
        kind: "typed",
        exercise: "operation",
        item: item.id,
        promptEn: item.en,
        sound: say(item.en),
        answer: item.answer,
        revealText: item.workingPl,
        explainPl: `${item.keyPl}: ${item.workingPl}.`,
      }),
    ),
  ];
}

// --- Zadania z treścią -------------------------------------------------------------

export type WordProblem = {
  id: string;
  en: string;
  answer: number;
  /** Słowo-klucz, po którym poznać działanie. */
  keyword: string;
  keyPl: string;
  workingPl: string;
};

export const WORD_PROBLEMS: WordProblem[] = [
  {
    id: "marbles",
    en: "Tom has 12 marbles. He gives 5 to his friend. How many marbles does Tom have left?",
    answer: 7,
    keyword: "left",
    keyPl: "„left” = zostało → odejmujemy",
    workingPl: "12 − 5 = 7",
  },
  {
    id: "cakes",
    en: "There are 6 boxes. Each box has 4 cakes. How many cakes are there altogether?",
    answer: 24,
    keyword: "each … altogether",
    keyPl: "„each box has 4” + „altogether” = 6 grup po 4 → mnożymy",
    workingPl: "6 × 4 = 24",
  },
  {
    id: "pencils",
    en: "A pencil costs 8p. How much do 3 pencils cost? Answer in pence.",
    answer: 24,
    keyword: "8p",
    keyPl: "„p” = pence (pensy, jak grosze). 3 ołówki po 8p → mnożymy",
    workingPl: "3 × 8p = 24p",
  },
  {
    id: "stickers",
    en: "Sam has 15 stickers. Mia has 9 stickers. How many more stickers does Sam have than Mia?",
    answer: 6,
    keyword: "how many more",
    keyPl: "„how many more … than” = o ile więcej → różnica, odejmujemy",
    workingPl: "15 − 9 = 6",
  },
  {
    id: "groups",
    en: "There are 28 children in the class. They sit in groups of 4. How many groups are there?",
    answer: 7,
    keyword: "groups of",
    keyPl: "„in groups of 4” + „how many groups” = ile czwórek w 28 → dzielimy",
    workingPl: "28 ÷ 4 = 7",
  },
  {
    id: "pages",
    en: "Ella reads 7 pages every day. How many pages does she read in one week?",
    answer: 49,
    keyword: "one week",
    keyPl: "ukryta liczba: „a week” = 7 dni → 7 razy po 7 stron",
    workingPl: "7 × 7 = 49",
  },
  {
    id: "bus",
    en: "A bus has 45 seats. 19 people are on the bus. How many seats are empty?",
    answer: 26,
    keyword: "empty",
    keyPl: "„empty” = puste → z wszystkich miejsc odejmujemy zajęte",
    workingPl: "45 − 19 = 26",
  },
  {
    id: "biscuits",
    en: "Grandma bakes 24 biscuits. She shares them equally between 6 plates. How many biscuits are on each plate?",
    answer: 4,
    keyword: "shares them equally",
    keyPl: "„shares equally between 6” = po równo na 6 → dzielimy",
    workingPl: "24 ÷ 6 = 4",
  },
  {
    id: "change",
    en: "Jack has £10. He buys a book for £6. How much change does he get? Answer in pounds.",
    answer: 4,
    keyword: "change",
    keyPl: "„change” = reszta (w sklepie) → odejmujemy",
    workingPl: "£10 − £6 = £4",
  },
  {
    id: "crayons",
    en: "There are 3 packs of crayons with 12 crayons in each pack. How many crayons are there in total?",
    answer: 36,
    keyword: "in each … in total",
    keyPl: "„12 in each pack” + „in total” = 3 paczki po 12 → mnożymy",
    workingPl: "3 × 12 = 36",
  },
  {
    id: "ruler",
    en: "A ruler is 30 centimetres long. How long are 2 rulers placed end to end? Answer in centimetres.",
    answer: 60,
    keyword: "end to end",
    keyPl: "„end to end” = jedna za drugą → dodajemy długości",
    workingPl: "30 + 30 = 60 cm",
  },
  {
    id: "points",
    en: "Leo scored 18 points. Amy scored double that. How many points did Amy score?",
    answer: 36,
    keyword: "double",
    keyPl: "„double that” = dwa razy tyle",
    workingPl: "18 × 2 = 36",
  },
  {
    id: "sweets",
    en: "There are 50 sweets in a jar. Half of them are red. How many red sweets are there?",
    answer: 25,
    keyword: "half of",
    keyPl: "„half of them” = połowa z nich",
    workingPl: "50 ÷ 2 = 25",
  },
  {
    id: "temperature",
    en: "It is 9 degrees in the morning. By lunchtime it is 5 degrees warmer. What is the temperature at lunchtime?",
    answer: 14,
    keyword: "warmer",
    keyPl: "„5 degrees warmer” = o 5 stopni cieplej → dodajemy",
    workingPl: "9 + 5 = 14",
  },
  {
    id: "boys",
    en: "There are 32 children in the class. 17 of them are girls. How many boys are there?",
    answer: 15,
    keyword: "how many boys",
    keyPl: "wszystkie dzieci minus dziewczynki = chłopcy → odejmujemy",
    workingPl: "32 − 17 = 15",
  },
  {
    id: "legs",
    en: "A dog has 4 legs. How many legs do 5 dogs have?",
    answer: 20,
    keyword: "5 dogs",
    keyPl: "5 psów po 4 nogi → mnożymy",
    workingPl: "5 × 4 = 20",
  },
];

function wordProblemsSession(): Exercise[] {
  return pickSome(WORD_PROBLEMS, 6).map(
    (problem, i): Exercise => ({
      id: `wp-${problem.id}-${i}`,
      kind: "typed",
      exercise: "word-problem",
      item: problem.id,
      heading: "Posłuchaj, przeczytaj, policz",
      promptEn: problem.en,
      sound: say(problem.en),
      answer: problem.answer,
      revealText: problem.workingPl,
      explainPl: `${problem.keyPl}: ${problem.workingPl}.`,
      parentPl: `Słowo-klucz: „${problem.keyword}”. Zapytaj najpierw: „Dodajemy, odejmujemy, mnożymy czy dzielimy? Po czym to poznałeś?” — to pytanie jest ważniejsze od samego wyniku.`,
    }),
  );
}

// --- Zegar ------------------------------------------------------------------------

type TimeKind = "oclock" | "half" | "quarter-past" | "quarter-to";

export function timePhrase(hour: number, kind: TimeKind): string {
  const word = (h: number) => numberToWords(((h - 1 + 12) % 12) + 1);
  switch (kind) {
    case "oclock":
      return `${word(hour)} o'clock`;
    case "half":
      return `half past ${word(hour)}`;
    case "quarter-past":
      return `quarter past ${word(hour)}`;
    case "quarter-to":
      return `quarter to ${word(hour + 1)}`;
  }
}

/** Wskazówki zegara dla „hour" i rodzaju godziny (quarter to = za kwadrans następna). */
function clockOf(hour: number, kind: TimeKind): { hour: number; minute: number } {
  const minute = { oclock: 0, half: 30, "quarter-past": 15, "quarter-to": 45 }[kind];
  return { hour, minute };
}

const TIME_KINDS: TimeKind[] = ["oclock", "half", "quarter-past", "quarter-to"];

function timeKey(hour: number, kind: TimeKind): string {
  return `${hour}-${kind}`;
}

/**
 * Dystraktory celowo z pułapek. Polskie „wpół do czwartej" to 3:30, a
 * angielskie „half past three" też 3:30 — liczby w nazwach się różnią, więc
 * pułapka działa w obie strony INACZEJ:
 *  - ze słuchu (zdanie → zegar): dziecko słyszy „three" i ustawia „wpół do
 *    trzeciej" = 2:30 → dystraktor o godzinę WCZEŚNIEJ;
 *  - z tarczy (zegar → zdanie): dziecko widzi 3:30, myśli „wpół do czwartej"
 *    i szuka „four" → dystraktor „half past four", o godzinę PÓŹNIEJ.
 */
function timeDistractors(hour: number, kind: TimeKind, direction: "read" | "hear"): Array<[number, TimeKind]> {
  const prev = hour === 1 ? 12 : hour - 1;
  const next = hour === 12 ? 1 : hour + 1;
  switch (kind) {
    case "half":
      return [
        [direction === "hear" ? prev : next, "half"],
        [hour, "quarter-past"],
      ];
    case "quarter-to":
      return [
        [next, "quarter-past"],
        [hour, "quarter-past"],
      ];
    case "quarter-past":
      return [
        [hour, "quarter-to"],
        [hour, "half"],
      ];
    case "oclock":
      return [
        [hour, "half"],
        [next, "oclock"],
      ];
  }
}

function timeSession(): Exercise[] {
  const screens: Exercise[] = [
    {
      id: "time-learn",
      kind: "learn",
      exercise: "learn",
      item: "time-words",
      heading: "Zegar po angielsku",
      visual: { kind: "clock", hour: 3, minute: 30 },
      promptEn: "It's half past three.",
      sound: say("It's half past three."),
      bodyPl:
        "Uwaga, pułapka! „Half past three” to 3:30 — pół godziny PO trzeciej. Po polsku mówimy „wpół do czwartej”, więc łatwo pomylić godzinę. Anglik liczy od godziny, która minęła:",
      examples: [
        { en: "three o'clock", pl: "3:00 — trzecia" },
        { en: "quarter past three", pl: "3:15 — kwadrans po trzeciej" },
        { en: "half past three", pl: "3:30 — wpół do czwartej!" },
        { en: "quarter to four", pl: "3:45 — za kwadrans czwarta" },
        { en: "half four", pl: "potocznie: 4:30 (half past four), NIE „wpół do czwartej”!" },
      ],
      parentPl:
        "W Year 3–4 dzieci czytają zegar wskazówkowy (także z cyframi rzymskimi) i piszą godziny cyfrowo. Uwaga na potoczne „half four” (tak mówią rodzice na placu zabaw: „pick-up at half four”) — to 4:30, a polskie ucho słyszy „wpół do czwartej”, czyli 3:30. Warto w domu mówić godziny po angielsku przy okazji: „It's quarter past seven — time for breakfast!”",
    },
  ];

  const used = new Set<string>();
  const draws: Array<[number, TimeKind]> = [];
  while (draws.length < 7) {
    const hour = 1 + Math.floor(Math.random() * 12);
    const kind = TIME_KINDS[Math.floor(Math.random() * TIME_KINDS.length)];
    // „half past" częściej — to w nim siedzi pułapka.
    const chosen: TimeKind = draws.length < 3 ? "half" : kind;
    if (used.has(timeKey(hour, chosen))) continue;
    used.add(timeKey(hour, chosen));
    draws.push([hour, chosen]);
  }

  draws.forEach(([hour, kind], i) => {
    const direction = i % 2 === 0 ? "read" : "hear";
    const options = shuffle([[hour, kind] as [number, TimeKind], ...timeDistractors(hour, kind, direction)]);
    const correct = timeKey(hour, kind);
    if (direction === "read") {
      // Zegar → które zdanie.
      screens.push({
        id: `time-read-${i}`,
        kind: "choice",
        exercise: "time-read",
        item: correct,
        promptEn: "What time is it?",
        sound: say("What time is it?"),
        visual: { kind: "clock", ...clockOf(hour, kind) },
        options: options.map(([h, k]) => ({
          id: timeKey(h, k),
          label: timePhrase(h, k),
          sound: say(timePhrase(h, k)),
        })),
        answer: correct,
        columns: 1,
        explainPl: explainTime(hour, kind),
      });
    } else {
      // Zdanie ze słuchu → który zegar.
      const phrase = `It's ${timePhrase(hour, kind)}.`;
      screens.push({
        id: `time-hear-${i}`,
        kind: "choice",
        exercise: "time-hear",
        item: correct,
        heading: "Który zegar?",
        promptEn: phrase,
        sound: say(phrase),
        options: options.map(([h, k]) => ({
          id: timeKey(h, k),
          label: "",
          visual: { kind: "clock", ...clockOf(h, k) },
        })),
        answer: correct,
        columns: 3,
        explainPl: explainTime(hour, kind),
      });
    }
  });
  return screens;
}

function explainTime(hour: number, kind: TimeKind): string {
  const next = hour === 12 ? 1 : hour + 1;
  const hh = (h: number, m: number) => `${h}:${String(m).padStart(2, "0")}`;
  switch (kind) {
    case "oclock":
      return `${timePhrase(hour, kind)} = ${hh(hour, 0)} — długa wskazówka na 12.`;
    case "half":
      return `${timePhrase(hour, kind)} = ${hh(hour, 30)} — pół godziny PO ${hour}. Po polsku „wpół do ${next}”.`;
    case "quarter-past":
      return `${timePhrase(hour, kind)} = ${hh(hour, 15)} — kwadrans PO ${hour}.`;
    case "quarter-to":
      return `${timePhrase(hour, kind)} = ${hh(hour, 45)} — za kwadrans ${next}.`;
  }
}

// --- Zapis jak w Anglii --------------------------------------------------------------

export type NotationItem = {
  id: string;
  shown: string;
  promptEn: string;
  options: string[];
  answer: string;
  explainPl: string;
};

export const NOTATION: NotationItem[] = [
  {
    id: "decimal",
    shown: "2.5",
    promptEn: "How do you say this number?",
    options: ["two point five", "twenty-five", "two thousand, five hundred"],
    answer: "two point five",
    explainPl: "W Anglii ułamek dziesiętny zapisuje się z KROPKĄ: 2.5 (czytaj „two point five”). Nasze 2,5 to po angielsku 2.5.",
  },
  {
    id: "thousands",
    shown: "2,500",
    promptEn: "How do you say this number?",
    options: ["two thousand, five hundred", "two point five", "twenty-five"],
    answer: "two thousand, five hundred",
    explainPl: "Uwaga! Przecinek w angielskiej liczbie oddziela TYSIĄCE: 2,500 = dwa tysiące pięćset (u nas 2 500). To nie jest 2,5!",
  },
  {
    id: "divide",
    shown: "12 ÷ 3",
    promptEn: "What does this sign mean?",
    options: ["divided by", "times", "take away"],
    answer: "divided by",
    explainPl: "Znak dzielenia w Anglii to ÷ („divided by”). Naszego dwukropka 12 : 3 w angielskiej szkole się nie używa — dwukropek oznacza tam godzinę (3:30).",
  },
  {
    id: "times",
    shown: "4 × 5",
    promptEn: "What does this sign mean?",
    options: ["times", "plus", "divided by"],
    answer: "times",
    explainPl: "× czyta się „times” albo „multiplied by”. Kropki (4 · 5) jako znaku mnożenia w Year 4 się nie używa.",
  },
  {
    id: "pounds",
    shown: "£3.50",
    promptEn: "How do you say this amount?",
    options: ["three pounds fifty", "thirty-five pounds", "thirty-five pence"],
    answer: "three pounds fifty",
    explainPl: "£ stoi PRZED liczbą: £3.50 = 3 funty i 50 pensów, mówi się „three pounds fifty”. To tyle samo co 350 pensów (100 pensów = 1 funt), ale kwotę z £ czyta się w funtach.",
  },
  {
    id: "pence",
    shown: "75p",
    promptEn: "How do you say this amount?",
    options: ["seventy-five pence", "seven pounds fifty", "seventy-five pounds"],
    answer: "seventy-five pence",
    explainPl: "„p” po liczbie to pensy: 75p = „seventy-five pence” (dzieci często mówią też „seventy-five p”).",
  },
  {
    id: "clock",
    shown: "3:30",
    promptEn: "What time is it?",
    options: ["half past three", "half past four", "quarter past three"],
    answer: "half past three",
    explainPl: "3:30 = „half past three” — pół godziny PO trzeciej. Po polsku „wpół do czwartej”, dlatego kusi „four” — ale Anglik liczy od godziny, która minęła.",
  },
  {
    id: "half",
    shown: "½",
    promptEn: "What is this fraction called?",
    options: ["a half", "a quarter", "a third"],
    answer: "a half",
    explainPl: "½ = „a half” (połowa), ¼ = „a quarter” (ćwierć), ⅓ = „a third” (jedna trzecia).",
  },
  {
    id: "quarter",
    shown: "¼",
    promptEn: "What is this fraction called?",
    options: ["a quarter", "a half", "a third"],
    answer: "a quarter",
    explainPl: "¼ = „a quarter” — to samo słowo co w „quarter past three” (kwadrans = ćwierć godziny).",
  },
];

function notationSession(): Exercise[] {
  const learn: Exercise = {
    id: "notation-learn",
    kind: "learn",
    exercise: "learn",
    item: "notation",
    heading: "Zapis jak w Anglii",
    visual: { kind: "big", text: "2.5   2,500   ÷" },
    bodyPl:
      "Matematyka ta sama, zapis trochę inny: ułamek dziesiętny z kropką (2.5), tysiące z przecinkiem (2,500), dzielenie znakiem ÷, pieniądze w funtach (£) i pensach (p).",
    parentPl:
      "Praktyczna rzecz na zeszyt: polską „jedynkę” z długim daszkiem angielski nauczyciel łatwo przeczyta jako 7. W Anglii 1 pisze się jedną prostą kreską, a 7 bez przekreślenia. Warto przećwiczyć zapis cyfr przed wrześniem.",
  };
  return [
    learn,
    ...shuffle(NOTATION).map(
      (item, i): Exercise => ({
        id: `notation-${item.id}-${i}`,
        kind: "choice",
        exercise: "notation",
        item: item.id,
        visual: { kind: "big", text: item.shown },
        promptEn: item.promptEn,
        sound: say(item.promptEn),
        options: shuffle(item.options).map((option) => ({ id: option, label: option, sound: say(option) })),
        answer: item.answer,
        columns: 1,
        explainPl: item.explainPl,
      }),
    ),
  ];
}

// --- Tematy ----------------------------------------------------------------------

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const MATHS_TOPICS: MathsTopic[] = [
  {
    id: "numbers-20",
    titlePl: "Liczby do 20",
    emoji: "🔢",
    goalPl: "Rozpoznaj liczbę ze słuchu — także eleven i twelve.",
    parentIntroPl:
      "Najtrudniejsze są eleven i twelve (nie mają końcówki -teen) oraz pary -teen / -ty. Dziecko, które dobrze liczy po polsku, i tak musi „przestawić ucho” — w klasie liczby padają szybko.",
    build: numbersTopic("n20", range(0, 20), { hear: 5, type: 3, read: 2 }),
  },
  {
    id: "teens-tens",
    titlePl: "Thirteen czy thirty?",
    emoji: "👂",
    goalPl: "Usłysz różnicę między -teen a -ty.",
    parentIntroPl:
      "13/30, 14/40… różnią się głównie akcentem. Pomyłka psuje całe zadanie, a w klasie nikt jej nie wyłapie — dlatego osobny trening.",
    build: teensTensSession,
  },
  {
    id: "numbers-100",
    titlePl: "Liczby do 100",
    emoji: "💯",
    goalPl: "Wpisz liczbę, którą słyszysz.",
    parentIntroPl:
      "W angielskim dziesiątki idą PRZED jednościami, jak w polskim („forty-five” = 45) — to akurat łatwe. Pułapką są -teen/-ty i szybkie tempo.",
    build: numbersTopic("n100", range(21, 99), { hear: 3, type: 5, read: 2 }),
  },
  {
    id: "numbers-1000",
    titlePl: "Setki i tysiąc",
    emoji: "🏛️",
    goalPl: "One hundred AND five — liczby do 1000 po brytyjsku.",
    parentIntroPl:
      "Year 4 pracuje na liczbach do 10 000. Brytyjczycy mówią „and” po setkach: 406 = „four hundred and six”. Zera w środku i na końcu (406 / 460 / 46) to typowa pomyłka ze słuchu.",
    build: numbersTopic("n1000", HUNDREDS_POOL, { hear: 3, type: 5, read: 3 }),
  },
  {
    id: "operations",
    titlePl: "Słowa działań",
    emoji: "➗",
    goalPl: "Total, difference, lots of, share — policz, gdy działanie jest powiedziane słowami.",
    parentIntroPl:
      "To najważniejszy temat działu. Polskie dziecko liczy dobrze, ale gubi się na „the difference between” albo „subtract 6 from 20” (odwrotna kolejność niż w zdaniu). Po błędzie aplikacja pokazuje, co znaczy słowo-klucz.",
    build: operationsSession,
  },
  {
    id: "word-problems",
    titlePl: "Zadania z treścią",
    emoji: "📖",
    goalPl: "Znajdź słowo-klucz i policz.",
    parentIntroPl:
      "Zadania w stylu Year 3–4: pensy, funty, grupy, reszta. Najpierw słuchamy, potem czytamy. W trybie z rodzicem po każdym zadaniu jest pytanie „po czym poznałeś, co liczyć?” — tego uczy angielska szkoła („explain your reasoning”).",
    build: wordProblemsSession,
  },
  {
    id: "time",
    titlePl: "Zegar po angielsku",
    emoji: "🕒",
    goalPl: "O'clock, half past, quarter past, quarter to.",
    parentIntroPl:
      "Pułapka dla polskich dzieci: „half past three” to 3:30, a po polsku „wpół do czwartej”. Dziecko słyszy „three” i ustawia 2:30. Ćwiczenie celowo podsuwa ten błąd, żeby go oswoić.",
    build: timeSession,
  },
  {
    id: "notation",
    titlePl: "Zapis jak w Anglii",
    emoji: "✏️",
    goalPl: "2.5 zamiast 2,5, ÷ zamiast :, £ i p.",
    parentIntroPl:
      "Rzeczy, których nikt nie tłumaczy, bo w Anglii są oczywiste: kropka dziesiętna, przecinek w tysiącach, znak ÷, funty i pensy.",
    build: notationSession,
  },
];

export function getMathsTopic(id: string): MathsTopic | undefined {
  return MATHS_TOPICS.find((topic) => topic.id === id);
}

/** Wszystkie zdania działu — dla generatora nagrań i audytu. */
export function mathsPhrases(): string[] {
  const phrases = new Set<string>();
  const add = (text: string) => phrases.add(text);
  TEEN_TY_PAIRS.forEach(([teen, ty]) => add(`${numberToWords(teen)}, ${numberToWords(ty)}`));
  ["add, take away, lots of, share", "add, plus, the total of, the sum of", "take away, subtract, minus, the difference between", "times, lots of, groups of, multiply by", "share equally, divide by, how many in"].forEach(add);
  OPERATIONS.forEach((item) => add(item.en));
  WORD_PROBLEMS.forEach((item) => add(item.en));
  add("What time is it?");
  add("half four");
  for (let hour = 1; hour <= 12; hour++) {
    for (const kind of TIME_KINDS) {
      add(timePhrase(hour, kind));
      add(`It's ${timePhrase(hour, kind)}.`);
    }
  }
  NOTATION.forEach((item) => {
    add(item.promptEn);
    item.options.forEach(add);
  });
  return [...phrases];
}
