import ReceiptUpload from "@/components/ReceiptUpload";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-zinc-50 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(4rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md text-center mb-12">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 mb-3">
          Splitr
        </h1>
        <p className="text-zinc-600 text-lg leading-snug">
          Snap a bill. Tag who had what. Send pay links in 30 seconds.
        </p>
      </div>
      <ReceiptUpload />
    </main>
  );
}
