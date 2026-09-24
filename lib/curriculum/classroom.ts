/**
 * Język klasy — treść działu THUNDER.
 *
 * Trzy warstwy, które dziecko spotyka od pierwszego dnia:
 *  1. POLECENIA NAUCZYCIELA (mówione): line up, put your hand up, eyes on me…
 *     Najważniejsze w pierwszych tygodniach — dziecko może długo prawie nic nie
 *     mówić (to normalny etap), ale musi wiedzieć, co ZROBIĆ.
 *  2. JĘZYK LEKCJI: get your books out, talk to your partner, show me on your
 *     whiteboard — rutyny angielskiej lekcji, których w polskiej szkole nie ma
 *     (tacki zamiast ławek z szufladą, białe tabliczki, praca w parach).
 *  3. POLECENIA NA KARTCE (pisane): Tick, Circle, Underline, Cross out, Show
 *     your working… — bez nich dziecko umie zadanie, a robi nie to, co trzeba.
 *
 * Liga Dźwięków (tor 2) ma podstawowe polecenia w temacie „Co mówi
 * nauczyciel" — tu część się powtarza celowo (utrwalenie) i dochodzi poziom
 * Year 4.
 */

import {
  pickSome,
  say,
  shuffle,
  type ChoiceOption,
  type Exercise,
  type MarkStyle,
} from "@/lib/session/exercise";

/**
 * `group`: polecenia o prawie tym samym znaczeniu („Eyes on me" i „Stop, look
 * and listen") — nie mogą być dla siebie błędnymi opcjami, bo dziecko, które
 * dobrze rozumie, dostałoby błąd.
 */
export type Command = { en: string; pl: string; actionPl: string; emoji: string; group?: string };

export const TEACHER_SAYS: Command[] = [
  { en: "Line up, please.", pl: "Ustawcie się w rzędzie.", actionPl: "Ustaw się w rzędzie przy drzwiach, jeden za drugim.", emoji: "🚶" },
  { en: "Put your hand up.", pl: "Podnieś rękę.", actionPl: "Podnieś rękę i czekaj — nie wołaj odpowiedzi.", emoji: "✋" },
  { en: "Sit on the carpet.", pl: "Usiądź na dywanie.", actionPl: "Usiądź na dywanie przed tablicą, po turecku.", emoji: "🟫", group: "sit" },
  { en: "Tidy up, please.", pl: "Posprzątajcie, proszę.", actionPl: "Odłóż rzeczy na miejsce.", emoji: "🧹" },
  { en: "Eyes on me.", pl: "Patrzcie na mnie.", actionPl: "Przestań pracować i patrz na nauczyciela.", emoji: "👀", group: "attention" },
  { en: "Pens down.", pl: "Odłóżcie długopisy.", actionPl: "Odłóż długopis i przestań pisać.", emoji: "✏️", group: "attention" },
  { en: "Get changed for PE.", pl: "Przebierzcie się na WF.", actionPl: "Przebierz się w strój na WF.", emoji: "👟" },
  { en: "Hang your coat on your peg.", pl: "Powieś kurtkę na swoim wieszaku.", actionPl: "Powieś kurtkę na swoim wieszaku w szatni.", emoji: "🧥" },
  { en: "Put your book in your tray.", pl: "Włóż zeszyt do swojej tacki.", actionPl: "Włóż zeszyt do swojej szuflady-tacki.", emoji: "📥" },
  { en: "Walk, don't run!", pl: "Idź, nie biegaj!", actionPl: "Zwolnij i idź spokojnie.", emoji: "🐢" },
  { en: "Stand behind your chair.", pl: "Stań za swoim krzesłem.", actionPl: "Wstań i stań za swoim krzesłem.", emoji: "🪑" },
  { en: "Wash your hands before lunch.", pl: "Umyj ręce przed obiadem.", actionPl: "Idź umyć ręce przed obiadem.", emoji: "🧼" },
  { en: "Stop, look and listen.", pl: "Stop, patrz i słuchaj.", actionPl: "Zatrzymaj się, patrz na nauczyciela i słuchaj.", emoji: "🛑", group: "attention" },
  { en: "Come and sit down, please.", pl: "Chodź i usiądź, proszę.", actionPl: "Podejdź i usiądź na swoim miejscu.", emoji: "🙋", group: "sit" },
];

