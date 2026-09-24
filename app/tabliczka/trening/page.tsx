"use client";

import { useState } from "react";
import { SessionRunner } from "@/components/session/SessionRunner";
import { BigButton, Card } from "@/components/ui";
import { LEARNING_ORDER, parseFact } from "@/lib/curriculum/tables";
import { countingLessonDone, heldNewTable } from "@/lib/mission";
import { useProgress } from "@/lib/progress/store";
import { buildTrainingSession } from "@/lib/tables/sessions";
import { focusTable, tablesSummary } from "@/lib/tables/practice";
import { useDeviceRole } from "@/lib/useDeviceRole";

export default function TrainingPage() {
  const { state, ready } = useProgress();
  const { role } = useDeviceRole();
  const [table, setTable] = useState<number | null>(null);

  // Następna tabliczka „Planu dnia" bez lekcji „Liczymy co N": ekran treningu
  // proponuje lekcję przed treningiem i po nim (także przed „Jeszcze raz",
  // który nie przechodzi przez misję dnia).
  const focus = focusTable(state.facts);
  const lessonFirst = ready && table === null && focus !== null && !countingLessonDone(state, focus) ? focus : null;
  const lessonCard = (held: boolean) =>
    lessonFirst !== null && (
      <Card className="w-full max-w-md text-center">
        <p className="text-lg font-bold text-hero-gold">🔢 Nowa tabliczka ×{lessonFirst}</p>
        <p className="mb-3 text-paper/80">
          {held
            ? `Nowe fakty ×${lessonFirst} przyjdą po lekcji „Liczymy co ${lessonFirst}”. Trening powtarza teraz to, co już znasz.`
            : `Najpierw lekcja „Liczymy co ${lessonFirst}” — z nią nowe fakty będą łatwiejsze.`}
        </p>
        <BigButton href={`/tabliczka/liczenie/${lessonFirst}/`} tone="quiet" full>
          Liczymy co {lessonFirst}
        </BigButton>
      </Card>
    );

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
      {lessonCard(heldNewTable(state) !== null)}
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
      parentIntroPl="Wygląda jak prawdziwy test: działanie i klawiatura. Nie podpowiadaj w trakcie — po błędzie aplikacja sama pokaże wynik i sposób na zapamiętanie, a dziecko musi wpisać poprawny wynik. Na komputerze dziecko może pisać na klawiaturze, jak w prawdziwym teście."
      startNotePl="Ok. 5 minut. ⚡ przy odpowiedzi = szybko (do 3,5 sekundy). Fakt zostaje błyskawicą, gdy jest szybki także w kolejnych dniach."
      exitHref="/tabliczka/"
      exitLabel="Tabliczka"
      build={() =>
        buildTrainingSession(state.facts, {
          size: role === "phone" ? 12 : 20,
          table,
          // Trening, który dziś skończył tabliczkę, nie zaczyna następnej przed
          // jej lekcją — także przy „Jeszcze raz" (patrz heldNewTable).
          holdNew: table === null && heldNewTable(state) !== null,
        })
      }
      introExtra={chooser}
      rewardExtra={(outcome) => {
        const summary = tablesSummary(state.facts);
        return (
          <>
            <Card className="w-full max-w-md">
              {outcome.newlyFluent.length > 0 ? (
                <>
                  <p className="text-lg font-bold text-hero-lime">⚡ Nowe błyskawice — te fakty znasz już płynnie!</p>
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
                <p className="text-paper/80">
                  Szybkie odpowiedzi ⚡ w kolejnych dniach zmieniają fakty w błyskawice — wróć jutro!
                </p>
              )}
              <p className="mt-2 text-sm text-paper/60">
                Płynnie (błyskawice): {summary.fluent} z {summary.total} faktów. Fakt jest błyskawicą, gdy
                odpowiadasz szybko w kilku powtórkach, w różne dni.
              </p>
            </Card>
            {lessonCard(heldNewTable(state) !== null)}
          </>
        );
      }}
    />
  );
}
