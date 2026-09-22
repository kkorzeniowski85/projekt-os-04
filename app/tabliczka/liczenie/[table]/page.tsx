import { notFound } from "next/navigation";
import { TABLES } from "@/lib/curriculum/tables";
import { CountingSession } from "./CountingSession";

export function generateStaticParams() {
  return TABLES.map((table) => ({ table: String(table) }));
}

export const dynamicParams = false;

export default async function CountingPage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const n = Number(table);
  if (!TABLES.includes(n as (typeof TABLES)[number])) notFound();
  return <CountingSession table={n} />;
}
