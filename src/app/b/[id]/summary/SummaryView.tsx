"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { FullBill } from "@/types/bill";
import { computeSplit } from "@/lib/split";
import {
  buildPayLink,
  PAY_PROVIDERS,
  type PayProvider,
} from "@/lib/pay-links";

export default function SummaryView({ initialBill }: { initialBill: FullBill }) {
  const [bill, setBill] = useState<FullBill>(initialBill);
  const split = useMemo(() => computeSplit(bill), [bill]);

  async function savePayInfo(
    participantId: string,
    payProvider: PayProvider | null,
    payHandle: string | null,
  ) {
    const next: FullBill = {
      ...bill,
      participants: bill.participants.map((p) =>
        p.id === participantId ? { ...p, payProvider, payHandle } : p,
      ),
    };
    setBill(next);
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: next.participants.map((p) => ({
            id: p.id,
            name: p.name,
            payHandle: p.payHandle,
            payProvider: p.payProvider,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  const note = bill.restaurant
    ? `Splitr — ${bill.restaurant}`
    : "Splitr — bill split";

  return (
    <main className="min-h-screen pb-[max(8rem,calc(env(safe-area-inset-bottom)+8rem))]">
      <header className="sticky top-0 z-10 backdrop-blur bg-zinc-50/80 border-b border-zinc-200 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/b/${bill.id}`}
            className="text-zinc-500 text-sm hover:text-zinc-900"
          >
            ← Edit bill
          </Link>
          <span className="font-medium text-zinc-700">The split</span>
          <button
            onClick={async () => {
              const url = window.location.href.replace(/\/summary$/, "");
              try {
                if (navigator.share) {
                  await navigator.share({ url, title: note });
                } else {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copied");
                }
              } catch {
                /* user cancelled share */
              }
            }}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            Share
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {split.unassignedItemNames.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
            <strong>{split.unassignedItemNames.length}</strong> unassigned
            item(s) — they aren't part of any split.
          </div>
        )}

        {split.participants.map((p) => (
          <ParticipantCard
            key={p.participantId}
            data={p}
            currency={bill.currency}
            note={note}
            onSavePay={(provider, handle) =>
              savePayInfo(p.participantId, provider, handle)
            }
          />
        ))}

        {split.participants.length === 0 && (
          <div className="text-center text-zinc-500 py-12">
            No participants yet. Go back and add someone.
          </div>
        )}

        <div className="pt-2 text-center text-sm text-zinc-500 tabular-nums">
          Total: {bill.currency} {bill.total.toFixed(2)}
          {split.unassignedItemsTotal > 0 && (
            <>
              {" · "}
              <span className="text-amber-600">
                Unassigned: {bill.currency} {split.unassignedItemsTotal.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function ParticipantCard({
  data,
  currency,
  note,
  onSavePay,
}: {
  data: ReturnType<typeof computeSplit>["participants"][number];
  currency: string;
  note: string;
  onSavePay: (provider: PayProvider | null, handle: string | null) => void;
}) {
  const [editing, setEditing] = useState(
    !data.payProvider || !data.payHandle,
  );
  const [provider, setProvider] = useState<PayProvider>(
    (data.payProvider as PayProvider) ?? "venmo",
  );
  const [handle, setHandle] = useState(data.payHandle ?? "");

  const payLink = buildPayLink({
    provider: data.payProvider as PayProvider | null,
    handle: data.payHandle,
    amount: data.total,
    note,
  });

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-semibold">{data.participantName}</h3>
        <div className="text-2xl font-bold tabular-nums">
          {currency} {data.total.toFixed(2)}
        </div>
      </div>

      <ul className="text-sm text-zinc-600 space-y-1 mb-4">
        {data.items.map((it, i) => (
          <li key={i} className="flex justify-between">
            <span>
              {it.name}
              {it.quantity > 1 && (
                <span className="text-zinc-400"> ×{it.quantity}</span>
              )}
            </span>
            <span className="tabular-nums">{it.share.toFixed(2)}</span>
          </li>
        ))}
        {data.taxShare > 0 && (
          <li className="flex justify-between text-zinc-400">
            <span>Tax share</span>
            <span className="tabular-nums">{data.taxShare.toFixed(2)}</span>
          </li>
        )}
        {data.tipShare > 0 && (
          <li className="flex justify-between text-zinc-400">
            <span>Tip share</span>
            <span className="tabular-nums">{data.tipShare.toFixed(2)}</span>
          </li>
        )}
      </ul>

      {editing ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as PayProvider)}
              className="bg-zinc-100 rounded-lg px-2 py-2 outline-none text-sm"
            >
              {PAY_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="username / @handle"
              className="flex-1 bg-zinc-100 rounded-lg px-3 py-2 outline-none text-sm"
            />
            <button
              onClick={() => {
                onSavePay(provider, handle.trim() || null);
                setEditing(false);
              }}
              className="px-3 rounded-lg bg-zinc-900 text-white text-sm"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {payLink && (
            <a
              href={payLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800"
            >
              Pay via {data.payProvider}
            </a>
          )}
          <button
            onClick={async () => {
              if (!payLink) return;
              await navigator.clipboard.writeText(payLink);
              toast.success("Pay link copied");
            }}
            disabled={!payLink}
            className="px-3 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-700 disabled:opacity-40"
          >
            Copy link
          </button>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-500"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