export const LESSON_TALK: Command[] = [
  { en: "Get your books out.", pl: "Wyjmijcie zeszyty.", actionPl: "Wyjmij zeszyt z tacki.", emoji: "📚" },
  { en: "Write the date and the title.", pl: "Napiszcie datę i temat.", actionPl: "Napisz datę i temat na górze strony.", emoji: "📅" },
  { en: "Underline it with a ruler.", pl: "Podkreśl to linijką.", actionPl: "Podkreśl datę i temat linijką.", emoji: "📏" },
  { en: "Talk to your partner.", pl: "Porozmawiaj z kolegą z ławki.", actionPl: "Odwróć się do sąsiada i porozmawiajcie o zadaniu.", emoji: "🗣️", group: "partner" },
  { en: "Show me on your whiteboard.", pl: "Pokaż mi na swojej tabliczce.", actionPl: "Napisz odpowiedź na białej tabliczce i podnieś ją.", emoji: "⬜" },
  { en: "Turn to page twelve.", pl: "Otwórzcie na stronie dwunastej.", actionPl: "Otwórz książkę na stronie 12.", emoji: "📖" },
  { en: "Work in pairs.", pl: "Pracujcie w parach.", actionPl: "Pracuj razem z jedną osobą.", emoji: "👫", group: "partner" },
  { en: "Thumbs up if you're ready.", pl: "Kciuk w górę, jeśli jesteś gotowy.", actionPl: "Pokaż kciuk w górę, gdy jesteś gotowy.", emoji: "👍" },
  { en: "Stick the sheet in your book.", pl: "Wklej kartkę do zeszytu.", actionPl: "Wklej kartkę klejem do zeszytu.", emoji: "🧴" },
  { en: "Have a go.", pl: "Spróbuj.", actionPl: "Spróbuj sam, nawet jeśli nie jesteś pewien.", emoji: "💪" },
  { en: "Check your work.", pl: "Sprawdź swoją pracę.", actionPl: "Przeczytaj jeszcze raz, co napisałeś, i popraw błędy.", emoji: "🔍", group: "finish" },
  { en: "Swap books with your partner.", pl: "Zamieńcie się zeszytami.", actionPl: "Daj zeszyt sąsiadowi i weź jego zeszyt.", emoji: "🔄" },
  { en: "Put your name on it.", pl: "Podpisz to.", actionPl: "Napisz swoje imię na kartce.", emoji: "🏷️" },
  { en: "Finish off your sentence.", pl: "Dokończ zdanie.", actionPl: "Dopisz koniec zdania, nad którym pracujesz.", emoji: "✍️", group: "finish" },
];

/** Polecenie ze słuchu → co zrobić. Połowa bez tekstu (samo ucho), połowa z tekstem (czytanie). */
function commandChoice(command: Command, pool: Command[], index: number, exercise: string): Exercise {
  const others = pickSome(
    pool.filter(
      (other) => other.en !== command.en && (command.group === undefined || other.group !== command.group),
    ),
    2,
  );
  const options: ChoiceOption[] = shuffle([command, ...others]).map((option) => ({
    id: option.en,
    label: option.actionPl,
    emoji: option.emoji,
  }));
  return {
    id: `${exercise}-${index}`,
    kind: "choice",
    exercise,
    item: command.en,
    heading: "Co trzeba zrobić?",
    promptEn: command.en,
    sound: say(command.en),
    listenOnly: index % 2 === 0,
    options,
    answer: command.en,
    columns: 1,
    explainPl: `„${command.en}” — ${command.pl}`,
    explainWhen: "wrong",
  };
}


function commandAct(command: Command, index: number, exercise: string): Exercise {
  return {
    id: `${exercise}-act-${index}`,
    kind: "act",
    exercise: `${exercise}-act`,
    item: command.en,
    heading: "Zrób to!",
    promptEn: command.en,
    sound: say(command.en),
    actionPl: command.actionPl,
    emoji: command.emoji,
  };
}

