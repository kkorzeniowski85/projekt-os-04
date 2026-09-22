"use client";

/**
 * Pytanie przy przerwaniu ćwiczenia w połowie. Wspólne dla wszystkich działów.
 *
 * Sesja zapisuje się normalnie dopiero na końcu, jednym kompletem — bez tego
 * okna przerwanie po ośmiu z dziesięciu zadań kasowało całą pracę bez słowa.
 * Trzy wyjścia zamiast dwóch, bo „← Przerwij" bywa kliknięte przypadkowo przez
 * dziecko: powrót do ćwiczenia musi być równie łatwy jak wyjście.
 */

import { BigButton, Card } from "@/components/ui";
import { RULES } from "@/lib/progress/rules";

export function InterruptDialog({
  zrobione,
  wszystkich,
  ocenianych,
  onZapisz,
  onWroc,
  exitHref = "/",
}: {
  zrobione: number;
  wszystkich: number;
  ocenianych: number;
  onZapisz: () => void;
  onWroc: () => void;
  /** Dokąd wyjść — zwykle do strony działu, nie do bazy. */
  exitHref?: string;
}) {
  const zaMaloDoOceny = ocenianych < RULES.minScoredForStatus;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Przerwać ćwiczenie?"
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/85 p-4 backdrop-blur-sm"
    >
      <Card className="max-w-lg">
        <h2 className="mb-2 text-2xl font-black">Przerwać ćwiczenie?</h2>
        <p className="mb-1 text-paper/80">
          Zrobione: <strong>{zrobione}</strong> z {wszystkich} zadań.
        </p>
        <p className="mb-5 text-sm text-paper/60">
          {zaMaloDoOceny
            ? "Zapis zachowa tę pracę i pokaże ją w raporcie, ale to za mało zadań, żeby zmienić ocenę — na to trzeba ich więcej."
            : "Zapis zachowa tę pracę razem z wynikiem — dostanie normalną ocenę za tę sesję."}
        </p>

        <div className="flex flex-col gap-3">
          <BigButton href={exitHref} onClick={onZapisz} full>
            Zapisz i wyjdź
          </BigButton>
          <BigButton href={exitHref} tone="quiet" full>
            Wyjdź bez zapisu
          </BigButton>
          <BigButton onClick={onWroc} tone="quiet" full>
            Wróć do ćwiczenia
          </BigButton>
        </div>

        <p className="mt-4 text-xs text-paper/50">
          „Wyjdź bez zapisu” nie zostawia śladu — to samo ćwiczenie można zacząć od nowa,
          od pierwszego zadania.
        </p>
      </Card>
    </div>
  );
}
