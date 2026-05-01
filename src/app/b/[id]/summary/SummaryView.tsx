"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { FullBill } from "@/types/bill";
import { computeSplit } from "@/lib/split";
import { PAY_PROVIDERS, getProviderInfo, type PayProvider } from "@/lib/pay-links";
import { formatMoney, formatAmount } from "@/lib/money";
import { isBillOwner } from "@/lib/ownership";

export default function SummaryView({
  initialBill,
}: {
  initialBill: FullBill;
}) {
  const [bill, setBill] = useState<FullBill>(initialBill);
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    setIsOwner(isBillOwner(initialBill.id));
  }, [initialBill.id]);
  const split = useMemo(() => computeSplit(bill), [bill]);

  async function savePayer(
    payerProvider: PayProvider | null,
    payerHandle: string | null,
    payerName: string | null,
  ) {
    const next: FullBill = { ...bill, payerProvider, payerHandle, payerName };
    setBill(next);
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payerProvider, payerHandle, payerName }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  const payerReady = !!(bill.payerProvider && bill.payerHandle);

  async function togglePaid(participantId: string, paid: boolean) {
    const nextParticipants = bill.participants.map((p) =>
      p.id === participantId
        ? { ...p, paid, paidAt: paid ? new Date() : null }
        : p,
    );
    setBill({ ...bill, participants: nextParticipants });
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: nextParticipants.map((p) => ({
            id: p.id,
            name: p.name,
            payHandle: p.payHandle,
            payProvider: p.payProvider,
            paid: p.id === participantId ? paid : p.paid,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      // Roll back local state on failure
      setBill(bill);
    }
  }

  const paidCount = split.participants.filter((p) => p.paid).length;
  const collected = split.participants
    .filter((p) => p.paid)
    .reduce((s, p) => s + p.total, 0);
  const allPaid =
    split.participants.length > 0 && paidCount === split.participants.length;

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
          <span className="font-display italic text-base text-fg">
            The split
          </span>
          {isOwner ? (
            <Link
              href={`/b/${bill.id}`}
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-dim hover:text-fg transition"
            >
              Edit
            </Link>
          ) : (
            <span className="w-10" aria-hidden="true" />
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 pt-6 space-y-4">
        {/* Bill total banner */}
        <div className="paper border border-edge rounded-3xl px-6 py-5 flex items-baseline justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint">
              {bill.restaurant ?? "Bill"}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-dim mt-1">
              {bill.participants.length}-way split
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint">
              Total
            </div>
            <div className="font-display italic text-2xl text-fg num">
              {formatMoney(bill.total, bill.currency)}
            </div>
          </div>
        </div>

        {split.unassignedItemNames.length > 0 && (
          <div className="rounded-2xl bg-warn-soft border border-warn/30 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-warn">
              Unassigned items ·{" "}
              {formatMoney(split.unassignedItemsTotal, bill.currency)}
            </div>
            <div className="text-fg-dim text-sm mt-1">
              {split.unassignedItemNames.slice(0, 3).join(", ")}
              {split.unassignedItemNames.length > 3 ? "…" : ""} aren't part of
              any split.
            </div>
          </div>
        )}

        {/* Paid progress banner */}
        {split.participants.length > 0 && (
          <div
            className={`rounded-2xl px-4 py-3 border ${
              allPaid
                ? "bg-accent/10 border-accent/30"
                : "paper border-edge"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-faint">
                {allPaid ? "Settled" : "Collection progress"}
              </div>
              <div className="font-mono text-xs text-fg-dim">
                {paidCount} of {split.participants.length} paid
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-edge overflow-hidden">
              <div
                className="h-full bg-accent spring-w"
                style={{
                  width:
                    split.participants.length > 0
                      ? `${(paidCount / split.participants.length) * 100}%`
                      : "0%",
                }}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between text-sm num">
              <span className="text-fg-dim">
                Collected{" "}
                <span className="font-mono text-fg">
                  {formatMoney(collected, bill.currency)}
                </span>
              </span>
              <span className="text-fg-faint font-mono text-xs">
                of {formatMoney(bill.total, bill.currency)}
              </span>
            </div>
          </div>
        )}

        {/* Bill-payer setup — owner only */}
        {isOwner && <PayerSetup bill={bill} onSave={savePayer} />}

        {/* Friend view banner */}
        {!isOwner && (bill.payerName || bill.payerHandle) && (
          <div className="paper border border-edge rounded-3xl p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint">
              Shared with you
            </div>
            <div className="font-display italic text-lg text-fg mt-1">
              {bill.payerName || "The bill payer"} is collecting
            </div>
            <div className="text-sm text-fg-dim mt-1">
              Find your name below to see what you owe — or use the personal
              link they sent you.
            </div>
          </div>
        )}

        {/* Send-to-everyone bulk action — owner only */}
        {isOwner && split.participants.length > 0 && (
          <SendToEveryone
            billId={bill.id}
            participants={split.participants}
            currency={bill.currency}
            payerName={bill.payerName ?? null}
            restaurant={bill.restaurant ?? null}
          />
        )}

        <div className="stagger space-y-3 pt-1">
          {split.participants.map((p) => (
            <ParticipantCard
              key={p.participantId}
              billId={bill.id}
              data={p}
              currency={bill.currency}
              payerReady={payerReady}
              payerName={bill.payerName ?? null}
              restaurant={bill.restaurant ?? null}
              isOwner={isOwner}
              onTogglePaid={(paid) => togglePaid(p.participantId, paid)}
            />
          ))}
        </div>

        {split.participants.length === 0 && (
          <div className="text-center text-fg-dim py-12">
            No participants yet.{" "}
            <Link
              href={`/b/${bill.id}`}
              className="text-accent underline underline-offset-2"
            >
              Go back and add someone.
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function PayerSetup({
  bill,
  onSave,
}: {
  bill: FullBill;
  onSave: (
    provider: PayProvider | null,
    handle: string | null,
    name: string | null,
  ) => void;
}) {
  const isSet = !!(bill.payerProvider && bill.payerHandle);
  const [editing, setEditing] = useState(!isSet);
  const [provider, setProvider] = useState<PayProvider>(
    (bill.payerProvider as PayProvider) ?? "venmo",
  );
  const [handle, setHandle] = useState(bill.payerHandle ?? "");
  const [name, setName] = useState(bill.payerName ?? "");

  if (!editing) {
    const savedInfo = getProviderInfo(bill.payerProvider as PayProvider);
    const savedHandle = (bill.payerHandle ?? "").replace(/^@/, "");
    return (
      <div className="paper border border-edge rounded-3xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint">
            You're getting paid back
          </div>
          <button
            onClick={() => setEditing(true)}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-dim hover:text-fg transition"
          >
            Change
          </button>
        </div>
        <div className="font-display italic text-xl text-fg">
          {bill.payerName || "You"}
        </div>
        <div className="text-sm text-fg-dim mt-1 font-mono">
          via {savedInfo.label} ·{" "}
          <span className="text-fg">
            {savedInfo.prefix}
            {savedHandle}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="paper border border-edge rounded-3xl p-5 space-y-3">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint mb-1">
          You paid the bill
        </div>
        <div className="font-display italic text-lg text-fg">
          Where should friends send your share?
        </div>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name (optional)"
        className="w-full bg-bg border border-edge rounded-2xl px-3 py-3 text-sm outline-none focus:border-fg-dim"
      />

      <ProviderHandleField
        provider={provider}
        handle={handle}
        onProviderChange={(next) => {
          setProvider(next);
          // Clear the handle so a paypal handle doesn't accidentally stay
          // when switching to venmo (different format).
          setHandle("");
        }}
        onHandleChange={setHandle}
      />

      <div className="flex items-stretch gap-2">
        <button
          onClick={() => {
            // Always store the bare handle — no prefix, no leading @.
            const info = getProviderInfo(provider);
            const cleanHandle =
              stripPrefix(handle.trim(), info).trim() || null;
            onSave(provider, cleanHandle, name.trim() || null);
            if (cleanHandle) setEditing(false);
          }}
          disabled={!stripPrefix(handle.trim(), getProviderInfo(provider)).trim()}
          className="flex-1 py-3 rounded-2xl bg-fg text-bg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
        >
          Save
        </button>
        {isSet && (
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-3 rounded-2xl border border-edge text-sm text-fg-faint hover:text-fg-dim hover:border-edge-strong transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function ProviderHandleField({
  provider,
  handle,
  onProviderChange,
  onHandleChange,
}: {
  provider: PayProvider;
  handle: string;
  onProviderChange: (p: PayProvider) => void;
  onHandleChange: (h: string) => void;
}) {
  const info = getProviderInfo(provider);
  // Strip the prefix from the visible value so users don't double-type "@@john"
  // or "paypal.me/paypal.me/john" if they paste the full thing.
  const visibleHandle = stripPrefix(handle, info);

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as PayProvider)}
          className="bg-bg border border-edge rounded-2xl px-3 py-3 text-sm focus:border-fg-dim outline-none min-w-[7rem]"
        >
          {PAY_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <div
          className={`flex-1 min-w-0 flex items-stretch border border-edge rounded-2xl bg-bg overflow-hidden focus-within:border-fg-dim transition-colors`}
        >
          {info.prefix && (
            <span className="flex items-center pl-3 pr-1 font-mono text-xs text-fg-faint shrink-0 select-none">
              {info.prefix}
            </span>
          )}
          <input
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={visibleHandle}
            onChange={(e) => onHandleChange(e.target.value)}
            placeholder={info.placeholder}
            aria-label={`${info.label} handle`}
            className={`flex-1 min-w-0 bg-transparent ${info.prefix ? "pl-1 pr-3" : "px-3"} py-3 text-sm outline-none`}
          />
        </div>
      </div>
      <p className="text-[11px] text-fg-faint leading-snug pl-1">{info.hint}</p>
    </div>
  );
}

function stripPrefix(handle: string, info: ReturnType<typeof getProviderInfo>) {
  if (!info.prefix) return handle;
  // Remove a leading copy of the prefix, regardless of casing/whitespace.
  const trimmed = handle.trimStart();
  const lcPrefix = info.prefix.toLowerCase();
  if (trimmed.toLowerCase().startsWith(lcPrefix)) {
    return trimmed.slice(info.prefix.length);
  }
  // Venmo: also strip a leading @ since users might type it.
  if (info.id === "venmo" && trimmed.startsWith("@")) {
    return trimmed.slice(1);
  }
  return handle;
}

function SendToEveryone({
  billId,
  participants,
  currency,
  payerName,
  restaurant,
}: {
  billId: string;
  participants: ReturnType<typeof computeSplit>["participants"];
  currency: string;
  payerName: string | null;
  restaurant: string | null;
}) {
  function buildMessage(): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const headline = restaurant
      ? `Splitr — ${restaurant}`
      : "Splitr — bill split";
    const lines = [
      headline,
      payerName
        ? `Tap your name to pay ${payerName}:`
        : "Tap your name to pay your share:",
      "",
      ...participants.map((p) => {
        const url = `${origin}/b/${billId}/p/${p.participantId}`;
        return `${p.participantName} — ${formatMoney(p.total, currency)} → ${url}`;
      }),
    ];
    return lines.join("\n");
  }

  async function send() {
    const text = buildMessage();
    const title = restaurant
      ? `Splitr — ${restaurant}`
      : "Splitr — bill split";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Group message copied — paste in your chat");
      }
    } catch {
      /* user cancelled */
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(buildMessage());
    toast.success("Group message copied");
  }

  return (
    <div className="paper border border-edge rounded-3xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint">
            Send to everyone
          </div>
          <div className="font-display italic text-lg text-fg">
            One message, all {participants.length} links
          </div>
        </div>
      </div>
      <div className="flex items-stretch gap-2">
        <button
          onClick={send}
          className="flex-1 py-3 rounded-2xl bg-fg text-bg text-sm font-medium hover:opacity-90 transition"
        >
          Share group message
        </button>
        <button
          onClick={copy}
          className="px-4 py-3 rounded-2xl border border-edge text-sm text-fg-dim hover:text-fg hover:border-edge-strong transition"
        >
          Copy
        </button>
      </div>
      <div className="text-xs text-fg-faint mt-2">
        Paste into your group chat — each person taps their own name to see
        their share.
      </div>
    </div>
  );
}

function ParticipantCard({
  billId,
  data,
  currency,
  payerReady,
  payerName,
  restaurant,
  isOwner,
  onTogglePaid,
}: {
  billId: string;
  data: ReturnType<typeof computeSplit>["participants"][number];
  currency: string;
  payerReady: boolean;
  payerName: string | null;
  restaurant: string | null;
  isOwner: boolean;
  onTogglePaid: (paid: boolean) => void;
}) {
  return (
    <article
      className={`paper border rounded-3xl p-5 sm:p-6 transition-all duration-500 ${
        data.paid ? "border-accent/40 opacity-70" : "border-edge opacity-100"
      }`}
    >
      <div className="flex items-baseline justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <h3
            className={`font-display italic text-2xl transition-colors duration-300 ${
              data.paid ? "text-fg-dim line-through" : "text-fg"
            }`}
          >
            {data.participantName}
          </h3>
          {data.paid && (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent anim-pop-in">
              ✓ Paid
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint">
            {data.paid ? "Settled" : "Owes"}
          </div>
          <div
            className={`font-display italic text-2xl num transition-colors duration-300 ${
              data.paid ? "text-fg-dim" : "text-accent"
            }`}
          >
            {formatMoney(data.total, currency)}
          </div>
        </div>
      </div>

      <hr className="divide-receipt" />

      <ul className="my-4 space-y-1.5 num">
        {data.items.map((it, i) => (
          <li key={i} className="flex items-baseline justify-between text-sm">
            <span className="text-fg-dim">
              {it.name}
              {it.quantity > 1 && (
                <span className="font-mono text-fg-faint"> ×{it.quantity}</span>
              )}
            </span>
            <span className="font-mono text-fg">
              {formatAmount(it.share, currency)}
            </span>
          </li>
        ))}
        {data.taxShare > 0 && (
          <li className="flex items-baseline justify-between text-sm text-fg-faint">
            <span>Tax share</span>
            <span className="font-mono">
              {formatAmount(data.taxShare, currency)}
            </span>
          </li>
        )}
        {data.tipShare > 0 && (
          <li className="flex items-baseline justify-between text-sm text-fg-faint">
            <span>Tip share</span>
            <span className="font-mono">
              {formatAmount(data.tipShare, currency)}
            </span>
          </li>
        )}
      </ul>

      {!isOwner ? null : data.paid ? (
        <div className="flex items-stretch gap-2 pt-1">
          <button
            onClick={() => onTogglePaid(false)}
            className="flex-1 py-3 rounded-2xl border border-edge text-sm text-fg-dim hover:text-fg hover:border-edge-strong transition"
          >
            Mark unpaid
          </button>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          <SendLinkRow
            billId={billId}
            participantId={data.participantId}
            participantName={data.participantName}
            amount={data.total}
            currency={currency}
            payerReady={payerReady}
            payerName={payerName}
            restaurant={restaurant}
          />
          <button
            onClick={() => onTogglePaid(true)}
            className="w-full py-3 rounded-2xl border border-accent/40 text-sm text-accent hover:bg-accent/10 transition"
          >
            ✓ Mark {data.participantName} paid
          </button>
        </div>
      )}
    </article>
  );
}

function SendLinkRow({
  billId,
  participantId,
  participantName,
  amount,
  currency,
  payerReady,
  payerName,
  restaurant,
}: {
  billId: string;
  participantId: string;
  participantName: string;
  amount: number;
  currency: string;
  payerReady: boolean;
  payerName: string | null;
  restaurant: string | null;
}) {
  const personalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/b/${billId}/p/${participantId}`
      : "";

  const shareTitle = restaurant
    ? `Splitr — ${restaurant}`
    : "Splitr — bill split";

  const initialText = `Hey ${participantName}, your share is ${formatMoney(amount, currency)}${
    payerName ? ` to ${payerName}` : ""
  }. Pay here:`;

  const reminderText = `Hey ${participantName}, gentle reminder — you still owe ${formatMoney(amount, currency)}${
    payerName ? ` to ${payerName}` : ""
  }${restaurant ? ` for ${restaurant}` : ""}. Pay here:`;

  async function shareWith(text: string, fallbackToast: string) {
    const data = { title: shareTitle, text, url: personalUrl };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(`${text} ${personalUrl}`);
        toast.success(fallbackToast);
      }
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <div className="space-y-2 pt-1">
      {!payerReady && (
        <div className="text-xs text-fg-faint italic">
          Set your payment info above to enable a pay button on their page.
        </div>
      )}
      <div className="flex items-stretch gap-2">
        <button
          onClick={() => shareWith(initialText, "Link copied")}
          className="flex-1 py-3 rounded-2xl bg-accent text-white text-sm font-medium hover:brightness-110 transition"
        >
          Send link to {participantName}
        </button>
        <button
          onClick={() => shareWith(reminderText, "Reminder copied")}
          className="px-4 py-3 rounded-2xl border border-edge text-sm text-fg-dim hover:text-fg hover:border-edge-strong transition"
          aria-label="Send a reminder"
          title="Send a reminder"
        >
          Remind
        </button>
      </div>
    </div>
  );
}

