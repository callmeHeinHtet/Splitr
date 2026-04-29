export type PayProvider = "venmo" | "paypal" | "cashapp" | "wise" | "other";

export const PAY_PROVIDERS: { id: PayProvider; label: string }[] = [
  { id: "venmo", label: "Venmo" },
  { id: "paypal", label: "PayPal" },
  { id: "cashapp", label: "Cash App" },
  { id: "wise", label: "Wise" },
  { id: "other", label: "Other" },
];

export function buildPayLink(opts: {
  provider: PayProvider | null | undefined;
  handle: string | null | undefined;
  amount: number;
  note?: string;
}): string | null {
  const { provider, handle, amount, note = "" } = opts;
  if (!provider || !handle) return null;
  const cleaned = handle.replace(/^@/, "").trim();
  const amt = amount.toFixed(2);
  const enc = encodeURIComponent(note);
  switch (provider) {
    case "venmo":
      return `https://venmo.com/${cleaned}?txn=pay&amount=${amt}&note=${enc}`;
    case "paypal":
      return `https://paypal.me/${cleaned}/${amt}`;
    case "cashapp":
      return `https://cash.app/$${cleaned}/${amt}`;
    case "wise":
      // Wise has no payment-request URL spec; link to their profile if it looks like one.
      if (cleaned.includes("wise.com")) return cleaned;
      return null;
    case "other":
    default:
      return null;
  }
}
