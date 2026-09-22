/**
 * Czytanie ze zrozumieniem — treść działu GLEAM.
 *
 * Model: Simple View of Reading (rozumienie czytanego = dekodowanie ×
 * rozumienie języka). Dziecko dopiero uczy się dekodować po angielsku (Liga
 * Dźwięków), więc rozumienie ćwiczymy najpierw UCHEM: tekst czyta się sam,
 * zdanie po zdaniu, z podświetleniem. Z czasem dziecko czyta coraz więcej
 * samo — tekst jest cały czas na ekranie.
 *
 * Pytania w formatach, które dziecko zobaczy w angielskiej szkole (i w KS2
 * reading paper): „Tick one", „Find and copy", „True or false", „Number the
 * events". Sama nazwa formatu to też język klasy — dziecko musi wiedzieć, co
 * zrobić, gdy zobaczy „Find and copy one word…".
 *
 * Teksty oryginalne, osadzone w realiach angielskiej szkoły i kraju (wet play,
 * lost property, Bonfire Night, lisy w mieście), żeby przy okazji oswajały
 * nowe miejsce.
 */

import { say, type Exercise } from "@/lib/session/exercise";

/** Umiejętność, której dotyczy pytanie (wg domen KS2 reading). */
export type ReadingSkill = "retrieve" | "vocabulary" | "infer" | "sequence";

export const SKILL_LABEL: Record<ReadingSkill, string> = {
  retrieve: "wyszukanie informacji",
  vocabulary: "znaczenie słowa",
  infer: "wnioskowanie",
  sequence: "kolejność zdarzeń",
};

export type ReadingQuestion =
  | { id: string; type: "choice"; en: string; options: string[]; answer: string; skill: ReadingSkill; explainPl: string }
  | { id: string; type: "truefalse"; en: string; answer: boolean; skill: ReadingSkill; explainPl: string }
  | { id: string; type: "find"; en: string; answers: string[]; skill: ReadingSkill; explainPl: string }
  | { id: string; type: "order"; en: string; events: string[]; skill: ReadingSkill; explainPl: string };

export type ReadingText = {
  id: string;
  titleEn: string;
  titlePl: string;
  emoji: string;
  level: 1 | 2 | 3;
  genre: "story" | "information" | "instructions";
  sentences: { en: string; pl: string }[];
  questions: ReadingQuestion[];
  parentPl: string;
};

export const GENRE_LABEL: Record<ReadingText["genre"], string> = {
  story: "opowiadanie",
  information: "tekst informacyjny",
  instructions: "instrukcja",
};

