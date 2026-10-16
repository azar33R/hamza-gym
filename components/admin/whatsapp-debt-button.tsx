"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { getUserAuthInfo } from "@/lib/admin-user-actions";
import { normalizeEGPhone } from "@/lib/phone";
import { buildDebtMessage, buildWhatsAppLink } from "@/lib/whatsapp";

// One-tap WhatsApp reminder for an owed remainder (icon button for table rows).
// Reuses the renewal button's phone-resolution flow: preloaded profile phone
// first, then the auth contact lookup.
const phoneCache = new Map<string, string | null>();

async function resolvePhone(
  userId: string,
  preloaded: string | null
): Promise<string | null> {
  if (preloaded) {
    const n = normalizeEGPhone(preloaded);
    if (n) return n;
  }
  if (phoneCache.has(userId)) return phoneCache.get(userId) ?? null;
  try {
    const contact = await getUserAuthInfo(userId);
    const normalized = contact?.phone ? normalizeEGPhone(contact.phone) : null;
    phoneCache.set(userId, normalized);
    return normalized;
  } catch {
    return null;
  }
}

export function WhatsAppDebtButton({
  userId,
  fullName,
  remaining,
  dueDate,
  preloadedPhone = null,
}: {
  userId: string;
  fullName: string | null;
  remaining: number;
  dueDate?: string | null;
  preloadedPhone?: string | null;
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const phone = await resolvePhone(userId, preloadedPhone);
      if (!phone) {
        toast.error(t("admin.whatsapp.no_phone"));
        return;
      }
      const text = buildDebtMessage(t, {
        fullName,
        remaining,
        dueDate: dueDate ?? null,
        locale,
        unknownLabel: t("common.unknown"),
      });
      window.open(buildWhatsAppLink(phone, text), "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
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
