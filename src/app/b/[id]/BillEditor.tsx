"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import type { FullBill } from "@/types/bill";
import { computeSplit } from "@/lib/split";
import { formatMoney } from "@/lib/money";
import { isBillOwner } from "@/lib/ownership";
import DeleteBillButton from "@/components/DeleteBillButton";

type Props = { initialBill: FullBill };

type IdMap = {
  participants: Record<string, string>;
  items: Record<string, string>;
};

/** Recompute subtotal/total locally so the UI reflects edits instantly. */
function withRecomputedTotals(b: FullBill): FullBill {
  const subtotal = b.items.reduce(
    (s, it) => s + (it.price || 0) * (it.quantity || 1),
    0,
  );
  const total = subtotal + (b.tax || 0) + (b.tip || 0);
  return { ...b, subtotal, total };
}

/** Apply server's tmp→real id translations to local state without losing edits. */
function applyIdMap(current: FullBill, idMap: IdMap): FullBill {
  const pMap = idMap?.participants ?? {};
  const iMap = idMap?.items ?? {};
  if (Object.keys(pMap).length === 0 && Object.keys(iMap).length === 0) {
    return current;
  }
  return {
    ...current,
    participants: current.participants.map((p) =>
      pMap[p.id] && pMap[p.id] !== p.id ? { ...p, id: pMap[p.id] } : p,
    ),
    items: current.items.map((it) => {
      const newId = iMap[it.id] ?? it.id;
      return {
        ...it,
        id: newId,
        billId: current.id,
        assignments: it.assignments.map((a) => ({
          itemId: iMap[a.itemId] ?? a.itemId ?? newId,
          participantId: pMap[a.participantId] ?? a.participantId,
        })),
      };
    }),
  };
}

