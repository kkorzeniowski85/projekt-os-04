import type { MetadataRoute } from "next";

// Na GitHub Pages aplikacja stoi w podkatalogu — adresy w manifeście muszą to
// uwzględniać, inaczej instalacja na telefonie prowadzi do pustej strony.
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Build statyczny (output: export) wymaga tego wprost dla tras generowanych. */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` odróżnia instalację Akademii od Ligi Dźwięków — obie stoją na tej
    // samej domenie i bez tego telefon mógłby je potraktować jak jedną apkę.
    id: `${base}/`,
    name: "Akademia Ligi — gotowi do angielskiej szkoły",
    short_name: "Akademia Ligi",
    description:
      "Tabliczka mnożenia pod Multiplication Tables Check, matematyka po angielsku, czytanie ze zrozumieniem i język klasy",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#10163a",
    theme_color: "#10163a",
    lang: "pl",
    icons: [
      { src: `${base}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: `${base}/icon-maskable.svg`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
