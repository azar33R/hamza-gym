"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOffline } from "@/lib/offline/context";
import { useI18n } from "@/lib/i18n/client";

// Compact single-row check-in PIN strip. The PIN is the hero element, but it
// doesn't get a full-height gradient card to itself.
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
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <KeyRound className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-zinc-500">{t("admin.pin.title")}</p>
        <p className="mt-0.5 font-mono text-4xl font-black leading-none tracking-tight text-zinc-50 tabular-nums">
          {pin}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <p className="hidden max-w-[16rem] text-[11px] leading-snug text-zinc-500 sm:block">
          {t("admin.pin.description", {
            when: new Date(updatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </p>
        <Button
          onClick={regenerate}
          disabled={pending || !isOnline}
          variant="secondary"
          size="sm"
          className="shrink-0 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          {pending ? t("admin.pin.generating") : t("admin.pin.generate")}
        </Button>
      </div>
    </section>
  );
}