export const READING_TEXTS: ReadingText[] = [
  {
    id: "new-school",
    titleEn: "Kuba's First Day",
    titlePl: "Pierwszy dzień Kuby",
    emoji: "🏫",
    level: 1,
    genre: "story",
    sentences: [
      { en: "Kuba is eight years old.", pl: "Kuba ma osiem lat." },
      { en: "He is from Poland, but now he lives in England.", pl: "Jest z Polski, ale teraz mieszka w Anglii." },
      { en: "Today is his first day at a new school.", pl: "Dziś jest jego pierwszy dzień w nowej szkole." },
      { en: "His teacher is called Miss Hill.", pl: "Jego nauczycielka nazywa się Miss Hill." },
      { en: "She has a kind smile and a red jumper.", pl: "Ma miły uśmiech i czerwony sweter." },
      { en: "At break time, a boy called Sam asks Kuba to play football.", pl: "Na przerwie chłopiec o imieniu Sam zaprasza Kubę do gry w piłkę." },
      { en: "Kuba scores a goal and everyone cheers!", pl: "Kuba strzela gola i wszyscy wiwatują!" },
      { en: "It is a good first day.", pl: "To dobry pierwszy dzień." },
    ],
    questions: [
      {
        id: "from",
        type: "choice",
        en: "Where is Kuba from?",
        options: ["Poland", "England", "Spain"],
        answer: "Poland",
        skill: "retrieve",
        explainPl: "Zdanie 2: „He is from Poland” — jest z Polski. W Anglii teraz mieszka.",
      },
      {
        id: "kind",
        type: "find",
        en: "Find and copy one word that shows Miss Hill is nice.",
        answers: ["kind"],
        skill: "vocabulary",
        explainPl: "„She has a kind smile” — kind = miły, życzliwy.",
      },
      {
        id: "football",
        type: "truefalse",
        en: "Sam asks Kuba to play football.",
        answer: true,
        skill: "retrieve",
        explainPl: "Tak — „a boy called Sam asks Kuba to play football”.",
      },
      {
        id: "sad",
        type: "truefalse",
        en: "Kuba is sad at the end of the day.",
        answer: false,
        skill: "infer",
        explainPl: "Tekst nie mówi wprost „happy”, ale: strzelił gola, wszyscy wiwatowali i „it is a good first day” — więc nie jest smutny. To wnioskowanie.",
      },
      {
        id: "order",
        type: "order",
        en: "Number the events from 1 to 4.",
        events: [
          "Kuba starts at his new school.",
          "Sam asks Kuba to play football.",
          "Kuba scores a goal.",
          "Everyone cheers.",
        ],
        skill: "sequence",
        explainPl: "Najpierw szkoła, potem zaproszenie na przerwie, gol i wiwaty.",
      },
    ],
    parentPl:
      "Dobry tekst na rozmowę o wrześniu: „What is your teacher called? Who will you play with at break time?” Kuba to chłopiec z Polski — łatwo się z nim utożsamić.",
  },
  {
    id: "hedgehogs",
    titleEn: "Hedgehogs",
    titlePl: "Jeże",
    emoji: "🦔",
    level: 1,
    genre: "information",
    sentences: [
      { en: "Hedgehogs are small animals with lots of spikes on their backs.", pl: "Jeże to małe zwierzęta z mnóstwem kolców na grzbiecie." },
      { en: "They sleep in the day and look for food at night.", pl: "W dzień śpią, a w nocy szukają jedzenia." },
      { en: "Hedgehogs eat beetles, worms and slugs.", pl: "Jeże jedzą chrząszcze, dżdżownice i ślimaki." },
      { en: "When a hedgehog is scared, it rolls into a tight ball.", pl: "Kiedy jeż się boi, zwija się w ciasną kulkę." },
      { en: "In winter, hedgehogs hibernate.", pl: "Zimą jeże zapadają w sen zimowy." },
      { en: "This means they sleep until spring.", pl: "To znaczy, że śpią aż do wiosny." },
      { en: "You might see a hedgehog in a garden in Britain.", pl: "Jeża można spotkać w ogrodzie w Wielkiej Brytanii." },
    ],
    questions: [
      {
        id: "when",
        type: "choice",
        en: "When do hedgehogs look for food?",
        options: ["at night", "in the morning", "at lunchtime"],
        answer: "at night",
        skill: "retrieve",
        explainPl: "„They sleep in the day and look for food at night.”",
      },
      {
        id: "scared",
        type: "choice",
        en: "What does a hedgehog do when it is scared?",
        options: ["It rolls into a ball.", "It runs up a tree.", "It hides in the water."],
        answer: "It rolls into a ball.",
        skill: "retrieve",
        explainPl: "„When a hedgehog is scared, it rolls into a tight ball.”",
      },
      {
        id: "eat",
        type: "find",
        en: "Find and copy one thing that hedgehogs eat.",
        answers: ["beetles", "worms", "slugs"],
        skill: "retrieve",
        explainPl: "Zdanie 3 wymienia trzy: beetles, worms, slugs — każde jest dobrą odpowiedzią.",
      },
      {
        id: "hibernate",
        type: "choice",
        en: "What does hibernate mean?",
        options: ["sleep all winter", "eat a lot of food", "go for a swim"],
        answer: "sleep all winter",
        skill: "vocabulary",
        explainPl: "Tekst sam tłumaczy trudne słowo w następnym zdaniu: „This means they sleep until spring.” Warto uczyć się szukać takiego „this means”.",
      },
      {
        id: "spikes",
        type: "truefalse",
        en: "Hedgehogs have spikes on their backs.",
        answer: true,
        skill: "retrieve",
        explainPl: "Zdanie 1: „lots of spikes on their backs”.",
      },
    ],
    parentPl:
      "Tekst informacyjny (non-fiction). Pokaż dziecku sztuczkę: trudne słowo „hibernate” tekst sam wyjaśnia zdanie dalej („This means…”). W angielskich tekstach dla dzieci to częste.",
  },
  {
    id: "wet-play",
    titleEn: "Wet Play",
    titlePl: "Przerwa w klasie",
    emoji: "🌧️",
    level: 2,
    genre: "story",
    sentences: [
      { en: "On Monday, it rained all morning.", pl: "W poniedziałek padało przez cały ranek." },
      { en: "At break time, Mr Patel said, ‘It's wet play today.’", pl: "Na przerwie pan Patel powiedział: „Dziś przerwa w klasie”." },
      { en: "That means the children stay inside the classroom.", pl: "To znaczy, że dzieci zostają w klasie." },
      { en: "Maya and Leo got out the board games.", pl: "Maya i Leo wyjęli gry planszowe." },
      { en: "Ruby drew a picture of a rainbow.", pl: "Ruby narysowała tęczę." },
      { en: "Some children read books on the carpet.", pl: "Niektóre dzieci czytały książki na dywanie." },
      { en: "When the bell rang, everyone helped to tidy up.", pl: "Kiedy zadzwonił dzwonek, wszyscy pomogli posprzątać." },
      { en: "By lunchtime, the sun was shining again.", pl: "Do obiadu znów świeciło słońce." },
    ],
    questions: [
      {
        id: "why",
        type: "choice",
        en: "Why did the children stay inside?",
        options: ["Because it was raining.", "Because it was too hot.", "Because it was lunchtime."],
        answer: "Because it was raining.",
        skill: "infer",
        explainPl: "„It rained all morning” + „wet play” — przy deszczu przerwa jest w klasie.",
      },
      {
        id: "carpet",
        type: "find",
        en: "Find and copy one word that tells you where some children read books.",
        answers: ["carpet"],
        skill: "retrieve",
        explainPl: "„Some children read books on the carpet.” W angielskiej klasie „the carpet” to ważne miejsce — tam siada się na wspólne części lekcji.",
      },
      {
        id: "rainbow",
        type: "truefalse",
        en: "Ruby drew a picture of the sun.",
        answer: false,
        skill: "retrieve",
        explainPl: "Ruby narysowała tęczę — „a rainbow”. Słońce pojawia się dopiero na końcu, na niebie.",
      },
      {
        id: "tidy",
        type: "choice",
        en: "What does tidy up mean?",
        options: ["put things away", "go outside", "have lunch"],
        answer: "put things away",
        skill: "vocabulary",
        explainPl: "„Tidy up” = posprzątać, odłożyć rzeczy na miejsce. To polecenie usłyszysz w klasie codziennie.",
      },
      {
        id: "order",
        type: "order",
        en: "Number the events from 1 to 4.",
        events: [
          "It rained all morning.",
          "Mr Patel said it was wet play.",
          "The children played inside.",
          "Everyone helped to tidy up.",
        ],
        skill: "sequence",
        explainPl: "Deszcz → ogłoszenie „wet play” → zabawa w klasie → sprzątanie po dzwonku.",
      },
    ],
    parentPl:
      "„Wet play” to angielska codzienność: w deszczowy dzień przerwa jest w klasie. Przy okazji: „the carpet” (miejsce zbiórek w klasie) i „tidy up” (sprzątanie).",
  },
  {
    id: "bonfire-night",
    titleEn: "Bonfire Night",
    titlePl: "Noc Ognisk",
    emoji: "🎆",
    level: 2,
    genre: "information",
    sentences: [
      { en: "On the fifth of November, people in Britain celebrate Bonfire Night.", pl: "Piątego listopada ludzie w Wielkiej Brytanii świętują Noc Ognisk." },
      { en: "Families wrap up warm in coats, hats and gloves.", pl: "Rodziny ubierają się ciepło w kurtki, czapki i rękawiczki." },
      { en: "They watch fireworks light up the dark sky.", pl: "Oglądają fajerwerki, które rozświetlają ciemne niebo." },
      { en: "The fireworks go bang, whizz and pop!", pl: "Fajerwerki robią bum, fiuu i pyk!" },
      { en: "Some people hold sparklers, but they must wear gloves to stay safe.", pl: "Niektórzy trzymają zimne ognie, ale muszą mieć rękawiczki, żeby było bezpiecznie." },
      { en: "Afterwards, lots of families eat hot soup or toffee apples.", pl: "Potem wiele rodzin je gorącą zupę albo jabłka w karmelu." },
    ],
    questions: [
      {
        id: "when",
        type: "choice",
        en: "When is Bonfire Night?",
        options: ["the fifth of November", "the first of January", "the twenty-fifth of December"],
        answer: "the fifth of November",
        skill: "retrieve",
        explainPl: "Pierwsze zdanie: „On the fifth of November”. Daty po angielsku mówi się „the fifth of November”.",
      },
      {
        id: "sound",
        type: "find",
        en: "Find and copy one word that is a sound a firework makes.",
        answers: ["bang", "whizz", "pop"],
        skill: "vocabulary",
        explainPl: "„Bang, whizz and pop” — słowa, które brzmią jak dźwięki (onomatopeje).",
      },
      {
        id: "gloves",
        type: "choice",
        en: "Why must people wear gloves with sparklers?",
        options: ["to stay safe", "to look smart", "to play a game"],
        answer: "to stay safe",
        skill: "retrieve",
        explainPl: "„They must wear gloves to stay safe” — żeby się nie poparzyć.",
      },
      {
        id: "morning",
        type: "truefalse",
        en: "People watch the fireworks in the morning.",
        answer: false,
        skill: "infer",
        explainPl: "Fajerwerki rozświetlają „the dark sky” — ciemne niebo, więc to wieczór, nie ranek. Tekst tego nie mówi wprost — trzeba wywnioskować.",
      },
      {
        id: "wrap",
        type: "choice",
        en: "What does wrap up warm mean?",
        options: ["put on warm clothes", "wrap a present", "go to bed early"],
        answer: "put on warm clothes",
        skill: "vocabulary",
        explainPl: "„Wrap up warm” = ubierz się ciepło. Zdanie od razu podpowiada: „in coats, hats and gloves”.",
      },
    ],
    parentPl:
      "Bonfire Night (5 listopada) to jedno z pierwszych świąt, które dziecko przeżyje w Anglii — w szkole będzie o nim mowa. „Wrap up warm!” usłyszy też od każdego rodzica na placu zabaw.",
  },
  {
    id: "lost-jumper",
    titleEn: "The Lost Jumper",
    titlePl: "Zgubiony sweter",
    emoji: "🧥",
    level: 2,
    genre: "story",
    sentences: [
      { en: "After PE, Ben could not find his school jumper.", pl: "Po WF-ie Ben nie mógł znaleźć swojego szkolnego swetra." },
      { en: "He looked under the benches and behind the door.", pl: "Szukał pod ławkami i za drzwiami." },
      { en: "It was not in his bag or on his peg.", pl: "Nie było go w torbie ani na jego wieszaku." },
      { en: "Ben felt worried, because his name was not on the label.", pl: "Ben się martwił, bo na metce nie było jego imienia." },
      { en: "His teacher said, ‘Let's check the lost property box.’", pl: "Nauczyciel powiedział: „Sprawdźmy pudło rzeczy znalezionych”." },
      { en: "The box was full of jumpers, and they all looked the same!", pl: "Pudło było pełne swetrów i wszystkie wyglądały tak samo!" },
      { en: "Then Ben saw a small blue paint mark on one sleeve.", pl: "Wtedy Ben zobaczył małą niebieską plamkę farby na jednym rękawie." },
      { en: "It was his jumper! That night, Mum wrote his name on the label.", pl: "To był jego sweter! Tego wieczoru mama napisała jego imię na metce." },
    ],
    questions: [
      {
        id: "when",
        type: "choice",
        en: "When did Ben lose his jumper?",
        options: ["after PE", "after lunch", "before school"],
        answer: "after PE",
        skill: "retrieve",
        explainPl: "Pierwsze słowa: „After PE” — po WF-ie (PE = Physical Education).",
      },
      {
        id: "felt",
        type: "find",
        en: "Find and copy one word that shows how Ben felt.",
        answers: ["worried"],
        skill: "vocabulary",
        explainPl: "„Ben felt worried” — martwił się.",
      },
      {
        id: "mark",
        type: "choice",
        en: "How did Ben know which jumper was his?",
        options: ["It had a blue paint mark.", "It had his name on the label.", "It was the biggest jumper."],
        answer: "It had a blue paint mark.",
        skill: "infer",
        explainPl: "Pułapka! Imienia na metce właśnie NIE było. Ben poznał sweter po niebieskiej plamce farby na rękawie.",
      },
      {
        id: "order",
        type: "order",
        en: "Number the events from 1 to 4.",
        events: [
          "Ben could not find his jumper.",
          "He looked under the benches.",
          "They checked the lost property box.",
          "Ben saw the paint mark.",
        ],
        skill: "sequence",
        explainPl: "Zgubił → szukał pod ławkami → pudło rzeczy znalezionych → plamka farby.",
      },
      {
        id: "label",
        type: "truefalse",
        en: "At the end, Mum wrote Ben's name on the label.",
        answer: true,
        skill: "retrieve",
        explainPl: "Ostatnie zdanie: „Mum wrote his name on the label.”",
      },
    ],
    parentPl:
      "Bardzo praktyczne: w Anglii wszyscy noszą takie same szkolne swetry, a „lost property” pęka w szwach. Podpiszcie ubrania dziecka (metki z imieniem) — i nauczcie słowa „peg” (wieszak w szatni).",
  },
  {
    id: "seaside",
    titleEn: "A Day at the Seaside",
    titlePl: "Dzień nad morzem",
    emoji: "🏖️",
    level: 3,
    genre: "story",
    sentences: [
      { en: "In the summer holidays, Aisha's family went to the seaside.", pl: "W wakacje rodzina Aishy pojechała nad morze." },
      { en: "They travelled by train, and the journey took two hours.", pl: "Jechali pociągiem, a podróż trwała dwie godziny." },
      { en: "First, Aisha and her brother built a huge sandcastle.", pl: "Najpierw Aisha i jej brat zbudowali ogromny zamek z piasku." },
      { en: "Next, they paddled in the sea, but the water was freezing!", pl: "Potem brodzili w morzu, ale woda była lodowata!" },
      { en: "At lunchtime, a cheeky seagull stole one of Dad's chips.", pl: "W porze obiadu bezczelna mewa ukradła tacie frytkę." },
      { en: "Everybody laughed, even Dad.", pl: "Wszyscy się śmiali, nawet tata." },
      { en: "In the afternoon, they bought ice creams and walked along the pier.", pl: "Po południu kupili lody i poszli spacerem po molo." },
      { en: "On the train home, Aisha fell fast asleep.", pl: "W pociągu do domu Aisha mocno zasnęła." },
    ],
    questions: [
      {
        id: "travel",
        type: "choice",
        en: "How did the family travel to the seaside?",
        options: ["by train", "by car", "by boat"],
        answer: "by train",
        skill: "retrieve",
        explainPl: "„They travelled by train.” Jeszcze jedna wskazówka na końcu: „On the train home”.",
      },
      {
        id: "cold",
        type: "find",
        en: "Find and copy one word that tells you the water was very cold.",
        answers: ["freezing"],
        skill: "vocabulary",
        explainPl: "„Freezing” = lodowaty, strasznie zimny (od „freeze” — zamarzać).",
      },
      {
        id: "cheeky",
        type: "choice",
        en: "The seagull was cheeky. What does cheeky mean here?",
        options: ["a bit naughty", "very hungry", "very big"],
        answer: "a bit naughty",
        skill: "vocabulary",
        explainPl: "„Cheeky” = bezczelny, trochę niegrzeczny (ale zabawnie). Ukradł frytkę i wszyscy się śmiali.",
      },
      {
        id: "order",
        type: "order",
        en: "Number the events from 1 to 4.",
        events: [
          "They built a sandcastle.",
          "They paddled in the sea.",
          "A seagull stole a chip.",
          "They walked along the pier.",
        ],
        skill: "sequence",
        explainPl: "Słowa-drogowskazy: First → Next → At lunchtime → In the afternoon.",
      },
      {
        id: "asleep",
        type: "choice",
        en: "Why do you think Aisha fell asleep on the train?",
        options: ["She was tired after a busy day.", "She did not like the train.", "It was early in the morning."],
        answer: "She was tired after a busy day.",
        skill: "infer",
        explainPl: "Tekst nie mówi „tired”, ale cały dzień był pełen zajęć, a jechali wieczorem do domu. Pytanie „Why do you think…?” zawsze oznacza wnioskowanie.",
      },
      {
        id: "journey",
        type: "truefalse",
        en: "The journey took two hours.",
        answer: true,
        skill: "retrieve",
        explainPl: "Zdanie 2: „the journey took two hours”.",
      },
    ],
    parentPl:
      "Zwróć uwagę na słowa porządkujące opowiadanie: First, Next, At lunchtime, In the afternoon. W angielskiej szkole dzieci same ich używają, pisząc opowiadania („time connectives”).",
  },
  {
    id: "jam-sandwich",
    titleEn: "How to Make a Jam Sandwich",
    titlePl: "Jak zrobić kanapkę z dżemem",
    emoji: "🥪",
    level: 3,
    genre: "instructions",
    sentences: [
      { en: "You will need two slices of bread, some butter, some jam, a knife and a plate.", pl: "Potrzebujesz dwóch kromek chleba, masła, dżemu, noża i talerza." },
      { en: "First, wash your hands.", pl: "Najpierw umyj ręce." },
      { en: "Next, put the two slices of bread on the plate.", pl: "Następnie połóż dwie kromki chleba na talerzu." },
      { en: "Then, spread butter on one side of each slice.", pl: "Potem posmaruj masłem jedną stronę każdej kromki." },
      { en: "After that, spread jam on top of the butter on one slice.", pl: "Następnie posmaruj dżemem masło na jednej kromce." },
      { en: "Finally, put the other slice on top, butter side down.", pl: "Na koniec połóż drugą kromkę na wierzchu, masłem do dołu." },
      { en: "Cut your sandwich in half and enjoy it!", pl: "Przekrój kanapkę na pół i smacznego!" },
    ],
    questions: [
      {
        id: "first",
        type: "choice",
        en: "What should you do first?",
        options: ["wash your hands", "spread the jam", "cut the sandwich"],
        answer: "wash your hands",
        skill: "retrieve",
        explainPl: "„First, wash your hands.” Słowo „First” pokazuje pierwszy krok.",
      },
      {
        id: "finally",
        type: "find",
        en: "Find and copy the word that tells you this is the last step.",
        answers: ["finally"],
        skill: "vocabulary",
        explainPl: "„Finally” = na koniec. Instrukcje w Anglii prowadzą takie słowa: First, Next, Then, After that, Finally.",
      },
      {
        id: "order",
        type: "order",
        en: "Number the steps from 1 to 4.",
        events: ["Wash your hands.", "Put the bread on the plate.", "Spread the butter.", "Spread the jam."],
        skill: "sequence",
        explainPl: "First → Next → Then → After that.",
      },
      {
        id: "why",
        type: "choice",
        en: "Why do you think you should wash your hands?",
        options: ["to keep the food clean", "to make the bread soft", "to make the jam sweet"],
        answer: "to keep the food clean",
        skill: "infer",
        explainPl: "Czyste ręce = czyste jedzenie. Tekst tego nie tłumaczy — trzeba pomyśleć.",
      },
      {
        id: "three",
        type: "truefalse",
        en: "You need three slices of bread.",
        answer: false,
        skill: "retrieve",
        explainPl: "„You will need two slices of bread” — dwie kromki.",
      },
    ],
    parentPl:
      "Instrukcja to w angielskiej szkole osobny gatunek, ćwiczony w Year 2–4. Najlepsza zabawa: zróbcie tę kanapkę naprawdę, a dziecko czyta (albo odtwarza) kolejne kroki po angielsku.",
  },
  {
    id: "city-foxes",
    titleEn: "Foxes in the City",
    titlePl: "Lisy w mieście",
    emoji: "🦊",
    level: 3,
    genre: "information",
    sentences: [
      { en: "Foxes are wild animals, but many of them live in towns and cities.", pl: "Lisy to dzikie zwierzęta, ale wiele z nich żyje w miastach." },
      { en: "A fox has orange fur, a white chest and a long, bushy tail.", pl: "Lis ma rude futro, białą pierś i długi, puszysty ogon." },
      { en: "In the city, foxes live in gardens, parks and even under sheds.", pl: "W mieście lisy mieszkają w ogrodach, parkach, a nawet pod szopami." },
      { en: "They are clever and can find food almost anywhere.", pl: "Są sprytne i znajdą jedzenie niemal wszędzie." },
      { en: "Sometimes they look for leftovers in rubbish bins.", pl: "Czasem szukają resztek w koszach na śmieci." },
      { en: "Foxes are nocturnal, so you are more likely to see one at night.", pl: "Lisy są nocnymi zwierzętami, więc łatwiej spotkać je w nocy." },
      { en: "A baby fox is called a cub.", pl: "Małe lisa to lisiątko (po angielsku „cub”)." },
    ],
    questions: [
      {
        id: "cub",
        type: "choice",
        en: "What is a baby fox called?",
        options: ["a cub", "a kitten", "a puppy"],
        answer: "a cub",
        skill: "retrieve",
        explainPl: "Ostatnie zdanie: „A baby fox is called a cub.”",
      },
      {
        id: "tail",
        type: "find",
        en: "Find and copy one word that describes a fox's tail.",
        answers: ["bushy", "long"],
        skill: "vocabulary",
        explainPl: "„A long, bushy tail” — long (długi) i bushy (puszysty) opisują ogon.",
      },
      {
        id: "nocturnal",
        type: "choice",
        en: "Foxes are nocturnal. What does nocturnal mean?",
        options: ["active at night", "very fast", "living in water"],
        answer: "active at night",
        skill: "vocabulary",
        explainPl: "Zdanie podpowiada samo: „nocturnal, so you are more likely to see one at night”. Słowo „so” łączy przyczynę ze skutkiem.",
      },
      {
        id: "where",
        type: "choice",
        en: "Where do foxes live in the city?",
        options: ["in gardens and parks", "in schools", "in shops"],
        answer: "in gardens and parks",
        skill: "retrieve",
        explainPl: "„Foxes live in gardens, parks and even under sheds.”",
      },
      {
        id: "bins",
        type: "truefalse",
        en: "Foxes sometimes look for food in rubbish bins.",
        answer: true,
        skill: "retrieve",
        explainPl: "„They look for leftovers in rubbish bins.” Leftovers = resztki.",
      },
      {
        id: "green",
        type: "truefalse",
        en: "Foxes have green fur.",
        answer: false,
        skill: "retrieve",
        explainPl: "„Orange fur” — rude futro.",
      },
    ],
    parentPl:
      "W angielskich miastach lisy naprawdę chodzą po ogrodach — dziecko pewnie je zobaczy. Dobre słowa na rozmowę: wild (dziki), clever (sprytny), leftovers (resztki), rubbish bin (kosz na śmieci).",
  },
];

