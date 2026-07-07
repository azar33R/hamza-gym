"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { LOCKED_STATUSES, WAITING_STATUSES, type SubscriptionStatus } from "@/lib/constants";
import { UnpaidLanding } from "@/components/subscriber/unpaid-landing";
import { PaymentWaiting } from "@/components/subscriber/payment-waiting";
import { PushPermissionPrompt } from "@/components/subscriber/push-permission-prompt";
import { OnboardingForm } from "@/components/subscriber/onboarding-form";

const ALLOWED_INACTIVE_PATHS = ["/billing", "/chat", "/location", "/settings"];

export function SubscriptionGate({
  children,
  status,
  fullName,
  onboarded,
}: {
  children: React.ReactNode;
  status: SubscriptionStatus;
  fullName: string | null;
  onboarded: boolean;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const inactiveAllowed = ALLOWED_INACTIVE_PATHS.some((p) =>
    pathname.startsWith(p)
  );

  if (LOCKED_STATUSES.includes(status) && !inactiveAllowed) {
    return <UnpaidLanding fullName={fullName} />;
  }

  if (WAITING_STATUSES.includes(status)) {
    return <PaymentWaiting fullName={fullName} />;
  }

  if (!LOCKED_STATUSES.includes(status) && !WAITING_STATUSES.includes(status)) {
    if (!onboarded && !pathname.startsWith("/onboarding")) {
      return <OnboardingForm fullName={fullName} />;
    }

    return (
      <div className="min-h-screen bg-background">
        {children}
        <PushPermissionPrompt />
      </div>
    );
  }

  return <>{children}</>;
}
