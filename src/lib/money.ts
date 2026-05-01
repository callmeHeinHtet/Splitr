// Locale-aware currency formatting using Intl.NumberFormat.
// Handles zero-decimal currencies (JPY, MMK, KRW, VND...) automatically
// and falls back gracefully for unknown codes.

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string): Intl.NumberFormat {
  const code = (currency || "USD").toUpperCase();
  let f = formatterCache.get(code);
  if (f) return f;
  try {
    f = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
    });
  } catch {
    // Unknown ISO code — fall back to plain number with code prefix
    f = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  formatterCache.set(code, f);
  return f;
}

export function formatMoney(amount: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
  try {
    return getFormatter(code).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

// Just the numeric part, with the right decimals for the currency.
// Useful when you want to render the code separately for typographic reasons.
export function formatAmount(amount: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
  try {
    const parts = getFormatter(code).formatToParts(amount);
    return parts
      .filter((p) => p.type !== "currency" && p.type !== "literal")
      .map((p) => p.value)
      .join("")
      .trim();
  } catch {
    return amount.toFixed(2);
  }
}
