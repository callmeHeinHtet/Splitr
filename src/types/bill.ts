import type { Prisma } from "@/generated/prisma/client";

export type FullBill = Prisma.BillGetPayload<{
  include: {
    items: { include: { assignments: true } };
    participants: { include: { assignments: true } };
  };
}>;

export type FullItem = FullBill["items"][number];
export type FullParticipant = FullBill["participants"][number];
