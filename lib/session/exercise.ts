/**
 * Wspólny model ćwiczenia dla wszystkich działów Akademii.
 *
 * Dział (tabliczka, matematyka, czytanie, język klasy) tylko BUDUJE listę
 * ćwiczeń z własnej treści; wyświetlanie, bramka naprawy błędu, cofanie i
 * zapis są wspólne (components/session). Dzięki temu zasady wypracowane w
 * Lidze — liczy się pierwsza odpowiedź, po błędzie dziecko samo wykonuje
 * poprawną, wyjaśnienie nie znika automatycznie — obowiązują wszędzie
 * jednakowo, a nowy typ zadania to nowa treść, nie nowy silnik.
 */

export type Sound =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "fact"; a: number; b: number };

export const say = (value: string): Sound => ({ kind: "text", value });
export const sayNumber = (value: number): Sound => ({ kind: "number", value });

export type Visual =
  /** Duży napis: „7 × 8 =", „406", „£2.50". */
  | { kind: "big"; text: string }
  | { kind: "emoji"; text: string }
  | { kind: "clock"; hour: number; minute: number }
  /** „3 lots of 4" — trzy rzędy po cztery. */
  | { kind: "array"; rows: number; cols: number; emoji?: string }
  /** Ciąg z luką: 7, 14, _, 28. `null` = luka. */
  | { kind: "sequence"; items: (number | null)[] }
  /** Tekst czytanki pod pytaniem — do zaglądania („look back in the text"). */
  | { kind: "passage"; title: string; sentences: string[] }
  /** Obrazek zaznaczony tak, jak na kartce: ptaszkiem, kółkiem, skreśleniem… */
  | { kind: "marked"; emoji: string; mark: MarkStyle };

export type MarkStyle = "tick" | "circle" | "underline" | "cross" | "colour";

export type ChoiceOption = {
  id: string;
  label: string;
  /** Podpis pod etykietą (np. tłumaczenie w trybie z rodzicem). */
  sub?: string;
  emoji?: string;
  visual?: Visual;
  sound?: Sound;
};

export type OrderItem = { id: string; label: string; sound?: Sound };

type Base = {
  /** Unikalny w sesji — klucz Reacta. */
  id: string;
  /** Rodzaj próby w dzienniku: „fact", „number-listen", „reading-find"… */
  exercise: string;
  /** Czego dotyczy próba: „7x8", „406", „hedgehogs-q3"… */
  item: string;
  /** Mała instrukcja nad zadaniem, po polsku („Posłuchaj i wybierz"). */
  heading?: string;
  /** Pytanie po angielsku — pokazane dużo i czytane z nagrania. */
  promptEn?: string;
  /** Tłumaczenie pytania — schowane za przyciskiem „PL". */
  promptPl?: string;
  /** Dźwięk pytania; gra sam na starcie ekranu. */
  sound?: Sound;
  /** Nie pokazuj tekstu pytania (ćwiczenie ze słuchu). */
  listenOnly?: boolean;
  visual?: Visual;
  /** Krótkie „dlaczego" po odpowiedzi — po błędzie zawsze, po trafieniu też. */
  explainPl?: string;
  /** „wrong" = wyjaśnienie tylko po błędzie (tabliczka: po trafieniu tempo). */
  explainWhen?: "always" | "wrong";
  /** Wskazówka dla rodzica (tylko tryb wspólny). */
  parentPl?: string;
};

export type Exercise = Base &
  (
    | {
        kind: "learn";
        bodyPl?: string;
        examples?: { en: string; pl?: string; visual?: Visual }[];
        /** Liczenie skokami: liczby do odegrania po kolei z podświetleniem. */
        countAlong?: number[];
      }
    | {
        kind: "choice";
        options: ChoiceOption[];
        answer: string;
        /** Zaznaczenie wybranej opcji tak, jak na kartce: ptaszek, kółko… */
        mark?: MarkStyle;
        columns?: 1 | 2 | 3 | 4;
      }
    | {
        kind: "typed";
        answer: number;
        /** Tabliczka: pokaż błyskawicę za odpowiedź w tym czasie. */
        fastMs?: number;
        /** Co pokazać i odtworzyć po błędzie: „7 × 8 = 56". */
        revealText?: string;
        revealSound?: Sound;
      }
    | { kind: "order"; items: OrderItem[] }
    | {
        kind: "tapword";
        title: string;
        sentences: string[];
        /** Dopuszczalne odpowiedzi (małe litery, bez interpunkcji). */
        answers: string[];
      }
    | {
        /** Ćwiczenie w ruchu: rodzic mówi, dziecko robi, rodzic ocenia. */
        kind: "act";
        actionPl: string;
        emoji: string;
      }
    | {
        /** Tekst do wysłuchania (i czytania) przed pytaniami. */
        kind: "passage";
        title: string;
        sentences: { en: string; pl: string }[];
      }
  );

export type ExerciseKind = Exercise["kind"];

/** Czy ćwiczenie w ogóle ocenia (i zapisuje próbę). */
export function isScored(exercise: Exercise): boolean {
  return exercise.kind !== "learn" && exercise.kind !== "passage";
}

/** Słowo z tekstu do porównania w „Find and copy": małe litery, bez interpunkcji. */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickSome<T>(items: readonly T[], count: number, random: () => number = Math.random): T[] {
  return shuffle(items, random).slice(0, count);
}

/** Wszystkie dźwięki ćwiczenia — do audytu nagrań. */
export function soundsOf(exercise: Exercise): Sound[] {
  const sounds: Sound[] = [];
  if (exercise.sound) sounds.push(exercise.sound);
  switch (exercise.kind) {
    case "choice":
      exercise.options.forEach((option) => option.sound && sounds.push(option.sound));
      break;
    case "typed":
      if (exercise.revealSound) sounds.push(exercise.revealSound);
      break;
    case "order":
      exercise.items.forEach((item) => item.sound && sounds.push(item.sound));
      break;
    case "learn":
      exercise.examples?.forEach((example) => sounds.push(say(example.en)));
      exercise.countAlong?.forEach((value) => sounds.push(sayNumber(value)));
      break;
    case "tapword":
      exercise.sentences.forEach((sentence) => sounds.push(say(sentence)));
      break;
    case "passage":
      exercise.sentences.forEach((sentence) => sounds.push(say(sentence.en)));
      break;
    case "act":
      break;
  }
  if (exercise.visual?.kind === "passage") {
    exercise.visual.sentences.forEach((sentence) => sounds.push(say(sentence)));
  }
  return sounds;
}
