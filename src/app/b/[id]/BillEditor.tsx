"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { FullBill } from "@/types/bill";
import { computeSplit } from "@/lib/split";

type Props = { initialBill: FullBill };

export default function BillEditor({ initialBill }: Props) {
  const [bill, setBill] = useState<FullBill>(initialBill);
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const split = useMemo(() => computeSplit(bill), [bill]);

  // Debounced save
  function scheduleSave(next: FullBill) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(next), 350);
  }

  async function save(next: FullBill) {
    setSaving(true);
    try {
      const payload = {
        restaurant: next.restaurant,
        tax: next.tax,
        tip: next.tip,
        items: next.items.map((it) => ({
          id: it.id.startsWith("tmp_") ? undefined : it.id,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          assigneeIds: it.assignments.map((a) => a.participantId),
        })),
        participants: next.participants.map((p) => ({
          id: p.id.startsWith("tmp_") ? undefined : p.id,
          name: p.name,
          payHandle: p.payHandle,
          payProvider: p.payProvider,
        })),
      };
      const res = await fetch(`/api/bills/${next.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      const fresh: FullBill = await res.json();
      setBill(fresh);
    } catch (err) {
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

  // ---------- Item handlers ----------
  function patchItem(itemId: string, patch: Partial<{ name: string; price: number; quantity: number }>) {
    const next = {
      ...bill,
      items: bill.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    };
    setBill(next);
    scheduleSave(next);
  }

  function deleteItem(itemId: string) {
    const next = {
      ...bill,
      items: bill.items.filter((it) => it.id !== itemId),
    };
    setBill(next);
    scheduleSave(next);
  }

  function addItem() {
    const tmpId = `tmp_item_${Math.random().toString(36).slice(2)}`;
    const next = {
      ...bill,
      items: [
        ...bill.items,
        {
          id: tmpId,
          billId: bill.id,
          name: "New item",
          price: 0,
          quantity: 1,
          assignments: [],
        },
      ],
    };
    setBill(next);
    scheduleSave(next);
  }

  // ---------- Participant handlers ----------
  function addParticipant(name: string) {
    if (!name.trim()) return;
    const tmpId = `tmp_p_${Math.random().toString(36).slice(2)}`;
    const next = {
      ...bill,
      participants: [
        ...bill.participants,
        {
          id: tmpId,
          billId: bill.id,
          name: name.trim(),
          payHandle: null,
          payProvider: null,
          assignments: [],
        },
      ],
    };
    setBill(next);
    scheduleSave(next);
  }

  function removeParticipant(pId: string) {
    const next = {
      ...bill,
      participants: bill.participants.filter((p) => p.id !== pId),
      items: bill.items.map((it) => ({
        ...it,
        assignments: it.assignments.filter((a) => a.participantId !== pId),
      })),
    };
    setBill(next);
    if (selectedParticipantId === pId) setSelectedParticipantId(null);
    scheduleSave(next);
  }

  // ---------- Assignment handlers ----------
  function toggleAssignment(itemId: string, participantId: string) {
    const item = bill.items.find((it) => it.id === itemId);
    if (!item) return;
    const isAssigned = item.assignments.some(
      (a) => a.participantId === participantId,
    );
    const next = {
      ...bill,
      items: bill.items.map((it) =>
        it.id !== itemId
          ? it
          : {
              ...it,
              assignments: isAssigned
                ? it.assignments.filter((a) => a.participantId !== participantId)
                : [...it.assignments, { itemId, participantId }],
            },
      ),
    };
    setBill(next);
    scheduleSave(next);
  }

  function patchTaxOrTip(field: "tax" | "tip", value: number) {
    const next = { ...bill, [field]: value };
    setBill(next);
    scheduleSave(next);
  }

  const allItemsAssigned = bill.items.every((it) => it.assignments.length > 0);
  const noParticipants = bill.participants.length === 0;

  return (
    <main className="min-h-screen pb-[max(8rem,calc(env(safe-area-inset-bottom)+8rem))]">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-zinc-50/80 border-b border-zinc-200 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="text-zinc-500 text-sm hover:text-zinc-900">
            ← New bill
          </Link>
          <div className="flex-1 mx-3 truncate text-center font-medium text-zinc-700">
            {bill.restaurant ?? "Untitled bill"}
          </div>
          <span className="text-xs text-zinc-400 w-12 text-right">
            {saving ? "Saving…" : "Saved"}
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Items */}
        <section>
          <SectionHeader title="Items" />
          <ul className="space-y-2">
            {bill.items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                participants={bill.participants}
                selectedParticipantId={selectedParticipantId}
                onPatch={(patch) => patchItem(it.id, patch)}
                onDelete={() => deleteItem(it.id)}
                onToggleAssign={(pid) => toggleAssignment(it.id, pid)}
              />
            ))}
          </ul>
          <button
            onClick={addItem}
            className="mt-3 w-full py-3 rounded-xl border border-dashed border-zinc-300 text-zinc-500 hover:bg-white hover:text-zinc-900 transition"
          >
            + Add item
          </button>
        </section>

        {/* Tax + tip */}
        <section className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3">
          <MoneyRow
            label="Subtotal"
            value={bill.subtotal}
            currency={bill.currency}
            readOnly
          />
          <MoneyRow
            label="Tax"
            value={bill.tax}
            currency={bill.currency}
            onChange={(v) => patchTaxOrTip("tax", v)}
          />
          <MoneyRow
            label="Tip"
            value={bill.tip}
            currency={bill.currency}
            onChange={(v) => patchTaxOrTip("tip", v)}
          />
          <div className="border-t border-zinc-200 pt-3">
            <MoneyRow
              label="Total"
              value={bill.total}
              currency={bill.currency}
              readOnly
              bold
            />
          </div>
        </section>

        {/* Participants */}
        <section>
          <SectionHeader title="Who's splitting?" />
          <ParticipantList
            participants={bill.participants}
            selectedId={selectedParticipantId}
            onSelect={setSelectedParticipantId}
            onAdd={addParticipant}
            onRemove={removeParticipant}
            split={split}
          />
          {bill.participants.length > 0 && !allItemsAssigned && (
            <p className="text-xs text-amber-600 mt-3">
              {selectedParticipantId
                ? "Tap items above to assign them to the selected person."
                : "Tap a person, then tap items to assign."}
            </p>
          )}
        </section>

        {/* Continue button */}
        <div className="pt-4">
          <Link
            href={`/b/${bill.id}/summary`}
            aria-disabled={noParticipants}
            onClick={(e) => {
              if (noParticipants) {
                e.preventDefault();
                toast.error("Add at least one person first");
              }
            }}
            className={`block text-center w-full py-4 rounded-2xl text-lg font-medium transition ${
              noParticipants
                ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                : "bg-black text-white hover:bg-zinc-800"
            }`}
          >
            See the split →
          </Link>
          {!allItemsAssigned && bill.items.length > 0 && (
            <p className="text-center text-xs text-zinc-500 mt-2">
              {bill.items.filter((it) => it.assignments.length === 0).length}{" "}
              item(s) still unassigned — they won't be split.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

// =================================================================

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
      {title}
    </h2>
  );
}

function ItemRow({
  item,
  participants,
  selectedParticipantId,
  onPatch,
  onDelete,
  onToggleAssign,
}: {
  item: FullBill["items"][number];
  participants: FullBill["participants"];
  selectedParticipantId: string | null;
  onPatch: (patch: Partial<{ name: string; price: number; quantity: number }>) => void;
  onDelete: () => void;
  onToggleAssign: (participantId: string) => void;
}) {
  const assignedIds = new Set(item.assignments.map((a) => a.participantId));
  const tapToAssign = selectedParticipantId !== null;

  return (
    <li
      onClick={() => {
        if (tapToAssign) onToggleAssign(selectedParticipantId!);
      }}
      className={`bg-white rounded-2xl border p-3 transition ${
        tapToAssign
          ? "border-zinc-300 cursor-pointer active:scale-[0.99]"
          : "border-zinc-200"
      } ${assignedIds.has(selectedParticipantId!) ? "ring-2 ring-black" : ""}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent outline-none text-base font-medium"
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={item.quantity > 1 ? item.quantity : ""}
          placeholder="1"
          onChange={(e) =>
            onPatch({ quantity: Math.max(1, parseInt(e.target.value || "1")) })
          }
          onClick={(e) => e.stopPropagation()}
          className="w-12 text-center bg-zinc-100 rounded-lg py-1 outline-none text-sm"
          title="Quantity"
        />
        <span className="text-zinc-400">×</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={item.price}
          onChange={(e) => onPatch({ price: parseFloat(e.target.value) || 0 })}
          onClick={(e) => e.stopPropagation()}
          className="w-20 text-right bg-zinc-100 rounded-lg py-1 px-2 outline-none tabular-nums"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 text-zinc-300 hover:text-red-500 transition w-6 h-6"
          aria-label="Remove item"
        >
          ✕
        </button>
      </div>
      {item.assignments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.assignments.map((a) => {
            const p = participants.find((pp) => pp.id === a.participantId);
            if (!p) return null;
            return (
              <span
                key={a.participantId}
                className="text-xs bg-zinc-900 text-white rounded-full px-2 py-0.5"
              >
                {p.name}
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
}

function MoneyRow({
  label,
  value,
  currency,
  readOnly,
  bold,
  onChange,
}: {
  label: string;
  value: number;
  currency: string;
  readOnly?: boolean;
  bold?: boolean;
  onChange?: (v: number) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? "text-lg font-semibold" : "text-base"
      }`}
    >
      <span className={readOnly ? "text-zinc-700" : "text-zinc-700"}>
        {label}
      </span>
      {readOnly ? (
        <span className="tabular-nums">
          {currency} {value.toFixed(2)}
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-sm">{currency}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => onChange?.(parseFloat(e.target.value) || 0)}
            className="w-24 text-right bg-zinc-100 rounded-lg py-1 px-2 outline-none tabular-nums"
          />
        </div>
      )}
    </div>
  );
}

function ParticipantList({
  participants,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  split,
}: {
  participants: FullBill["participants"];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  split: ReturnType<typeof computeSplit>;
}) {
  const [draftName, setDraftName] = useState("");

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {participants.map((p) => {
          const ps = split.participants.find((sp) => sp.participantId === p.id);
          const isSelected = selectedId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(isSelected ? null : p.id)}
              className={`flex items-center gap-2 rounded-full pl-3 pr-2 py-1.5 transition ${
                isSelected
                  ? "bg-black text-white"
                  : "bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-400"
              }`}
            >
              <span className="font-medium">{p.name}</span>
              {ps && ps.total > 0 && (
                <span
                  className={`text-xs tabular-nums ${
                    isSelected ? "text-zinc-300" : "text-zinc-500"
                  }`}
                >
                  {ps.total.toFixed(2)}
                </span>
              )}
              <span
                role="button"
                aria-label="Remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(p.id);
                }}
                className={`ml-1 w-5 h-5 inline-flex items-center justify-center rounded-full ${
                  isSelected
                    ? "hover:bg-white/20"
                    : "text-zinc-300 hover:text-red-500"
                }`}
              >
                ✕
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
          className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 outline-none focus:border-zinc-400"
        />
        <button
          type="submit"
          disabled={!draftName.trim()}
          className="px-4 rounded-xl bg-zinc-900 text-white disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </div>
  );
}
