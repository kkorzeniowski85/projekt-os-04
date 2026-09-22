"use client";

import { PageHeader, ParentTip } from "@/components/ui";
import { UnitList } from "@/components/UnitList";
import { GENRE_LABEL, READING_TEXTS } from "@/lib/curriculum/reading";

export default function ReadingHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Czytanie ze zrozumieniem" subtitle="GLEAM · posłuchaj, przeczytaj, odpowiedz" />
      {[1, 2, 3].map((level) => (
        <section key={level} className="flex flex-col gap-3">
          <h2 className="text-lg font-black text-paper/80">
            Poziom {level}
            <span className="ml-2 text-sm font-normal text-paper/50">
              {level === 1 ? "krótkie zdania" : level === 2 ? "dłuższe teksty" : "tekst jak w Year 3–4"}
            </span>
          </h2>
          <UnitList
            module="reading"
            units={READING_TEXTS.filter((text) => text.level === level).map((text) => ({
              id: text.id,
              href: `/czytanie/${text.id}/`,
              emoji: text.emoji,
              title: text.titleEn,
              subtitle: text.titlePl,
              badge: GENRE_LABEL[text.genre],
            }))}
          />
        </section>
      ))}
      <ParentTip title="Jak czytać z dzieckiem (dla rodzica)">
        <p className="mb-2">
          Najpierw słuchanie: tekst czyta się sam, zdanie po zdaniu. Dziecko, które dopiero uczy się
          składać litery (Liga Dźwięków), rozumie ze słuchu dużo więcej, niż przeczyta samo — i to
          rozumienie ćwiczymy tutaj. Z czasem niech czyta coraz więcej na głos, a nagranie zostaje jako
          podpowiedź.
        </p>
        <p>
          Pytania są w formatach z angielskiej szkoły: „Tick one”, „Find and copy”, „True or false”,
          „Number the events”. Tekst jest cały czas pod ręką — zaglądanie do niego to umiejętność, której
          szkoła uczy, a nie ściąganie.
        </p>
      </ParentTip>
    </div>
  );
}
