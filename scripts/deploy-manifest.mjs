/**
 * Manifest wdrożenia — uruchamia się sam przed buildem (`prebuild` w
 * package.json, więc `npm run build` w deploy.yml też go wywołuje).
 *
 * Zapisuje public/deploy.json: znacznik wersji i krótki hash treści każdego
 * nagrania z public/audio. Service worker (public/sw.js) porównuje go z
 * zapamiętanym przy aktywacji i przy nawigacji online. Nowa wersja = odświeża
 * powłokę offline, sprząta stare pliki _next/static i usuwa z pamięci
 * nagrania podmienione albo skasowane. Na HEAD nagrań odpowiada z manifestu,
 * bez sieci. Hash to pierwsze 12 znaków SHA-256 — sw.js liczy go tak samo.
 *
 * Plik jest generowany przy każdym buildzie, więc nie trafia do repozytorium
 * (.gitignore). Bez niego (npm run dev, build bez prebuild) service worker
 * zapomina poprzedni manifest i na HEAD nagrań znowu pyta serwer.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

/** Wszystkie pliki w katalogu (bez ukrytych, np. .gitkeep). */
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const audio = {};
for (const file of listFiles(path.join(publicDir, "audio")).sort()) {
  const name = path.relative(publicDir, file).split(path.sep).join("/");
  audio[name] = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
}

const build = process.env.NEXT_PUBLIC_BUILD_ID || new Date().toISOString();
writeFileSync(path.join(publicDir, "deploy.json"), `${JSON.stringify({ build, audio })}\n`);
console.log(`deploy.json: wersja ${build}, nagrania: ${Object.keys(audio).length}`);