export default function BillEditor({ initialBill }: Props) {
  const router = useRouter();
  // Initial bill comes from the server with whatever the parser stored —
  // recompute totals once so the displayed Total always equals subtotal+tax+tip.
  const [bill, setBillRaw] = useState<FullBill>(() =>
    withRecomputedTotals(initialBill),
  );
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);
  const [saving, setSaving] = useState(false);

  // Friends viewing a shared link shouldn't land on the editor — bounce them
  // to the read-only summary instead.
  useEffect(() => {
    if (!isBillOwner(initialBill.id)) {
      router.replace(`/b/${initialBill.id}/summary`);
    }
  }, [initialBill.id, router]);

  const billRef = useRef(bill);
  useEffect(() => {
    billRef.current = bill;
  }, [bill]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const pendingDirty = useRef(false);

  // Wrapper that always recomputes subtotal/total locally
  const setBill = (
    update: FullBill | ((prev: FullBill) => FullBill),
  ) => {
    setBillRaw((prev) => {
      const nextRaw =
        typeof update === "function"
          ? (update as (p: FullBill) => FullBill)(prev)
          : update;
      return withRecomputedTotals(nextRaw);
    });
  };

  const split = useMemo(() => computeSplit(bill), [bill]);

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => triggerSave(), 350);
  }

  function triggerSave() {
    if (inFlight.current) {
      pendingDirty.current = true;
      return;
    }
    pendingDirty.current = false;
    inFlight.current = save().finally(() => {
      inFlight.current = null;
      if (pendingDirty.current) {
        pendingDirty.current = false;
        triggerSave();
      }
    });
  }

  async function save() {
    setSaving(true);
    try {
      const snapshot = billRef.current;
      const payload = {
        restaurant: snapshot.restaurant,
        tax: snapshot.tax,
        tip: snapshot.tip,
        items: snapshot.items.map((it) => ({
          id: it.id,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          assigneeIds: it.assignments.map((a) => a.participantId),
        })),
        participants: snapshot.participants.map((p) => ({
          id: p.id,
          name: p.name,
          payHandle: p.payHandle,
          payProvider: p.payProvider,
        })),
      };
      const res = await fetch(`/api/bills/${snapshot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail ?? errBody.error ?? "Save failed");
      }
      const data = await res.json();
      const idMap: IdMap = data.idMap ?? { participants: {}, items: {} };

      setBill((current) => applyIdMap(current, idMap));
      setSelectedParticipantId((prev) =>
        prev && idMap.participants[prev] ? idMap.participants[prev] : prev,
      );
    } catch (err) {
      console.error("[save] failed", err);
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function patchItem(
    itemId: string,
    patch: Partial<{ name: string; price: number; quantity: number }>,
  ) {
    setBill((b) => ({
      ...b,
      items: b.items.map((it) =>
        it.id === itemId ? { ...it, ...patch } : it,
      ),
    }));
    scheduleSave();
  }

  function deleteItem(itemId: string) {
    setBill((b) => ({
      ...b,
      items: b.items.filter((it) => it.id !== itemId),
    }));
    scheduleSave();
  }

  function addItem() {
    const tmpId = `tmp_item_${Math.random().toString(36).slice(2)}`;
    setBill((b) => ({
      ...b,
      items: [
        ...b.items,
        {
          id: tmpId,
          billId: b.id,
          name: "New item",
          price: 0,
          quantity: 1,
          assignments: [],
        },
      ],
    }));
    scheduleSave();
  }

  function addParticipant(name: string) {
    if (!name.trim()) return;
    const tmpId = `tmp_p_${Math.random().toString(36).slice(2)}`;
    setBill((b) => ({
      ...b,
      participants: [
        ...b.participants,
        {
          id: tmpId,
          billId: b.id,
          name: name.trim(),
          payHandle: null,
          payProvider: null,
          paid: false,
          paidAt: null,
          assignments: [],
        },
      ],
    }));
    scheduleSave();
  }

  function removeParticipant(pId: string) {
    setBill((b) => ({
      ...b,
      participants: b.participants.filter((p) => p.id !== pId),
      items: b.items.map((it) => ({
        ...it,
        assignments: it.assignments.filter((a) => a.participantId !== pId),
      })),
    }));
    if (selectedParticipantId === pId) setSelectedParticipantId(null);
    scheduleSave();
  }

  function toggleAssignment(itemId: string, participantId: string) {
    setBill((b) => {
      const item = b.items.find((it) => it.id === itemId);
      if (!item) return b;
      const isAssigned = item.assignments.some(
        (a) => a.participantId === participantId,
      );
      return {
        ...b,
        items: b.items.map((it) =>
          it.id !== itemId
            ? it
            : {
                ...it,
                assignments: isAssigned
                  ? it.assignments.filter(
                      (a) => a.participantId !== participantId,
                    )
                  : [
                      ...it.assignments,
                      { itemId: it.id, participantId },
                    ],
              },
        ),
      };
    });
    scheduleSave();
  }

  function patchTaxOrTip(field: "tax" | "tip", value: number) {
    setBill((b) => ({ ...b, [field]: value }));
    scheduleSave();
  }

  const allItemsAssigned =
    bill.items.length > 0 &&
    bill.items.every((it) => it.assignments.length > 0);
  const noParticipants = bill.participants.length === 0;
  const unassignedCount = bill.items.filter(
    (it) => it.assignments.length === 0,
  ).length;

  return (
    <main className="min-h-screen pb-[max(2rem,env(safe-area-inset-bottom))] bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-bg/85 border-b border-edge pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-dim hover:text-fg transition"
          >
            ← New
          </Link>
          <span className="font-display italic text-base text-fg truncate">
            {bill.restaurant ?? "Untitled bill"}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-faint">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors ${saving ? "bg-warn anim-pulse-soft" : "bg-fg-faint/50"}`}
            />
            {saving ? "Saving" : "Saved"}
          </span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 pt-6">
        {/* Receipt-card */}
        <article className="paper border border-edge rounded-3xl px-5 sm:px-7 py-7 shadow-[0_2px_0_var(--edge)]">
          {/* Restaurant header */}
          <div className="text-center pb-5">
            <input
              type="text"
              value={bill.restaurant ?? ""}
              placeholder="Restaurant name"
              onChange={(e) => {
                setBill((b) => ({ ...b, restaurant: e.target.value }));
                scheduleSave();
              }}
              className="field-bare w-full text-center font-display italic text-2xl sm:text-3xl tracking-tight text-fg placeholder:text-fg-faint/70"
            />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint">
              · Splitr · {bill.currency}
            </p>
          </div>

          <hr className="divide-receipt" />

          {/* Items */}
          <ul className="stagger py-4 space-y-1">
            {bill.items.length === 0 && (
              <li className="text-center py-8 text-fg-dim text-sm">
                No items yet. Add one below.
              </li>
            )}
            {bill.items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                participants={bill.participants}
                selectedParticipantId={selectedParticipantId}
                currency={bill.currency}
                onPatch={(patch) => patchItem(it.id, patch)}
                onDelete={() => deleteItem(it.id)}
                onToggleAssign={(pid) => toggleAssignment(it.id, pid)}
              />
            ))}
          </ul>

          <button
            onClick={addItem}
            className="mt-1 w-full py-3 rounded-xl border border-dashed border-edge-strong text-fg-dim text-sm hover:text-fg hover:border-fg-dim transition"
          >
            + Add item
          </button>

          <hr className="divide-receipt my-5" />

          {/* Totals */}
          <div className="space-y-2.5 num">
            <Row
              label="Subtotal"
              value={
                <span className="text-fg-dim">
                  {formatMoney(bill.subtotal, bill.currency)}
                </span>
              }
            />
            <EditableRow
              label="Tax"
              currency={bill.currency}
              value={bill.tax}
              onChange={(v) => patchTaxOrTip("tax", v)}
            />
            <EditableRow
              label="Tip"
              currency={bill.currency}
              value={bill.tip}
              onChange={(v) => patchTaxOrTip("tip", v)}
            />
          </div>

          <hr className="divide-receipt my-4" />

          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-fg-dim">
              Total
            </span>
            <span className="font-display italic text-3xl sm:text-4xl text-fg num">
              {formatMoney(bill.total, bill.currency)}
            </span>
          </div>

          {/* Bottom flourish */}
          <div className="flex justify-center mt-5">
            <span className="font-mono text-[10px] tracking-[0.4em] text-fg-faint">
              ✦ ✦ ✦
            </span>
          </div>
        </article>

        {/* Participants */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-fg-dim">
              Who's splitting?
            </h2>
            {bill.participants.length > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-faint">
                {bill.participants.length} ·{" "}
                {selectedParticipantId ? "tap items" : "tap a name first"}
              </span>
            )}
          </div>

          <ParticipantList
            participants={bill.participants}
            selectedId={selectedParticipantId}
            onSelect={setSelectedParticipantId}
            onAdd={addParticipant}
            onRemove={removeParticipant}
          />

          {bill.participants.length > 0 && unassignedCount > 0 && (
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-warn">
              {unassignedCount} unassigned · they won't be split
            </p>
          )}
        </section>

        {/* Primary CTA — sits at the end of the editing flow, not stuck to
            the viewport, so it never overlaps the participant input. */}
        <section className="mt-8">
          <Link
            href={`/b/${bill.id}/summary`}
            aria-disabled={noParticipants}
            onClick={(e) => {
              if (noParticipants) {
                e.preventDefault();
                toast.error("Add at least one person first");
              }
            }}
            className={`flex items-center justify-between gap-3 rounded-3xl px-6 py-4 transition shadow-[0_8px_30px_rgba(198,61,28,0.25)] ${
              noParticipants
                ? "bg-fg-faint/30 text-fg-faint cursor-not-allowed shadow-none"
                : "bg-accent text-white hover:brightness-110 active:scale-[0.99]"
            }`}
          >
            <div className="text-left">
              <div className="font-display italic text-lg leading-tight">
                See the split
              </div>
              <div className="text-[11px] opacity-80 font-mono uppercase tracking-[0.18em]">
                {allItemsAssigned
                  ? "Everything assigned"
                  : noParticipants
                    ? "Add someone first"
                    : `${unassignedCount} pending`}
              </div>
            </div>
            <ArrowIcon />
          </Link>
        </section>

        {/* Danger zone */}
        <section className="mt-10 pt-6 border-t border-edge">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg-faint mb-3">
            Danger zone
          </div>
          <DeleteBillButton billId={bill.id} label="Delete this bill" />
          <p className="mt-2 text-[11px] text-fg-faint leading-snug">
            Removes the bill, all items, and everyone's assignments. Personal
            share links stop working immediately.
          </p>
        </section>
      </div>

    </main>
  );
}

