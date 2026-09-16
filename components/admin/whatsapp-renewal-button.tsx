"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { getUserAuthInfo } from "@/lib/admin-user-actions";
import { normalizeEGPhone } from "@/lib/phone";
import { buildRenewalMessage, buildWhatsAppLink } from "@/lib/whatsapp";

// Per-member cache so repeat taps don't re-hit the server action.
const phoneCache = new Map<string, string | null>();

async function resolvePhone(userId: string): Promise<string | null> {
  if (phoneCache.has(userId)) return phoneCache.get(userId) ?? null;
  try {
    const contact = await getUserAuthInfo(userId);
    const raw = contact?.phone ?? null;
    const normalized = raw ? normalizeEGPhone(raw) : null;
    phoneCache.set(userId, normalized);
    return normalized;
  } catch {
    return null;
  }
}

/**
 * One-tap WhatsApp renewal reminder (direct chat).
 * Builds wa.me/<phone>?text=<name + expiry> on click.
 *
 * variant="icon"  -> for the ACTIONS bar in tables (inactive + expiring).
 * variant="full"  -> for the User Settings dialog (active members).
 */
export function WhatsAppRenewalButton({
  userId,
  fullName,
  endDate,
  variant = "icon",
  preloadedPhone = null,
}: {
  userId: string;
  fullName: string | null;
  endDate: string | null | undefined;
  variant?: "icon" | "full";
  preloadedPhone?: string | null;
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      let phone = preloadedPhone ? normalizeEGPhone(preloadedPhone) : null;
      if (!phone) phone = await resolvePhone(userId);
      if (!phone) {
        toast.error(t("admin.whatsapp.no_phone"));
        return;
      }
      const { text } = buildRenewalMessage(t, {
        fullName,
        endDate,
        locale,
        unknownLabel: t("common.unknown"),
      });
      window.open(buildWhatsAppLink(phone, text), "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={t("admin.whatsapp.send_reminder")}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-60 active:scale-[0.98]"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        {t("admin.whatsapp.send_reminder")}
      </button>
    );
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      title={t("admin.whatsapp.send_reminder")}
      aria-label={t("admin.whatsapp.send_reminder")}
      className="h-9 w-9 text-emerald-500 hover:text-emerald-400"
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
    </Button>
  );
}
