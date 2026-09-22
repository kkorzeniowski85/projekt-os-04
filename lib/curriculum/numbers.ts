/**
 * Liczby po angielsku — tak, jak mówi się je w brytyjskiej szkole.
 *
 * Brytyjska różnica, której uczy aplikacja: w setkach jest „and" —
 * 105 = „one hundred AND five" (Amerykanie mówią „one hundred five").
 * Dziecko usłyszy w klasie wyłącznie wersję z „and".
 *
 * Bez importów — generator nagrań czyta ten plik z Node.
 */

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** Liczba słownie po brytyjsku, 0–9999: 105 → „one hundred and five". */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    throw new Error(`numberToWords: poza zakresem (${n})`);
  }
  if (n < 20) return ONES[n];
  if (n < 100) {
    const ones = n % 10;
    return ones ? `${TENS[Math.floor(n / 10)]}-${ONES[ones]}` : TENS[Math.floor(n / 10)];
  }
  if (n < 1000) {
    const rest = n % 100;
    const hundreds = `${ONES[Math.floor(n / 100)]} hundred`;
    return rest ? `${hundreds} and ${numberToWords(rest)}` : hundreds;
  }
  const rest = n % 1000;
  const thousands = `${numberToWords(Math.floor(n / 1000))} thousand`;
  if (!rest) return thousands;
  return rest < 100 ? `${thousands} and ${numberToWords(rest)}` : `${thousands}, ${numberToWords(rest)}`;
}

/**
 * Pary „-teen / -ty" — klasyczna pułapka ucha dla uczących się angielskiego:
 * thirTEEN i THIRty różnią się głównie AKCENTEM. W klasie pomyłka 13/30 psuje
 * całe zadanie, a słychać ją dopiero po wielu powtórzeniach.
 */
export const TEEN_TY_PAIRS: Array<[number, number]> = [
  [13, 30],
  [14, 40],
  [15, 50],
  [16, 60],
  [17, 70],
  [18, 80],
  [19, 90],
];

/**
 * Setki do ćwiczenia ze słuchu. Dobrane pod pułapki: zero w środku (105, 406),
 * zero na końcu (150, 460), „-teen" w setkach (113, 118) i pary, które różnią
 * się tylko kolejnością (205 / 250, 301 / 310).
 */
export const HUNDREDS_POOL = [
  105, 113, 118, 150, 180, 205, 250, 301, 310, 406, 460, 512, 620, 707, 770, 888, 909,
  990, 999, 1000,
];

/**
 * Wszystkie liczby, które mają nagranie w /audio/numbers. Do 150 w całości —
 * liczenie skokami sięga 12 × 12 = 144 — plus pula setek.
 */
export function numbersWithAudio(): number[] {
  const set = new Set<number>();
  for (let n = 0; n <= 150; n++) set.add(n);
  HUNDREDS_POOL.forEach((n) => set.add(n));
  return [...set].sort((a, b) => a - b);
}
