"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { LOCKED_STATUSES, WAITING_STATUSES, type SubscriptionStatus } from "@/lib/constants";
import { UnpaidLanding } from "@/components/subscriber/unpaid-landing";
import { PaymentWaiting } from "@/components/subscriber/payment-waiting";
import { PushPermissionPrompt } from "@/components/subscriber/push-permission-prompt";
import { OnboardingForm } from "@/components/subscriber/onboarding-form";
import { SetupPassword } from "@/components/subscriber/setup-password";

const ALLOWED_INACTIVE_PATHS = ["/billing", "/chat", "/location", "/settings"];

export function SubscriptionGate({
  children,
  status,
  fullName,
  onboarded,
  needsPasswordSetup,
}: {
  children: React.ReactNode;
  status: SubscriptionStatus;
  fullName: string | null;
  onboarded: boolean;
  needsPasswordSetup: boolean;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const inactiveAllowed = ALLOWED_INACTIVE_PATHS.some((p) =>
    pathname.startsWith(p)
  );

  // A member who signed in via an admin access code must set a password first.
  if (needsPasswordSetup) {
    return <SetupPassword />;
  }

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
