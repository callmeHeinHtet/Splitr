import type { FullBill } from "@/types/bill";

export type ParticipantSplit = {
  participantId: string;
  participantName: string;
  payHandle: string | null;
  payProvider: string | null;
  items: { name: string; share: number; pricePerUnit: number; quantity: number }[];
  itemsTotal: number;
  taxShare: number;
  tipShare: number;
  total: number;
};

export type SplitResult = {
  unassignedItemNames: string[];
  unassignedItemsTotal: number;
  participants: ParticipantSplit[];
  grandTotal: number;
};

/**
 * Compute per-participant totals.
 *
 * - Each item's price * quantity is divided equally among its assignees.
 * - Tax and tip are distributed proportionally to each participant's items total.
 * - Floating-point rounding is reconciled at the end so the sum equals the bill total.
 */
export function computeSplit(bill: FullBill): SplitResult {
  const participants = bill.participants.map((p) => ({
    participantId: p.id,
    participantName: p.name,
    payHandle: p.payHandle,
    payProvider: p.payProvider,
    items: [] as ParticipantSplit["items"],
    itemsTotal: 0,
    taxShare: 0,
    tipShare: 0,
    total: 0,
  }));

  const byId = new Map(participants.map((p) => [p.participantId, p]));
  const unassignedItemNames: string[] = [];
  let unassignedItemsTotal = 0;

  for (const item of bill.items) {
    const lineTotal = item.price * item.quantity;
    if (item.assignments.length === 0) {
      unassignedItemNames.push(item.name);
      unassignedItemsTotal += lineTotal;
      continue;
    }
    const share = lineTotal / item.assignments.length;
    for (const a of item.assignments) {
      const p = byId.get(a.participantId);
      if (!p) continue;
      p.items.push({
        name: item.name,
        share,
        pricePerUnit: item.price,
        quantity: item.quantity,
      });
      p.itemsTotal += share;
    }
  }

  const assignedSubtotal = participants.reduce((s, p) => s + p.itemsTotal, 0);
  if (assignedSubtotal > 0) {
    for (const p of participants) {
      const ratio = p.itemsTotal / assignedSubtotal;
      p.taxShare = bill.tax * ratio;
      p.tipShare = bill.tip * ratio;
      p.total = p.itemsTotal + p.taxShare + p.tipShare;
    }
  }

  // Reconcile rounding to 2 decimals; remainder goes to the last participant.
  for (const p of participants) {
    p.itemsTotal = round2(p.itemsTotal);
    p.taxShare = round2(p.taxShare);
    p.tipShare = round2(p.tipShare);
    p.total = round2(p.total);
  }

  const expectedTotal = round2(
    bill.subtotal + bill.tax + bill.tip - unassignedItemsTotal,
  );
  const computed = round2(participants.reduce((s, p) => s + p.total, 0));
  const drift = round2(expectedTotal - computed);
  if (Math.abs(drift) >= 0.01 && participants.length > 0) {
    participants[participants.length - 1].total = round2(
      participants[participants.length - 1].total + drift,
    );
  }

  return {
    unassignedItemNames,
    unassignedItemsTotal: round2(unassignedItemsTotal),
    participants,
    grandTotal: round2(bill.total),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
