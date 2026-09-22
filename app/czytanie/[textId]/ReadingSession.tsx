"use client";

import { SessionRunner } from "@/components/session/SessionRunner";
import { buildReadingSession, getReadingText } from "@/lib/curriculum/reading";

export function ReadingSession({ textId }: { textId: string }) {
  const text = getReadingText(textId)!;
  return (
    <SessionRunner
      module="reading"
      unitId={text.id}
      kind="lesson"
      title={text.titleEn}
      emoji={text.emoji}
      goalPl={text.titlePl}
      parentIntroPl={text.parentPl}
      startNotePl="Najpierw tekst przeczyta się sam. Każde zdanie i pytanie można odsłuchać."
      exitHref="/czytanie/"
      exitLabel="Inne teksty"
      build={() => buildReadingSession(text)}
    />
  );
}
