"use client";

/**
 * Wspólne klocki interfejsu (skopiowane z Ligi i uogólnione — KONWENCJE:
 * kopia, dopóki nie ma trzeciego użycia).
 */

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Duży przycisk — minimum 64 px wysokości, bo celuje w niego palec dziecka.
 * Z `href` renderuje się jako link w stylu przycisku; `onClick` działa w obu
 * wersjach (np. zapis sesji tuż przed przejściem).
 */
export function BigButton({
  children,
  onClick,
  href,
  tone = "primary",
  disabled = false,
  full = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "primary" | "yes" | "no" | "quiet";
  disabled?: boolean;
  full?: boolean;
}) {
  const tones: Record<string, string> = {
    primary: "bg-hero-blue text-white shadow-[0_6px_0_#1c47b3]",
    yes: "bg-hero-lime text-night shadow-[0_6px_0_#4fae42]",
    // Ciemny tekst na różowym: biały nie spełniał progu kontrastu.
    no: "bg-hero-pink text-night shadow-[0_6px_0_#c93c76]",
    quiet: "bg-white/10 text-paper shadow-[0_4px_0_rgba(0,0,0,0.25)]",
  };
  const className = `min-h-16 rounded-blob px-7 py-4 text-2xl font-bold transition active:translate-y-1 active:shadow-none disabled:opacity-40 ${tones[tone]} ${full ? "w-full" : ""}`;

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={`${className} flex items-center justify-center text-center`}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-blob border border-white/10 bg-white/5 p-5 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

/**
 * Głośnik. `sm` = okrągła ikonka (przy opcji, zdaniu, kwestii), `md`/`lg` =
 * złoty przycisk z podpisem — główne źródło dźwięku na ekranie.
 */
export function Speaker({
  onPlay,
  label = "Posłuchaj",
  size = "md",
  pulse = false,
  ariaLabel,
}: {
  onPlay: () => void;
  label?: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  ariaLabel?: string;
}) {
  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPlay();
        }}
        aria-label={ariaLabel ?? label}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hero-gold/25 text-lg transition active:translate-y-0.5"
      >
        🔊
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={ariaLabel ?? label}
      className={`flex items-center gap-3 rounded-blob bg-hero-gold font-bold text-night shadow-[0_6px_0_#c99a1f] transition active:translate-y-1 active:shadow-none ${
        size === "lg" ? "px-8 py-5 text-3xl" : "px-5 py-3 text-xl"
      } ${pulse ? "animate-pulse-ring" : ""}`}
    >
      <span aria-hidden>🔊</span>
      {label}
    </button>
  );
}

/** Pasek postępu sesji — kropki, nie procenty. */
export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`Krok ${current + 1} z ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-2.5 w-2.5 rounded-full ${
            index < current ? "bg-hero-lime" : index === current ? "bg-hero-gold" : "bg-white/20"
          }`}
        />
      ))}
    </div>
  );
}

/** Ramka ze wskazówką dla rodzica — widoczna tylko w trybie wspólnym. */
export function ParentTip({ children, title = "Dla rodzica" }: { children: ReactNode; title?: string }) {
  return (
    <div className="rounded-2xl border border-hero-cyan/40 bg-hero-cyan/10 p-4 text-left text-sm leading-relaxed text-paper/90">
      <p className="mb-1 font-bold text-hero-cyan">{title}</p>
      {children}
    </div>
  );
}

/** Nagłówek strony działu z powrotem do bazy. */
export function PageHeader({ title, subtitle, back = "/" }: { title: string; subtitle?: string; back?: string }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black sm:text-4xl">{title}</h1>
        {subtitle && <p className="text-sm text-paper/60">{subtitle}</p>}
      </div>
      <Link href={back} className="flex min-h-11 shrink-0 items-center rounded-full bg-white/10 px-5 text-sm">
        ← {back === "/" ? "Baza" : "Wróć"}
      </Link>
    </header>
  );
}

/** Znaczek statusu jednostki — te same kolory co w Lidze. */
export const STATUS_STYLE: Record<string, string> = {
  mastered: "bg-hero-lime text-night",
  learning: "bg-hero-gold text-night",
  "needs-help": "bg-hero-pink text-night",
  new: "bg-white/15 text-paper",
};

export const STATUS_LABEL: Record<string, string> = {
  mastered: "opanowane",
  learning: "w trakcie",
  "needs-help": "trudne",
  new: "nowe",
};
