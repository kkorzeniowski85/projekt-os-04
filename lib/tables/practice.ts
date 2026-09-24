/**
 * Silnik nauki tabliczki: pudełka Leitnera i dobór faktów do treningu.
 *
 * Dlaczego pudełka, a nie „przerób całą tabliczkę": badania nad praktyką
 * rozłożoną w czasie i aktywnym przypominaniem (spacing + retrieval practice)
 * pokazują przewagę krótkich, powracających powtórek nad jednorazowym
 * wkuwaniem. Fakt, który dziecko zna, wraca coraz rzadziej; fakt, który
 * sprawia kłopot, wraca od razu.
 *
 * Progi czasu wynikają z MTC: w teście jest 6 sekund na przeczytanie,
 * przypomnienie I wpisanie. Odpowiedź w ≤ 3,5 s zostawia zapas na
 * zdenerwowanie i palec, który trafi obok klawisza.
 */

import {
  ALL_FACTS,
  factKey,
  factsIntroducedBy,
  factsOfTable,
  introducedWith,
  LEARNING_ORDER,
  parseFact,
  type FactKey,
  type Question,
} from "@/lib/curriculum/tables";
import { emptyFactState, type FactState, type SessionKind } from "@/lib/progress/types";

export const FACT_RULES = {
  /** Odpowiedź do tej granicy liczy się jako szybka (⚡). Limit testu: MTC.answerMs. */
  fastMs: 3500,
  maxBox: 5,
  /** Odstęp powtórki dla pudełka 0–5, w dniach. */
  intervalsDays: [0, 0, 1, 3, 7, 21],
  /** Od tego pudełka fakt liczy się jako „płynnie". */
  fluentBox: 4,
  /** Nowych faktów w zwykłym treningu — więcej rozmywa naukę. */
  newPerSession: 4,
  /** Górna granica nowych faktów, gdy trening dopełnia się na starcie nauki. */
  maxNewPerSession: 8,
} as const;

const DAY = 24 * 60 * 60 * 1000;

/** Tryb „jedna tabliczka": najmniej różnych faktów w sesji (patrz buildPracticeSet). */
const TABLE_MODE_MIN_FACTS = 6;

export type FactOutcome = { correct: boolean; ms: number; ts: number };

/**
 * Tolerancja terminu: trening następnego dnia o wcześniejszej godzinie też
 * jest „w terminie" (termin = godzina odpowiedzi + N × 24 h).
 */
const DUE_SLACK_MS = DAY / 2;

/**
 * Czy fakt czeka na powtórkę: nowy albo termin minął.
 *
 * Termin z tolerancją, ale najwcześniej od północy dnia terminu: trening
 * następnego dnia o 7:00 po wieczornym o 19:00 się liczy, a rano i wieczorem
 * tego samego dnia już nie — inaczej „po dniu" dało się zaliczyć tego samego
 * dnia i fakt był „płynny" po dwóch dniach nauki. Pudełko 1 (odstęp 0) dalej
 * jest zawsze w terminie.
 *
 * Północ UTC, nie lokalna: scalanie odtwarza stan faktów z prób z różnych
 * urządzeń (merge.ts) i wynik musi być ten sam niezależnie od strefy czasowej
 * urządzenia. W Anglii i w Polsce północ UTC wypada między 0:00 a 2:00 w nocy,
 * kiedy nikt nie ćwiczy, więc dzień UTC = dzień nauki dziecka.
 */
export function isFactDue(state: FactState | undefined, now: number): boolean {
  if (!state || state.box === 0) return true;
  const dueDayStart = Math.floor(state.dueTs / DAY) * DAY;
  return Math.max(state.dueTs - DUE_SLACK_MS, dueDayStart) <= now;
}

/**
 * Nowy stan faktu po jednej odpowiedzi.
 *
 *  - trening: awans TYLKO za powtórkę w terminie. Poprawnie i szybko → pudełko
 *    wyżej (nowy, od razu znany fakt skacze na 2 — to wiedza przyniesiona z
 *    polskiej szkoły); poprawnie, ale wolno → bez awansu. Trafienie przed
 *    terminem (druga tura tej samej sesji, fakty „dla pewności siebie") to
 *    ćwiczenie, nie dowód trwałej pamięci — nie rusza pudełka ani terminu.
 *    Bez tej zasady fakt był „płynny" po jednym pięciominutowym treningu;
 *  - błąd → pudełko 1 zawsze (pomyłka jest informacją niezależnie od terminu);
 *  - fakt płynny odpowiedziany poprawnie, ale wolno, przestaje być płynny
 *    (w MTC liczenie na palcach to 0 punktów) — także w próbnym teście;
 *  - próbny test MTC tylko obniża. Jedno trafienie w teście niczego nie
 *    „zalicza" i nie przesuwa terminu powtórki — także przy obniżeniu:
 *    zaległy fakt, który w teście wyszedł wolno, idzie na najbliższy trening;
 *  - test nie wprowadza faktów, których trening jeszcze nie zaczął (pudełko 0):
 *    błąd zostaje w seen/right (raport i panel go pokazują), a fakt wejdzie
 *    razem ze swoją tabliczką, po lekcji „Liczymy co N". Bez tego test na
 *    starcie wrzucał do pudełka 1 kilkanaście faktów ×6–×12 naraz, które
 *    zapychały trening i zamykały bramkę nowych faktów.
 */
