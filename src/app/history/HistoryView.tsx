"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listOwnedBills } from "@/lib/ownership";
import { formatMoney } from "@/lib/money";
import DeleteBillButton from "@/components/DeleteBillButton";

type HistoryBill = {
  id: string;
  restaurant: string | null;
  total: number;
  currency: string;
  createdAt: string;
  participants: { id: string; paid: boolean; name: string }[];
};

export default function HistoryView() {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<HistoryBill[]>([]);

  const loadBills = useCallback(async () => {
    const ids = listOwnedBills();
    if (ids.length === 0) {
      setBills([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/bills/by-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids.slice().reverse() }),
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setBills(data.bills ?? []);
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  return (
    <main className="min-h-screen pb-[max(4rem,env(safe-area-inset-bottom))] bg-bg">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-bg/85 border-b border-edge pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-dim hover:text-fg transition"
          >
            ← Home
          </Link>
          <span className="font-display italic text-base text-fg">History</span>
          <span className="w-12" aria-hidden="true" />
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 pt-6 space-y-3">
        {loading ? (
          <div className="text-center text-fg-faint py-16 font-mono text-[11px] uppercase tracking-[0.22em]">
            Loading…
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center text-fg-dim py-16">
            <div className="font-display italic text-2xl text-fg">
              No bills yet
            </div>
            <p className="mt-2 text-sm">
              Bills you create on this device show up here.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:underline underline-offset-4"
            >
              ← Snap a receipt
            </Link>
          </div>
        ) : (
          bills.map((bill) => {
            const total = bill.participants.length;
            const paid = bill.participants.filter((p) => p.paid).length;
            const settled = total > 0 && paid === total;
            const pendingNames = bill.participants
              .filter((p) => !p.paid)
              .map((p) => p.name);
            return (
              <div
                key={bill.id}
                className={`paper border rounded-3xl transition hover:border-edge-strong ${
                  settled ? "border-accent/30" : "border-edge"
                }`}
              >
                <Link
                  href={`/b/${bill.id}/summary`}
                  className="block p-5 pb-3"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="font-display italic text-xl text-fg truncate pr-3">
                      {bill.restaurant ?? "Untitled bill"}
                    </div>
                    <div className="font-mono text-xs text-fg-dim shrink-0">
                      {formatDate(new Date(bill.createdAt))}
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between text-sm">
                    <div className="text-fg-dim">
                      {total > 0 ? `${total}-way split` : "No participants"}
                    </div>
                    <div className="font-mono text-fg num">
                      {formatMoney(bill.total, bill.currency)}
                    </div>
                  </div>

                  {total > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-edge overflow-hidden">
                        <div
                          className="h-full bg-accent spring-w"
                          style={{ width: `${(paid / total) * 100}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span
                          className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
                            settled ? "text-accent" : "text-fg-faint"
                          }`}
                        >
                          {settled
                            ? "✓ Settled"
                            : `${paid} of ${total} paid`}
                        </span>
                        {!settled && pendingNames.length > 0 && (
                          <span className="text-xs text-fg-dim truncate ml-2">
                            waiting on{" "}
                            {pendingNames.slice(0, 2).join(", ")}
                            {pendingNames.length > 2
                              ? ` +${pendingNames.length - 2}`
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
                <div className="px-5 pb-3 flex justify-end">
                  <DeleteBillButton
                    billId={bill.id}
                    variant="compact"
                    redirectTo={null}
                    onDeleted={() => loadBills()}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}
