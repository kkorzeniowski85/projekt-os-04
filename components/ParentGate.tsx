"use client";

/**
 * Bramka strefy rodzica: przycisk trzeba PRZYTRZYMAĆ przez 3 sekundy.
 *
 * Chroni przed przypadkowym wejściem dziecka (i przypadkowym "Wyczyść
 * postęp"), nie przed zdeterminowanym — to bariera na niechcący, jak nakrętka
 * z zabezpieczeniem. Odblokowanie pamiętane do zamknięcia przeglądarki
 * (sessionStorage), żeby rodzic nie trzymał przycisku przy każdym wejściu.
 *
 * Obejmuje też wejście z adresu URL — bramka siedzi w stronie /rodzic,
 * nie w linku do niej.
 */

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

const HOLD_MS = 3000;
const STORAGE_KEY = "school.parent-gate.v1";

export function ParentGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      setState(sessionStorage.getItem(STORAGE_KEY) === "open" ? "open" : "locked");
    } catch {
      // Brak sessionStorage (bardzo stare przeglądarki) — bramka bez pamięci.
      setState("locked");
    }
    return () => stopHold();
  }, []);

  function stopHold() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setProgress(0);
  }

  function startHold() {
    if (timerRef.current) return;
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const ratio = (Date.now() - startedAt) / HOLD_MS;
      if (ratio >= 1) {
        stopHold();
        try {
          sessionStorage.setItem(STORAGE_KEY, "open");
        } catch {
          // jw.
        }
        setState("open");
        return;
      }
      setProgress(ratio);
    }, 50);
  }

  if (state === "open") return <>{children}</>;
  if (state === "checking") return null;

  const secondsLeft = Math.ceil((1 - progress) * (HOLD_MS / 1000));

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-3xl font-black">Strefa rodzica</h1>
      <p className="max-w-sm text-paper/70">
        Ta część jest dla dorosłych. Przytrzymaj przycisk, aż koło się wypełni.
      </p>

      <div
        className="rounded-full p-2.5"
        style={{
          background: `conic-gradient(#ffc93c ${progress * 360}deg, rgba(255,255,255,0.12) 0deg)`,
        }}
      >
        <button
          type="button"
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(event) => event.preventDefault()}
          className="no-select flex h-40 w-40 touch-none flex-col items-center justify-center rounded-full bg-night-soft text-paper"
        >
          <span aria-hidden className="text-3xl">
            👨‍👩‍👦
          </span>
          <span className="mt-1 px-3 text-sm font-bold">
            {progress > 0 ? `Trzymaj… ${secondsLeft}` : "Przytrzymaj 3 sekundy"}
          </span>
        </button>
      </div>

      <Link href="/" className="text-sm text-paper/60 underline">
        ← Wróć do aplikacji
      </Link>
    </div>
  );
}
