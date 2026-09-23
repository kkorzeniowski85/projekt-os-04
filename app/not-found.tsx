import Link from "next/link";

export const metadata = { title: "Nie ma takiej strony" };

/** Stara zakładka albo adres sprzed aktualizacji — w PWA bez paska adresu to ślepy zaułek. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <p className="text-6xl" aria-hidden>
        🧭
      </p>
      <h1 className="text-3xl font-black">Nie ma takiej strony</h1>
      <p className="text-paper/75">Ten adres mógł się zmienić po aktualizacji aplikacji.</p>
      <Link
        href="/"
        className="flex min-h-16 items-center rounded-blob bg-hero-blue px-7 text-2xl font-bold text-white shadow-[0_6px_0_#1c47b3]"
      >
        ← Do Bazy
      </Link>
    </div>
  );
}
