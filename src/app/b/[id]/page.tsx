import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BillEditor from "./BillEditor";

export default async function BillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      items: { include: { assignments: true }, orderBy: { name: "asc" } },
      participants: {
        include: { assignments: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!bill) return notFound();

  return <BillEditor initialBill={bill} />;
}
