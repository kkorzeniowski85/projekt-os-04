import { notFound } from "next/navigation";
import { READING_TEXTS } from "@/lib/curriculum/reading";
import { ReadingSession } from "./ReadingSession";

export function generateStaticParams() {
  return READING_TEXTS.map((text) => ({ textId: text.id }));
}

export const dynamicParams = false;

export default async function ReadingTextPage({ params }: { params: Promise<{ textId: string }> }) {
  const { textId } = await params;
  if (!READING_TEXTS.some((text) => text.id === textId)) notFound();
  return <ReadingSession textId={textId} />;
}
