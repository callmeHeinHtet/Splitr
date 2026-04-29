import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { parsedReceiptSchema, type ParsedReceipt } from "@/types/receipt";

export async function parseReceipt(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ParsedReceipt> {
  const { object } = await generateObject({
    model: google("gemini-2.0-flash"),
    schema: parsedReceiptSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are extracting structured data from a restaurant or shop receipt photo.

Rules:
- Extract every line item the customer ordered. Skip discounts, tax lines, tip lines, subtotal, total.
- "price" is the price per ONE unit of the item. If the receipt shows "2 x Burger 30.00", price is 15.00 and quantity is 2.
- If quantity is not printed explicitly, assume 1.
- "tax" and "tip" are 0 if not shown on the receipt.
- "subtotal" is items before tax/tip. If not printed, sum the items.
- "total" is the final charged amount.
- "currency" is the 3-letter ISO code. Infer from currency symbol or country context.
- "restaurant" is the establishment name from the header. null if unclear.
- All money values are positive numbers (no currency symbols, no commas as thousands separators).

If the image is not a receipt or is unreadable, return empty items array and 0 for all amounts.`,
          },
          { type: "image", image: imageBuffer, mediaType: mimeType },
        ],
      },
    ],
  });

  return object;
}
