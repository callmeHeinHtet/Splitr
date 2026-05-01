import Link from "next/link";
import ReceiptUpload from "@/components/ReceiptUpload";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] bg-bg">
      {/* Top bar — small wordmark, off-axis */}
      <header className="relative z-10 flex items-center justify-between max-w-md w-full mx-auto">
        <div className="flex items-baseline gap-2">
          <span className="font-display italic text-2xl tracking-tight text-fg">
            Splitr
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
            v1
          </span>
        </div>
        <Link
          href="/history"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-dim hover:text-fg transition px-3 py-2 -mr-3"
        >
          History →
        </Link>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto -mt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-5">
          ✦ Snap → tag → send
        </p>
        <h1 className="font-display font-light text-5xl sm:text-6xl leading-[0.95] tracking-tight text-fg">
          Split a bill in
          <span className="font-display italic font-normal text-accent">
            {" "}
            thirty&nbsp;seconds.
          </span>
        </h1>
        <p className="mt-6 text-fg-dim text-base leading-relaxed max-w-sm">
          Photograph a receipt, tap who had what, send each person a pay link.
          No more thumb-typing item names into a group chat.
        </p>

        <div className="mt-10">
          <ReceiptUpload />
        </div>
      </section>

      {/* Receipt-style footer line */}
      <footer className="max-w-md w-full mx-auto pt-8">
        <hr className="divide-receipt mb-3" />
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
          <span>EUR · USD · GBP · THB · 30+</span>
          <span>v Calc-A</span>
        </div>
      </footer>
    </main>
  );
}
