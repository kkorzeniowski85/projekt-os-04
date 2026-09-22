"use client";

/**
 * Obrazek pod pytaniem: duży napis, zegar, tablica „lots of", ciąg z luką,
 * tekst czytanki do zaglądania.
 */

import { useState } from "react";
import { ClockFace } from "@/components/ClockFace";
import { Speaker } from "@/components/ui";
import { playText } from "@/lib/audio";
import type { MarkStyle, Visual } from "@/lib/session/exercise";

export function VisualView({ visual, small = false }: { visual: Visual; small?: boolean }) {
  switch (visual.kind) {
    case "big":
      return (
        <p
          className={`font-reading font-black tabular-nums ${small ? "text-2xl" : "text-5xl sm:text-6xl"}`}
        >
          {visual.text}
        </p>
      );
    case "emoji":
      return (
        <div className={small ? "text-4xl" : "text-7xl"} aria-hidden>
          {visual.text}
        </div>
      );
    case "clock":
      return <ClockFace hour={visual.hour} minute={visual.minute} size={small ? 110 : 190} />;
    case "array":
      return <DotArray rows={visual.rows} cols={visual.cols} emoji={visual.emoji} small={small} />;
    case "sequence":
      return (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {visual.items.map((value, index) => (
            <span
              key={index}
              className={`flex min-h-14 min-w-14 items-center justify-center rounded-2xl px-2 text-2xl font-black tabular-nums ${
                value === null ? "border-4 border-dashed border-hero-gold text-hero-gold" : "bg-white/10"
              }`}
            >
              {value ?? "?"}
            </span>
          ))}
        </div>
      );
    case "passage":
      return <PassagePeek title={visual.title} sentences={visual.sentences} />;
    case "marked":
      return <MarkedPicture emoji={visual.emoji} mark={visual.mark} small={small} />;
  }
}

/**
 * Obrazek z zaznaczeniem jak ołówkiem na kartce. Kółko i podkreślenie są
 * rysowane, a nie symbolizowane — dziecko ma zobaczyć, co ZROBIĆ ręką.
 */
export function MarkedPicture({
  emoji,
  mark,
  small = false,
}: {
  emoji: string;
  mark: MarkStyle;
  small?: boolean;
}) {
  const size = small ? 92 : 120;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={MARK_LABEL[mark]}>
      {mark === "colour" && <rect x="14" y="14" width="72" height="62" rx="14" fill="#ffc93c" opacity="0.85" />}
      <text x="50" y="47" textAnchor="middle" dominantBaseline="central" fontSize="44">
        {emoji}
      </text>
      {mark === "circle" && <ellipse cx="50" cy="46" rx="38" ry="34" fill="none" stroke="#e33d5a" strokeWidth="5" />}
      {mark === "underline" && <line x1="18" y1="86" x2="82" y2="86" stroke="#e33d5a" strokeWidth="6" strokeLinecap="round" />}
      {mark === "cross" && (
        <g stroke="#e33d5a" strokeWidth="7" strokeLinecap="round">
          <line x1="20" y1="18" x2="80" y2="78" />
          <line x1="80" y1="18" x2="20" y2="78" />
        </g>
      )}
      {mark === "tick" && (
        <polyline points="62,70 72,82 94,52" fill="none" stroke="#e33d5a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const MARK_LABEL: Record<MarkStyle, string> = {
  tick: "zaznaczone ptaszkiem",
  circle: "zakreślone kółkiem",
  underline: "podkreślone",
  cross: "skreślone",
  colour: "pokolorowane",
};

/**
 * Tablica „rows lots of cols". Rzędy odstępują od siebie, bo cała idea to
 * zobaczyć GRUPY — 3 × 4 to trzy grupy po cztery, nie dwanaście kropek.
 */
export function DotArray({
  rows,
  cols,
  emoji,
  small = false,
}: {
  rows: number;
  cols: number;
  emoji?: string;
  small?: boolean;
}) {
  const size = small ? "text-base" : cols > 8 ? "text-lg" : "text-2xl";
  return (
    <div className="flex flex-col items-center gap-1.5" aria-label={`${rows} rzędy po ${cols}`}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-1 rounded-full bg-white/5 px-2 py-0.5">
          {Array.from({ length: cols }, (_, col) => (
            <span key={col} className={`${size} leading-none`} aria-hidden>
              {emoji ?? "🔵"}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Tekst czytanki pod pytaniem. W angielskiej szkole na pytania odpowiada się
 * z tekstem przed oczami — umiejętność „zajrzyj i znajdź" jest częścią
 * rozumienia, a nie ściąganiem. Zwinięty na starcie tylko na telefonie.
 */
function PassagePeek({ title, sentences }: { title: string; sentences: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/20 text-left">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-bold text-paper/70"
      >
        <span>📖 {title}</span>
        <span>{open ? "zwiń ▴" : "pokaż tekst ▾"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 px-4 pb-3">
          {sentences.map((sentence, index) => (
            <p key={index} className="flex items-start gap-2">
              <Speaker size="sm" onPlay={() => void playText(sentence)} ariaLabel={`Posłuchaj: ${sentence}`} />
              <span className="font-reading pt-1.5 text-lg leading-snug">{sentence}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
