import { z } from "zod";

export const parsedReceiptSchema = z.object({
  restaurant: z
    .string()
    .nullable()
    .describe("Name of the restaurant or vendor, if visible"),
  currency: z
    .string()
    .default("USD")
    .describe("3-letter ISO currency code (USD, EUR, THB, etc.)"),
  items: z
    .array(
      z.object({
        name: z.string().describe("Item name as printed on receipt"),
        price: z
          .number()
          .describe("Unit price for one of this item, NOT line total"),
        quantity: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("Quantity ordered (default 1 if not shown)"),
      }),
    )
    .describe("Line items ordered. Skip discounts, tax, tip, and totals."),
  tax: z.number().default(0).describe("Tax amount, 0 if not shown"),
  tip: z.number().default(0).describe("Tip/service charge, 0 if not shown"),
  subtotal: z
    .number()
    .describe("Sum of items before tax and tip. If not printed, compute it."),
  total: z.number().describe("Final total charged to the customer"),
});

export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>;
