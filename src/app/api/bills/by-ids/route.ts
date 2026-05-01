import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  ids: z.array(z.string().min(1).max(64)).max(500),
});

/**
 * Returns bills matching the given ids, in the order requested.
 * Used by the history page to fetch only bills the browser claims to own
 * (via localStorage), instead of leaking the full bill list to every visitor.
 */
export async function POST(req: NextRequest) {
  try {
    const { ids } = bodySchema.parse(await req.json());
    if (ids.length === 0) {
      return NextResponse.json({ bills: [] });
    }

    const bills = await prisma.bill.findMany({
      where: { id: { in: ids } },
      include: {
        participants: {
          select: { id: true, paid: true, name: true },
        },
      },
    });

    // Preserve caller order so the most-recently-saved id stays first.
    const byId = new Map(bills.map((b) => [b.id, b]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    return NextResponse.json({ bills: ordered });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[/api/bills/by-ids] error", err);
    return NextResponse.json(
      { error: "Failed to fetch bills" },
      { status: 500 },
    );
  }
}
