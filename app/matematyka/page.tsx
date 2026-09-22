"use client";

import { PageHeader, ParentTip } from "@/components/ui";
import { UnitList } from "@/components/UnitList";
import { MATHS_TOPICS } from "@/lib/curriculum/maths";

export default function MathsHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Matematyka po angielsku" subtitle="SPARK · liczby, słowa działań, zegar, zapis" />
      <UnitList
        module="maths"
        units={MATHS_TOPICS.map((topic) => ({
          id: topic.id,
          href: `/matematyka/${topic.id}/`,
          emoji: topic.emoji,
          title: topic.titlePl,
          subtitle: topic.goalPl,
        }))}
      />
      <ParentTip title="Po co ten dział (dla rodzica)">
        <p>
          Matematyki dziecko nie uczy się tu od zera — uczy się języka, w którym angielska lekcja ją podaje.
          Dziecko, które świetnie liczy po polsku, na lekcji w Anglii gubi się na „the difference between”,
          „share equally” albo „half past three”. Najważniejsze tematy na start: „Słowa działań” i „Thirteen
          czy thirty?”.
        </p>
      </ParentTip>
    </div>
  );
}
