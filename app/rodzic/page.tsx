"use client";

/**
 * Panel rodzica Akademii: plan pod MTC, mapa faktów, próbne testy, stan
 * tematów, raport dla Claude, synchronizacja i ustawienia.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FactGrid } from "@/components/FactGrid";
import { ParentGate } from "@/components/ParentGate";
import { QrCode } from "@/components/QrCode";
import { BigButton, Card, STATUS_LABEL, STATUS_STYLE } from "@/components/ui";
import {
  auditClips,
  numberClipPath,
  factClipPath,
  textClipPath,
  getVoiceStatus,
  type ClipAudit,
  type VoiceStatus,
} from "@/lib/audio";
import { CLASSROOM_UNITS, classroomPhrases } from "@/lib/curriculum/classroom";
import { MATHS_TOPICS, mathsPhrases } from "@/lib/curriculum/maths";
import { numbersWithAudio } from "@/lib/curriculum/numbers";
import { READING_TEXTS, readingPhrases } from "@/lib/curriculum/reading";
import { parseFact, TABLES } from "@/lib/curriculum/tables";
import { MTC_WINDOW_START, roughlyUntil, SCHOOL_START, daysUntil } from "@/lib/mtcDates";
import { pl } from "@/lib/pl";
import {
  buildProgressExport,
  looksLikeLigaFile,
  parseProgressFile,
  previewImport,
  progressFileName,
} from "@/lib/progress/merge";
import {
  buildAttemptsCsv,
  buildMarkdownReport,
  buildSessionsCsv,
  downloadFile,
  trainingDaysCount,
} from "@/lib/progress/report";
import { useProgress } from "@/lib/progress/store";
import {
  adoptShortCode,
  createShortCode,
  disableSync,
  dismissCodeChange,
  enableSync,
  expireShortCode,
  getSyncStatus,
  KOD_WAZNOSC_MS,
  ligaCodeMismatch,
  normalizeShortCode,
  pairingLink,
  subscribeSync,
  switchToLigaCode,
  type SyncStatus,
} from "@/lib/progress/sync";
import { progressCutoff, unitKeyOf, type ModuleId } from "@/lib/progress/types";
import { countingPhrases } from "@/lib/tables/sessions";
import { focusTable, tablesSummary, weakestFacts } from "@/lib/tables/practice";

export default function ParentPage() {
  return (
    <ParentGate>
      <ParentPanel />
    </ParentGate>
  );
}

function ParentPanel() {
  const { state, ready } = useProgress();
  const summary = tablesSummary(state.facts);
  const focus = focusTable(state.facts);
  const weak = weakestFacts(state.facts, 10);
  const trainingDays = trainingDaysCount(state);

  return (
    <div className="flex flex-col gap-6 select-text">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Panel rodzica</h1>
          <p className="text-sm text-paper/60">{ready ? state.childName : "Wczytywanie…"} · Akademia Ligi</p>
        </div>
        <Link href="/" className="flex min-h-11 items-center rounded-full bg-white/10 px-5 text-sm">
          ← Baza
        </Link>
      </header>

      <Card>
        <h2 className="mb-2 text-lg font-bold">Plan: szkoła i Multiplication Tables Check</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Start w Anglii (Year 4)" value="wrzesień 2027" note={roughlyUntil(SCHOOL_START)} />
          <Stat label="Okno MTC" value="czerwiec 2028" note={pl(daysUntil(MTC_WINDOW_START), "dzień", "dni", "dni")} />
          <Stat label="Fakty płynnie" value={`${summary.fluent} / 66`} note={`${Math.round(summary.readiness * 100)}% gotowości`} />
        </div>
        <p className="mt-3 text-sm text-paper/75">
          Dni z treningiem w ostatnich 4 tygodniach: <strong>{trainingDays}/28</strong>. Cel: 5–6 dni w
          tygodniu po ok. 5 minut. {focus ? `Teraz w centrum uwagi: ×${focus}.` : "Wszystkie fakty są już w nauce — trening pilnuje powtórek."}
        </p>
        <p className="mt-2 text-xs text-paper/55">
          Jak czytać wynik: „płynnie” = dobrze i w 3,5 s przy kolejnych powtórkach w odstępach dni
          (awans jest tylko za powtórkę w terminie, więc wymaga co najmniej trzech dni nauki). W teście
          jest 6 s. Do czerwca 2028 jest dużo czasu — spokojne tempo (kilka nowych faktów
          tygodniowo) wystarczy z zapasem, pod warunkiem regularności.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Mapa tabliczki</h2>
        <FactGrid facts={state.facts} />
        {weak.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-paper/80">Najsłabsze fakty</p>
            <div className="flex flex-wrap gap-2">
              {weak.map((key) => {
                const [a, b] = parseFact(key);
                const fact = state.facts[key];
                return (
                  <span key={key} className="rounded-xl bg-white/10 px-3 py-1.5 text-sm tabular-nums">
                    <strong>
                      {a} × {b} = {a * b}
                    </strong>{" "}
                    <span className="text-paper/60">
                      {fact.right}/{fact.seen}
                      {fact.lastMs ? ` · ${(fact.lastMs / 1000).toFixed(1)} s` : ""}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <MockHistory />

      <Card>
        <h2 className="mb-3 text-lg font-bold">Tematy</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          <UnitStatusList
            title="Matematyka po angielsku"
            module="maths"
            units={MATHS_TOPICS.map((topic) => ({ id: topic.id, title: topic.titlePl }))}
          />
          <UnitStatusList
            title="Czytanie"
            module="reading"
            units={READING_TEXTS.map((text) => ({ id: text.id, title: `${text.titleEn} (${text.level})` }))}
          />
          <UnitStatusList
            title="Język klasy"
            module="tasks"
            units={CLASSROOM_UNITS.map((unit) => ({ id: unit.id, title: unit.titlePl }))}
          />
        </div>
        <UnitStatusList
          title="Liczymy co… (lekcje tabliczki)"
          module="tables"
          units={TABLES.map((table) => ({ id: `count-${table}`, title: `×${table}` }))}
          inline
        />
      </Card>

      <ReportCard />
      <SyncCard />
      <AudioCard />
      <SettingsCard />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <p className="text-xs text-paper/60">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs text-hero-cyan">{note}</p>
    </div>
  );
}

function MockHistory() {
  const { state } = useProgress();
  return (
    <Card>
      <h2 className="mb-2 text-lg font-bold">Próbne testy MTC</h2>
      {state.mocks.length === 0 ? (
        <p className="text-sm text-paper/70">
          Jeszcze nie było. Pierwszy warto zrobić po kilku tygodniach treningu — jako punkt odniesienia,
          nie egzamin.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex h-28 items-end gap-2">
            {state.mocks.slice(-12).map((mock) => (
              <div key={mock.id} className="flex flex-1 flex-col items-center gap-1" title={new Date(mock.ts).toLocaleDateString("pl-PL")}>
                <span className="text-xs font-bold tabular-nums">{mock.score}</span>
                <div
                  className={`w-full rounded-t-lg ${mock.score >= 21 ? "bg-hero-lime" : mock.score >= 15 ? "bg-hero-gold" : "bg-hero-pink"}`}
                  style={{ height: `${Math.max(6, (mock.score / 25) * 80)}px` }}
                />
              </div>
            ))}
          </div>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-paper/75">
            {state.mocks
              .slice(-5)
              .reverse()
              .map((mock) => (
                <li key={mock.id}>
                  {new Date(mock.ts).toLocaleDateString("pl-PL")}: <strong>{mock.score}/{mock.total}</strong>
                  {mock.missed.length > 0 && <span className="text-paper/55"> — bez punktu: {mock.missed.join(", ")}</span>}
                </li>
              ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-paper/55">
        Kontekst: w MTC nie ma progu zaliczenia. W roku 2024/25 średnia w Anglii wyniosła 21,0/25, a 37%
        dzieci miało 25/25. Źródło: Department for Education, „Multiplication tables check attainment”.
      </p>
    </Card>
  );
}

function UnitStatusList({
  title,
  module,
  units,
  inline = false,
}: {
  title: string;
  module: ModuleId;
  units: { id: string; title: string }[];
  inline?: boolean;
}) {
  const { state } = useProgress();
  return (
    <div className={inline ? "mt-5" : ""}>
      <p className="mb-2 text-sm font-bold text-paper/80">{title}</p>
      <ul className={inline ? "flex flex-wrap gap-2" : "flex flex-col gap-1.5"}>
        {units.map((unit) => {
          const progress = state.units[unitKeyOf(module, unit.id)];
          const status = progress?.status ?? "new";
          return (
            <li key={unit.id} className="flex items-center gap-2 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>
                {inline ? unit.title : STATUS_LABEL[status]}
              </span>
              {!inline && <span className="flex-1">{unit.title}</span>}
              {!inline && progress?.lastAccuracy != null && (
                <span className="text-xs text-paper/55">{Math.round(progress.lastAccuracy * 100)}%</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReportCard() {
  const { state } = useProgress();
  const report = useMemo(() => buildMarkdownReport(state), [state]);
  const [copied, setCopied] = useState(false);
  const date = new Date().toISOString().slice(0, 10);
  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold">Raport dla Claude</h2>
      <p className="mb-3 text-sm text-paper/70">
        Raz na 2–4 tygodnie skopiuj raport i wklej go w rozmowie z Claude — dostaniesz analizę postępu i
        propozycje, co zmienić. Pełne dane (CSV) przydają się przy głębszej analizie.
      </p>
      <div className="mb-3 flex flex-wrap gap-3">
        <BigButton
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(report);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              downloadFile(`akademia-raport-${date}.md`, report, "text/markdown");
            }
          }}
        >
          {copied ? "Skopiowano ✓" : "Kopiuj raport"}
        </BigButton>
        <BigButton tone="quiet" onClick={() => downloadFile(`akademia-raport-${date}.md`, report, "text/markdown")}>
          Pobierz .md
        </BigButton>
        <BigButton tone="quiet" onClick={() => downloadFile(`akademia-proby-${date}.csv`, buildAttemptsCsv(state), "text/csv")}>
          CSV: próby
        </BigButton>
        <BigButton tone="quiet" onClick={() => downloadFile(`akademia-sesje-${date}.csv`, buildSessionsCsv(state), "text/csv")}>
          CSV: sesje
        </BigButton>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/30 p-4 text-xs">{report}</pre>
    </Card>
  );
}

function SyncCard() {
  const { importProgress, requestSync, state } = useProgress();
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Krótki kod razem z kodem rodziny, dla którego powstał, i chwilą utworzenia:
  // przekazka działa godzinę i tylko raz, a kod rodziny potrafi zmienić się w
  // tle (za Ligą) — stary krótki kod prowadziłby wtedy do starej skrzynki.
  const [shortCode, setShortCode] = useState<{ short: string; forCode: string; ts: number } | null>(null);
  const [making, setMaking] = useState(false);
  const [typed, setTyped] = useState("");
  const [joining, setJoining] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeSync(setSync), []);

  // Po godzinie kod znika z ekranu i ze skrzynki. Godzinę liczy to urządzenie,
  // bo zegar urządzenia, które kod wpisuje, bywa przesunięty (sync.ts).
  useEffect(() => {
    if (!shortCode) return;
    const timer = setTimeout(() => {
      setShortCode(null);
      void expireShortCode(shortCode.short);
    }, Math.max(0, shortCode.ts + KOD_WAZNOSC_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [shortCode]);
  const shownShort = shortCode && shortCode.forCode === sync?.code ? shortCode.short : null;

  /** Chowa pokazany krótki kod i czyści jego szufladę (nowy kod, wyłączenie). */
  function dropShortCode() {
    if (shortCode) void expireShortCode(shortCode.short);
    setShortCode(null);
  }

  // Kod rodziny zmienił się w tle (za Ligą, w innej karcie): krótki kod do
  // starej skrzynki podłączyłby komputer do obiegu, którego już nikt nie używa.
  useEffect(() => {
    if (!shortCode || !sync || shortCode.forCode === sync.code) return;
    setShortCode(null);
    void expireShortCode(shortCode.short);
  }, [shortCode, sync]);

  async function onImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);

    // Plik z Dysku Google na tablecie bywa niedostępny przy słabym łączu —
    // bez try/catch przycisk „nic nie robił" (ta sama poprawka jest w Lidze).
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage(
        `Nie udało się otworzyć pliku „${file.name}”. Jeśli wybierasz go z Dysku Google, sprawdź połączenie z internetem i spróbuj ponownie.`,
      );
      return;
    }
    if (looksLikeLigaFile(text)) {
      setMessage(
        `„${file.name}” to kopia Ligi Dźwięków — wczytaj ją w Lidze (Panel rodzica → Wczytaj kopię). Kopie Akademii nazywają się akademia-ligi-postep-….json.`,
      );
      return;
    }
    const parsed = parseProgressFile(text);
    if (!parsed) {
      setMessage(
        `Plik „${file.name}” nie wygląda na kopię postępu Akademii. Szukaj pliku o nazwie akademia-ligi-postep-….json.`,
      );
      return;
    }
    // Najpierw sprawdzamy, co zrobi scalenie — granica „Wyczyść postęp" potrafi
    // po cichu pominąć sesje z pliku albo usunąć sesje z tego urządzenia.
    const preview = previewImport(state, parsed);
    const resetDate = new Date(preview.mergedCutoff).toLocaleDateString("pl-PL");
    let restore = false;
    // Nowszy reset z pliku rozchodzi się synchronizacją jak „Wyczyść postęp" —
    // więc przy włączonej synchronizacji pytamy nawet, gdy tu nic nie zniknie.
    const newerReset = preview.mergedCutoff > progressCutoff(state);
    if (preview.removed > 0 || (newerReset && sync?.enabled)) {
      const here =
        preview.removed > 0
          ? ` Wczytanie usunie z tego urządzenia ${pl(preview.removed, "sesję", "sesje", "sesji")} sprzed tej daty.`
          : "";
      const everywhere = sync?.enabled
        ? " Synchronizacja jest włączona, więc sesje sprzed tej daty znikną też na pozostałych urządzeniach podłączonych kodem rodziny."
        : "";
      const ok = window.confirm(`Ta kopia zawiera wyczyszczenie postępu z ${resetDate}.${here}${everywhere} Kontynuować?`);
      if (!ok) {
        setMessage("Kopia nie została wczytana — postęp na tym urządzeniu bez zmian.");
        return;
      }
    } else if (preview.olderSessions > 0) {
      restore = window.confirm(
        `Ta kopia ma ${pl(preview.olderSessions, "sesję", "sesje", "sesji")} sprzed wyczyszczenia postępu (${resetDate}). Przywrócić je?\n\nOK — przywróć (przy włączonej synchronizacji także na pozostałych urządzeniach).\nAnuluj — wczytaj tylko nowsze.`,
      );
    }

    const { added, removed } = importProgress(parsed, { restore });
    const skipped = restore ? 0 : preview.olderSessions;
    const parts: string[] = [];
    if (added > 0) {
      parts.push(
        restore
          ? `Przywrócono: ${pl(added, "sesja", "sesje", "sesji")} (także sprzed wyczyszczenia postępu).`
          : `Scalono: ${pl(added, "nowa sesja", "nowe sesje", "nowych sesji")}.`,
      );
    }
    if (removed > 0) {
      parts.push(
        `Usunięto z tego urządzenia ${pl(removed, "sesję", "sesje", "sesji")} sprzed wyczyszczenia postępu (${resetDate}).`,
      );
    }
    if (added === 0 && removed === 0) {
      parts.push(skipped > 0 ? "Nic nowego nie doszło." : "Nic nowego — wszystkie sesje z pliku już tu były.");
    }
    if (skipped > 0) {
      parts.push(`Pominięto ${pl(skipped, "sesję", "sesje", "sesji")} sprzed wyczyszczenia postępu (${resetDate}).`);
    }
    setMessage(parts.join(" "));
  }

  async function makeShortCode() {
    const forCode = getSyncStatus().code;
    if (!forCode) return;
    dropShortCode();
    setMaking(true);
    const short = await createShortCode();
    setMaking(false);
    setShortCode(short ? { short, forCode, ts: Date.now() } : null);
    if (!short) setMessage("Nie udało się przygotować kodu — sprawdź połączenie i spróbuj ponownie.");
  }

  const mismatch = sync?.enabled ? ligaCodeMismatch() : false;

  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold">Synchronizacja między urządzeniami</h2>
      {sync?.enabled ? (
        <>
          <p className="mb-3 text-sm text-paper/80">
            <strong className="text-hero-lime">Działa automatycznie.</strong> Postęp sam się wysyła i
            pobiera — przy otwarciu, po każdej sesji i co 3 minuty.
            {sync.lastOkTs && <> Ostatnio: {new Date(sync.lastOkTs).toLocaleTimeString("pl-PL")}.</>}
          </p>
          {sync.fromLiga && (
            <p className="mb-3 rounded-2xl bg-hero-cyan/10 p-3 text-sm text-paper/85">
              🔗 Kod rodziny przejęty z Ligi Dźwięków na tym urządzeniu — Akademia synchronizuje się bez
              osobnego parowania i idzie za Ligą, gdy tam zmienisz obieg.
            </p>
          )}
          {sync.keptOnJoin && (
            <p className="mb-3 rounded-2xl bg-black/25 p-3 text-sm text-paper/85">
              To urządzenie miało {pl(sync.keptOnJoin.sessions, "sesję", "sesje", "sesji")} sprzed wyczyszczenia
              postępu w tej rodzinie ({new Date(sync.keptOnJoin.resetTs).toLocaleDateString("pl-PL")}).{" "}
              {sync.keptOnJoin.sessions === 1 ? "Została zachowana i trafi" : "Zostały zachowane i trafią"} też na
              pozostałe urządzenia. Jeśli postęp ma zacząć się od zera, użyj „Wyczyść postęp” w ustawieniach.
            </p>
          )}
          {sync.codeChangedTs && (
            <div className="mb-3 rounded-2xl bg-hero-gold/15 p-3 text-sm text-paper/85">
              <p className="mb-2">
                ⚠️ Kod rodziny Akademii zmienił się na tym urządzeniu (
                {new Date(sync.codeChangedTs).toLocaleDateString("pl-PL")}, za Ligą Dźwięków). Urządzenia
                podłączone wcześniej kodem z Akademii (QR albo krótki kod, np. komputer) zostały na starym kodzie
                i trzeba je podłączyć ponownie: pokaż krótki kod i wpisz go tam w polu „Podłącz to urządzenie
                kodem”. Każdy krótki kod działa raz — dla kolejnego urządzenia pokaż nowy.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {shownShort ? (
                  <>
                    <span className="rounded-xl bg-white/10 px-4 py-2 font-mono text-2xl font-black tracking-[0.35em] text-hero-gold">
                      {shownShort}
                    </span>
                    <BigButton tone="quiet" onClick={() => void makeShortCode()}>
                      {making ? "Przygotowuję…" : "Nowy kod"}
                    </BigButton>
                  </>
                ) : (
                  <BigButton tone="quiet" onClick={() => void makeShortCode()}>
                    {making ? "Przygotowuję…" : "Pokaż krótki kod"}
                  </BigButton>
                )}
                <BigButton tone="quiet" onClick={() => dismissCodeChange()}>
                  Podłączone — ukryj
                </BigButton>
              </div>
            </div>
          )}
          {mismatch && (
            <div className="mb-3 rounded-2xl bg-hero-gold/15 p-3 text-sm text-paper/85">
              <p className="mb-2">
                ⚠️ Liga Dźwięków na tym urządzeniu używa innego kodu rodziny niż Akademia — urządzenia mogą
                być w dwóch osobnych obiegach. Najprościej przejść na kod Ligi (postęp z tego urządzenia
                zostaje i trafi do wspólnej skrzynki). Urządzenia podłączone wcześniej kodem z Akademii (QR
                albo krótki kod, np. komputer) trzeba potem podłączyć ponownie — krótkim kodem, który pokaże
                się tutaj.
              </p>
              <BigButton
                tone="quiet"
                onClick={() => {
                  switchToLigaCode();
                  dropShortCode();
                  requestSync();
                  setMessage("Akademia używa teraz kodu rodziny z Ligi.");
                }}
              >
                Użyj kodu z Ligi
              </BigButton>
            </div>
          )}
          {sync.lastError && (
            <p className="mb-3 rounded-2xl bg-hero-pink/15 p-3 text-sm text-paper/85">
              {sync.lastError === "brak-sieci" &&
                "Nie udało się połączyć z usługą synchronizacji — aplikacja spróbuje sama za chwilę. Jeśli to się powtarza, sprawdź blokery reklam/antywirus (adres textdb.dev)."}
              {sync.lastError === "usluga-odmowila" && "Usługa synchronizacji odmówiła — zwykle przejściowo. Postęp na urządzeniach jest bezpieczny."}
              {sync.lastError === "za-duzo-danych" && "Postęp przerósł pojemność skrzynki. Zapisz kopię do pliku i daj znać."}
              {sync.lastError === "nowsza-wersja" &&
                "Na innym urządzeniu działa nowsza wersja Akademii. Ta wersja nie nadpisze jej danych — pobierz najnowszą wersję (Ustawienia niżej), a synchronizacja ruszy sama."}
              {sync.lastErrorDetail && <span className="mt-1 block text-xs text-paper/50">Szczegół: {sync.lastErrorDetail}</span>}
            </p>
          )}
          <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="mb-3 text-sm font-bold text-paper/80">Podłącz kolejne urządzenie</p>
            <div className="flex flex-wrap items-start gap-6">
              <div className="w-[190px] shrink-0 text-center">
                <QrCode value={pairingLink() ?? ""} size={190} />
                <p className="mt-2 text-xs text-paper/60">Ma aparat? Zeskanuj — aplikacja otworzy się już podłączona.</p>
              </div>
              <div className="min-w-[240px] flex-1">
                <p className="mb-2 text-xs text-paper/60">
                  Bez aparatu (np. komputer)? Pokaż krótki kod i wpisz go tam w polu niżej.
                </p>
                {shownShort ? (
                  <p className="rounded-xl bg-white/10 px-4 py-3 text-center font-mono text-3xl font-black tracking-[0.35em] text-hero-gold">
                    {shownShort}
                  </p>
                ) : (
                  <BigButton tone="quiet" onClick={() => void makeShortCode()}>
                    {making ? "Przygotowuję…" : "Pokaż krótki kod"}
                  </BigButton>
                )}
                {shownShort && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-xs text-paper/50">
                      Kod działa przez godzinę i tylko raz — dla kolejnego urządzenia weź nowy.
                    </p>
                    <BigButton tone="quiet" onClick={() => void makeShortCode()}>
                      {making ? "Przygotowuję…" : "Nowy kod"}
                    </BigButton>
                  </div>
                )}
              </div>
            </div>
          </div>
          <BigButton
            tone="quiet"
            onClick={() => {
              disableSync();
              dropShortCode();
              setMessage("Synchronizacja wyłączona na tym urządzeniu. Postęp lokalny zostaje.");
            }}
          >
            Wyłącz
          </BigButton>
        </>
      ) : sync?.optedOut ? (
        <p className="mb-3 text-sm text-paper/80">
          Wyłączona ręcznie na tym urządzeniu — Akademia nie włączy się sama, także gdy Liga jest sparowana.
          Włącz przyciskiem niżej albo wpisz kod.
        </p>
      ) : (
        <p className="mb-3 text-sm text-paper/80">
          Włącz na jednym urządzeniu, podłącz pozostałe kodem — postęp sam pojawi się wszędzie. Jeśli Liga
          Dźwięków jest na tym urządzeniu sparowana, Akademia podłączy się sama przy następnym otwarciu.
        </p>
      )}

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="mb-1 text-sm font-bold text-paper/80">Podłącz to urządzenie kodem</p>
        <p className="mb-3 text-xs text-paper/50">Sześcioznakowy kod z drugiego urządzenia — z Akademii albo z Ligi Dźwięków.</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={typed}
            onChange={(event) => setTyped(normalizeShortCode(event.target.value))}
            placeholder="np. K7M2QP"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-12 w-44 rounded-xl bg-black/40 px-4 text-center font-mono text-xl tracking-[0.25em] text-paper placeholder:text-paper/25"
          />
          <BigButton
            onClick={async () => {
              setJoining(true);
              const result = await adoptShortCode(typed);
              setJoining(false);
              if (result === "ok") {
                setTyped("");
                dropShortCode();
                requestSync();
                setMessage("Podłączone. Za chwilę pojawi się tu postęp z pozostałych urządzeń.");
              } else if (result === "expired") {
                setMessage("Ten kod wygasł (działa przez godzinę). Pokaż nowy krótki kod na drugim urządzeniu.");
              } else {
                setMessage(
                  "Ten kod nie zadziałał. Sprawdź, czy jest przepisany dokładnie. Każdy krótki kod działa tylko raz — jeśli był już użyty, pokaż nowy na drugim urządzeniu.",
                );
              }
            }}
          >
            {joining ? "Łączę…" : "Podłącz"}
          </BigButton>
        </div>
      </div>

      {!sync?.enabled && (
        <div className="mt-3">
          <BigButton
            onClick={() => {
              enableSync();
              requestSync();
              setMessage("Synchronizacja włączona. Podłącz pozostałe urządzenia kodem QR albo krótkim kodem.");
            }}
          >
            Włącz automatyczną synchronizację
          </BigButton>
          <p className="mt-2 text-xs text-paper/50">
            Jeśli Liga Dźwięków jest na tym urządzeniu sparowana, Akademia użyje jej kodu rodziny. Inaczej
            powstaje nowy, osobny obieg — gdy obieg już gdzieś działa, użyj raczej pola z kodem powyżej.
          </p>
        </div>
      )}

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="mb-2 text-sm font-bold text-paper/70">Kopia zapasowa</p>
        <div className="flex flex-wrap gap-3">
          <BigButton
            tone="quiet"
            onClick={() => downloadFile(progressFileName(), buildProgressExport(state), "application/json")}
          >
            Zapisz kopię
          </BigButton>
          <BigButton tone="quiet" onClick={() => fileRef.current?.click()}>
            Wczytaj kopię
          </BigButton>
          <input ref={fileRef} type="file" onChange={(event) => void onImportFile(event)} className="hidden" />
        </div>
      </div>
      {message && <p className="mt-3 rounded-2xl bg-black/25 p-3 text-sm text-paper/85">{message}</p>}
    </Card>
  );
}

