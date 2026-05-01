export type PayProvider = "venmo" | "paypal" | "cashapp" | "wise" | "other";

export type PayProviderInfo = {
  id: PayProvider;
  label: string;
  /** Static text shown in front of the input so the format is unmistakable. */
  prefix: string;
  /** Placeholder inside the input. */
  placeholder: string;
  /** One-line hint shown under the input. */
  hint: string;
};

export const PAY_PROVIDERS: PayProviderInfo[] = [
  {
    id: "venmo",
    label: "Venmo",
    prefix: "@",
    placeholder: "your-username",
    hint: "Your Venmo @username — not your email. In the app: Me tab → tap your name to copy it.",
  },
  {
    id: "paypal",
    label: "PayPal",
    prefix: "paypal.me/",
    placeholder: "your-handle",
    hint: "Your PayPal.Me handle (not your email). If you haven't claimed one yet, do it free at paypal.me.",
  },
  {
    id: "cashapp",
    label: "Cash App",
    prefix: "$",
    placeholder: "yourcashtag",
    hint: "Your $cashtag — in the Cash App: profile icon → your name. Letters and numbers, no spaces.",
  },
  {
    id: "wise",
    label: "Wise",
    prefix: "",
    placeholder: "wise.com/pay/me/yourname",
    hint: "Wise has no auto-pay link, so paste your full wise.com profile URL — friends will open it manually.",
  },
  {
    id: "other",
    label: "Other",
    prefix: "",
    placeholder: "How they should pay you",
    hint: "Free-form text shown to friends. They'll need to pay you manually — no in-app link.",
  },
];

export function getProviderInfo(p: PayProvider | null | undefined): PayProviderInfo {
  return (
    PAY_PROVIDERS.find((x) => x.id === p) ??
    PAY_PROVIDERS[PAY_PROVIDERS.length - 1]
  );
}

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
