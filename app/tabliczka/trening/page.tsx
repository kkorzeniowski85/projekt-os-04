"use client";

import { useState } from "react";
import { SessionRunner } from "@/components/session/SessionRunner";
import { Card } from "@/components/ui";
import { LEARNING_ORDER, parseFact } from "@/lib/curriculum/tables";
import { useProgress } from "@/lib/progress/store";
import { buildTrainingSession } from "@/lib/tables/sessions";
import { tablesSummary } from "@/lib/tables/practice";
import { useDeviceRole } from "@/lib/useDeviceRole";

export default function TrainingPage() {
  const { state } = useProgress();
  const { role } = useDeviceRole();
  const [table, setTable] = useState<number | null>(null);

  const chooser = (
    <div className="flex w-full max-w-xl flex-col items-center gap-2">
      <p className="text-sm text-paper/60">Co ćwiczymy?</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setTable(null)}
          className={`min-h-11 rounded-full px-4 text-sm font-bold ${table === null ? "bg-hero-gold text-night" : "bg-white/10"}`}
        >
          Plan dnia
        </button>
        {LEARNING_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTable(t)}
            className={`min-h-11 min-w-11 rounded-full px-3 text-sm font-bold ${table === t ? "bg-hero-gold text-night" : "bg-white/10"}`}
          >
            ×{t}
          </button>
        ))}
      </div>
      <p className="text-xs text-paper/50">
        „Plan dnia” sam dobiera powtórki i nowe fakty — to najlepszy wybór na co dzień.
      </p>
    </div>
  );

  return (
    <SessionRunner
      module="tables"
      unitId={table ? `practice-${table}` : "practice"}
      kind="practice"
      title={table ? `Trening ×${table}` : "Trening dnia"}
      emoji="⚡"
      goalPl="Odpowiadaj szybko jak błyskawica. Enter zatwierdza."
      parentIntroPl="Wygląda jak prawdziwy test: działanie i klawiatura. Nie podpowiadaj w trakcie — po błędzie aplikacja sama pokaże wynik i sposób na zapamiętanie, a dziecko musi wpisać poprawny wynik. Na komputerze dziecko może pisać na klawiaturze, jak w szkole."
      startNotePl="Ok. 5 minut. Błyskawica ⚡ = odpowiedź w 3,5 sekundy."
      exitHref="/tabliczka/"
      exitLabel="Tabliczka"
      build={() =>
        buildTrainingSession(state.facts, { size: role === "phone" ? 12 : 20, table })
      }
      introExtra={chooser}
      rewardExtra={(outcome) => {
        const summary = tablesSummary(state.facts);
        return (
          <Card className="w-full max-w-md">
            {outcome.newlyFluent.length > 0 ? (
              <>
                <p className="text-lg font-bold text-hero-lime">⚡ Nowe błyskawice!</p>
                <p className="font-reading text-2xl font-black">
                  {outcome.newlyFluent
                    .map((key) => {
                      const [a, b] = parseFact(key);
                      return `${a} × ${b}`;
                    })
                    .join(", ")}
                </p>
              </>
            ) : (
              <p className="text-paper/80">Każdy trening przybliża kolejne fakty do błyskawicy.</p>
            )}
            <p className="mt-2 text-sm text-paper/60">
              Płynnie: {summary.fluent} z {summary.total} faktów
            </p>
          </Card>
        );
      }}
    />
  );
}
