/**
 * Eksport statystyk do okresowej analizy w rozmowie z Claude (jak w Lidze).
 *
 *  - Markdown: zwięzłe podsumowanie do wklejenia na czat — gotowość do MTC,
 *    najsłabsze fakty, wyniki próbnych testów, stan tematów;
 *  - CSV: pełny dziennik prób i sesji, gdyby trzeba było policzyć coś więcej.
 */

import { parseFact } from "@/lib/curriculum/tables";
import { MATHS_TOPICS } from "@/lib/curriculum/maths";
import { READING_TEXTS, SKILL_LABEL, type ReadingSkill } from "@/lib/curriculum/reading";
import { CLASSROOM_UNITS } from "@/lib/curriculum/classroom";
import { MTC_WINDOW_START, daysUntil } from "@/lib/mtcDates";
import { pl } from "@/lib/pl";
import { FACT_RULES, focusTable, tablesSummary, weakestFacts } from "@/lib/tables/practice";
import { accuracyOf, RULES } from "./rules";
import { unitKeyOf, type ModuleId, type ProgressState } from "./types";

const STATUS_LABEL: Record<string, string> = {
  new: "nowy",
  learning: "w trakcie",
  mastered: "opanowany",
  "needs-help": "trudny",
};

const MODULE_LABEL: Record<ModuleId, string> = {
  tables: "tabliczka",
  maths: "matematyka po angielsku",
  reading: "czytanie ze zrozumieniem",
  tasks: "język klasy",
};

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Liczba różnych dni (czas lokalny) z treningiem tabliczki w ostatnich `days`
 * dniach kalendarzowych, łącznie z dzisiejszym. Wspólna dla raportu i panelu —
 * okno „teraz minus 28 × 24 h" obejmowało 29 dat i dawało „29/28".
 */
export function trainingDaysCount(state: ProgressState, now = Date.now(), days = 28): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const since = start.getTime();
  return new Set(
    state.sessions
      .filter(
        (session) =>
          session.module === "tables" && session.kind === "practice" && session.endedTs >= since && session.endedTs <= now,
      )
      .map((session) => new Date(session.endedTs).toDateString()),
  ).size;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

