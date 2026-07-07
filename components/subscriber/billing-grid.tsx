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

export function BillingGrid({
  plans,
  walletNumber,
}: {
  plans: Plan[];
  walletNumber: string;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Plan | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className="flex flex-col border-border bg-card transition-colors hover:border-primary/50"
          >
            <CardHeader>
              <CardTitle className="text-zinc-50">{plan.label}</CardTitle>
              <div className="mt-2">
                <Badge variant="muted">{plan.price_egp} EGP</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="flex-1 space-y-2 text-sm text-zinc-400">
                {(plan.features ?? []).map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
                {(!plan.features || plan.features.length === 0) && (
                  <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> {t("billing.full_gym_access")}
                  </li>
                )}
              </ul>
              <Button
                className="mt-6 w-full"
                size="lg"
                onClick={() => setSelected(plan)}
              >
                {t("billing.select_plan", { label: plan.label })}
              </Button>
            </CardContent>
          </Card>
        ))}
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
