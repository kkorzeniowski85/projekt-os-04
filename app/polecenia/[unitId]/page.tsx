import { notFound } from "next/navigation";
import { CLASSROOM_UNITS } from "@/lib/curriculum/classroom";
import { ClassroomSession } from "./ClassroomSession";

export function generateStaticParams() {
  return CLASSROOM_UNITS.map((unit) => ({ unitId: unit.id }));
}

export const dynamicParams = false;

export default async function ClassroomUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  if (!CLASSROOM_UNITS.some((unit) => unit.id === unitId)) notFound();
  return <ClassroomSession unitId={unitId} />;
}
