"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Loader2, Lock, CheckCircle2, WifiOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { performCheckIn } from "@/lib/check-in-actions";
import { POINT_REWARDS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { useOffline } from "@/lib/offline/context";
import { getCheckIn, setProfile } from "@/lib/offline/db";
import { queueCheckIn } from "@/lib/offline/queue";

// A cached PIN older than this is considered too stale to trust offline.
// Matches the user's "every 6 hours" requirement.
const PIN_STALE_MS = 6 * 60 * 60 * 1000;

// Modal asking for today's 2-digit PIN. On success: confetti + toast, and the
// parent's onSuccess flips the dashboard CTA to enabled.
//
// Offline behavior: verifies the PIN against the cached copy (refreshed every
// 6h while online). If the cache is missing/stale, blocks with a clear
// message. The actual server write is queued and synced on reconnect.
export function CheckInModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (pointsAwarded: number) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { isOnline } = useOffline();
  const [pending, startTransition] = useTransition();
  const [digits, setDigits] = useState(["", ""]);
  const [shake, setShake] = useState(false);
  const [offlineBlocked, setOfflineBlocked] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state each time the modal opens.
  useEffect(() => {
    if (open) {
      setDigits(["", ""]);
      setShake(false);
      setOfflineBlocked(null);
      setTimeout(() => inputs.current[0]?.focus(), 50);
    }
  }, [open]);

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 1) inputs.current[i + 1]?.focus();
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function submit() {
    const code = digits.join("").trim();
    if (!/^\d{2}$/.test(code)) {
      triggerShake();
      return;
    }

    if (isOnline) {
      submitOnline(code);
    } else {
      submitOffline(code);
    }
  }

  function submitOnline(pin: string) {
    startTransition(async () => {
      const res = await performCheckIn(pin);
      if (res.error || !res.checkedIn) {
        triggerShake();
        toast.error(res.error ?? t("checkin.failed"));
      } else {
        // Mirror into the offline cache so the offline state stays consistent.
        const nowIso = new Date().toISOString();
        await setProfile({
          value: {
            id: "self",
            full_name: null,
            role: "subscriber",
            subscription_status: "active",
            created_at: nowIso,
            last_attendance_date: nowIso,
          },
          fetchedAt: nowIso,
        }).catch(() => {});
        fireConfetti();
        toast.success(
          res.pointsAwarded > 0
            ? t("checkin.success_points", { points: res.pointsAwarded })
            : t("checkin.already")
        );
        onSuccess(res.pointsAwarded);
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  async function submitOffline(pin: string) {
    // Verify the PIN against the cached copy (refreshed every 6h).
    const cached = await getCheckIn();
    if (!cached || !cached.pin) {
      setOfflineBlocked(t("checkin.offline_no_code"));
      return;
    }
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age > PIN_STALE_MS) {
      setOfflineBlocked(t("checkin.offline_stale"));
      return;
    }
    if (cached.pin !== pin) {
      triggerShake();
      toast.error(t("checkin.wrong_pin"));
      return;
    }

    // PIN matches a fresh cache → mark checked-in locally + queue the write.
    const nowIso = new Date().toISOString();
    await queueCheckIn(pin);
    await setProfile({
      value: {
        id: "self",
        full_name: null,
        role: "subscriber",
        subscription_status: "active",
        created_at: nowIso,
        last_attendance_date: nowIso,
      },
      fetchedAt: nowIso,
    }).catch(() => {});

    fireConfetti();
    toast.success(t("checkin.offline_success", { points: POINT_REWARDS.CHECK_IN }));
    onSuccess(POINT_REWARDS.CHECK_IN);
    onOpenChange(false);
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  function fireConfetti() {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#84cc16", "#a3e635", "#ecfccb"],
    });
  }

  const full = digits.join("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-50">
            <Lock className="h-4 w-4 text-primary" /> {t("checkin.enter_pin")}
          </DialogTitle>
          <DialogDescription>
            {isOnline ? t("checkin.ask_coach") : t("checkin.offline_verifying")}
          </DialogDescription>
        </DialogHeader>

        {offlineBlocked ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <WifiOff className="h-6 w-6" />
            </span>
            <p className="text-sm text-zinc-400">{offlineBlocked}</p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex justify-center gap-3 py-4",
                shake && "animate-shake"
              )}
              dir="ltr"
            >
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKey(i, e)}
                  disabled={pending}
                  className={cn(
                    "h-16 w-16 rounded-xl border-2 border-border bg-zinc-950 text-center font-mono text-3xl font-bold text-zinc-50 outline-none transition-colors focus:border-primary",
                    shake && "border-red-500"
                  )}
                />
              ))}
            </div>

            <Button
              size="lg"
              className="w-full gap-2"
              disabled={pending || full.length !== 2}
              onClick={submit}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {pending
                ? t("checkin.checking")
                : t("checkin.checkin_button", { points: POINT_REWARDS.CHECK_IN })}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
