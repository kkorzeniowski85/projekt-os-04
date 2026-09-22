/**
 * Generator nagrań Akademii — brytyjski głos neuronowy (en-GB-SoniaNeural)
 * z usługi mowy Microsoft Edge, ten sam co w Lidze Dźwięków.
 *
 *  - numbers/<n>.mp3   liczby słownie po brytyjsku („one hundred and five"),
 *  - facts/<a>x<b>.mp3 fakty tabliczki („seven times eight is fifty-six"),
 *  - phrases/<slug>.mp3 zdania, pytania i polecenia ze wszystkich działów.
 *
 * Teksty biorą się wprost z plików treści (lib/curriculum), więc dopisanie
 * zdania w treści + `npm run audio` = nagranie na miejscu.
 *
 * Uruchomienie:
 *   npm run audio                 # tylko brakujące pliki
 *   npm run audio -- --force      # nadpisz wszystko
 *   npm run audio -- --voice en-GB-RyanNeural
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { numbersWithAudio, numberToWords } from "../lib/curriculum/numbers.ts";
import { audioSlug } from "../lib/curriculum/slug.ts";
import { TABLES } from "../lib/curriculum/tables.ts";
import { mathsPhrases } from "../lib/curriculum/maths.ts";
import { readingPhrases } from "../lib/curriculum/reading.ts";
import { classroomPhrases } from "../lib/curriculum/classroom.ts";
import { countingPhrases } from "../lib/tables/sessions.ts";

const args = process.argv.slice(2);
const force = args.includes("--force");
const voiceArg = args.indexOf("--voice");
const VOICE = voiceArg >= 0 ? args[voiceArg + 1] : "en-GB-SoniaNeural";
const CONCURRENCY = 4;

const root = path.join(fileURLToPath(new URL("../", import.meta.url)));
const dirs = {
  numbers: path.join(root, "public", "audio", "numbers"),
  facts: path.join(root, "public", "audio", "facts"),
  phrases: path.join(root, "public", "audio", "phrases"),
};
Object.values(dirs).forEach((dir) => mkdirSync(dir, { recursive: true }));

/** Nowe połączenie na każdy plik — usługa zamyka websocket po syntezie. */
async function synthesize(text, rate) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate });
  const chunks = [];
  for await (const chunk of audioStream) chunks.push(chunk);
  tts.close?.();
  return Buffer.concat(chunks);
}

async function withRetry(label, run, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const buffer = await run();
      if (buffer.length < 500) throw new Error(`podejrzanie mały plik (${buffer.length} B)`);
      return buffer;
    } catch (error) {
      if (attempt === attempts) {
        console.error(`  ✗ ${label}: ${error.message}`);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  return null;
}

/** Zadania: [ścieżka docelowa, tekst, tempo]. */
const jobs = [];

// Liczby — wyraźnie, lekko wolniej (dziecko ma usłyszeć -teen vs -ty).
for (const n of numbersWithAudio()) {
  jobs.push([path.join(dirs.numbers, `${n}.mp3`), numberToWords(n), "-10%"]);
}

// Fakty w obu kolejnościach: 7 × 8 i 8 × 7 brzmią inaczej.
for (const a of TABLES) {
  for (const b of TABLES) {
    jobs.push([
      path.join(dirs.facts, `${a}x${b}.mp3`),
      `${numberToWords(a)} times ${numberToWords(b)} is ${numberToWords(a * b)}`,
      "-10%",
    ]);
  }
}

// Zdania — spokojne tempo lekcji, nie tempo rozmowy.
const phrases = [...new Set([...mathsPhrases(), ...readingPhrases(), ...classroomPhrases(), ...countingPhrases()])];
const slugs = new Map();
for (const text of phrases) {
  const slug = audioSlug(text);
  // Ten sam slug = te same słowa (różnią się tylko wielkością liter albo
  // kropką, np. „wash your hands" i „Wash your hands.") — jedno nagranie
  // wystarczy obu. Długie teksty mają w slugu skrót, więc tu nie ma kolizji.
  if (slugs.has(slug)) continue;
  slugs.set(slug, text);
  jobs.push([path.join(dirs.phrases, `${slug}.mp3`), text, "-12%"]);
}

const todo = jobs.filter(([target]) => force || !existsSync(target));
console.log(`Głos: ${VOICE}`);
console.log(`Nagrań w sumie: ${jobs.length} (liczby, fakty, ${phrases.length} zdań). Do zrobienia: ${todo.length}\n`);

let created = 0;
let failed = 0;
let next = 0;

async function worker() {
  while (next < todo.length) {
    const [target, text, rate] = todo[next++];
    const buffer = await withRetry(`"${text}"`, () => synthesize(text, rate));
    if (buffer) {
      writeFileSync(target, buffer);
      created++;
      if (created % 25 === 0) console.log(`  … ${created}/${todo.length}`);
    } else {
      failed++;
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\nGotowe: ${created} nowych, ${jobs.length - todo.length} już było, ${failed} błędów.`);
if (failed > 0) process.exitCode = 1;
