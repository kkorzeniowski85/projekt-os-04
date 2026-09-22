import { notFound } from "next/navigation";
import { MATHS_TOPICS } from "@/lib/curriculum/maths";
import { MathsSession } from "./MathsSession";

export function generateStaticParams() {
  return MATHS_TOPICS.map((topic) => ({ topicId: topic.id }));
}

export const dynamicParams = false;

export default async function MathsTopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  if (!MATHS_TOPICS.some((topic) => topic.id === topicId)) notFound();
  return <MathsSession topicId={topicId} />;
}
