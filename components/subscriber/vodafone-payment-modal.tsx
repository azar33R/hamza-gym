"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitPaymentRequest } from "@/lib/payment-actions";
import type { Plan } from "@/lib/types";

export function VodafonePaymentModal({
  plan,
  walletNumber,
  onClose,
}: {
  plan: Plan | null;
  walletNumber: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState("");
  const [txnId, setTxnId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOpen(plan !== null);
  }, [plan]);

  function handleClose(open: boolean) {
    setOpen(open);
    if (!open) onClose();
  }

  function copyWallet() {
    navigator.clipboard?.writeText(walletNumber);
    toast.success(t("billing.wallet_copied"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan) return;

    if (!/^\d{6,}$/.test(wallet)) {
      toast.error(t("billing.wallet_invalid"));
      return;
    }
    if (txnId.trim().length < 3) {
      toast.error(t("billing.txn_required"));
      return;
    }

    setLoading(true);

    const res = await submitPaymentRequest({
      planType: plan.plan_type,
      senderWalletNumber: wallet,
      transactionId: txnId.trim(),
    });

    if (res.error) {
      toast.error(res.error);
      setLoading(false);
      return;
    }

    toast.success(t("billing.payment_submitted"));
    handleClose(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            {t("billing.pay_title")}
          </DialogTitle>
          <DialogDescription>
            {t("billing.pay_desc", { plan: plan?.label ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-zinc-950/50 p-4 text-sm text-zinc-300">
            <p>
              {t("billing.transfer_instruction")}
            </p>
            <button
              type="button"
              onClick={copyWallet}
              className="mt-2 flex w-full items-center justify-between rounded-md bg-zinc-900 px-3 py-2 text-start font-mono font-semibold text-primary hover:bg-zinc-800"
            >
              <span>{walletNumber}</span>
              <Copy className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wallet">{t("billing.wallet_number")}</Label>
            <Input
              id="wallet"
              inputMode="numeric"
              placeholder={t("billing.wallet_placeholder")}
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="txn">{t("billing.transaction_id")}</Label>
            <Input
              id="txn"
              placeholder={t("billing.txn_placeholder")}
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? t("billing.submitting") : t("billing.confirm")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