export function getReadingText(id: string): ReadingText | undefined {
  return READING_TEXTS.find((text) => text.id === id);
}

const FORMAT_HEADING: Record<ReadingQuestion["type"], string> = {
  choice: "Tick one. — zaznacz jedną odpowiedź",
  truefalse: "True or false? — prawda czy fałsz?",
  find: "Find and copy. — znajdź i przepisz",
  order: "Number the events. — ponumeruj po kolei",
};

/** Sesja czytanki: najpierw tekst (słuchanie), potem pytania z tekstem pod ręką. */
export function buildReadingSession(text: ReadingText): Exercise[] {
  const sentencesEn = text.sentences.map((sentence) => sentence.en);
  const passage = { kind: "passage" as const, title: text.titleEn, sentences: sentencesEn };

  const screens: Exercise[] = [
    {
      id: `${text.id}-passage`,
      kind: "passage",
      exercise: "reading-listen",
      item: text.id,
      title: text.titleEn,
      sentences: text.sentences,
    },
  ];

  for (const question of text.questions) {
    const base = {
      id: `${text.id}-${question.id}`,
      item: `${text.id}:${question.id}`,
      heading: FORMAT_HEADING[question.type],
      promptEn: question.en,
      sound: say(question.en),
      explainPl: question.explainPl,
    };
    switch (question.type) {
      case "choice":
        screens.push({
          ...base,
          kind: "choice",
          exercise: `reading-${question.skill}`,
          visual: passage,
          options: question.options.map((option) => ({ id: option, label: option, sound: say(option) })),
          answer: question.answer,
          columns: 1,
          mark: "tick",
        });
        break;
      case "truefalse":
        screens.push({
          ...base,
          kind: "choice",
          exercise: `reading-${question.skill}`,
          visual: passage,
          options: [
            { id: "true", label: "True", sub: "prawda", sound: say("True") },
            { id: "false", label: "False", sub: "fałsz", sound: say("False") },
          ],
          answer: question.answer ? "true" : "false",
          columns: 2,
          mark: "tick",
        });
        break;
      case "find":
        screens.push({
          ...base,
          kind: "tapword",
          exercise: `reading-${question.skill}`,
          title: text.titleEn,
          sentences: sentencesEn,
          answers: question.answers,
        });
        break;
      case "order":
        screens.push({
          ...base,
          kind: "order",
          exercise: `reading-${question.skill}`,
          visual: passage,
          items: question.events.map((event, i) => ({ id: `e${i}`, label: event, sound: say(event) })),
        });
        break;
    }
  }
  return screens;
}

/** Wszystkie zdania działu — dla generatora nagrań i audytu. */
export function readingPhrases(): string[] {
  const phrases = new Set<string>(["True", "False"]);
  for (const text of READING_TEXTS) {
    text.sentences.forEach((sentence) => phrases.add(sentence.en));
    for (const question of text.questions) {
      phrases.add(question.en);
      if (question.type === "choice") question.options.forEach((option) => phrases.add(option));
      if (question.type === "order") question.events.forEach((event) => phrases.add(event));
    }
  }
  return [...phrases];
}
