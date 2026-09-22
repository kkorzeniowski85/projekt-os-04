"use client";

import { SessionRunner } from "@/components/session/SessionRunner";
import { TABLE_TIPS } from "@/lib/curriculum/tables";
import { buildCountingSession, TABLE_PLURAL } from "@/lib/tables/sessions";

export function CountingSession({ table }: { table: number }) {
  return (
    <SessionRunner
      module="tables"
      unitId={`count-${table}`}
      kind="count"
      title={`Liczymy co ${table}`}
      emoji="🔢"
      goalPl={`Count in ${TABLE_PLURAL[table]} — liczenie skokami, „lots of” i fakty z ×${table}.`}
      parentIntroPl={`Sposób na tę tabliczkę: ${TABLE_TIPS[table]} Na pierwszym ekranie liczcie razem na głos — najpierw z liczbami, potem z zakrytymi.`}
      exitHref="/tabliczka/"
      exitLabel="Tabliczka"
      build={() => buildCountingSession(table)}
    />
  );
}
