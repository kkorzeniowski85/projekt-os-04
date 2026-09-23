"use client";

import Link from "next/link";
import { FactGrid } from "@/components/FactGrid";
import { HeroAvatar } from "@/components/HeroAvatar";
import { BigButton, Card, PageHeader, ParentTip, STATUS_STYLE } from "@/components/ui";
import { LEARNING_ORDER, MTC } from "@/lib/curriculum/tables";
import { HEROES_BY_MODULE } from "@/lib/heroes";
import { useProgress } from "@/lib/progress/store";
import { unitKeyOf } from "@/lib/progress/types";
import { focusTable, tablesSummary } from "@/lib/tables/practice";

export default function TablesHubPage() {
  const { state, ready } = useProgress();
  const summary = tablesSummary(state.facts);
  const focus = focusTable(state.facts);
  const lastMock = state.mocks[state.mocks.length - 1];
  const hero = HEROES_BY_MODULE.tables;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tabliczka mnożenia" subtitle="SPEED · trening, liczenie skokami, próbny test" />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <HeroAvatar hero={hero} size={80} />
            <div>
              <p className="text-sm font-bold text-hero-cyan">{hero.codename}</p>
              <p className="text-2xl font-black">
                ⚡ {ready ? summary.fluent : "…"} / {summary.total}
              </p>
              <p className="text-sm text-paper/70">faktów płynnie</p>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-hero-lime transition-all"
              style={{ width: `${Math.round(summary.readiness * 100)}%` }}
            />
          </div>
          <BigButton href="/tabliczka/trening/" full>
            ⚡ Trening dnia
          </BigButton>
          <p className="text-sm text-paper/60">
            {!ready
              ? "…"
              : focus
                ? `Teraz dochodzą fakty z tabliczki ×${focus}. Trening sam dobiera nowe fakty i powtórki.`
                : "Wszystkie fakty są już w nauce — trening pilnuje powtórek."}
          </p>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-black">📝 Próbny test MTC</h2>
          <p className="text-sm text-paper/75">
            Wiernie jak prawdziwy: {MTC.questions} pytań, {MTC.answerMs / 1000} sekund na każde, 3
            pytania na rozgrzewkę, bez podpowiedzi. Wynik na 25 — jak w szkole.
          </p>
          {lastMock ? (
            <p className="text-lg">
              Ostatni wynik: <strong>{lastMock.score} / {lastMock.total}</strong>
              <span className="text-sm text-paper/60">
                {" "}
                ({new Date(lastMock.ts).toLocaleDateString("pl-PL")})
              </span>
            </p>
          ) : (
            <p className="text-sm text-paper/60">Jeszcze nie było próbnego testu.</p>
          )}
          <BigButton href="/tabliczka/test/" tone="quiet" full>
            Zrób próbny test
          </BigButton>
          <p className="text-xs text-paper/50">
            Rada: raz na 2–3 tygodnie wystarczy. Test pokazuje stan, a uczy trening.
          </p>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-black">Liczymy co… (zrozumienie i słowa)</h2>
        <p className="text-sm text-paper/70">
          Kolejność jak w angielskiej szkole. Lekcja uczy liczenia skokami i słów „lots of”, „groups of”,
          „times” — trening potem utrwala fakty.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {LEARNING_ORDER.map((table) => {
            const per = summary.perTable[table];
            const unit = state.units[unitKeyOf("tables", `count-${table}`)];
            return (
              <Link
                key={table}
                href={`/tabliczka/liczenie/${table}/`}
                className={`flex flex-col items-center gap-1 rounded-blob p-3 transition active:translate-y-0.5 ${
                  ready && focus === table ? "bg-hero-blue ring-4 ring-hero-gold" : "bg-white/10"
                }`}
              >
                <span className="text-3xl font-black">×{table}</span>
                <span className="text-xs text-paper/70">
                  ⚡ {ready ? per.fluent : "…"}/{per.total}
                </span>
                {unit && (
                  <span className={`rounded-full px-2 text-[10px] font-bold ${STATUS_STYLE[unit.status]}`}>
                    lekcja: {unit.sessions}×
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <Card>
        <h2 className="mb-3 text-xl font-black">Mapa tabliczki</h2>
        <FactGrid facts={state.facts} />
      </Card>

      <ParentTip title="Jak to działa (dla rodzica)">
        <p className="mb-2">
          Codziennie ok. 5 minut treningu wystarczy. Aplikacja pamięta każdy z 66 faktów osobno
          (7 × 8 i 8 × 7 to jeden fakt): co dziecko zna płynnie, wraca coraz rzadziej, a co sprawia
          kłopot — od razu. Nowe fakty dochodzą tylko wtedy, gdy nie piętrzą się słabe.
        </p>
        <p>
          „Płynnie” znaczy: dobrze i w 3,5 sekundy przy kolejnych powtórkach w odstępach dni (po
          dniu, potem po trzech) — jedna szybka odpowiedź to dopiero „w drodze”, a pomyłka cofa fakt do
          powtórki. W teście jest 6 sekund na przeczytanie, przypomnienie i wpisanie — zapas jest na
          stres i palec, który trafi obok klawisza.
        </p>
      </ParentTip>
    </div>
  );
}
