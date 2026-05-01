import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      items: { include: { assignments: true } },
      participants: { include: { assignments: true } },
    },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  return NextResponse.json(bill);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // Cascade in schema removes items, participants, and assignments.
    await prisma.bill.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Prisma throws P2025 when the row doesn't exist — treat it as success
    // since the caller's intent (the bill is gone) is satisfied.
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ ok: true });
    }
    console.error("[/api/bills/[id] DELETE] error", err);
    return NextResponse.json(
      { error: "Failed to delete bill" },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  restaurant: z.string().nullable().optional(),
  tax: z.number().optional(),
  tip: z.number().optional(),
  payerHandle: z.string().nullable().optional(),
  payerProvider: z.string().nullable().optional(),
  payerName: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        price: z.number(),
        quantity: z.number().int().min(1).default(1),
        assigneeIds: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  participants: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        payHandle: z.string().nullable().optional(),
        payProvider: z.string().nullable().optional(),
        paid: z.boolean().optional(),
      }),
    )
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.bill.findUnique({
      where: { id },
      include: { items: true, participants: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // Maps of incoming id (real or tmp_) → real DB id (scoped outside tx so we can return them)
    const participantIdMap = new Map<string, string>();
    const itemIdMap = new Map<string, string>();

    await prisma.$transaction(
      async (tx) => {
      // Update top-level
      if (
        body.restaurant !== undefined ||
        body.tax !== undefined ||
        body.tip !== undefined ||
        body.payerHandle !== undefined ||
        body.payerProvider !== undefined ||
        body.payerName !== undefined
      ) {
        await tx.bill.update({
          where: { id },
          data: {
            restaurant: body.restaurant ?? undefined,
            tax: body.tax ?? undefined,
            tip: body.tip ?? undefined,
            payerHandle:
              body.payerHandle === undefined ? undefined : body.payerHandle,
            payerProvider:
              body.payerProvider === undefined ? undefined : body.payerProvider,
            payerName:
              body.payerName === undefined ? undefined : body.payerName,
          },
        });
      }

      // Replace participants if provided
      if (body.participants) {
        const realIncomingIds = body.participants
          .map((p) => p.id)
          .filter(
            (x): x is string =>
              typeof x === "string" && !x.startsWith("tmp_"),
          );
        await tx.participant.deleteMany({
          where: { billId: id, id: { notIn: realIncomingIds } },
        });

        // Check which "real" IDs actually still exist for this bill, so we
        // know whether to update or fall through to create. This makes the
        // route resilient to stale client IDs (race conditions, deletes from
        // other tabs, etc.) which would otherwise blow up with P2025.
        const existingIds = new Set(
          (
            await tx.participant.findMany({
              where: { billId: id, id: { in: realIncomingIds } },
              select: { id: true },
            })
          ).map((r) => r.id),
        );

        for (const p of body.participants) {
          const paidUpdate =
            p.paid === undefined
              ? {}
              : {
                  paid: p.paid,
                  paidAt: p.paid ? new Date() : null,
                };
          const isExisting =
            p.id && !p.id.startsWith("tmp_") && existingIds.has(p.id);
          if (isExisting) {
            await tx.participant.update({
              where: { id: p.id! },
              data: {
                name: p.name,
                payHandle: p.payHandle ?? null,
                payProvider: p.payProvider ?? null,
                ...paidUpdate,
              },
            });
            participantIdMap.set(p.id!, p.id!);
          } else {
            const created = await tx.participant.create({
              data: {
                billId: id,
                name: p.name,
                payHandle: p.payHandle ?? null,
                payProvider: p.payProvider ?? null,
                ...paidUpdate,
              },
              select: { id: true },
            });
            if (p.id) participantIdMap.set(p.id, created.id);
          }
        }
      }

      // Replace items if provided
      if (body.items) {
        const realIncomingItemIds = body.items
          .map((it) => it.id)
          .filter(
            (x): x is string =>
              typeof x === "string" && !x.startsWith("tmp_"),
          );
        await tx.billItem.deleteMany({
          where: { billId: id, id: { notIn: realIncomingItemIds } },
        });

        // Same defensiveness as participants — only update IDs that exist
        // for this bill, otherwise create.
        const existingItemIds = new Set(
          (
            await tx.billItem.findMany({
              where: { billId: id, id: { in: realIncomingItemIds } },
              select: { id: true },
            })
          ).map((r) => r.id),
        );

        let runningSubtotal = 0;
        for (const it of body.items) {
          let itemId: string;
          const isExisting =
            it.id && !it.id.startsWith("tmp_") && existingItemIds.has(it.id);
          if (isExisting) {
            await tx.billItem.update({
              where: { id: it.id! },
              data: {
                name: it.name,
                price: it.price,
                quantity: it.quantity,
              },
            });
            itemId = it.id!;
            itemIdMap.set(it.id!, it.id!);
          } else {
            const created = await tx.billItem.create({
              data: {
                billId: id,
                name: it.name,
                price: it.price,
                quantity: it.quantity,
              },
              select: { id: true },
            });
            itemId = created.id;
            if (it.id) itemIdMap.set(it.id, created.id);
          }
          runningSubtotal += it.price * it.quantity;

          // Sync assignments. Always go through participantIdMap — it covers
          // every participant in this payload (real and tmp_), and remaps any
          // stale real IDs that were re-created with a new id during this save.
          // Any assigneeId not in the map (e.g. references a participant that
          // was removed before reaching the server) is silently dropped.
          if (it.assigneeIds !== undefined) {
            await tx.itemAssignment.deleteMany({ where: { itemId } });
            const resolved = it.assigneeIds
              .map((pid) => participantIdMap.get(pid))
              .filter((pid): pid is string => typeof pid === "string");
            if (resolved.length > 0) {
              await tx.itemAssignment.createMany({
                data: resolved.map((pid) => ({
                  itemId,
                  participantId: pid,
                })),
                skipDuplicates: true,
              });
            }
          }
        }

        // Recompute totals
        const taxValue = body.tax ?? existing.tax;
        const tipValue = body.tip ?? existing.tip;
        await tx.bill.update({
          where: { id },
          data: {
            subtotal: runningSubtotal,
            total: runningSubtotal + taxValue + tipValue,
          },
        });
      }
      },
      { timeout: 30000, maxWait: 10000 },
    );

    const fresh = await prisma.bill.findUnique({
      where: { id },
      include: {
        items: { include: { assignments: true } },
        participants: { include: { assignments: true } },
      },
    });
    return NextResponse.json({
      ...fresh,
      idMap: {
        participants: Object.fromEntries(participantIdMap),
        items: Object.fromEntries(itemIdMap),
      },
    });
  } catch (err) {
    console.error("[/api/bills/[id] PATCH] error", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update bill" },
      { status: 500 },
    );
  }
}