/** Wszystkie ścieżki nagrań, których aplikacja może potrzebować. */
function allClipPaths(): string[] {
  const paths = new Set<string>();
  numbersWithAudio().forEach((n) => paths.add(numberClipPath(n)));
  for (const a of TABLES) for (const b of TABLES) paths.add(factClipPath(a, b));
  [...mathsPhrases(), ...readingPhrases(), ...classroomPhrases(), ...countingPhrases()].forEach((text) =>
    paths.add(textClipPath(text)),
  );
  return [...paths];
}

function AudioCard() {
  const [result, setResult] = useState<ClipAudit | null>(null);
  const [running, setRunning] = useState(false);
  const [voice, setVoice] = useState<VoiceStatus | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVoice(getVoiceStatus()), 500);
    return () => clearTimeout(timer);
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setResult(await auditClips(allClipPaths()));
    setRunning(false);
  }, []);

  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold">Nagrania</h2>
      <p className="mb-3 text-sm text-paper/70">
        Wszystko, co aplikacja mówi, to nagrania brytyjskiego głosu (en-GB). Gdyby któregoś brakowało,
        awaryjnie mówi syntezator przeglądarki
        {voice ? ` (${voice.voiceName ?? "brak głosu"}${voice.isBritish ? ", brytyjski" : ", nie brytyjski"})` : ""}.
      </p>
      <BigButton tone="quiet" onClick={() => void run()}>
        {running ? "Sprawdzam…" : "Sprawdź nagrania"}
      </BigButton>
      {result && (
        <p className="mt-3 text-sm">
          Na miejscu: <strong>{result.found.length}</strong>. Brakuje: <strong>{result.missing.length}</strong>
          {result.missing.length > 0 && (
            <span className="mt-1 block max-h-32 overflow-auto text-xs text-paper/55">{result.missing.slice(0, 40).join(", ")}</span>
          )}
          {result.unknown.length > 0 && (
            <span className="mt-1 block text-paper/70">
              Nie da się sprawdzić: <strong>{result.unknown.length}</strong> — brak połączenia z serwerem. To nie znaczy,
              że ich brakuje; sprawdź ponownie z internetem.
            </span>
          )}
        </p>
      )}
    </Card>
  );
}

