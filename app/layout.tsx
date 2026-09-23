import type { Metadata, Viewport } from "next";
import { Andika } from "next/font/google";
import { ProgressProvider } from "@/lib/progress/store";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

/**
 * Font czytelniczy (klasa `font-reading`) dla angielskiego tekstu — ten sam co
 * w Lidze Dźwięków: Andika ma jednopiętrowe „a", proste „g" i wyraźne b/d.
 * next/font wbudowuje pliki w build, więc działa offline.
 */
const andika = Andika({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-andika",
  display: "swap",
});

// Next nie dokleja basePath do tekstowych adresów ikon w metadanych.
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: { default: "Akademia Ligi", template: "%s · Akademia Ligi" },
  description:
    "Przygotowanie do angielskiej szkoły: tabliczka pod Multiplication Tables Check, matematyka po angielsku, czytanie ze zrozumieniem i język klasy",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Akademia Ligi" },
  // iOS nie bierze ikon SVG z manifestu — bez PNG ikoną na ekranie głównym
  // byłby zrzut strony.
  icons: {
    icon: [{ url: `${base}/icon.svg`, type: "image/svg+xml" }],
    apple: [{ url: `${base}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
};

// Powiększanie szczypaniem zostaje (rodzic czyta drobne teksty w panelu);
// przypadkowy zoom dwuklikiem przy szybkim stukaniu wyłącza touch-action w
// globals.css.
export const viewport: Viewport = {
  themeColor: "#10163a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`h-full ${andika.variable}`}>
      <body className="min-h-dvh antialiased">
        <ProgressProvider>
          <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
        </ProgressProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
