import Link from "next/link";
import { Clock, ArrowLeft } from "lucide-react";

export function PaymentWaiting({ fullName }: { fullName: string | null }) {
  const firstName = fullName?.split(" ")[0];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 animate-pulse-soft items-center justify-center rounded-full bg-primary/15 text-primary">
          <Clock className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          {firstName ? `Thanks, ${firstName}!` : "Thanks!"}
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-zinc-400">
          Your payment is being verified by the coach. You&apos;ll get access
          shortly!
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm text-zinc-400">
          This usually takes a few hours. Hang tight — we&apos;ll unlock your
          dashboard as soon as it&apos;s approved.
        </div>

        <Link
          href="/location"
          className="mt-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to options
        </Link>
      </div>
    </div>
  );
}
