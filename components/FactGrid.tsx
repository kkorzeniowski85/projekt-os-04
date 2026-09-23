"use client";

/**
 * Mapa tabliczki 2–12: każda kratka to jedno działanie, kolor = jak pewnie
 * dziecko je zna. 7 × 8 i 8 × 7 mają ten sam kolor, bo to jeden fakt.
 * Stuknięcie kratki odtwarza fakt po angielsku.
 */

import { factKey, TABLES } from "@/lib/curriculum/tables";
import { playFact } from "@/lib/audio";
import type { FactState } from "@/lib/progress/types";
import { factLevel, type FactLevel } from "@/lib/tables/practice";

export const LEVEL_STYLE: Record<FactLevel, string> = {
  fluent: "bg-hero-lime text-night",
  learning: "bg-hero-gold text-night",
  weak: "bg-hero-pink text-night",
  unseen: "bg-white/10 text-paper/50",
};

export const LEVEL_LABEL: Record<FactLevel, string> = {
  fluent: "płynnie (⚡ w powtórkach)",
  learning: "w drodze",
  weak: "do powtórki",
  unseen: "jeszcze nie ćwiczone",
};

export function FactGrid({
  facts,
  compact = false,
}: {
  facts: Record<string, FactState>;
  compact?: boolean;
}) {
  const cell = compact ? "h-6 text-[10px]" : "h-8 text-xs sm:h-9 sm:text-sm";
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 tabular-nums">
        <thead>
          <tr>
            <th className={`${cell} text-paper/50`}>×</th>
            {TABLES.map((b) => (
              <th key={b} className={`${cell} font-black text-paper/70`}>
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLES.map((a) => (
            <tr key={a}>
              <th className={`${cell} font-black text-paper/70`}>{a}</th>
              {TABLES.map((b) => {
                const level = factLevel(facts[factKey(a, b)]);
                return (
                  <td key={b} className="p-0">
                    <button
                      type="button"
                      onClick={() => void playFact(a, b)}
                      title={`${a} × ${b} = ${a * b} — ${LEVEL_LABEL[level]}`}
                      aria-label={`${a} razy ${b}: ${LEVEL_LABEL[level]}`}
                      className={`${cell} w-full rounded font-bold ${LEVEL_STYLE[level]}`}
                    >
                      {compact ? "" : a * b}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-paper/70">
        {(Object.keys(LEVEL_STYLE) as FactLevel[]).map((level) => (
          <span key={level} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded ${LEVEL_STYLE[level]}`} />
            {LEVEL_LABEL[level]}
          </span>
        ))}
      </div>
    </div>
  );
}
