/**
 * Polska odmiana rzeczownika po liczebniku: 1 kropka, 2–4 kropki (bez 12–14),
 * 5+ kropek. Bez importów — czyta go też generator nagrań i audyt.
 */
export function plForm(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const d = abs % 10;
  const t = abs % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

/** Liczba z odmienionym rzeczownikiem: pl(3, "sesja", "sesje", "sesji") → „3 sesje". */
export function pl(n: number, one: string, few: string, many: string): string {
  return `${n} ${plForm(n, one, few, many)}`;
}