function commandsSession(pool: Command[], exercise: string, mode: "solo" | "parent"): Exercise[] {
  const chosen = pickSome(pool, 8);
  const screens = chosen.map((command, i) => commandChoice(command, pool, i, exercise));
  // „Zrób to" — w ruchu, ocenia rodzic. Samodzielnie się nie da, więc tylko w trybie wspólnym.
  if (mode === "parent") {
    pickSome(chosen, 3).forEach((command, i) => screens.push(commandAct(command, i, exercise)));
  }
  return screens;
}

// --- Polecenia na kartce ----------------------------------------------------------

type MarkVerb = { mark: MarkStyle; en: string; pl: string };

export const MARK_VERBS: MarkVerb[] = [
  { mark: "tick", en: "Tick", pl: "postaw ptaszek ✓" },
  { mark: "circle", en: "Circle", pl: "zakreśl kółkiem" },
  { mark: "underline", en: "Underline", pl: "podkreśl" },
  { mark: "cross", en: "Cross out", pl: "skreśl" },
  { mark: "colour", en: "Colour", pl: "pokoloruj" },
];

const OBJECTS = [
  { en: "apple", emoji: "🍎" },
  { en: "dog", emoji: "🐶" },
  { en: "cat", emoji: "🐱" },
  { en: "fish", emoji: "🐟" },
  { en: "star", emoji: "⭐" },
  { en: "ball", emoji: "⚽" },
  { en: "book", emoji: "📘" },
  { en: "sun", emoji: "☀️" },
];

export type MeaningItem = { en: string; answerPl: string; wrongPl: [string, string]; explainPl: string };

/** Polecenia z kartek i zeszytów ćwiczeń (Year 3–4), zwłaszcza z matematyki. */
export const WORKSHEET_MEANINGS: MeaningItem[] = [
  {
    en: "Show your working.",
    answerPl: "Zapisz, jak liczyłeś.",
    wrongPl: ["Pokaż zeszyt nauczycielowi.", "Pracuj szybciej."],
    explainPl: "„Show your working” = zapisz obliczenia, nie tylko wynik. Za sposób liczenia też są punkty.",
  },
  {
    en: "Explain your answer.",
    answerPl: "Napisz, dlaczego tak uważasz.",
    wrongPl: ["Przepisz odpowiedź jeszcze raz.", "Narysuj odpowiedź."],
    explainPl: "„Explain” = wyjaśnij. Często z „because…” — „I know because…”.",
  },
  {
    en: "Check your answer.",
    answerPl: "Sprawdź, czy wynik jest dobry.",
    wrongPl: ["Zaznacz odpowiedź ptaszkiem.", "Zapytaj kolegę o odpowiedź."],
    explainPl: "„Check” = sprawdź — np. policz jeszcze raz albo odwrotnym działaniem. Ptaszek to po angielsku „tick”.",
  },
  {
    en: "Estimate the answer.",
    answerPl: "Oszacuj wynik w przybliżeniu.",
    wrongPl: ["Policz dokładnie.", "Zgadnij dowolną liczbę."],
    explainPl: "„Estimate” = oszacuj, np. 49 + 32 to mniej więcej 50 + 30 = 80. Nie strzał, tylko rozsądne przybliżenie.",
  },
  {
    en: "Fill in the gaps.",
    answerPl: "Uzupełnij puste miejsca.",
    wrongPl: ["Zakreśl błędy.", "Przepisz całe zdanie."],
    explainPl: "„Fill in the gaps” = wpisz brakujące słowa albo liczby w luki.",
  },
  {
    en: "Match the words to the pictures.",
    answerPl: "Połącz słowa z obrazkami.",
    wrongPl: ["Narysuj obrazki do słów.", "Przepisz słowa pod obrazkami."],
    explainPl: "„Match” = połącz w pary (zwykle linią).",
  },
  {
    en: "Label the picture.",
    answerPl: "Podpisz części obrazka.",
    wrongPl: ["Pokoloruj obrazek.", "Wytnij obrazek."],
    explainPl: "„Label” = podpisz (np. części rośliny strzałkami i słowami).",
  },
  {
    en: "Write your answer in the box.",
    answerPl: "Wpisz odpowiedź w ramkę.",
    wrongPl: ["Narysuj ramkę wokół odpowiedzi.", "Włóż kartkę do pudełka."],
    explainPl: "„In the box” = w ramce na kartce, nie w pudełku! Na testach odpowiedź poza ramką może nie zostać zaliczona.",
  },
  {
    en: "Round 47 to the nearest ten.",
    answerPl: "Zaokrąglij 47 do pełnych dziesiątek.",
    wrongPl: ["Narysuj 47 kółek.", "Dodaj 10 do 47."],
    explainPl: "„Round to the nearest ten” = zaokrąglij do dziesiątek: 47 → 50.",
  },
  {
    en: "Put these numbers in order, starting with the smallest.",
    answerPl: "Ułóż liczby od najmniejszej.",
    wrongPl: ["Ułóż liczby od największej.", "Dodaj wszystkie liczby."],
    explainPl: "„In order, starting with the smallest” = rosnąco. „Largest first” byłoby malejąco.",
  },
];

