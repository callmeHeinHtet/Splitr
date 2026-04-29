"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { ParsedReceipt } from "@/types/receipt";

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
      router.push(`/b/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
      setStage("idle");
    }
  }

  const buttonLabel =
    stage === "parsing"
      ? "Reading receipt…"
      : stage === "creating"
        ? "Setting up your bill…"
        : null;

  return (
    <div className="w-full max-w-md mx-auto">
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

      {buttonLabel ? (
        <button
          disabled
          className="w-full py-6 px-8 rounded-2xl bg-black text-white text-lg font-medium shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={busy}
            className="w-full py-6 px-8 rounded-2xl bg-black text-white text-lg font-medium shadow-lg hover:bg-zinc-800 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <CameraIcon />
            <span>Snap a receipt</span>
          </button>
          <button
            onClick={() => uploadInputRef.current?.click()}
            disabled={busy}
            className="w-full py-4 px-8 rounded-2xl bg-white border border-zinc-200 text-zinc-900 text-base font-medium hover:border-zinc-400 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <UploadIcon />
            <span>Upload from gallery</span>
          </button>
        </div>
      )}
      <p className="text-center text-sm text-zinc-500 mt-4">
        JPEG / PNG, under 10MB.
      </p>
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
