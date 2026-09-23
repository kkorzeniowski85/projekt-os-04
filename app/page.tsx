"use client";

/**
 * Baza Akademii: misja dnia, cztery działy, odliczanie do szkoły i do MTC.
 * Na komputerze obok jest kolumna rodzica ze skrótem postępu.
 */

import Link from "next/link";
import { FactGrid } from "@/components/FactGrid";
import { HeroAvatar } from "@/components/HeroAvatar";
import { Card } from "@/components/ui";
import { CLASSROOM_UNITS } from "@/lib/curriculum/classroom";
import { MATHS_TOPICS } from "@/lib/curriculum/maths";
import { READING_TEXTS } from "@/lib/curriculum/reading";
import { HEROES_BY_MODULE } from "@/lib/heroes";
import { dailyMission } from "@/lib/mission";
import { MTC_WINDOW_START, roughlyUntil, SCHOOL_START } from "@/lib/mtcDates";
import { useProgress } from "@/lib/progress/store";
import { unitKeyOf, type ModuleId, type ProgressState } from "@/lib/progress/types";
import { tablesSummary } from "@/lib/tables/practice";
import { useDeviceRole } from "@/lib/useDeviceRole";

const LIGA_URL = "https://kkorzeniowski85.github.io/projekt-os-02/";

function masteredIn(state: ProgressState, module: ModuleId, ids: string[]): number {
  return ids.filter((id) => state.units[unitKeyOf(module, id)]?.status === "mastered").length;
}

export default function HomePage() {
  const { role } = useDeviceRole();
  const { state, ready } = useProgress();
  const mission = dailyMission(state);
  const summary = tablesSummary(state.facts);
  const lastMock = state.mocks[state.mocks.length - 1];

  const modules: { module: ModuleId; href: string; title: string; detail: string }[] = [
    {
      module: "tables",
      href: "/tabliczka/",
      title: "Tabliczka",
      detail: ready ? `⚡ ${summary.fluent}/66 płynnie` : "…",
    },
    {
      module: "maths",
      href: "/matematyka/",
      title: "Matematyka po angielsku",
      detail: ready ? `${masteredIn(state, "maths", MATHS_TOPICS.map((t) => t.id))}/${MATHS_TOPICS.length} opanowane` : "…",
    },
    {
      module: "reading",
      href: "/czytanie/",
      title: "Czytanie",
      detail: ready ? `${masteredIn(state, "reading", READING_TEXTS.map((t) => t.id))}/${READING_TEXTS.length} opanowane` : "…",
    },
    {
      module: "tasks",
      href: "/polecenia/",
      title: "Język klasy",
      detail: ready ? `${masteredIn(state, "tasks", CLASSROOM_UNITS.map((u) => u.id))}/${CLASSROOM_UNITS.length} opanowane` : "…",
    },
  ];

  const allDone = ready && mission.every((step) => step.done);

  return (
    <div className={role === "desktop" ? "grid grid-cols-[1fr_340px] gap-8" : "flex flex-col gap-6"}>
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">Akademia Ligi</h1>
            <p className="text-sm text-paper/60">
              {/* Odliczanie dopiero u klienta: w HTML z builda byłoby z dnia
                  publikacji, a różnica wywołuje błąd hydratacji Reacta. */}
              {ready ? `Kadet: ${state.childName}` : "Wczytywanie…"} · szkoła w Anglii{" "}
              {ready ? roughlyUntil(SCHOOL_START) : "we wrześniu 2027"}
            </p>
          </div>
          {role !== "desktop" && (
            <Link href="/rodzic/" className="flex min-h-11 items-center rounded-full bg-white/10 px-5 text-sm">
              Rodzic
            </Link>
          )}
        </header>

        <Card className="border-hero-gold/40 bg-hero-gold/10">
          <p className="text-sm font-bold uppercase tracking-wide text-hero-gold">
            {allDone ? "Misja dnia wykonana! 🎉" : "Misja dnia"}
          </p>
          {!ready && (
            <div className="mt-3 flex flex-col gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/10" />
              ))}
            </div>
          )}
          <ol className={`mt-3 flex flex-col gap-2 ${ready ? "" : "hidden"}`}>
            {mission.map((step, index) => (
              <li key={`${step.href}-${index}`}>
                <Link
                  href={step.href}
                  className={`flex items-center gap-3 rounded-2xl p-3 transition active:translate-y-0.5 ${
                    step.done ? "bg-hero-lime/15" : index === mission.findIndex((s) => !s.done) ? "bg-hero-blue" : "bg-white/10"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/20 text-2xl">
                    {step.done ? "✅" : step.emoji}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg font-black leading-tight">{step.title}</span>
                    <span className="text-sm text-paper/70">{step.subtitle}</span>
                  </span>
                  <span aria-hidden className="text-xl">
                    ▸
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {allDone && (
            <p className="mt-3 text-sm text-paper/75">
              Na dziś wystarczy. Krótko i codziennie działa lepiej niż długo raz w tygodniu.
            </p>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {modules.map(({ module, href, title, detail }) => {
            const hero = HEROES_BY_MODULE[module];
            return (
              <Link
                key={module}
                href={href}
                className="flex flex-col items-center gap-2 rounded-blob border border-white/10 bg-white/5 p-4 text-center transition hover:bg-white/10 active:translate-y-0.5"
              >
                <HeroAvatar hero={hero} size={role === "phone" ? 64 : 84} />
                <span className="text-xs font-bold text-hero-cyan">{hero.codename}</span>
                <span className="text-lg font-black leading-tight">{title}</span>
                <span className="text-xs text-paper/65">{detail}</span>
              </Link>
            );
          })}
        </div>

        <a
          href={LIGA_URL}
          className="flex items-center gap-3 rounded-blob border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
        >
          <span className="text-3xl" aria-hidden>
            🔤
          </span>
          <span className="flex-1">
            <span className="block font-black">Liga Dźwięków</span>
            <span className="text-sm text-paper/65">Czytanie metodą phonics i słownictwo na co dzień — druga aplikacja drużyny.</span>
          </span>
          <span aria-hidden>↗</span>
        </a>
      </div>

      {role === "desktop" && (
        <aside className="flex flex-col gap-4">
          <Card>
            <p className="text-sm font-bold text-hero-cyan">Multiplication Tables Check</p>
            <p className="text-2xl font-black">czerwiec 2028</p>
            <p className="text-sm text-paper/70">{ready ? roughlyUntil(MTC_WINDOW_START) : "…"} · Year 4</p>
            <p className="mt-3 text-sm">
              Płynnie: <strong>{ready ? summary.fluent : "…"}/66</strong> faktów
              {lastMock && (
                <>
                  <br />
                  Ostatni próbny test: <strong>{lastMock.score}/25</strong>
                </>
              )}
            </p>
          </Card>
          <Card>
            <p className="mb-2 text-sm font-bold">Mapa tabliczki</p>
            <FactGrid facts={state.facts} compact />
          </Card>
          <Link href="/rodzic/" className="rounded-blob bg-white/10 p-4 text-center font-bold transition hover:bg-white/15">
            Panel rodzica: raport, synchronizacja →
          </Link>
        </aside>
      )}
    </div>
  );
}
