/**
 * Bohaterowie Akademii — ta sama drużyna co w Lidze Dźwięków (te same imiona,
 * kolory i wygląd). Dla dziecka to jeden świat: bohaterowie Ligi idą do
 * szkoły, a każdy prowadzi jeden dział Akademii.
 *
 * WAŻNE (jak w Lidze): wyłącznie postacie oryginalne, żadnych chronionych
 * prawem autorskim. Imiona robocze — do wymyślenia z dzieckiem.
 */

import type { ModuleId } from "@/lib/progress/types";

export type Hero = {
  id: string;
  codename: string;
  /** Moc opisana językiem dziecka. */
  power: string;
  colors: { suit: string; cape: string; accent: string };
  emblem?: string;
};

export const HEROES_BY_MODULE: Record<ModuleId, Hero> = {
  tables: {
    id: "speed",
    codename: "SPEED",
    power: "Odpowiada szybciej, niż zdążysz mrugnąć — tabliczka w mgnieniu oka.",
    colors: { suit: "#21d4fd", cape: "#2f6bff", accent: "#f5f7ff" },
    emblem: "×",
  },
  maths: {
    id: "spark",
    codename: "SPARK",
    power: "Zamienia angielskie słowa w liczby i działania.",
    colors: { suit: "#ffc93c", cape: "#e33d5a", accent: "#21d4fd" },
    emblem: "+",
  },
  reading: {
    id: "gleam",
    codename: "GLEAM",
    power: "Widzi odpowiedź ukrytą w tekście, zanim inni doczytają do końca.",
    colors: { suit: "#7bed6b", cape: "#21d4fd", accent: "#10163a" },
    emblem: "Aa",
  },
  tasks: {
    id: "thunder",
    codename: "THUNDER",
    power: "Zna każde polecenie z kartkówki — Tick, Circle, Find and copy.",
    colors: { suit: "#e33d5a", cape: "#10163a", accent: "#ffc93c" },
    emblem: "✓",
  },
};
