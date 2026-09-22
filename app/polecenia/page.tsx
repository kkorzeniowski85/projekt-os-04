"use client";

import { useState } from "react";
import { Card, PageHeader, ParentTip, Speaker } from "@/components/ui";
import { UnitList } from "@/components/UnitList";
import { playText } from "@/lib/audio";
import { CLASSROOM_UNITS, LESSON_TALK, TEACHER_SAYS } from "@/lib/curriculum/classroom";

const LIGA_URL = "https://kkorzeniowski85.github.io/projekt-os-02/slownictwo/";

export default function ClassroomHubPage() {
  const [openList, setOpenList] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Język klasy" subtitle="THUNDER · polecenia nauczyciela, lekcja, kartka" />
      <UnitList
        module="tasks"
        units={CLASSROOM_UNITS.map((unit) => ({
          id: unit.id,
          href: `/polecenia/${unit.id}/`,
          emoji: unit.emoji,
          title: unit.titlePl,
          subtitle: unit.goalPl,
        }))}
      />

      <Card>
        <button
          type="button"
          onClick={() => setOpenList((value) => !value)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={openList}
        >
          <span className="text-lg font-black">📋 Ściąga: wszystkie polecenia z nagraniem</span>
          <span className="text-sm text-paper/60">{openList ? "zwiń ▴" : "pokaż ▾"}</span>
        </button>
        {openList && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[...TEACHER_SAYS, ...LESSON_TALK].map((command) => (
              <div key={command.en} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2">
                <Speaker size="sm" onPlay={() => void playText(command.en)} ariaLabel={`Posłuchaj: ${command.en}`} />
                <span className="text-2xl" aria-hidden>
                  {command.emoji}
                </span>
                <span>
                  <span className="font-reading block font-bold">{command.en}</span>
                  <span className="text-xs text-hero-cyan">{command.pl}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ParentTip title="Dla rodzica">
        <p className="mb-2">
          Pierwsze tygodnie w angielskiej szkole to głównie słuchanie. Dziecko, które rozumie polecenia,
          czuje się bezpiecznie, nawet jeśli jeszcze nic nie mówi — ten „cichy okres” jest normalnym etapem
          nauki języka.
        </p>
        <p>
          Zwroty, które dziecko samo musi umieć POWIEDZIEĆ („Can I go to the toilet, please?”, „I don't
          understand”), ćwiczy Liga Dźwięków w temacie „Ratunek!”:{" "}
          <a href={LIGA_URL} className="underline">
            otwórz Ligę
          </a>
          .
        </p>
      </ParentTip>
    </div>
  );
}
