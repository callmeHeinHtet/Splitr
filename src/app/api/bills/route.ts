import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parsedReceiptSchema } from "@/types/receipt";

export const runtime = "nodejs";

const createBillSchema = parsedReceiptSchema.extend({
  imageUrl: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const data = createBillSchema.parse(json);

    const bill = await prisma.bill.create({
      data: {
        restaurant: data.restaurant,
        currency: data.currency,
        subtotal: data.subtotal,
        tax: data.tax,
        tip: data.tip,
        total: data.total,
        imageUrl: data.imageUrl ?? null,
        items: {
          create: data.items.map((it) => ({
            name: it.name,
            price: it.price,
            quantity: it.quantity ?? 1,
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: bill.id });
  } catch (err) {
    console.error("[/api/bills POST] error", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid bill data", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create bill" },
      { status: 500 },
    );
  }
}
