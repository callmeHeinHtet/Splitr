import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { parsedReceiptSchema, type ParsedReceipt } from "@/types/receipt";

const MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
] as const;

function isOverloadedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /overload|high demand|rate.?limit|429|503|unavailable|quota/i.test(msg);
}

export async function parseReceipt(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ParsedReceipt> {
  let lastErr: unknown;
  for (const modelId of MODEL_CHAIN) {
    try {
      return await callModel(modelId, imageBuffer, mimeType);
    } catch (err) {
      lastErr = err;
      if (!isOverloadedError(err)) throw err;
      console.warn(`[parseReceipt] ${modelId} overloaded, trying next model`);
    }
  }
  throw lastErr;
}

async function callModel(
  modelId: string,
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ParsedReceipt> {
  const { object } = await generateObject({
    model: google(modelId),
    schema: parsedReceiptSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract structured data from this restaurant or shop receipt photo.

OUTPUT RULES (read carefully):
- All money values are decimal numbers (NOT strings, no symbols, no thousands separators).
- Convert European decimals: "16,00" → 16.00. Convert Indian/lakh formats: "1,234.56" → 1234.56.
- Every value must be a positive number except where noted below.

ITEMS:
- One entry per ordered line item (food, drink, service).
- "price" is the price per ONE unit. If receipt shows "2 x Burger 30,00" or "Burger @ 15,00 = 30,00", price=15.00 quantity=2.
- If quantity isn't explicitly shown, assume 1.
- SKIP these — do NOT include them in the items array:
  * Discount / promo / coupon lines (often shown as negative numbers like "-26,55" or "Reserva 30%")
  * Tax / IVA / VAT / GST lines
  * Tip / service charge / propina lines
  * Subtotal, Net Total, Total lines

DISCOUNT HANDLING:
- If there's a discount, items keep their full prices. The discount only affects the final total — do NOT subtract from individual items.
- Discounts make the total < subtotal. Just record the printed total as-is.

TAX/TIP:
- "tax" — single number. May be labeled IVA, VAT, GST, Sales Tax, MwSt. 0 if not shown.
- "tip" — single number. May be labeled Service, Propina, Servicio, Gratuity. 0 if not shown.

CURRENCY:
- 3-letter ISO code. Infer from symbol (€=EUR, £=GBP, ฿=THB, ¥=JPY, $=USD by default unless context says CAD/AUD/etc.)
- For receipts with no symbol, infer from address/country (e.g., "Barcelona" → EUR, "Bangkok" → THB).

RESTAURANT:
- Name from the header. null if unclear.

SUBTOTAL / TOTAL:
- "subtotal" — items before tax/tip. If only one printed, use that. If neither, sum the items.
- "total" — what the customer actually pays. If a discount makes total != subtotal+tax+tip, record total as printed.

If the image isn't a receipt or is unreadable, return empty items array and 0 for all amounts.`,
          },
          { type: "image", image: imageBuffer, mediaType: mimeType },
        ],
      },
    ],
  });

  return object;
}