export function nextFactState(
  previous: FactState | undefined,
  outcome: FactOutcome,
  kind: SessionKind,
): FactState {
  const base = previous ?? emptyFactState();
  const due = isFactDue(previous, outcome.ts);
  const fast = outcome.ms <= FACT_RULES.fastMs;
  let box = base.box;
  let dueTs = base.dueTs;

  if (kind === "mock" && box === 0) {
    // Nieprzerobiony fakt: tylko licznik prób (niżej).
  } else if (!outcome.correct) {
    box = 1;
    dueTs = outcome.ts + FACT_RULES.intervalsDays[1] * DAY;
  } else if (!fast && box >= FACT_RULES.fluentBox) {
    box = FACT_RULES.fluentBox - 1;
    dueTs = outcome.ts + FACT_RULES.intervalsDays[box] * DAY;
    if (kind === "mock") dueTs = Math.min(base.dueTs, dueTs);
  } else if (kind !== "mock" && due) {
    box = fast ? Math.min(FACT_RULES.maxBox, Math.max(box, 1) + 1) : Math.max(box, 1);
    dueTs = outcome.ts + FACT_RULES.intervalsDays[box] * DAY;
  }

  return {
    box,
    dueTs,
    lastTs: outcome.ts,
    seen: base.seen + 1,
    right: base.right + (outcome.correct ? 1 : 0),
    lastMs: outcome.ms,
    bestMs:
      outcome.correct && (base.bestMs === null || outcome.ms < base.bestMs)
        ? outcome.ms
        : base.bestMs,
  };
}

export type FactLevel = "unseen" | "weak" | "learning" | "fluent";

export function factLevel(state: FactState | undefined): FactLevel {
  if (!state || state.box === 0) return "unseen";
  if (state.box >= FACT_RULES.fluentBox) return "fluent";
  if (state.box >= 2) return "learning";
  return "weak";
}

/** Fakty jeszcze nie wprowadzone, w kolejności, w jakiej wprowadzi je trening. */
export function freshFacts(facts: Record<FactKey, FactState>, table?: number | null): FactKey[] {
  const source = table ? factsOfTable(table) : LEARNING_ORDER.flatMap((t) => factsIntroducedBy(t));
  return source.filter((key) => (facts[key]?.box ?? 0) === 0);
}

/**
 * Tabliczka, na której teraz leży nacisk: ta, z której trening wprowadzi
 * najbliższy nowy fakt (te same reguły co w buildPracticeSet — hub, misja i
 * raport mówią o tej samej tabliczce, którą dziecko naprawdę ćwiczy). Gdy
 * wszystkie fakty już weszły — null (trening pracuje na powtórkach).
 */
