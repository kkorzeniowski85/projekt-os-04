"use client";

/**
 * Sesja działu: ekran startu → ćwiczenia → nagroda.
 *
 * Działy podają tylko treść (`build`) i opisy; przebieg (useSessionFlow),
 * wygląd ćwiczeń (ExerciseScreen), powtórka po cofnięciu (ReviewScreen) i
 * zapis są wspólne.
 */

import Link from "next/link";
import { useEffect, useMemo, type ReactNode } from "react";
import { Celebration } from "@/components/Celebration";
import { HeroAvatar } from "@/components/HeroAvatar";
import { BigButton, Card, ParentTip, STATUS_LABEL, StepDots } from "@/components/ui";
import { playStarDing, playVictoryFanfare, stopVictoryFanfare } from "@/lib/audio";
import { HEROES_BY_MODULE } from "@/lib/heroes";
import { useProgress, type SessionOutcome } from "@/lib/progress/store";
import { unitKeyOf, type ModuleId, type SessionKind, type SessionMode } from "@/lib/progress/types";
import type { Exercise } from "@/lib/session/exercise";
import { useDeviceRole } from "@/lib/useDeviceRole";
import { ExerciseScreen } from "./ExerciseScreen";
import { InterruptDialog } from "./InterruptDialog";
import { ReviewScreen } from "./ReviewScreen";
import { useSessionFlow } from "./useSessionFlow";

export type SessionRunnerProps = {
  module: ModuleId;
  unitId: string;
  kind: SessionKind;
  title: string;
  emoji?: string;
  goalPl?: string;
  parentIntroPl?: string;
  /** Uwaga pod przyciskami startu, np. „w tym dziale nic nie trzeba czytać". */
  startNotePl?: string;
  exitHref: string;
  exitLabel: string;
  build: (mode: SessionMode) => Exercise[];
  /** Runda bonusowa na końcu (domyślnie tak). */
  bonus?: boolean;
  /** Tryb samodzielny — wyłączony, gdy ćwiczenia wymagają oceny rodzica. */
  allowSolo?: boolean;
  /** Dodatkowa treść na ekranie nagrody (np. nowe płynne fakty). */
  rewardExtra?: (outcome: SessionOutcome) => ReactNode;
  /** Dodatkowa treść na ekranie startu (np. wybór tabliczki). */
  introExtra?: ReactNode;
};

