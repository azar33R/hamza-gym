"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

// Minimal segmented language toggle: العربية / English.
// On click → persists the locale cookie via server action, then refreshes
// the router so the whole tree re-renders in the new language + direction.
// Works before login (auth chrome), inside subscriber settings, and admin.
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { t, locale: current } = useI18n();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Locale | null>(null);
  const active = optimistic ?? current;

  function choose(loc: Locale) {
    if (loc === active || pending) return;
    setOptimistic(loc);
    startTransition(async () => {
      await setLocale(loc);
      // Force a full refresh so <html lang/dir> + every translated string flips.
      router.refresh();
    });
  }

  if (compact) {
    // Icon-only pill for tight chrome (auth layout corners).
    const next: Locale = active === "ar" ? "en" : "ar";
    return (
      <button
        type="button"
        onClick={() => choose(next)}
        disabled={pending}
        aria-label={t("lang.toggle")}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50 active:scale-95 disabled:opacity-60"
      >
        <Languages className="h-3.5 w-3.5" />
        {active === "ar" ? "EN" : "ع"}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 p-1">
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => choose(loc)}
          disabled={pending}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors active:scale-95 disabled:opacity-60",
            active === loc
              ? "bg-primary text-primary-foreground"
              : "text-zinc-400 hover:text-zinc-100"
          )}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
