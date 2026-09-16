// WhatsApp renewal reminders — direct-chat links with auto-filled text.
//
// The coach taps one button in the admin action bar and WhatsApp opens
// straight into the member's chat with the name + expiry date already typed.

export type RenewalMode = "expired" | "expiring";

/** Whole days from today (date-only, UTC) until YYYY-MM-DD. Negative = expired. */
export function daysUntilExpiry(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms =
    Date.parse(`${dateStr}T00:00:00Z`) -
    Date.parse(`${new Date().toISOString().split("T")[0]}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

export function renewalModeFor(endDate: string | null | undefined): RenewalMode {
  const d = daysUntilExpiry(endDate);
  return d !== null && d < 0 ? "expired" : "expiring";
}

/** Locale-aware date label, e.g. 20‏/9‏/2026 in ar-EG. Falls back to raw string. */
export function formatExpiryDate(
  dateStr: string | null | undefined,
  locale: string = "ar"
): string {
  if (!dateStr) return "—";
  try {
    const tag = locale.startsWith("ar") ? "ar-EG" : "en-GB";
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(tag);
  } catch {
    return dateStr;
  }
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Build the renewal text. Uses i18n templates so AR/EN stay in messages/*.json:
 * - expired  -> admin.whatsapp.reminder_expired  ({name} {date} {n})
 * - expiring -> admin.whatsapp.reminder_expiring ({name} {date} {n})
 * - no date  -> admin.whatsapp.reminder_no_date  ({name})
 */
export function buildRenewalMessage(
  t: TFn,
  opts: {
    fullName: string | null;
    endDate: string | null | undefined;
    locale?: string;
    unknownLabel?: string;
  }
): { text: string; mode: RenewalMode } {
  const name = (opts.fullName ?? "").trim() || opts.unknownLabel || "Captain";
  const date = formatExpiryDate(opts.endDate, opts.locale ?? "ar");
  const left = daysUntilExpiry(opts.endDate);
  const mode: RenewalMode = left !== null && left < 0 ? "expired" : "expiring";

  if (!opts.endDate || left === null) {
    return { text: t("admin.whatsapp.reminder_no_date", { name }), mode };
  }
  if (mode === "expired") {
    return {
      text: t("admin.whatsapp.reminder_expired", {
        name,
        date,
        n: Math.abs(left),
      }),
      mode,
    };
  }
  return {
    text: t("admin.whatsapp.reminder_expiring", {
      name,
      date,
      n: left,
    }),
    mode,
  };
}

/** wa.me direct-chat link with pre-filled text. Pass E.164 like +2010… */
export function buildWhatsAppLink(e164Phone: string, message: string): string {
  const digits = e164Phone.replace("+", "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
