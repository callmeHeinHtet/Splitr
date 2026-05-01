// Browser-local "I created this bill" tracking. Used to gate edit / mark-paid
// controls on summary and editor pages so friends opening shared links see
// a clean, read-only view without needing accounts.
//
// Not a security boundary — anyone could write the key by hand. Real
// permissioning needs auth.

const KEY = "splitr.ownedBills";

export function markBillOwned(billId: string) {
  if (typeof window === "undefined") return;
  try {
    const set = new Set(loadList());
    set.add(billId);
    window.localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* localStorage unavailable */
  }
}

export function isBillOwner(billId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return loadList().includes(billId);
  } catch {
    return false;
  }
}

export function forgetBill(billId: string) {
  if (typeof window === "undefined") return;
  try {
    const next = loadList().filter((id) => id !== billId);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable */
  }
}

export function listOwnedBills(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return loadList();
  } catch {
    return [];
  }
}

function loadList(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}
