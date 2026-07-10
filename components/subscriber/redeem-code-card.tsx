"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Ticket, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { redeemCode } from "@/lib/code-actions";

export function RedeemCodeCard() {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    startTransition(async () => {
      const res = await redeemCode(code);
      if (res.error) {
        if (res.error === "invalid") toast.error(t("redeem.invalid"));
        else if (res.error === "used_up") toast.error(t("redeem.used_up"));
        else if (res.error === "expired") toast.error(t("redeem.expired"));
        else toast.error(t("redeem.error"));
        return;
      }
      setDone(true);
      toast.success(t("redeem.success"));
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        <p className="text-sm font-medium text-emerald-300">{t("redeem.success")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleRedeem}
      className="rounded-2xl border border-primary/30 bg-primary/5 p-5"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Ticket className="h-6 w-6" />
        </span>
        <div className="text-start">
          <h2 className="text-base font-semibold text-zinc-50">
            {t("redeem.title")}
          </h2>
          <p className="text-sm text-zinc-400">{t("redeem.desc")}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("redeem.placeholder")}
          className="flex-1 font-mono tracking-wider"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={pending || !code.trim()} className="shrink-0 gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("redeem.button")}
        </Button>
      </div>
    </form>
  );
}
