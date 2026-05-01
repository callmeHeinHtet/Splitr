"use client";

import { useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { FullBill } from "@/types/bill";
import { computeSplit } from "@/lib/split";
import { buildPayLink, getProviderInfo, type PayProvider } from "@/lib/pay-links";
import { formatMoney, formatAmount } from "@/lib/money";

export default function ParticipantView({
  bill,
  participantId,
}: {
  bill: FullBill;
  participantId: string;
}) {
  const split = useMemo(() => computeSplit(bill), [bill]);
  const me = split.participants.find((p) => p.participantId === participantId);

  if (!me) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center px-5">
        <div className="text-fg-dim">This share link is no longer valid.</div>
      </main>
    );
  }

  const note = bill.restaurant
    ? `Splitr — ${bill.restaurant}`
    : "Splitr — bill split";

  const payLink = buildPayLink({
    provider: bill.payerProvider as PayProvider | null,
    handle: bill.payerHandle,
    amount: me.total,
    note,
  });

  const payerName = bill.payerName || "the bill payer";

  return (
    <main className="min-h-screen pb-[max(4rem,env(safe-area-inset-bottom))] bg-bg">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-bg/85 border-b border-edge pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-dim hover:text-fg transition"
          >
            Splitr
          </Link>
          <span className="font-display italic text-base text-fg">
            Your share
          </span>
          <span className="w-12" aria-hidden="true" />
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 pt-6 space-y-4">
        {/* Hero */}
        <div className="paper border border-edge rounded-3xl px-6 py-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint">
            {bill.restaurant ?? "Bill"}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h1 className="font-display italic text-2xl text-fg">
              Hi {me.participantName}
            </h1>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-faint">
              You owe
            </div>
            <div className="font-display italic text-3xl text-accent num">
              {formatMoney(me.total, bill.currency)}
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-dim mt-1 text-right">
            to {payerName}
          </div>
        </div>

        {/* Breakdown */}
        <article className="paper border border-edge rounded-3xl p-5 sm:p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint mb-3">
            Your items
          </div>
          <hr className="divide-receipt" />
          <ul className="my-4 space-y-1.5 num">
            {me.items.map((it, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between text-sm"
              >
                <span className="text-fg-dim">
                  {it.name}
                  {it.quantity > 1 && (
                    <span className="font-mono text-fg-faint">
                      {" "}
                      ×{it.quantity}
                    </span>
                  )}
                </span>
                <span className="font-mono text-fg">
                  {formatAmount(it.share, bill.currency)}
                </span>
              </li>
            ))}
            {me.taxShare > 0 && (
              <li className="flex items-baseline justify-between text-sm text-fg-faint">
                <span>Tax share</span>
                <span className="font-mono">
                  {formatAmount(me.taxShare, bill.currency)}
                </span>
              </li>
            )}
            {me.tipShare > 0 && (
              <li className="flex items-baseline justify-between text-sm text-fg-faint">
                <span>Tip share</span>
                <span className="font-mono">
                  {formatAmount(me.tipShare, bill.currency)}
                </span>
              </li>
            )}
          </ul>
          <hr className="divide-receipt" />
          <div className="flex items-baseline justify-between text-sm font-mono mt-3">
            <span className="text-fg-faint uppercase tracking-[0.22em] text-[10px]">
              Total
            </span>
            <span className="text-fg num">
              {formatAmount(me.total, bill.currency)}
            </span>
          </div>
        </article>

        {/* Pay action */}
        <div className="space-y-2">
          {payLink ? (
            <a
              href={payLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-4 rounded-2xl bg-accent text-white text-base font-medium hover:brightness-110 transition"
            >
              Pay {formatMoney(me.total, bill.currency)} via{" "}
              {getProviderInfo(bill.payerProvider as PayProvider).label} →
            </a>
          ) : bill.payerHandle && bill.payerProvider ? (
            <div className="paper border border-edge rounded-2xl px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-faint">
                Pay {payerName} directly
              </div>
              <div className="text-fg mt-1 text-sm">
                via {getProviderInfo(bill.payerProvider as PayProvider).label}{" "}
                —{" "}
                <span className="font-mono">
                  {getProviderInfo(bill.payerProvider as PayProvider).prefix}
                  {bill.payerHandle.replace(/^@/, "")}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center text-fg-faint text-sm italic py-2">
              {payerName} hasn't set up a payment method yet.
            </div>
          )}

          {payLink && (
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(payLink);
                toast.success("Pay link copied");
              }}
              className="w-full py-3 rounded-2xl border border-edge text-sm text-fg-dim hover:text-fg hover:border-edge-strong transition"
            >
              Copy pay link
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

