import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BillingGrid } from "@/components/subscriber/billing-grid";
import { getActivePlans } from "@/lib/plans";
import { getVodafoneWallet } from "@/lib/gym-settings-actions";
import { config } from "@/lib/config";
import { getT } from "@/lib/i18n/server";

// Plans are now read from the admin-managed `plans` table.
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const t = await getT();
  const plans = await getActivePlans();

  // Prefer the DB-managed wallet number; fall back to config.ts if empty.
  const dbWallet = await getVodafoneWallet();
  const walletNumber = dbWallet || config.coach.vodafoneCashWallet;

  return (
    <>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-50"
      >
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Link>

      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
          {t("billing.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-zinc-400">
          {t("billing.pay_instruction")}
        </p>
      </header>

      <BillingGrid
        plans={plans}
        walletNumber={walletNumber}
      />
    </>
  );
}