export function SessionRunner(props: SessionRunnerProps) {
  const { role } = useDeviceRole();
  const { commitSession, state } = useProgress();
  const hero = HEROES_BY_MODULE[props.module];

  const flow = useSessionFlow<Exercise>({
    build: props.build,
    commit: (snapshot, flush) =>
      commitSession(
        {
          ...snapshot,
          module: props.module,
          unitId: props.unitId,
          kind: props.kind,
          device: role,
          endedTs: Date.now(),
        },
        { flush },
      ),
    draft: { module: props.module, unitId: props.unitId, kind: props.kind, device: role },
    bonusFor:
      props.bonus === false
        ? undefined
        : (exercise) => ({
            ...exercise,
            id: `${exercise.id}-bonus`,
            // W bonusie fakt nie jest już „nowy" — dziecko właśnie go ćwiczyło.
            ...(exercise.exercise === "fact" ? { heading: undefined } : {}),
          }),
  });

  if (flow.stage === "intro") {
    return <IntroScreen {...props} onStart={flow.start} phone={role === "phone"} />;
  }

  if (flow.stage === "done" && flow.outcome) {
    return (
      <RewardScreen
        {...props}
        outcome={flow.outcome}
        status={state.units[unitKeyOf(props.module, props.unitId)]?.status ?? "learning"}
        onAgain={() => flow.start(flow.mode)}
      />
    );
  }

  const exercise = flow.screen;

  return (
    <div className={role === "desktop" ? "grid grid-cols-[1fr_300px] gap-6" : "flex flex-col gap-4"}>
      {flow.interrupting && (
        <InterruptDialog
          zrobione={flow.frontier}
          wszystkich={flow.screens.length}
          ocenianych={flow.scoredCount()}
          zapisane={flow.isSaved()}
          bonus={flow.inBonus}
          zapisanaCzesc={flow.savedPart()}
          onZapisz={flow.saveNow}
          onPorzuc={flow.discard}
          onWroc={flow.closeInterrupt}
          exitHref={props.exitHref}
        />
      )}

      {/* Pod oknem przerwania treść sesji nie istnieje dla fokusu i klawiatury:
          Tab z okna nie dochodzi do „Dalej" ani „↩", Enter niczego nie przesuwa.
          data-own-enter: Enter na przyciskach paska działa jak klik, nie „Dalej". */}
      <div className="flex flex-col gap-4" inert={flow.interrupting}>
        <header className="flex items-center justify-between gap-3" data-own-enter>
          <button type="button" onClick={flow.openInterrupt} className="text-sm text-paper/60 underline">
            ← Przerwij
          </button>
          <StepDots total={flow.screens.length} current={flow.index} />
          <div className="flex items-center gap-2">
            {flow.index > 0 && (
              <button
                type="button"
                onClick={flow.goBack}
                aria-label="Poprzedni ekran"
                title="Wróć do poprzedniego ekranu"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 text-lg"
              >
                ↩
              </button>
            )}
            <span className="hidden rounded-full bg-white/10 px-3 py-1 text-sm font-bold sm:inline">
              {props.emoji && <span aria-hidden>{props.emoji} </span>}
              {props.title}
            </span>
          </div>
        </header>

        {flow.inBonus && (
          <p className="rounded-2xl border border-hero-gold/40 bg-hero-gold/10 p-3 text-center text-sm font-bold text-hero-gold">
            ⭐ Runda bonusowa — złap te, które uciekły! (bez punktów, sama chwała)
          </p>
        )}

        {exercise && flow.isReview && (
          <ReviewScreen
            key={`review-${flow.index}`}
            exercise={exercise}
            attempt={flow.attemptAt(flow.index)}
            mode={flow.mode}
            onForward={flow.goForward}
          />
        )}
        {exercise && !flow.isReview && (
          <ExerciseScreen
            key={`${exercise.id}-${flow.index}`}
            exercise={exercise}
            mode={flow.mode}
            onAnswer={flow.onAnswer}
            onNext={flow.onNext}
            paused={flow.interrupting}
            firstAttempt={flow.attemptAt(flow.index)}
            answerMs={flow.answerMs}
          />
        )}
      </div>

      {role === "desktop" && (
        <aside className="flex flex-col gap-4" inert={flow.interrupting}>
          <Card>
            <div className="flex items-center gap-3">
              <HeroAvatar hero={hero} size={64} />
              <div>
                <p className="font-bold">{hero.codename}</p>
                <p className="text-xs text-paper/70">{props.goalPl ?? props.title}</p>
              </div>
            </div>
          </Card>
          {props.parentIntroPl && (
            <ParentTip>
              <p>{props.parentIntroPl}</p>
            </ParentTip>
          )}
          <Card className="text-sm text-paper/70">
            <p className="mb-1 font-bold text-paper">
              Tryb: {flow.mode === "parent" ? "z rodzicem" : "samodzielny"}
            </p>
            <p>
              Liczy się pierwsza odpowiedź. Strzałka ↩ cofa do powtórki — bez ponownego
              punktowania.
            </p>
          </Card>
        </aside>
      )}
    </div>
  );
}

