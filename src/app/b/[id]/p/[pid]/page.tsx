import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ParticipantView from "./ParticipantView";

export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id, pid } = await params;
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      items: { include: { assignments: true } },
      participants: { include: { assignments: true } },
    },
  });

  if (!bill) return notFound();
  const participant = bill.participants.find((p) => p.id === pid);
  if (!participant) return notFound();

  return <ParticipantView bill={bill} participantId={pid} />;
}
