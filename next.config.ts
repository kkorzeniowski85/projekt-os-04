import type { NextConfig } from "next";

/**
 * Aplikacja jest hostowana na GitHub Pages, więc buduje się jako czysta statyka
 * (bez serwera Node). Wszystko, czego potrzebuje, dzieje się w przeglądarce:
 * postęp w localStorage, nagrania w IndexedDB.
 *
 * Na Pages adres to https://<użytkownik>.github.io/<repo>/, więc w buildzie
 * produkcyjnym wszystkie ścieżki muszą mieć przedrostek `/<repo>`. Lokalnie
 * (npm run dev) przedrostek jest pusty i nic się nie zmienia.
 *
 * NEXT_PUBLIC_BASE_PATH jest potrzebny osobno, bo Next dokleja basePath tylko
 * do <Link> i importowanych zasobów — nie do ścieżek budowanych w kodzie
 * (nagrania w /audio, rejestracja service workera).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
