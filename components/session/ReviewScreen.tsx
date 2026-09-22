"use client";

/**
 * Ekran, który już był — wejście strzałką ↩ w nagłówku sesji.
 *
 * Powtórka, nie druga próba: wynik zapadł przy pierwszej odpowiedzi. Tutaj
 * wszystko da się jeszcze raz usłyszeć i zobaczyć poprawną odpowiedź, ale
 * niczego nie da się przepunktować.
 */

import { BigButton, Card, ParentTip, Speaker } from "@/components/ui";
import { playSound, playText } from "@/lib/audio";
import type { PendingAttempt } from "@/lib/progress/store";
import type { SessionMode } from "@/lib/progress/types";
import type { Exercise } from "@/lib/session/exercise";
import { VisualView } from "./VisualView";

export function ReviewScreen({
  exercise,
  attempt,
  mode,
  onForward,
}: {
  exercise: Exercise;
  attempt: PendingAttempt | undefined;
  mode: SessionMode;
  onForward: () => void;
}) {
  const result =
    attempt === undefined || attempt.correct === null ? null : attempt.correct ? "good" : "practise";

  return (
    <Card className="no-select flex flex-col items-center gap-4 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-paper/60">
        <span className="rounded-full bg-white/10 px-3 py-1">↩ Powtórka — to już było</span>
        {result === "good" && (
          <span className="rounded-full bg-hero-lime/20 px-3 py-1 text-hero-lime">✓ dobrze</span>
        )}
        {result === "practise" && (
          <span className="rounded-full bg-hero-gold/20 px-3 py-1 text-hero-gold">🙂 warto poćwiczyć</span>
        )}
      </div>

      {exercise.heading && <p className="text-sm text-paper/60">{exercise.heading}</p>}
      {exercise.visual && <VisualView visual={exercise.visual} />}
      {exercise.promptEn && (
        <p className="font-reading max-w-2xl text-2xl font-bold">{exercise.promptEn}</p>
      )}
      {exercise.promptPl && <p className="text-sm text-hero-cyan">{exercise.promptPl}</p>}
      {exercise.sound && <Speaker onPlay={() => void playSound(exercise.sound!)} label="Posłuchaj" />}

      <Answer exercise={exercise} />

      {exercise.explainPl && (
        <p className="max-w-xl rounded-2xl bg-white/5 p-3 text-left text-sm text-paper/80">
          💡 {exercise.explainPl}
        </p>
      )}
      {mode === "parent" && exercise.parentPl && (
        <div className="w-full max-w-xl">
          <ParentTip>
            <p>{exercise.parentPl}</p>
          </ParentTip>
        </div>
      )}

      <BigButton onClick={onForward}>Dalej ▸</BigButton>
    </Card>
  );
}

function Answer({ exercise }: { exercise: Exercise }) {
  switch (exercise.kind) {
    case "choice": {
      const option = exercise.options.find((candidate) => candidate.id === exercise.answer);
      if (!option) return null;
      return (
        <div className="flex flex-col items-center gap-1 rounded-blob bg-hero-lime px-6 py-4 text-night">
          {option.emoji && <span className="text-5xl">{option.emoji}</span>}
          {option.visual && <VisualView visual={option.visual} small />}
          <span className="font-reading text-xl font-black">{option.label}</span>
          {option.sub && <span className="text-xs font-bold">{option.sub}</span>}
        </div>
      );
    }
    case "typed":
      return (
        <p className="rounded-blob bg-hero-lime px-6 py-3 text-3xl font-black text-night">
          {exercise.revealText ?? exercise.answer}
        </p>
      );
    case "order":
      return (
        <ol className="flex w-full max-w-xl flex-col gap-1.5 text-left">
          {exercise.items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-hero-lime/15 px-3 py-2">
              <span className="font-black">{index + 1}.</span>
              <span className="font-reading text-lg">{item.label}</span>
            </li>
          ))}
        </ol>
      );
    case "tapword":
      return (
        <p className="rounded-2xl bg-white/10 px-4 py-2 text-lg">
          ✏️ Copy: <span className="font-reading font-black text-hero-lime">{exercise.answers[0]}</span>
        </p>
      );
    case "act":
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl" aria-hidden>
            {exercise.emoji}
          </span>
          <span className="text-hero-cyan">{exercise.actionPl}</span>
        </div>
      );
    case "learn":
      return exercise.examples ? (
        <ul className="flex w-full max-w-xl flex-col gap-2 text-left">
          {exercise.examples.map((example) => (
            <li key={example.en} className="flex items-start gap-3 rounded-2xl bg-white/5 p-3">
              <Speaker size="sm" onPlay={() => void playText(example.en)} />
              <span>
                <span className="font-reading block font-bold">{example.en}</span>
                {example.pl && <span className="text-sm text-hero-cyan">{example.pl}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : exercise.bodyPl ? (
        <p className="max-w-xl text-paper/80">{exercise.bodyPl}</p>
      ) : null;
    case "passage":
      return (
        <div className="flex w-full max-w-2xl flex-col gap-1.5 text-left">
          <p className="font-reading text-2xl font-black">{exercise.title}</p>
          {exercise.sentences.map((sentence) => (
            <p key={sentence.en} className="flex items-start gap-2">
              <Speaker size="sm" onPlay={() => void playText(sentence.en)} />
              <span>
                <span className="font-reading block text-lg">{sentence.en}</span>
                <span className="text-sm text-hero-cyan">{sentence.pl}</span>
              </span>
            </p>
          ))}
        </div>
      );
  }
}
