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

const patchSchema = z.object({
  restaurant: z.string().nullable().optional(),
  tax: z.number().optional(),
  tip: z.number().optional(),
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

    await prisma.$transaction(async (tx) => {
      // Update top-level
      if (
        body.restaurant !== undefined ||
        body.tax !== undefined ||
        body.tip !== undefined
      ) {
        await tx.bill.update({
          where: { id },
          data: {
            restaurant: body.restaurant ?? undefined,
            tax: body.tax ?? undefined,
            tip: body.tip ?? undefined,
          },
        });
      }

      // Replace participants if provided
      if (body.participants) {
        const incomingIds = body.participants
          .map((p) => p.id)
          .filter((x): x is string => Boolean(x));
        await tx.participant.deleteMany({
          where: { billId: id, id: { notIn: incomingIds } },
        });
        for (const p of body.participants) {
          if (p.id) {
            await tx.participant.update({
              where: { id: p.id },
              data: {
                name: p.name,
                payHandle: p.payHandle ?? null,
                payProvider: p.payProvider ?? null,
              },
            });
          } else {
            await tx.participant.create({
              data: {
                billId: id,
                name: p.name,
                payHandle: p.payHandle ?? null,
                payProvider: p.payProvider ?? null,
              },
            });
          }
        }
      }

      // Replace items if provided
      if (body.items) {
        const incomingItemIds = body.items
          .map((it) => it.id)
          .filter((x): x is string => Boolean(x));
        await tx.billItem.deleteMany({
          where: { billId: id, id: { notIn: incomingItemIds } },
        });

        let runningSubtotal = 0;
        for (const it of body.items) {
          let itemId: string;
          if (it.id) {
            await tx.billItem.update({
              where: { id: it.id },
              data: {
                name: it.name,
                price: it.price,
                quantity: it.quantity,
              },
            });
            itemId = it.id;
          } else {
            const created = await tx.billItem.create({
              data: {
                billId: id,
                name: it.name,
                price: it.price,
                quantity: it.quantity,
              },
            });
            itemId = created.id;
          }
          runningSubtotal += it.price * it.quantity;

          // Sync assignments if provided
          if (it.assigneeIds !== undefined) {
            await tx.itemAssignment.deleteMany({
              where: { itemId },
            });
            if (it.assigneeIds.length > 0) {
              await tx.itemAssignment.createMany({
                data: it.assigneeIds.map((pid) => ({
                  itemId,
                  participantId: pid,
                })),
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
    });

    const fresh = await prisma.bill.findUnique({
      where: { id },
      include: {
        items: { include: { assignments: true } },
        participants: { include: { assignments: true } },
      },
    });
    return NextResponse.json(fresh);
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