function SettingsCard() {
  const { state, setChildName, resetAll } = useProgress();
  const [sync, setSync] = useState<SyncStatus | null>(null);
  useEffect(() => subscribeSync(setSync), []);
  return (
    <Card>
      <h2 className="mb-3 text-lg font-bold">Ustawienia</h2>
      <label className="flex flex-col gap-2 text-sm">
        Imię lub pseudonim dziecka (przy włączonej synchronizacji przechodzi przez zewnętrzną usługę
        textdb.dev — pseudonim wystarczy)
        <input
          value={state.childName}
          onChange={(event) => setChildName(event.target.value)}
          className="max-w-xs rounded-xl bg-white/10 px-4 py-3 text-lg"
        />
      </label>
      <div className="mt-6">
        <BigButton
          tone="no"
          onClick={() => {
            if (
              !window.confirm(
                "Skasować cały postęp Akademii? Tego nie da się cofnąć — chyba że masz kopię zapasową w pliku („Zapisz kopię” wyżej).",
              )
            )
              return;
            const fluent = tablesSummary(state.facts).fluent;
            const everywhere = sync?.enabled
              ? " Synchronizacja jest włączona, więc postęp zniknie też na pozostałych urządzeniach podłączonych kodem rodziny."
              : "";
            if (
              window.confirm(
                `Na pewno? Znikną: ${pl(state.sessions.length, "sesja", "sesje", "sesji")}, ${pl(state.mocks.length, "próbny test", "próbne testy", "próbnych testów")} i stan ${pl(fluent, "płynnego faktu", "płynnych faktów", "płynnych faktów")}.${everywhere} Postęp Ligi Dźwięków zostaje nietknięty.`,
              )
            ) {
              resetAll();
            }
          }}
        >
          Wyczyść postęp
        </BigButton>
      </div>
      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="mb-2 text-sm font-bold text-paper/70">Wersja aplikacji</p>
        <p className="mb-3 text-xs text-paper/50">
          Ta wersja: <code>{(process.env.NEXT_PUBLIC_BUILD_ID ?? "lokalna").slice(0, 7)}</code>. Jeśli na
          jednym urządzeniu brakuje czegoś, co widać na innym — ten przycisk pobierze najnowszą wersję.
          Postępu nie dotyka.
        </p>
        <BigButton
          tone="quiet"
          onClick={async () => {
            // Tylko WŁASNY service worker i WŁASNA pamięć podręczna: Liga Dźwięków i
            // inne aplikacje stoją na tej samej domenie i mają tu swoje rzeczy.
            try {
              const scope = new URL(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`, window.location.origin).href;
              const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
              await Promise.all(
                registrations.filter((registration) => registration.scope === scope).map((registration) => registration.unregister()),
              );
              const keys = await caches.keys();
              await Promise.all(keys.filter((key) => key.startsWith("akademia-ligi-")).map((key) => caches.delete(key)));
            } catch {
              // Przeładowanie i tak pomoże.
            }
            window.location.reload();
          }}
        >
          Pobierz najnowszą wersję
        </BigButton>
      </div>
    </Card>
  );
}
