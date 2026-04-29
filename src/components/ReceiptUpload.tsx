"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { ParsedReceipt } from "@/types/receipt";

export default function ReceiptUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "parsing" | "creating">("idle");

  async function handleFile(file: File) {
    setBusy(true);
    setStage("parsing");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const parseRes = await fetch("/api/parse", { method: "POST", body: fd });
      if (!parseRes.ok) {
        const err = await parseRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to parse receipt");
      }
      const parsed: ParsedReceipt = await parseRes.json();

      setStage("creating");
      const createRes = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create bill");
      }
      const { id } = await createRes.json();
      router.push(`/b/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
      setStage("idle");
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className="w-full py-6 px-8 rounded-2xl bg-black text-white text-lg font-medium shadow-lg hover:bg-zinc-800 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {stage === "idle" && "Snap a receipt"}
        {stage === "parsing" && "Reading receipt…"}
        {stage === "creating" && "Setting up your bill…"}
      </button>
      <p className="text-center text-sm text-zinc-500 mt-3">
        Photo from camera or gallery. JPEG/PNG, under 10MB.
      </p>
    </div>
  );
}