export function focusTable(facts: Record<FactKey, FactState>): number | null {
  const next = freshFacts(facts)[0];
  return next ? introducedWith(next) : null;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Losowa kolejność czynników — dziecko ma znać 7 × 8 i 8 × 7. */
function orient(key: FactKey, random: () => number): Question {
  const [a, b] = parseFact(key);
  return random() < 0.5 ? [a, b] : [b, a];
}

/**
 * Pytania na jeden trening. Skład:
 *  1. słabe i zaległe fakty (pudełko 1+, termin minął) — najniższe pudełka
 *     pierwsze, bo to one najbardziej potrzebują powtórki;
 *  2. do `newPerSession` nowych faktów TYLKO z tabliczki w centrum uwagi
 *     (focusTable). Trening nie przeskakuje na następną tabliczkę w połowie
 *     sesji: następna wchodzi od kolejnego treningu — tego samego dnia dopiero
 *     po swojej lekcji „Liczymy co N" (`holdNew`), następnego dnia misja
 *     stawia tę lekcję jako krok 1 (najpierw zrozumieć);
 *  3. kilka płynnych faktów „dla pewności siebie" — dziecko, które trafia
 *     tylko na trudne, szybko się zniechęca (i przy okazji przypomina sobie
 *     starsze fakty, zanim wypadną z pamięci).
 * Gdy wszystkiego jest za mało (dziecko dopiero zaczyna), dopełniamy
 * kolejnymi nowymi faktami, żeby trening nie kończył się po trzech pytaniach.
 *
 * `table` = tryb „ćwicz jedną tabliczkę" wybrany przez rodzica: wtedy pula to
 * pełna tabliczka „razy t", niezależnie od kolejności nauki.
 *
 * `holdNew` („Plan dnia") = bez nowych faktów: następna tabliczka czeka na
 * swoją lekcję (heldNewTable w mission.ts), trening robi same powtórki.
 */
export function buildPracticeSet(
  facts: Record<FactKey, FactState>,
  options: { size: number; now: number; table?: number | null; holdNew?: boolean; random?: () => number },
): Question[] {
  const random = options.random ?? Math.random;
  const { size, now } = options;
  const pool = options.table ? factsOfTable(options.table) : ALL_FACTS;

  const allStarted = ALL_FACTS.filter((key) => (facts[key]?.box ?? 0) >= 1);
  const started = options.table ? pool.filter((key) => (facts[key]?.box ?? 0) >= 1) : allStarted;
  // Zaległe = termin powtórki minął, łącznie z płynnymi: bez tego fakt płynny
  // nigdy nie wracałby na zaplanowaną powtórkę i wypadałby z pamięci po cichu.
  // Kolejność: najpierw pudełko 1 (to, co się sypie), potem najbardziej
  // spóźnione względem własnego odstępu — inaczej świeże fakty z pudełka 2
  // w nieskończoność spychałyby zaległe z pudełka 3.
  const overdue = (key: FactKey) =>
    (now - facts[key].dueTs) / (Math.max(1, FACT_RULES.intervalsDays[facts[key].box]) * DAY);
  const due = started
    .filter((key) => isFactDue(facts[key], now))
    .sort((a, b) => Number(facts[b].box === 1) - Number(facts[a].box === 1) || overdue(b) - overdue(a));

  // Nowe fakty: w „Planie dnia" tylko z tabliczki w centrum uwagi (kolejne
  // tabliczki po kolei, każda po swojej lekcji), w trybie jednej tabliczki —
  // z tabliczki wybranej przez rodzica.
  const focus = focusTable(facts);
  const fresh = options.table
    ? freshFacts(facts, options.table)
    : freshFacts(facts).filter((key) => introducedWith(key) === focus);

  // BRAMKA POJEMNOŚCI: nowe fakty tylko wtedy, gdy nie piętrzą się słabe.
  // Bez niej trening dokładał nowe codziennie i po dziesięciu dniach dziecko
  // miało kilkadziesiąt faktów „w powietrzu" naraz (wyszło w symulacji).
  // Liczona zawsze z CAŁEGO stanu: w trybie jednej tabliczki zaczętych faktów
  // tej tabliczki jest zwykle kilka, więc bramka liczona w jej obrębie zawsze
  // widziała „start nauki" i dokładała 8 nowych naraz.
  const weak = allStarted.filter((key) => facts[key].box === 1).length;
  const allDue = options.table ? allStarted.filter((key) => isFactDue(facts[key], now)).length : due.length;
  let newQuota: number =
    allStarted.length < FACT_RULES.maxNewPerSession
      ? FACT_RULES.maxNewPerSession // start nauki: jest z czego zbudować trening
      : weak >= 8
        ? 0 // najpierw utrwalić to, co się sypie
        : weak >= 4
          ? 2
          : FACT_RULES.newPerSession;
  // Zaległe powtórki to też obciążenie: gdy jest ich tyle, ile mieści sesja
  // (na telefonie tylko 12 pytań), nowe fakty czekają.
  if (allStarted.length >= FACT_RULES.maxNewPerSession) {
    if (allDue >= size) newQuota = 0;
    else if (allDue >= size / 2) newQuota = Math.min(newQuota, 2);
  }
  // Tryb jednej tabliczki: co najmniej 6 różnych faktów (z drugą turą ≥ 12
  // pytań). Sama bramka dawała tu sesje z 0–4 pytań, gdy tabliczka jest
  // prawie nieruszona, a w całym stanie piętrzą się słabe.
  if (options.table) newQuota = Math.max(newQuota, TABLE_MODE_MIN_FACTS - started.length);
  else if (options.holdNew) newQuota = 0;

  const notDueFluent = shuffle(
    started.filter((key) => facts[key].box >= FACT_RULES.fluentBox && facts[key].dueTs > now),
    random,
  );

  const chosen: FactKey[] = [];
  const add = (keys: FactKey[], limit: number) => {
    for (const key of keys) {
      if (chosen.length >= size || limit <= 0) break;
      if (chosen.includes(key)) continue;
      chosen.push(key);
      limit -= 1;
    }
  };

  const confidence = Math.max(1, Math.round(size * 0.2));
  add(due, size - Math.min(newQuota, fresh.length) - Math.min(confidence, notDueFluent.length));
  add(fresh, newQuota);
  add(notDueFluent, confidence);
  // Dopełnienie: fakty w drodze (jeszcze nie płynne), potem płynne.
  add(
    started
      .filter((key) => facts[key].box < FACT_RULES.fluentBox)
      .sort((a, b) => facts[a].box - facts[b].box),
    size,
  );
  add(notDueFluent, size);

  // Jeśli dalej brakuje do pełnej długości (początek nauki), fakty wracają w
  // DRUGIEJ turze — najpierw nowe i najsłabsze. Drugie przypomnienie w tej
  // samej sesji to praktyka przypominania (pudełka nie awansuje — patrz
  // nextFactState). Każdy fakt najwyżej dwa razy; gdy materiału brak, trening
  // jest po prostu krótszy.
  const firstPass = shuffle(chosen, random);
  const byNeed = [...chosen].sort((a, b) => (facts[a]?.box ?? 0) - (facts[b]?.box ?? 0));
  const repeats = shuffle(byNeed.slice(0, Math.max(0, size - firstPass.length)), random);
  // Styk tur: pierwsza powtórka nie może być ostatnim pytaniem pierwszej tury
  // (powtórka tuż po pierwszym podejściu nie uczy niczego).
  const last = firstPass[firstPass.length - 1];
  if (repeats.length > 0 && repeats[0] === last) {
    if (repeats.length > 1) {
      const j = 1 + Math.floor(random() * (repeats.length - 1));
      [repeats[0], repeats[j]] = [repeats[j], repeats[0]];
    } else if (firstPass.length > 1) {
      [firstPass[0], firstPass[firstPass.length - 1]] = [firstPass[firstPass.length - 1], firstPass[0]];
    }
  }

  return [...firstPass, ...repeats].map((key) => orient(key, random));
}

export type TablesSummary = {
  fluent: number;
  learning: number;
  weak: number;
  unseen: number;
  total: number;
  /** Udział płynnych faktów, 0–1. */
  readiness: number;
  perTable: Record<number, { fluent: number; total: number }>;
};

export function tablesSummary(facts: Record<FactKey, FactState>): TablesSummary {
  const counts = { fluent: 0, learning: 0, weak: 0, unseen: 0 };
  for (const key of ALL_FACTS) counts[factLevel(facts[key])] += 1;

  const perTable: TablesSummary["perTable"] = {};
  for (const table of LEARNING_ORDER) {
    const keys = factsOfTable(table);
    perTable[table] = {
      fluent: keys.filter((key) => factLevel(facts[key]) === "fluent").length,
      total: keys.length,
    };
  }

  return {
    ...counts,
    total: ALL_FACTS.length,
    readiness: counts.fluent / ALL_FACTS.length,
    perTable,
  };
}

/**
 * Najsłabsze fakty — do raportu i panelu rodzica. Pomija fakty z pudełka 0
 * bez błędów: to te, które dziecko trafiło w próbnym teście, zanim trening do
 * nich doszedł (test nie awansuje pudełek) — nie są słabe, tylko jeszcze
 * nieprzerobione. Fakt z pudełka 0 z błędem w teście zostaje na liście (test
 * go nie wprowadza, ale rodzic ma wiedzieć, że jeszcze go nie ma) — za słabymi
 * z treningu, żeby ich nie wypierał.
 */
export function weakestFacts(facts: Record<FactKey, FactState>, limit = 8): FactKey[] {
  return ALL_FACTS.filter((key) => {
    const fact = facts[key];
    if (!fact || fact.seen === 0 || fact.box >= FACT_RULES.fluentBox) return false;
    return fact.box >= 1 || fact.right < fact.seen;
  })
    .sort((a, b) => {
      const fa = facts[a];
      const fb = facts[b];
      const accA = fa.right / fa.seen;
      const accB = fb.right / fb.seen;
      // Niewprowadzone (pudełko 0, błąd tylko z próbnego testu) na koniec:
      // trening ich jeszcze nie ćwiczy, pierwsze miejsca mają słabe z treningu.
      return (
        Number(fa.box === 0) - Number(fb.box === 0) ||
        fa.box - fb.box ||
        accA - accB ||
        (fb.lastMs ?? 0) - (fa.lastMs ?? 0)
      );
    })
    .slice(0, limit);
}

export { factKey };
