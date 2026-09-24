/**
 * Szkic trwającej sesji — zabezpieczenie przed ubiciem aplikacji w tle.
 *
 * Na tablecie typowe wyjście z sesji to Home albo przełączenie aplikacji:
 * strona dostaje tylko visibilitychange→hidden, a potem system może ją po
 * cichu zamknąć — bez pagehide i bez sprzątania Reacta. Dlatego przebieg
 * sesji (useSessionFlow) zapisuje szkic SYNCHRONICZNIE przy każdej odpowiedzi
 * i przy zejściu strony z ekranu, a magazyn postępu (store.tsx) przy
 * następnym starcie aplikacji zatwierdza pozostawiony szkic jako zwykłą sesję.
 *
 * Szkic niesie stałe `id` sesji, a próby dostają przy zapisie id wyprowadzone
 * z niego i z pozycji. Zatwierdzenie jest więc idempotentne: szkic odzyskany
 * dwa razy albo sesja zapisana i potem odzyskana niczego nie dublują.
 *
 * Każda sesja ma WŁASNY klucz szkicu (`school.session-draft.v1.<id>`). Przy
 * jednym wspólnym kluczu szkic sesji z karty ubitej w tle ginął przy pierwszej
 * odpowiedzi nowej sesji w innej, dawno otwartej karcie — zanim ktokolwiek
 * zdążył go odzyskać. Magazyn odzyskuje wszystkie wolne szkice przy wczytaniu
 * i przy powrocie karty na ekran (store.tsx).
 *
 * Szkic ŻYWEJ sesji nie jest do odzyskania: postęp bywa otwarty w dwóch
 * kartach (rodzic w raporcie, dziecko ćwiczy), a odzysk w drugiej karcie
 * zatwierdziłby sesję, którą dziecko może jeszcze porzucić („Wyjdź bez
 * zapisu" obiecuje, że nie zostawi śladu). Dlatego trwająca sesja trzyma Web
 * Lock `school.session.<id>` (holdSessionLock), a odzysk czeka na wolną
 * blokadę (whenSessionIdle). Blokadę ubitej karty przeglądarka zwalnia sama.
 *
 * Przedrostek `school.` nie jest ozdobą — domenę dzielimy z Ligą Dźwięków
 * (lib/progress/types.ts).
 */

import type { PendingAttempt, SessionCommit } from "@/lib/progress/store";

/** Przedrostek kluczy szkiców; pełny klucz to przedrostek + id sesji. */
export const SESSION_DRAFT_PREFIX = "school.session-draft.v1.";

function draftKey(id: string): string {
  return `${SESSION_DRAFT_PREFIX}${id}`;
}

export type SessionDraft = Omit<SessionCommit, "id" | "endedTs"> & { id: string };

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Zapis szkicu. Sesja bez żadnej odpowiedzi nie zostawia śladu — także tutaj. */
export function writeDraft(draft: SessionDraft): void {
  if (draft.attempts.length === 0) return;
  try {
    window.localStorage.setItem(draftKey(draft.id), JSON.stringify(draft));
  } catch {
    // Brak miejsca / tryb prywatny — zostaje zapis na końcu sesji.
  }
}

/** Id sesji, które mają szkic (także cudzych kart — te czekają na odzysk). */
export function draftIds(): string[] {
  if (typeof window === "undefined") return [];
  const ids: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(SESSION_DRAFT_PREFIX)) ids.push(key.slice(SESSION_DRAFT_PREFIX.length));
    }
  } catch {
    // brak dostępu do localStorage — nie ma też szkiców
  }
  return ids;
}

export function readDraft(id: string): SessionDraft | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(draftKey(id));
    if (!raw) return null;
    const draft = JSON.parse(raw) as SessionDraft;
    const valid =
      typeof draft === "object" &&
      draft !== null &&
      draft.id === id &&
      typeof draft.module === "string" &&
      typeof draft.unitId === "string" &&
      typeof draft.kind === "string" &&
      typeof draft.mode === "string" &&
      typeof draft.device === "string" &&
      typeof draft.startedTs === "number" &&
      Array.isArray(draft.attempts) &&
      draft.attempts.every(
        (attempt: PendingAttempt) =>
          attempt && typeof attempt.ts === "number" && typeof attempt.exercise === "string",
      );
    if (valid) return draft;
  } catch {
    // uszkodzony zapis — niżej sprzątamy
  }
  if (raw !== null) clearDraft(id);
  return null;
}

/**
 * Kasuje szkic sesji o podanym `id` — tylko jej: „Wyjdź bez zapisu" w jednej
 * karcie nie może skasować szkicu sesji, która trwa (albo zginęła) w drugiej.
 */
export function clearDraft(id: string): void {
  try {
    window.localStorage.removeItem(draftKey(id));
  } catch {
    // brak dostępu do localStorage — nie było też szkicu
  }
}

function sessionLockName(id: string): string {
  return `school.session.${id}`;
}

function lockManager(): LockManager | null {
  return typeof navigator !== "undefined" && navigator.locks ? navigator.locks : null;
}

/**
 * Czy da się odróżnić sesję żywą od martwej. Bez Web Locks odzysk bywa tylko
 * przy wczytaniu strony — przy powrocie karty na ekran zatwierdzałby sesję,
 * która w tej samej karcie wciąż trwa.
 */
export function canTellIdle(): boolean {
  return lockManager() !== null;
}

/**
 * Blokada „ta sesja żyje" — trzymana, dopóki zwrócona funkcja jej nie zwolni.
 * Bez Web Locks (bardzo stara przeglądarka) nic nie robi.
 */
export function holdSessionLock(id: string): () => void {
  const locks = lockManager();
  if (!locks) return () => {};
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.request(sessionLockName(id), () => held).catch(() => {
    // blokada niedostępna (np. dokument w trakcie zamykania) — trudno
  });
  return release;
}

/**
 * Woła `recover`, tylko jeśli sesja o tym id nie trwa w żadnej karcie
 * (blokada wolna) — w trakcie `recover` blokada jest nasza. Bez Web Locks:
 * od razu, jak dawniej.
 */
export function whenSessionIdle(id: string, recover: () => void): void {
  const locks = lockManager();
  if (!locks) {
    recover();
    return;
  }
  locks
    .request(sessionLockName(id), { ifAvailable: true }, (lock) => {
      if (lock) recover();
    })
    .catch(() => {
      // bez blokady nie odzyskujemy — szkic poczeka na następne wczytanie
    });
}

/** Szkic jako zwykły zapis sesji: koniec = chwila ostatniej odpowiedzi. */
export function commitOfDraft(draft: SessionDraft): SessionCommit {
  const lastTs = draft.attempts.reduce((latest, attempt) => Math.max(latest, attempt.ts), draft.startedTs);
  return { ...draft, endedTs: lastTs };
}
