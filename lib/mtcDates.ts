/**
 * Kalendarz szkolny dziecka (z briefu rodzica): start w Anglii we wrześniu
 * 2027 → Year 4 → Multiplication Tables Check w czerwcu 2028.
 *
 * Dokładne okno MTC w 2028 r. STA ogłosi później (zwykle pierwsze dwa-trzy
 * tygodnie czerwca), więc odliczamy do 1 czerwca — z zapasem, nie na styk.
 * Przy zmianie planów rodziny wystarczy poprawić te dwie daty.
 */

export const SCHOOL_START = new Date(2027, 8, 1); // 1 września 2027
export const MTC_WINDOW_START = new Date(2028, 5, 1); // 1 czerwca 2028

const DAY = 24 * 60 * 60 * 1000;

export function daysUntil(date: Date, now = Date.now()): number {
  return Math.max(0, Math.ceil((date.getTime() - now) / DAY));
}

/** „za 1 rok i 8 miesięcy" — po ludzku, bez dokładności co do dnia. */
export function roughlyUntil(date: Date, now = new Date()): string {
  let months = (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
  if (date.getDate() < now.getDate()) months -= 1;
  if (months <= 0) {
    const days = daysUntil(date, now.getTime());
    return days === 0 ? "już teraz" : days === 1 ? "jutro" : `za ${days} dni`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 0 ? "" : years === 1 ? "1 rok" : years < 5 ? `${years} lata` : `${years} lat`;
  const m =
    rest === 0 ? "" : rest === 1 ? "1 miesiąc" : rest < 5 ? `${rest} miesiące` : `${rest} miesięcy`;
  return `za ${[y, m].filter(Boolean).join(" i ")}`;
}