// =================================================================

function ItemRow({
  item,
  participants,
  selectedParticipantId,
  currency,
  onPatch,
  onDelete,
  onToggleAssign,
}: {
  item: FullBill["items"][number];
  participants: FullBill["participants"];
  selectedParticipantId: string | null;
  currency: string;
  onPatch: (
    patch: Partial<{ name: string; price: number; quantity: number }>,
  ) => void;
  onDelete: () => void;
  onToggleAssign: (participantId: string) => void;
}) {
  const assignedIds = new Set(item.assignments.map((a) => a.participantId));
  const tapToAssign = selectedParticipantId !== null;
  const isAssignedToSelected =
    selectedParticipantId !== null && assignedIds.has(selectedParticipantId);

  return (
    <li
      onClick={() => {
        if (tapToAssign) onToggleAssign(selectedParticipantId!);
      }}
      className={`-mx-2 px-2 py-2 rounded-xl transition ${
        tapToAssign
          ? `cursor-pointer ${isAssignedToSelected ? "bg-accent-soft" : "hover:bg-bg active:bg-bg"}`
          : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Inputs become non-interactive while a participant is selected so the
            entire row is one big tap target for assigning. */}
        <div
          className={`flex-1 min-w-0 flex items-center gap-2 ${
            tapToAssign ? "pointer-events-none select-none" : ""
          }`}
        >
          <input
            type="text"
            value={item.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            readOnly={tapToAssign}
            tabIndex={tapToAssign ? -1 : 0}
            className="field-bare flex-1 min-w-0 text-[15px] text-fg"
          />
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={item.quantity > 1 ? item.quantity : ""}
            placeholder="1"
            onChange={(e) =>
              onPatch({
                quantity: Math.max(1, parseInt(e.target.value || "1")),
              })
            }
            onClick={(e) => e.stopPropagation()}
            readOnly={tapToAssign}
            tabIndex={tapToAssign ? -1 : 0}
            className="field-qty text-fg-dim font-mono text-sm"
            title="Quantity"
          />
          <span className="font-mono text-fg-faint text-sm">×</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={item.price}
            onChange={(e) =>
              onPatch({ price: parseFloat(e.target.value) || 0 })
            }
            onClick={(e) => e.stopPropagation()}
            readOnly={tapToAssign}
            tabIndex={tapToAssign ? -1 : 0}
            className="field-num text-fg font-mono text-[15px]"
          />
        </div>
        {tapToAssign ? (
          <span
            aria-hidden="true"
            className={`ml-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-200 ${
              isAssignedToSelected
                ? "bg-accent border-accent text-white"
                : "border-edge-strong text-transparent"
            }`}
          >
            {/* key flips on toggle so the pop-in animation re-runs each tap */}
            <span
              key={isAssignedToSelected ? "on" : "off"}
              className={isAssignedToSelected ? "anim-pop-in" : "inline-flex"}
            >
              <CheckIcon />
            </span>
          </span>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="ml-1 text-fg-faint hover:text-accent transition w-5 h-5 flex items-center justify-center text-sm"
            aria-label="Remove item"
          >
            ×
          </button>
        )}
      </div>
      {item.assignments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
          {item.assignments.map((a) => {
            const p = participants.find((pp) => pp.id === a.participantId);
            if (!p) return null;
            return (
              <span
                key={a.participantId}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent"
              >
                · {p.name}
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-fg-dim text-sm">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function EditableRow({
  label,
  value,
  currency,
  onChange,
}: {
  label: string;
  value: number;
  currency: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-fg-dim text-sm">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-xs text-fg-faint">{currency}</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="field-num font-mono text-sm text-fg-dim w-16"
        />
      </div>
    </div>
  );
}

function ParticipantList({
  participants,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
}: {
  participants: FullBill["participants"];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draftName, setDraftName] = useState("");

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {participants.map((p) => {
          const isSelected = selectedId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(isSelected ? null : p.id)}
              className={`group flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1.5 transition ${
                isSelected
                  ? "bg-fg text-bg"
                  : "bg-bg-elev border border-edge text-fg hover:border-edge-strong"
              }`}
            >
              <span className="font-medium text-sm">{p.name}</span>
              <span
                role="button"
                aria-label="Remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(p.id);
                }}
                className={`w-5 h-5 inline-flex items-center justify-center rounded-full transition ${
                  isSelected
                    ? "hover:bg-bg/20"
                    : "text-fg-faint hover:text-accent"
                }`}
              >
                ×
              </span>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(draftName);
          setDraftName("");
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Add a person…"
          className="flex-1 bg-bg-elev border border-edge rounded-2xl px-4 py-2.5 outline-none focus:border-fg-dim transition text-sm placeholder:text-fg-faint"
        />
        <button
          type="submit"
          disabled={!draftName.trim()}
          className="px-5 rounded-2xl bg-fg text-bg text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition"
        >
          Add
        </button>
      </form>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
