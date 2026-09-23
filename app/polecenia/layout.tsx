import type { Metadata } from "next";

/** Tytuł karty działu — strony działu są komponentami klienckimi bez metadanych. */
export const metadata: Metadata = { title: "Język klasy" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