function markVerbChoice(verb: MarkVerb, index: number): Exercise {
  const object = OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
  const others = pickSome(
    MARK_VERBS.filter((other) => other.mark !== verb.mark),
    2,
  );
  const sentence = `${verb.en} the ${object.en}.`;
  return {
    id: `mark-${verb.mark}-${index}`,
    kind: "choice",
    exercise: "worksheet-mark",
    item: verb.mark,
    heading: "Na którym obrazku zrobiono to, co każe polecenie?",
    promptEn: sentence,
    sound: say(sentence),
    options: shuffle([verb, ...others]).map((option) => ({
      id: option.mark,
      label: "",
      visual: { kind: "marked" as const, emoji: object.emoji, mark: option.mark },
    })),
    answer: verb.mark,
    columns: 3,
    explainPl: `„${verb.en}” = ${verb.pl}.`,
  };
}

function meaningChoice(item: MeaningItem, index: number): Exercise {
  return {
    id: `meaning-${index}`,
    kind: "choice",
    exercise: "worksheet-meaning",
    item: item.en,
    heading: "Co każe zrobić to polecenie?",
    promptEn: item.en,
    sound: say(item.en),
    options: shuffle([item.answerPl, ...item.wrongPl]).map((option) => ({ id: option, label: option })),
    answer: item.answerPl,
    columns: 1,
    explainPl: item.explainPl,
  };
}

function orderNumbers(): Exercise {
  const values = pickSome([12, 21, 102, 120, 45, 54, 99, 109, 190, 36, 63], 4);
  const sorted = [...values].sort((a, b) => a - b);
  const prompt = "Put these numbers in order, starting with the smallest.";
  return {
    id: "order-numbers",
    kind: "order",
    exercise: "worksheet-order",
    item: sorted.join(","),
    heading: "Zrób to, co każe polecenie",
    promptEn: prompt,
    sound: say(prompt),
    items: sorted.map((value) => ({ id: String(value), label: String(value) })),
    explainPl: `Od najmniejszej: ${sorted.join(" → ")}. Uważaj na liczby z tych samych cyfr (21 i 12, 102 i 120).`,
  };
}

function roundTyped(): Exercise {
  const value = 11 + Math.floor(Math.random() * 88);
  const rounded = Math.round(value / 10) * 10;
  const prompt = `Round ${value} to the nearest ten.`;
  return {
    id: "round",
    kind: "typed",
    exercise: "worksheet-round",
    item: String(value),
    heading: "Zrób to, co każe polecenie",
    promptEn: prompt,
    sound: say(prompt),
    answer: rounded,
    revealText: `${value} → ${rounded}`,
    explainPl:
      value % 10 === 0
        ? `${value} to już pełna dziesiątka — po zaokrągleniu zostaje ${value}.`
        : value % 10 === 5
          ? `Piątka na końcu zaokrągla się w górę: ${value} → ${rounded}.`
          : `${value} leży bliżej ${rounded} niż ${rounded === Math.floor(value / 10) * 10 ? rounded + 10 : rounded - 10}.`,
  };
}

