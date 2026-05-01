"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { forgetBill } from "@/lib/ownership";

type Props = {
  billId: string;
  /** Where to send the user after a successful delete. Defaults to "/". */
  redirectTo?: string | null;
  /** Called before the redirect (used by history to refresh in place). */
  onDeleted?: () => void;
  /** Visual style. Compact variant fits inside a card; full is the editor button. */
  variant?: "compact" | "full";
  label?: string;
};

export default function DeleteBillButton({
  billId,
  redirectTo = "/",
  onDeleted,
  variant = "full",
  label = "Delete bill",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function performDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/bills/${billId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Delete failed");
      }
      forgetBill(billId);
      toast.success("Bill deleted");
      onDeleted?.();
      if (redirectTo) router.push(redirectTo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    if (variant === "compact") {
      return (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint mr-1">
            Delete?
          </span>
          <button
            onClick={performDelete}
            disabled={busy}
            className="px-3 h-8 rounded-lg bg-accent text-white text-xs font-medium hover:brightness-110 disabled:opacity-50 transition"
          >
            {busy ? "…" : "Yes"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="px-3 h-8 rounded-lg border border-edge text-xs text-fg-dim hover:text-fg hover:border-edge-strong transition"
          >
            No
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-stretch gap-2">
        <button
          onClick={performDelete}
          disabled={busy}
          className="flex-1 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 transition"
        >
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="px-5 py-3 rounded-xl border border-edge text-sm text-fg-dim hover:text-fg hover:border-edge-strong transition"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(true);
        }}
        aria-label="Delete bill"
        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-fg-faint hover:text-accent hover:bg-accent-soft transition"
      >
        <TrashIcon />
      </button>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full py-3 rounded-xl border border-edge text-sm text-fg-dim hover:text-accent hover:border-accent/50 transition"
    >
      {label}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