export function buildMarkdownReport(state: ProgressState, now = Date.now()): string {
  const days = 28;
  const since = now - days * 24 * 60 * 60 * 1000;
  const recent = state.sessions.filter((session) => session.endedTs >= since);
  const lines: string[] = [];

  lines.push(`# Akademia Ligi — raport: ${state.childName}`);
  lines.push("");
  lines.push(
    `Okres: ostatnie ${days} dni (do ${formatDate(now)}). Do okna MTC (czerwiec 2028): ${pl(daysUntil(MTC_WINDOW_START, now), "dzień", "dni", "dni")}.`,
  );
  lines.push(
    `Sesje w okresie: ${recent.length} (łącznie ${state.sessions.length}). Dni z treningiem tabliczki: ${trainingDaysCount(state, now, days)}/${days}.`,
  );
  const minutes = recent.map((session) => Math.max(0, session.endedTs - session.startedTs) / 60000);
  const soloCount = recent.filter((session) => session.mode === "solo").length;
  if (recent.length > 0) {
    lines.push(
      `Czas nauki w okresie: ~${Math.round(minutes.reduce((sum, m) => sum + m, 0))} min (mediana sesji: ${(median(minutes.map((m) => Math.round(m * 10))) ?? 0) / 10} min). Tryb: ${soloCount} samodzielnie / ${recent.length - soloCount} z rodzicem.`,
    );
  }
  for (const module of Object.keys(MODULE_LABEL) as ModuleId[]) {
    const inModule = recent.filter((session) => session.module === module);
    const solo = inModule.filter((session) => session.mode === "solo").length;
    lines.push(
      `- ${MODULE_LABEL[module]}: ${pl(inModule.length, "sesja", "sesje", "sesji")}${inModule.length ? ` (samodzielnie ${solo} / z rodzicem ${inModule.length - solo})` : ""}`,
    );
  }

  // --- Tabliczka
  const summary = tablesSummary(state.facts);
  const focus = focusTable(state.facts);
  lines.push("");
  lines.push("## Tabliczka (przygotowanie do MTC)");
  lines.push(
    `Płynnie (pudełko 4+: szybkie trafienia w powtórkach w terminie, co najmniej 3 dni nauki): ${summary.fluent}/66 · w drodze: ${summary.learning} · do powtórki: ${summary.weak} · niećwiczone: ${summary.unseen}.`,
  );
  lines.push(
    `Tabliczka w centrum uwagi: ${focus ? `×${focus}` : "żadna — wszystkie 66 faktów już wprowadzone, trening pracuje na powtórkach"}.`,
  );
  lines.push(
    `Płynne wg tabliczki: ${Object.entries(summary.perTable)
      .map(([table, value]) => `×${table} ${value.fluent}/${value.total}`)
      .join(", ")}.`,
  );
  const weak = weakestFacts(state.facts, 10);
  if (weak.length > 0) {
    lines.push(
      `Najsłabsze fakty: ${weak
        .map((key) => {
          const [a, b] = parseFact(key);
          const fact = state.facts[key];
          return `${a}×${b} (pudełko ${fact.box}, ${fact.right}/${fact.seen}, ost. ${fact.lastMs ? (fact.lastMs / 1000).toFixed(1) + " s" : "—"})`;
        })
        .join("; ")}.`,
    );
  }
  const factAttempts = state.attempts.filter((attempt) => attempt.exercise === "fact" && attempt.ts >= since);
  const correctMs = factAttempts.filter((attempt) => attempt.correct).map((attempt) => attempt.responseMs);
  lines.push(
    `Trening w okresie: ${pl(factAttempts.length, "odpowiedź", "odpowiedzi", "odpowiedzi")}, trafność ${percent(
      factAttempts.length ? factAttempts.filter((attempt) => attempt.correct).length / factAttempts.length : null,
    )}, mediana czasu poprawnej: ${median(correctMs) !== null ? (median(correctMs)! / 1000).toFixed(1) + " s" : "—"}.`,
  );
  // Pomyłki „o jedną grupę" (7 × 8 = 48) vs brak odpowiedzi — różne diagnozy.
  const wrong = factAttempts.filter((attempt) => attempt.correct === false && attempt.answer);
  const offByGroup = wrong.filter((attempt) => {
    const [a, b] = attempt.item.split("x").map(Number);
    const answer = Number(attempt.answer);
    return answer === a * b - a || answer === a * b + a || answer === a * b - b || answer === a * b + b;
  }).length;
  if (wrong.length > 0) lines.push(`Błędne odpowiedzi: ${wrong.length}, z czego „o jedną grupę obok”: ${offByGroup}.`);

  lines.push("");
  lines.push("### Próbne testy MTC (25 pytań, 6 s)");
  if (state.mocks.length === 0) {
    lines.push("Jeszcze nie było. (Średnia krajowa 2024/25: 21,0/25; 37% dzieci ma komplet.)");
  } else {
    for (const mock of state.mocks.slice(-6)) {
      lines.push(
        `- ${formatDate(mock.ts)}: ${mock.score}/${mock.total}${mock.mode === "parent" ? " (z rodzicem obok)" : ""}${mock.missed.length ? ` — bez punktu: ${mock.missed.join(", ")}` : ""}`,
      );
    }
    lines.push("(Średnia krajowa 2024/25: 21,0/25; 37% dzieci ma komplet.)");
  }

  // --- Tematy
  const unitLines = (module: ModuleId, units: { id: string; title: string }[]) => {
    for (const unit of units) {
      const state_ = state.units[unitKeyOf(module, unit.id)];
      if (!state_) continue;
      lines.push(
        `- ${unit.title}: ${STATUS_LABEL[state_.status]}, sesji ${state_.sessions}, ostatnio ${percent(state_.lastAccuracy)} (${formatDate(state_.lastSeenTs)})`,
      );
    }
  };

  lines.push("");
  lines.push("## Matematyka po angielsku");
  unitLines("maths", MATHS_TOPICS.map((topic) => ({ id: topic.id, title: topic.titlePl })));
  const opsMissed = state.attempts
    .filter((attempt) => (attempt.exercise === "operation" || attempt.exercise === "word-problem") && attempt.correct === false)
    .map((attempt) => attempt.item);
  if (opsMissed.length > 0) {
    const counts = new Map<string, number>();
    opsMissed.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
    lines.push(
      `Słowa/zadania z błędami: ${[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([item, count]) => `${item} (${count})`)
        .join(", ")}.`,
    );
  }

  lines.push("");
  lines.push("## Czytanie ze zrozumieniem");
  unitLines("reading", READING_TEXTS.map((text) => ({ id: text.id, title: `${text.titleEn} (poz. ${text.level})` })));
  const readingAttempts = state.attempts.filter((attempt) => attempt.module === "reading" && attempt.correct !== null);
  if (readingAttempts.length > 0) {
    const bySkill = (Object.keys(SKILL_LABEL) as ReadingSkill[]).map((skill) => {
      const items = readingAttempts.filter((attempt) => attempt.exercise === `reading-${skill}`);
      return `${SKILL_LABEL[skill]} ${percent(items.length ? items.filter((a) => a.correct).length / items.length : null)} (${items.length})`;
    });
    lines.push(`Trafność wg umiejętności: ${bySkill.join(", ")}.`);
  }

  lines.push("");
  lines.push("## Język klasy");
  unitLines("tasks", CLASSROOM_UNITS.map((unit) => ({ id: unit.id, title: unit.titlePl })));
  const actAttempts = state.attempts.filter((attempt) => attempt.exercise.endsWith("-act"));
  if (actAttempts.length > 0) {
    lines.push(
      `Polecenia „w ruchu” (ocena rodzica): ${actAttempts.filter((attempt) => attempt.correct).length}/${actAttempts.length} wykonane.`,
    );
  }

  lines.push("");
  lines.push("## Kontekst dla analizy");
  lines.push(
    `Progi tematów (matematyka, czytanki, język klasy, lekcje „Liczymy co N”): opanowany = co najmniej ${Math.round(RULES.masteryAccuracy * 100)}% ` +
      `w ${RULES.masterySessions} sesjach pod rząd; trudny = poniżej ${Math.round(RULES.strugglingAccuracy * 100)}% w ${RULES.strugglingSessions} sesjach pod rząd; ` +
      `status zmienia tylko sesja z co najmniej ${RULES.minScoredForStatus} ocenianymi zadaniami.`,
  );
  lines.push(
    `Tabliczka: pudełka 0–${FACT_RULES.maxBox}, odstępy powtórek ${FACT_RULES.intervalsDays.join("/")} dni; szybka odpowiedź = do ${String(FACT_RULES.fastMs / 1000).replace(".", ",")} s; ` +
      `płynnie = pudełko ${FACT_RULES.fluentBox}+. Awans tylko za szybkie trafienie w terminie. ` +
      "Nowy fakt odpowiedziany szybko od razu trafia do pudełka 2; pomyłka cofa do pudełka 1, a stamtąd awans do 2 możliwy już w tej samej sesji. " +
      "Od pudełka 2 kolejny awans najwcześniej następnego dnia, potem po 3 dniach itd. Nowe fakty tabliczka po tabliczce. Próbny test tylko obniża pudełka i nie wprowadza faktów, których trening jeszcze nie zaczął.",
  );
  lines.push(
    "Polecenia „w ruchu” (ocenia je rodzic) i wskazówki rodzica są tylko w trybie wspólnym — wyników samodzielnych i z rodzicem nie da się porównać 1:1.",
  );

  lines.push("");
  lines.push("## Pytania do analizy");
  lines.push("- Czy tempo nauki tabliczki wystarczy do czerwca 2028? Które tabliczki blokują postęp?");
  lines.push("- Które słowa działań i typy pytań czytelniczych sprawiają kłopot — i co ćwiczyć poza aplikacją?");
  return lines.join("\n");
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildAttemptsCsv(state: ProgressState): string {
  const header = ["timestamp", "data", "module", "unit", "exercise", "item", "answer", "correct", "response_ms", "mode"].join(",");
  const rows = state.attempts.map((attempt) =>
    [
      attempt.ts,
      new Date(attempt.ts).toISOString(),
      attempt.module,
      attempt.unitId,
      attempt.exercise,
      attempt.item,
      attempt.answer ?? "",
      attempt.correct === null ? "" : attempt.correct ? "1" : "0",
      attempt.responseMs,
      attempt.mode,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header, ...rows].join("\n");
}

export function buildSessionsCsv(state: ProgressState): string {
  const header = ["session_id", "data", "module", "unit", "kind", "mode", "device", "correct", "scored", "accuracy", "duration_s"].join(",");
  const rows = state.sessions.map((session) =>
    [
      session.id,
      new Date(session.endedTs).toISOString(),
      session.module,
      session.unitId,
      session.kind,
      session.mode,
      session.device,
      session.correct,
      session.scored,
      accuracyOf(session)?.toFixed(2) ?? "",
      Math.round((session.endedTs - session.startedTs) / 1000),
    ]
      .map(csvCell)
      .join(","),
  );
  return [header, ...rows].join("\n");
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
