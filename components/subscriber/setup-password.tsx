"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordSetup } from "@/lib/member-actions";

export function SetupPassword() {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("setup.short"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("setup.mismatch"));
      return;
    }
    startTransition(async () => {
      const res = await completePasswordSetup(password);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("setup.success"));
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <KeyRound className="h-8 w-8" />
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-50">
          {t("setup.title")}
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-400">{t("setup.desc")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sp-pw">{t("setup.password")}</Label>
            <Input
              id="sp-pw"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-confirm">{t("setup.confirm")}</Label>
            <Input
              id="sp-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("setup.submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
