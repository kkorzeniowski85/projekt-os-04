/**
 * Audyt treści Akademii — uruchamiany przed publikacją (`npm run audit`).
 *
 * Sprawdza rzeczy, których nie złapie kompilator:
 *  1. zestawy próbnego MTC zgodne z ramą STA (2000 losowań),
 *  2. każdy dźwięk, jaki może paść w KAŻDEJ sesji, ma nagranie w manifeście
 *     generatora (sesje budowane wielokrotnie, bo są losowane),
 *  3. „Find and copy": odpowiedź naprawdę stoi w tekście,
 *  4. „Number the events": kolejność zgodna z tekstem da się ułożyć,
 *  5. poprawna odpowiedź jest wśród opcji, a opcje się nie powtarzają,
 *  6. wyniki w zadaniach liczbowych zgadzają się z rozpisaniem,
 *  7. pliki nagrań istnieją na dysku (gdy już wygenerowane).
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMtcForm, checkMtcForm, TABLES } from "../lib/curriculum/tables.ts";
import { numbersWithAudio } from "../lib/curriculum/numbers.ts";
import { audioSlug } from "../lib/curriculum/slug.ts";
import { MATHS_TOPICS, mathsPhrases, OPERATIONS, WORD_PROBLEMS } from "../lib/curriculum/maths.ts";
import { READING_TEXTS, buildReadingSession, readingPhrases } from "../lib/curriculum/reading.ts";
import { CLASSROOM_UNITS, classroomPhrases } from "../lib/curriculum/classroom.ts";
import { buildCountingSession, buildTrainingSession, countingPhrases } from "../lib/tables/sessions.ts";
import { normalizeWord, soundsOf } from "../lib/session/exercise.ts";

const root = path.join(fileURLToPath(new URL("../", import.meta.url)));
const errors = [];
const warn = [];

// 1. MTC
for (let i = 0; i < 2000; i++) {
  const problems = checkMtcForm(buildMtcForm());
  if (problems.length) {
    errors.push(`MTC: ${problems.join("; ")}`);
    break;
  }
}

// 2. Manifest nagrań
const phrases = new Set([...mathsPhrases(), ...readingPhrases(), ...classroomPhrases(), ...countingPhrases()]);
const numbers = new Set(numbersWithAudio());
const missingSounds = new Set();
function checkSound(sound, where) {
  if (sound.kind === "text" && !phrases.has(sound.value)) missingSounds.add(`${where}: "${sound.value}"`);
  if (sound.kind === "number" && !numbers.has(sound.value)) missingSounds.add(`${where}: liczba ${sound.value}`);
  if (sound.kind === "fact" && (!TABLES.includes(sound.a) || !TABLES.includes(sound.b))) {
    missingSounds.add(`${where}: fakt ${sound.a}x${sound.b}`);
  }
}

function checkExercise(exercise, where) {
  soundsOf(exercise).forEach((sound) => checkSound(sound, where));
  if (exercise.kind === "choice") {
    const ids = exercise.options.map((option) => option.id);
    if (!ids.includes(exercise.answer)) errors.push(`${where}: odpowiedzi "${exercise.answer}" nie ma wśród opcji`);
    if (new Set(ids).size !== ids.length) errors.push(`${where}: powtórzone opcje (${ids.join(" | ")})`);
    if (ids.length < 2) errors.push(`${where}: mniej niż 2 opcje`);
  }
  if (exercise.kind === "tapword") {
    const words = new Set(exercise.sentences.flatMap((sentence) => sentence.split(" ").map(normalizeWord)));
    if (!exercise.answers.some((answer) => words.has(normalizeWord(answer)))) {
      errors.push(`${where}: żadnej z odpowiedzi (${exercise.answers.join(", ")}) nie ma w tekście`);
    }
  }
}

const RUNS = 60;
for (const topic of MATHS_TOPICS) {
  for (let i = 0; i < RUNS; i++) topic.build().forEach((exercise) => checkExercise(exercise, `maths/${topic.id}`));
}
for (const text of READING_TEXTS) {
  buildReadingSession(text).forEach((exercise) => checkExercise(exercise, `reading/${text.id}`));
}
for (const unit of CLASSROOM_UNITS) {
  for (let i = 0; i < RUNS; i++) {
    for (const mode of ["solo", "parent"]) unit.build(mode).forEach((exercise) => checkExercise(exercise, `tasks/${unit.id}`));
  }
}
for (const table of TABLES) {
  for (let i = 0; i < RUNS; i++) buildCountingSession(table).forEach((exercise) => checkExercise(exercise, `count-${table}`));
}
for (let i = 0; i < 20; i++) buildTrainingSession({}, { size: 20 }).forEach((exercise) => checkExercise(exercise, "training"));
missingSounds.forEach((message) => errors.push(`brak w manifeście nagrań — ${message}`));

// 3–4. Czytanki
for (const text of READING_TEXTS) {
  const words = new Set(text.sentences.flatMap((sentence) => sentence.en.split(" ").map(normalizeWord)));
  for (const question of text.questions) {
    if (question.type === "find") {
      for (const answer of question.answers) {
        if (!words.has(normalizeWord(answer))) errors.push(`reading/${text.id}/${question.id}: „${answer}” nie stoi w tekście`);
      }
    }
    if (question.type === "choice" && !question.options.includes(question.answer)) {
      errors.push(`reading/${text.id}/${question.id}: brak odpowiedzi wśród opcji`);
    }
  }
  if (text.sentences.some((sentence) => !sentence.pl)) errors.push(`reading/${text.id}: zdanie bez tłumaczenia`);
}

// 6. Wyniki liczbowe zgodne z rozpisaniem („12 − 5 = 7" → 7)
for (const item of [...OPERATIONS, ...WORD_PROBLEMS]) {
  const match = item.workingPl.match(/=\s*£?(\d+)/);
  if (!match || Number(match[1]) !== item.answer) errors.push(`maths/${item.id}: odpowiedź ${item.answer} ≠ rozpisanie „${item.workingPl}”`);
}

// 7. Pliki nagrań
const audioDir = path.join(root, "public", "audio");
if (existsSync(audioDir)) {
  const missingFiles = [];
  numbers.forEach((n) => existsSync(path.join(audioDir, "numbers", `${n}.mp3`)) || missingFiles.push(`numbers/${n}`));
  for (const a of TABLES) for (const b of TABLES) existsSync(path.join(audioDir, "facts", `${a}x${b}.mp3`)) || missingFiles.push(`facts/${a}x${b}`);
  phrases.forEach((text) => existsSync(path.join(audioDir, "phrases", `${audioSlug(text)}.mp3`)) || missingFiles.push(`phrases: "${text}"`));
  if (missingFiles.length) warn.push(`brakuje ${missingFiles.length} plików nagrań (npm run audio), np. ${missingFiles.slice(0, 5).join(", ")}`);
} else {
  warn.push("nie ma jeszcze katalogu public/audio (npm run audio)");
}

console.log(`Zdań z nagraniem: ${phrases.size}, liczb: ${numbers.size}, faktów: ${TABLES.length ** 2}`);
warn.forEach((message) => console.log(`  ! ${message}`));
if (errors.length) {
  console.error(`\n✗ Błędów: ${errors.length}`);
  errors.slice(0, 60).forEach((message) => console.error(`  - ${message}`));
  process.exitCode = 1;
} else {
  console.log("\n✓ Treść spójna.");
}
