"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Check, X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approvePaymentRequest,
  rejectPaymentRequest,
  nudgeClient,
} from "@/lib/admin-actions";
import { approveLift, rejectLift } from "@/lib/lift-actions";
import { useWriteGuard } from "@/lib/admin-write-guard";
import { useOffline } from "@/lib/offline/context";

export function ApproveButton({ requestId }: { requestId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const can = useWriteGuard();
  const { isOnline } = useOffline();

  function handle() {
    if (!can("approve payment")) return;
    startTransition(async () => {
      const res = await approvePaymentRequest(requestId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.triage.approve_success"));
        router.refresh();
      }
    });
  }

  return (
    <Button size="sm" onClick={handle} disabled={pending || !isOnline} className="gap-1">
      <Check className="h-4 w-4" />
      {pending ? t("admin.triage.processing") : t("admin.triage.approve")}
    </Button>
  );
}

export function RejectButton({ requestId }: { requestId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const can = useWriteGuard();
  const { isOnline } = useOffline();

  function handle() {
    if (!can("reject payment")) return;
    startTransition(async () => {
      const res = await rejectPaymentRequest(requestId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.triage.reject_success"));
        router.refresh();
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handle}
      disabled={pending || !isOnline}
      className="gap-1"
    >
      <X className="h-4 w-4" />
      {pending ? t("admin.triage.processing") : t("admin.triage.reject")}
    </Button>
  );
}

export function NudgeButton({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const can = useWriteGuard();
  const { isOnline } = useOffline();

  function handle() {
    if (!can("send a nudge")) return;
    startTransition(async () => {
      const res = await nudgeClient(userId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.triage.nudge_success"));
        router.refresh();
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handle}
      disabled={pending || !isOnline}
      className="gap-1"
    >
      <Bell className="h-4 w-4" />
      {pending ? t("admin.triage.processing") : t("admin.triage.nudge")}
    </Button>
  );
}

export function ApproveLiftButton({ submissionId }: { submissionId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const can = useWriteGuard();
  const { isOnline } = useOffline();

  function handle() {
    if (!can("approve lift")) return;
    startTransition(async () => {
      const res = await approveLift(submissionId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.triage.approve_lift_success"));
        router.refresh();
      }
    });
  }

  return (
    <Button size="sm" onClick={handle} disabled={pending || !isOnline} className="gap-1">
      <Check className="h-4 w-4" />
      {pending ? t("admin.triage.processing") : t("admin.triage.approve")}
    </Button>
  );
}

export function RejectLiftButton({ submissionId }: { submissionId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const can = useWriteGuard();
  const { isOnline } = useOffline();

  function handle() {
    if (!can("reject lift")) return;
    startTransition(async () => {
      const res = await rejectLift(submissionId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.triage.reject_lift_success"));
        router.refresh();
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handle}
      disabled={pending || !isOnline}
      className="gap-1"
    >
      <X className="h-4 w-4" />
      {pending ? t("admin.triage.processing") : t("admin.triage.reject")}
    </Button>
  );
}
