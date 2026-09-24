"use client";

/**
 * Klawiatura numeryczna jak w Multiplication Tables Check: cyfry, „Delete" i
 * „Enter". Podpisy celowo po angielsku — dokładnie te dwa słowa dziecko
 * zobaczy na ekranie prawdziwego testu, więc niech będą oswojone.
 *
 * Działa też z fizycznej klawiatury (cyfry, Backspace, Enter) — na komputerze
 * i przy klawiaturze podpiętej do tabletu, jak w szkole.
 */

import { useEffect, useRef } from "react";

/**
 * Skąd przyszedł bieżący fokus: z myszy/palca czy z klawiatury (Tab albo
 * program po klawiszu). Enter na przycisku lub linku z fokusem z klawiatury
 * („← Przerwij", „↩") należy do tego elementu — dziecko go widzi obrysowany.
 * Po stuknięciu 🔊 przycisk też ma fokus, ale wtedy Enter dalej zatwierdza
 * liczbę. :focus-visible tego nie rozróżni: Chrome włącza go po każdym
 * klawiszu także na przycisku klikniętym myszą (sprawdzone), więc liczymy sami.
 * Nasłuch jeden na dokument, od załadowania modułu — fokus bywa ustawiony,
 * zanim klawiatura liczb się pojawi.
 */
let pointerActive = false;
let pointerFocused: EventTarget | null = null;
if (typeof window !== "undefined") {
  const opts = { capture: true, passive: true } as const;
  window.addEventListener("pointerdown", () => (pointerActive = true), opts);
  window.addEventListener("mousedown", () => (pointerActive = true), opts);
  window.addEventListener("keydown", () => (pointerActive = false), opts);
  window.addEventListener("focusin", (event) => (pointerFocused = pointerActive ? event.target : null), opts);
}

/** Enter ma aktywować przycisk/link, na który fokus przyszedł z klawiatury. */
function keyboardFocusedControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target === pointerFocused) return false;
  return target.closest("button, a[href], [role='button']") !== null;
}

export function NumberPad({
  value,
  onChange,
  onEnter,
  disabled = false,
  maxLength = 4,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Dostaje wartość z chwili naciśnięcia — stan rodzica mógł się jeszcze nie odświeżyć. */
  onEnter: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
}) {
  // Bieżąca wartość w refie: dziecko potrafi wpisać „56" szybciej, niż React
  // zdąży przerysować ekran, a wtedy obie cyfry widziałyby tę samą starą
  // wartość i pierwsza by przepadła (wyszło w teście).
  const valueRef = useRef(value);
  valueRef.current = value;
  const handlers = useRef({ onChange, onEnter });
  handlers.current = { onChange, onEnter };

  const type = (next: string) => {
    valueRef.current = next;
    handlers.current.onChange(next);
  };
  const press = (d: string) => {
    if (valueRef.current.length < maxLength) type(valueRef.current + d);
  };
  const erase = () => type(valueRef.current.slice(0, -1));
  const enter = () => handlers.current.onEnter(valueRef.current);

  useEffect(() => {
    if (disabled) return;
    function onKey(event: KeyboardEvent) {
      // Autopowtarzanie przytrzymanego klawisza: „5555" albo seria Enterów.
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        erase();
      } else if (event.key === "Enter") {
        // Bez preventDefault: przeglądarka sama „kliknie" element z fokusem.
        if (keyboardFocusedControl(event.target)) return;
        event.preventDefault();
        enter();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, maxLength]);

  const digit = (d: string) => (
    <button
      key={d}
      type="button"
      disabled={disabled}
      onClick={() => press(d)}
      className="min-h-16 rounded-2xl bg-white/15 text-3xl font-black text-paper shadow-[0_5px_0_rgba(0,0,0,0.3)] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
    >
      {d}
    </button>
  );

  return (
    <div className="no-select grid w-full max-w-xs grid-cols-3 gap-2.5">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(digit)}
      <button
        type="button"
        disabled={disabled}
        onClick={erase}
        className="min-h-16 rounded-2xl bg-white/10 text-base font-bold text-paper/80 shadow-[0_5px_0_rgba(0,0,0,0.3)] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
      >
        ⌫ Delete
      </button>
      {digit("0")}
      <button
        type="button"
        disabled={disabled}
        onClick={enter}
        className="min-h-16 rounded-2xl bg-hero-lime text-lg font-black text-night shadow-[0_5px_0_#4fae42] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
      >
        Enter ↵
      </button>
    </div>
  );
}

/** Okienko odpowiedzi obok pytania: „7 × 8 = [ 56 ]". */
export function AnswerBox({
  value,
  state = "idle",
}: {
  value: string;
  state?: "idle" | "correct" | "wrong" | "repair";
}) {
  const styles = {
    idle: "border-white/30 bg-black/30 text-paper",
    correct: "border-hero-lime bg-hero-lime/20 text-hero-lime",
    wrong: "border-hero-pink bg-hero-pink/20 text-hero-pink",
    repair: "border-hero-gold bg-hero-gold/15 text-hero-gold",
  } as const;
  return (
    <span
      className={`inline-flex min-h-16 min-w-28 items-center justify-center rounded-2xl border-4 px-3 font-black tabular-nums ${styles[state]}`}
    >
      {value || <span className="opacity-30">?</span>}
    </span>
  );
}
