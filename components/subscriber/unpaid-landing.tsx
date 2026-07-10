import Link from "next/link";
import { CreditCard, MessageCircle, MapPin, Dumbbell } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { config } from "@/lib/config";
import { SignOutButton } from "@/components/auth/signout-button";
import { RedeemCodeCard } from "@/components/subscriber/redeem-code-card";

export function UnpaidLanding({ fullName }: { fullName: string | null }) {
  const { t } = useI18n();
  const firstName = fullName?.split(" ")[0];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
        <div className="mb-4 flex justify-start">
          <SignOutButton />
        </div>

        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-lime-500/20">
            <Dumbbell className="h-7 w-7" />
          </div>
          {firstName ? (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-50">
                {t("billing.welcome")},{" "}
                <span className="text-primary">{firstName}</span>
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {t("billing.desc")}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                {t("billing.welcome")}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {t("billing.desc")}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4">
          <Link
            href="/billing"
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-zinc-800/40 active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <CreditCard className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-zinc-50">
                  {t("billing.select_plan")}
                </h2>
                <p className="text-sm text-zinc-400">
                  {t("billing.pay_instruction")}
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/chat"
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-zinc-800/40 active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <MessageCircle className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-zinc-50">
                  {t("billing.chat_coach")}
                </h2>
                <p className="text-sm text-zinc-400">
                  {t("billing.contact_coach", { name: config.coach.name })}
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/location"
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-zinc-800/40 active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <MapPin className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-zinc-50">
                  {t("billing.gym_location")}
                </h2>
                <p className="text-sm text-zinc-400">
                  {t("billing.gym_hours")}
                </p>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-4">
          <RedeemCodeCard />
        </div>
      </div>
    </div>
  );
}