function IntroScreen({
  module,
  title,
  emoji,
  goalPl,
  parentIntroPl,
  startNotePl,
  exitHref,
  allowSolo = true,
  introExtra,
  onStart,
  phone,
}: SessionRunnerProps & { onStart: (mode: SessionMode) => void; phone: boolean }) {
  const hero = HEROES_BY_MODULE[module];
  const tip = parentIntroPl ? (
    <div className="w-full max-w-xl">
      <ParentTip>
        <p>{parentIntroPl}</p>
      </ParentTip>
    </div>
  ) : null;

  return (
    <div className={`flex flex-col items-center text-center ${phone ? "gap-4" : "gap-6"}`}>
      <Link href={exitHref} className="flex min-h-11 items-center self-start rounded-full bg-white/10 px-5 text-sm">
        ← Wróć
      </Link>
      <div className="flex flex-col items-center gap-2">
        <HeroAvatar hero={hero} size={phone ? 110 : 150} />
        <p className="text-lg font-bold text-hero-cyan">{hero.codename}</p>
      </div>
      {emoji && (
        <div className="text-6xl" aria-hidden>
          {emoji}
        </div>
      )}
      <h1 className="text-3xl font-black">{title}</h1>
      {goalPl && <p className="max-w-md text-lg text-hero-gold">{goalPl}</p>}
      {introExtra}
      {!phone && tip}
      <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
        <BigButton onClick={() => onStart("parent")} full>
          Z rodzicem
        </BigButton>
        {allowSolo && (
          <BigButton tone="quiet" onClick={() => onStart("solo")} full>
            Sam
          </BigButton>
        )}
      </div>
      {startNotePl && <p className="max-w-md text-xs text-paper/50">{startNotePl}</p>}
      {phone && tip}
    </div>
  );
}

function RewardScreen({
  module,
  title,
  emoji,
  exitHref,
  exitLabel,
  outcome,
  status,
  onAgain,
  rewardExtra,
}: SessionRunnerProps & {
  outcome: SessionOutcome;
  status: string;
  onAgain: () => void;
}) {
  const hero = HEROES_BY_MODULE[module];
  const accuracy = outcome.accuracy;
  // Zawsze co najmniej jedna gwiazdka — bez kar za błędy (brief).
  const stars = accuracy === null ? 2 : accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;
  const mastered = status === "mastered";

  const STAR_START = 400;
  const STAR_STEP = 420;
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < stars; i++) {
      timers.push(setTimeout(() => playStarDing(i), STAR_START + i * STAR_STEP));
    }
    timers.push(setTimeout(() => void playVictoryFanfare(), STAR_START + stars * STAR_STEP + 150));
    return () => {
      timers.forEach(clearTimeout);
      stopVictoryFanfare();
    };
  }, [stars]);

  const extra = useMemo(() => rewardExtra?.(outcome), [rewardExtra, outcome]);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <Celebration big={mastered} />
      <h1 className="animate-pop-in text-3xl font-black">Misja zakończona!</h1>
      <HeroAvatar hero={hero} size={140} cheering />
      <div className="text-5xl" aria-label={`${stars} z 3 gwiazdek`}>
        {Array.from({ length: 3 }, (_, i) =>
          i < stars ? (
            <span
              key={i}
              className="animate-pop-in inline-block"
              style={{ animationDelay: `${STAR_START + i * STAR_STEP}ms` }}
            >
              ⭐
            </span>
          ) : (
            <span key={i} className="inline-block opacity-25">
              ⭐
            </span>
          ),
        )}
      </div>

      <Card className="w-full max-w-md">
        <p className="text-xl font-bold">
          {emoji && <span aria-hidden>{emoji} </span>}
          {title}
        </p>
        <p className="text-paper/80">
          {outcome.session.scored > 0
            ? `Dobrze za pierwszym razem: ${outcome.session.correct} z ${outcome.session.scored}`
            : "Sesja bez punktacji"}
        </p>
        {status !== "new" && (
          <p className="mt-1 text-sm text-paper/60">Stan: {STATUS_LABEL[status] ?? status}</p>
        )}
      </Card>

      {extra}

      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <BigButton
          onClick={() => {
            stopVictoryFanfare();
            onAgain();
          }}
          full
        >
          Jeszcze raz
        </BigButton>
        <BigButton href={exitHref} tone="quiet" full>
          {exitLabel}
        </BigButton>
      </div>
      <button type="button" onClick={() => stopVictoryFanfare()} className="text-xs text-paper/40 underline">
        wycisz muzykę
      </button>
    </div>
  );
}
