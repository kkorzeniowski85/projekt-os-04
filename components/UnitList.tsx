"use client";

/** Lista tematów działu z ich stanem — wspólna dla matematyki, czytania i poleceń. */

import Link from "next/link";
import { STATUS_LABEL, STATUS_STYLE } from "@/components/ui";
import { useProgress } from "@/lib/progress/store";
import { unitKeyOf, type ModuleId } from "@/lib/progress/types";

export type UnitTile = {
  id: string;
  href: string;
  emoji: string;
  title: string;
  subtitle?: string;
  badge?: string;
};

export function UnitList({ module, units }: { module: ModuleId; units: UnitTile[] }) {
  const { state } = useProgress();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {units.map((unit) => {
        const progress = state.units[unitKeyOf(module, unit.id)];
        const status = progress?.status ?? "new";
        return (
          <Link
            key={unit.id}
            href={unit.href}
            className="flex items-start gap-3 rounded-blob border border-white/10 bg-white/5 p-4 transition hover:bg-white/10 active:translate-y-0.5"
          >
            <span className="text-4xl" aria-hidden>
              {unit.emoji}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-lg font-black leading-tight">{unit.title}</span>
              {unit.subtitle && <span className="text-sm text-paper/65">{unit.subtitle}</span>}
              <span className="mt-1 flex flex-wrap gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
                {unit.badge && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-paper/70">{unit.badge}</span>
                )}
                {progress && progress.sessions > 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-paper/70">
                    sesji: {progress.sessions}
                  </span>
                )}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