function worksheetSession(): Exercise[] {
  const learn: Exercise = {
    id: "worksheet-learn",
    kind: "learn",
    exercise: "learn",
    item: "mark-verbs",
    heading: "Polecenia na kartce",
    bodyPl:
      "Na angielskich kartkach polecenie stoi na początku zdania — zwykle jedno słowo (Tick, Circle, Underline, Colour), czasem dwa (Cross out). Zobacz, co każde każe zrobić ołówkiem:",
    examples: MARK_VERBS.map((verb) => ({
      en: `${verb.en} the star.`,
      pl: verb.pl,
      visual: { kind: "marked" as const, emoji: "⭐", mark: verb.mark },
    })),
    parentPl:
      "Warto pobawić się tym na zwykłej kartce: rysujecie kilka obrazków, rodzic mówi „Circle the cat”, „Cross out the dog”, dziecko robi to ołówkiem.",
  };
  return [
    learn,
    ...pickSome(MARK_VERBS, 4).map((verb, i) => markVerbChoice(verb, i)),
    ...pickSome(WORKSHEET_MEANINGS, 4).map((item, i) => meaningChoice(item, i)),
    orderNumbers(),
    roundTyped(),
  ];
}

// --- Tematy -----------------------------------------------------------------------

export type ClassroomUnit = {
  id: string;
  titlePl: string;
  emoji: string;
  goalPl: string;
  parentIntroPl: string;
  /** Uwaga pod przyciskami startu. */
  startNotePl?: string;
  build: (mode: "solo" | "parent") => Exercise[];
};

export const CLASSROOM_UNITS: ClassroomUnit[] = [
  {
    id: "teacher-says",
    titlePl: "Co mówi nauczyciel",
    emoji: "👩‍🏫",
    goalPl: "Line up, put your hand up, eyes on me — wiem, co zrobić.",
    parentIntroPl:
      "Najważniejszy temat na pierwsze tygodnie. Dziecko może długo prawie nic nie mówić — to normalny etap nauki języka — ale musi rozumieć polecenia. W trybie z rodzicem na końcu są polecenia „w ruchu”: mówisz po angielsku, dziecko wykonuje. W domu warto używać tych zdań na co dzień („Line up for the car!”).",
    startNotePl: "Z rodzicem dochodzą polecenia „w ruchu”: rodzic mówi, dziecko wykonuje.",
    build: (mode) => commandsSession(TEACHER_SAYS, "teacher-says", mode),
  },
  {
    id: "lesson-talk",
    titlePl: "Na lekcji",
    emoji: "📚",
    goalPl: "Get your books out, talk to your partner, show me on your whiteboard.",
    parentIntroPl:
      "Rutyny angielskiej lekcji, których w polskiej szkole nie ma: tacki (trays) zamiast szuflad w ławkach, białe tabliczki (whiteboards) do pokazywania odpowiedzi, rozmowa w parach (talk partners), data i temat podkreślone linijką na początku każdej pracy.",
    startNotePl: "Z rodzicem dochodzą polecenia „w ruchu”: rodzic mówi, dziecko wykonuje.",
    build: (mode) => commandsSession(LESSON_TALK, "lesson-talk", mode),
  },
  {
    id: "worksheet",
    titlePl: "Polecenia na kartce",
    emoji: "📝",
    goalPl: "Tick, Circle, Underline, Cross out, Show your working.",
    parentIntroPl:
      "Dziecko często umie zadanie, ale robi nie to, co każe polecenie (zakreśla zamiast podkreślić, podaje sam wynik zamiast „show your working”). Te słowa są na każdej kartce i w każdym teście.",
    startNotePl: "Z rodzicem: po pierwszym ekranie z przykładami pobawcie się poleceniami na zwykłej kartce.",
    build: () => worksheetSession(),
  },
];

export function getClassroomUnit(id: string): ClassroomUnit | undefined {
  return CLASSROOM_UNITS.find((unit) => unit.id === id);
}

/** Wszystkie zdania działu — dla generatora nagrań i audytu. */
export function classroomPhrases(): string[] {
  const phrases = new Set<string>();
  [...TEACHER_SAYS, ...LESSON_TALK].forEach((command) => phrases.add(command.en));
  for (const verb of MARK_VERBS) {
    phrases.add(`${verb.en} the star.`);
    OBJECTS.forEach((object) => phrases.add(`${verb.en} the ${object.en}.`));
  }
  WORKSHEET_MEANINGS.forEach((item) => phrases.add(item.en));
  for (let value = 11; value <= 98; value++) phrases.add(`Round ${value} to the nearest ten.`);
  return [...phrases];
}
