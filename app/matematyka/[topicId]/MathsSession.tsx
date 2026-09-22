"use client";

import { SessionRunner } from "@/components/session/SessionRunner";
import { getMathsTopic } from "@/lib/curriculum/maths";

/** Temat szukany po id po stronie klienta — funkcji `build` nie da się przekazać z serwera. */
export function MathsSession({ topicId }: { topicId: string }) {
  const topic = getMathsTopic(topicId)!;
  return (
    <SessionRunner
      module="maths"
      unitId={topic.id}
      kind="lesson"
      title={topic.titlePl}
      emoji={topic.emoji}
      goalPl={topic.goalPl}
      parentIntroPl={topic.parentIntroPl}
      startNotePl="Każde zdanie da się odsłuchać — czytanie po angielsku nie jest tu warunkiem."
      exitHref="/matematyka/"
      exitLabel="Inne tematy"
      build={() => topic.build()}
    />
  );
}
