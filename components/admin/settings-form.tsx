"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGymSetting } from "@/lib/gym-settings-actions";
import { useI18n } from "@/lib/i18n/client";

type Props = {
  vodafoneCashWallet: string;
};

export function SettingsForm({ vodafoneCashWallet }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [wallet, setWallet] = useState(vodafoneCashWallet);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.trim()) {
      toast.error(t("admin.settings.wallet_empty_error"));
      return;
    }
    startTransition(async () => {
      const res = await updateGymSetting("vodafone_cash_wallet", wallet);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.settings.wallet_updated"));
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-primary">
        <Wallet className="h-4 w-4" />
        <h2 className="text-xs font-semibold uppercase tracking-wider">
          {t("admin.settings.wallet_heading")}
        </h2>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        {t("admin.settings.wallet_desc")}
      </p>
      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="wallet-num">{t("admin.settings.wallet_label")}</Label>
          <Input
            id="wallet-num"
            inputMode="numeric"
            placeholder={t("admin.settings.wallet_placeholder")}
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("common.save")}
        </Button>
      </form>
    </section>
  );
}
