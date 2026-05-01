"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { ParsedReceipt } from "@/types/receipt";
import { markBillOwned } from "@/lib/ownership";

export default function ReceiptUpload() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
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
        const baseMsg = err.error ?? "Failed to parse receipt";
        throw new Error(err.detail ? `${baseMsg}: ${err.detail}` : baseMsg);
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
      markBillOwned(id);
      router.push(`/b/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
      setStage("idle");
    }
  }

  if (busy) {
    return (
      <div className="paper border border-edge rounded-3xl py-10 px-6 text-center">
        <div className="inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
          <Spinner />
          {stage === "parsing" && "Reading receipt"}
          {stage === "creating" && "Setting up the bill"}
        </div>
        <p className="mt-3 text-fg-dim text-sm">
          {stage === "parsing"
            ? "Pulling out items, tax, and totals…"
            : "Almost there."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <button
        onClick={() => cameraInputRef.current?.click()}
        className="group w-full text-left rounded-3xl bg-fg text-bg px-6 py-5 flex items-center gap-4 hover:opacity-95 active:scale-[0.985] transition"
      >
        <span className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shrink-0">
          <CameraIcon />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-medium text-xl leading-snug">
            Snap a receipt
          </span>
          <span className="block text-[13px] opacity-70 mt-0.5">
            Open the camera straight away
          </span>
        </span>
        <ArrowIcon />
      </button>

      <button
        onClick={() => uploadInputRef.current?.click()}
        className="w-full text-left rounded-3xl bg-bg-elev border border-edge px-6 py-4 flex items-center gap-4 hover:border-edge-strong active:scale-[0.985] transition"
      >
        <span className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center shrink-0 text-accent">
          <UploadIcon />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-fg">Upload from gallery</span>
          <span className="block text-xs text-fg-dim mt-0.5">
            JPEG / PNG · under 10 MB
          </span>
        </span>
      </button>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-fg"
      aria-hidden="true"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-bg/60 group-hover:translate-x-0.5 transition"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </svg>
  );
}
