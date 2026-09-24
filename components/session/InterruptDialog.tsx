"use client";

/**
 * Pytanie przy przerwaniu ćwiczenia w połowie. Wspólne dla wszystkich działów.
 *
 * Sesja zapisuje się normalnie na końcu, jednym kompletem — bez tego okna
 * przerwanie po ośmiu z dziesięciu zadań kasowało całą pracę bez słowa.
 * Trzy wyjścia zamiast dwóch, bo „← Przerwij" bywa kliknięte przypadkowo przez
 * dziecko: powrót do ćwiczenia musi być równie łatwy jak wyjście (i dostaje
 * fokus, więc Enter wraca do ćwiczenia).
 */

import { useEffect, useRef } from "react";
import { BigButton, Card } from "@/components/ui";
import { RULES } from "@/lib/progress/rules";

export function InterruptDialog({
  zrobione,
  wszystkich,
  ocenianych,
  zapisane,
  bonus = false,
  zapisanaCzesc = false,
  onZapisz,
  onPorzuc,
  onWroc,
  exitHref = "/",
}: {
  zrobione: number;
  wszystkich: number;
  ocenianych: number;
  /** Sesja zapisana i od zapisu nic nie przybyło — wyjście niczego nie traci. */
  zapisane: boolean;
  /** Trwa runda bonusowa (bez punktów). */
  bonus?: boolean;
  /** Część odpowiedzi już zapisana (strona była zamknięta i wróciła). */
  zapisanaCzesc?: boolean;
  onZapisz: () => void;
  onPorzuc: () => void;
  onWroc: () => void;
  /** Dokąd wyjść — zwykle do strony działu, nie do bazy. */
  exitHref?: string;
}) {
  const wrocRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    wrocRef.current?.querySelector("button")?.focus();
  }, []);

  const nicNieZrobione = ocenianych === 0 && !zapisane;
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
        {zapisane ? (
          <p className="mb-5 text-paper/80">
            {bonus
              ? "Sesja jest już zapisana razem z wynikiem — runda bonusowa niczego nie punktuje, więc wyjście teraz nic nie traci."
              : "Wszystkie odpowiedzi są już zapisane — wyjście teraz nic nie traci."}
          </p>
        ) : nicNieZrobione ? (
          <p className="mb-5 text-paper/80">Nie ma jeszcze żadnej odpowiedzi — nie ma czego zapisywać.</p>
        ) : (
          <>
            <p className="mb-1 text-paper/80">
              Zrobione: <strong>{zrobione}</strong> z {wszystkich} zadań.
            </p>
            <p className="mb-5 text-sm text-paper/60">
              {zaMaloDoOceny
                ? "Zapis zachowa tę pracę i pokaże ją w raporcie, ale to za mało zadań, żeby zmienić ocenę — na to trzeba ich więcej."
                : "Zapis zachowa tę pracę razem z wynikiem — dostanie normalną ocenę za tę sesję."}
            </p>
          </>
        )}

        <div className="flex flex-col gap-3">
          {zapisane || nicNieZrobione ? (
            <BigButton href={exitHref} onClick={onPorzuc} full>
              Wyjdź
            </BigButton>
          ) : (
            <>
              <BigButton href={exitHref} onClick={onZapisz} full>
                Zapisz i wyjdź
              </BigButton>
              <BigButton href={exitHref} onClick={onPorzuc} tone="quiet" full>
                Wyjdź bez zapisu
              </BigButton>
            </>
          )}
          <div ref={wrocRef} className="flex flex-col">
            <BigButton onClick={onWroc} tone="quiet" full>
              Wróć do ćwiczenia
            </BigButton>
          </div>
        </div>

        {!zapisane && !nicNieZrobione && (
          <p className="mt-4 text-xs text-paper/50">
            {zapisanaCzesc
              ? "Część odpowiedzi jest już zapisana (aplikacja była na chwilę zamknięta) — „Wyjdź bez zapisu” pominie tylko te nowsze."
              : "„Wyjdź bez zapisu” nie zostawia śladu — to samo ćwiczenie można zacząć od nowa, od pierwszego zadania."}
          </p>
        )}
      </Card>
    </div>
  );
}
