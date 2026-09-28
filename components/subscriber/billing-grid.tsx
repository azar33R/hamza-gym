"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VodafonePaymentModal } from "@/components/subscriber/vodafone-payment-modal";
import { useI18n } from "@/lib/i18n/client";
import type { Plan } from "@/lib/types";

// Plans are admin-authored in English in the DB, so the member-facing names
// come from the translated plan-type labels, and known feature strings are
// mapped to translations. Anything unknown renders verbatim (never blank).
function planDisplayName(
  plan: Plan,
  t: (key: string) => string
): string {
  // A custom-length plan is named by the coach, so show their label rather than
  // the generic "Custom" type label.
  if (plan.plan_type === "custom") return plan.label;
  const key = `admin.plans.type.${plan.plan_type}`;
  const translated = t(key);
  return translated === key ? plan.label : translated;
}

function featureDisplayName(
  feature: string,
  t: (key: string) => string
): string {
  const normalized = feature.trim().toLowerCase();
  if (normalized === "full gym access") return t("billing.full_gym_access");
  if (normalized === "coach guidance") return t("billing.feature_coach");
  if (normalized === "workout tracking") return t("billing.feature_tracking");
  return feature;
}

export function BillingGrid({
  plans,
  walletNumber,
}: {
  plans: Plan[];
  walletNumber: string;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Plan | null>(null);
  const currency = t("common.egp");

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const name = planDisplayName(plan, t);
          return (
            <Card
              key={plan.id}
              className="flex flex-col border-border bg-card transition-colors hover:border-primary/50"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-zinc-50">{name}</CardTitle>
                <div className="mt-2">
                  <Badge variant="muted">
                    {plan.price_egp} {currency}
                  </Badge>
                  {plan.cardio_price > 0 && (
                    <p className="mt-1.5 text-xs text-zinc-500">
                      {t("billing.cardio_option", {
                        price: plan.cardio_price,
                        currency,
                      })}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col pt-1">
                <ul className="flex-1 space-y-2 text-sm text-zinc-400">
                  {(plan.features ?? []).map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">{featureDisplayName(f, t)}</span>
                    </li>
                  ))}
                  {(!plan.features || plan.features.length === 0) && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">{t("billing.full_gym_access")}</span>
                    </li>
                  )}
                </ul>
                <Button
                  className="mt-4 h-auto min-h-11 w-full whitespace-normal py-2.5 text-sm leading-snug"
                  size="lg"
                  onClick={() => setSelected(plan)}
                >
                  {t("billing.select_plan", { plan: name })}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {plans.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-400">
          {t("billing.no_plans")}
        </div>
      )}

      <VodafonePaymentModal
        plan={selected}
        walletNumber={walletNumber}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
