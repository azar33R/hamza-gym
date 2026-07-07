"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOffline } from "@/lib/offline/context";
import { useI18n } from "@/lib/i18n/client";

export function DailyPinCard({ pin, updatedAt }: { pin: string; updatedAt: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { isOnline } = useOffline();

  function regenerate() {
    startTransition(async () => {
      const { regeneratePin } = await import("@/lib/gym-settings-actions");
      const res = await regeneratePin();
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.pin.generated", { pin: res.pin ?? "" }));
        router.refresh();
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-6">
      <div className="flex items-center gap-2 text-primary">
        <KeyRound className="h-4 w-4" />
        <h2 className="text-xs font-semibold uppercase tracking-wider">
          {t("admin.pin.title")}
        </h2>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <span className="font-mono text-7xl font-black leading-none tracking-tight text-zinc-50 sm:text-8xl" dir="ltr" style={{ unicodeBidi: "plaintext" }}>
          {pin}
        </span>
      </div>

      <p className="mt-2 text-xs text-zinc-400">
        {t("admin.pin.description", {
          time: new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        })}
      </p>

      <Button
        onClick={regenerate}
        disabled={pending || !isOnline}
        variant="secondary"
        className="mt-4 gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? t("admin.pin.generating") : t("admin.pin.generate")}
      </Button>
    </section>
  );
}
