"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HandCoins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { recordTopUpPayment } from "@/lib/admin-actions";
import { useWriteGuard } from "@/lib/admin-write-guard";
import { useOffline } from "@/lib/offline/context";
import { useI18n } from "@/lib/i18n/client";

// Records a cash top-up against a member's remaining plan balance. Used from
// the triage debts queue and the member payment tab. Caps the amount at the
// remaining balance so overpaying is impossible.
export function RecordPaymentDialog({
  userId,
  userName,
  remaining,
  trigger,
}: {
  userId: string;
  userName: string | null;
  remaining: number;
  trigger?: React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const can = useWriteGuard();
  const { isOnline } = useOffline();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!can("record a payment")) return;
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error(t("admin.debt.amount_invalid"));
      return;
    }
    if (n > remaining) {
      toast.error(t("admin.debt.amount_too_much", { n: remaining }));
      return;
    }
    startTransition(async () => {
      const res = await recordTopUpPayment(userId, n);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.remaining && res.remaining > 0
          ? t("admin.debt.topup_partial", { n: res.remaining })
          : t("admin.debt.topup_settled")
      );
      setOpen(false);
      setAmount("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <HandCoins className="h-4 w-4" />
            {t("admin.debt.record_payment")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("admin.debt.record_payment")}</DialogTitle>
          <DialogDescription>
            {t("admin.debt.record_for", {
              name: userName ?? t("admin.user_settings.member"),
              n: remaining,
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-amount">{t("admin.debt.amount")}</Label>
            <Input
              id="rp-amount"
              type="number"
              min={1}
              max={remaining}
              required
              placeholder={String(remaining)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={pending || !isOnline}
          >
            {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("admin.debt.confirm_payment")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
