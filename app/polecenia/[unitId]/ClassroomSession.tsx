"use client";

import { SessionRunner } from "@/components/session/SessionRunner";
import { getClassroomUnit } from "@/lib/curriculum/classroom";

export function ClassroomSession({ unitId }: { unitId: string }) {
  const unit = getClassroomUnit(unitId)!;
  return (
    <SessionRunner
      module="tasks"
      unitId={unit.id}
      kind="lesson"
      title={unit.titlePl}
      emoji={unit.emoji}
      goalPl={unit.goalPl}
      parentIntroPl={unit.parentIntroPl}
      startNotePl="Z rodzicem dochodzą polecenia „w ruchu”: rodzic mówi, dziecko wykonuje."
      exitHref="/polecenia/"
      exitLabel="Język klasy"
      build={(mode) => unit.build(mode)}
    />
  );
}
