import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SummaryView from "./SummaryView";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      items: { include: { assignments: true } },
      participants: { include: { assignments: true } },
    },
  });

  if (!bill) return notFound();

  return <SummaryView initialBill={bill} />;
}
