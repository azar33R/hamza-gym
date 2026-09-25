import { getGymSettings } from "@/lib/gym-settings-actions";
import { SettingsForm } from "@/components/admin/settings-form";
import { DailyPinCard } from "@/components/admin/daily-pin-card";
import { requireStaffOrAdmin } from "@/lib/admin";
import { LanguageToggle } from "@/components/language-toggle";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getT();
  await requireStaffOrAdmin();
  const { settings } = await getGymSettings();

  // Navigation to the other admin sections (revenue, machines, plans, comms,
  // shop, cosmetics, codes) lives in the sidebar, so this page is only the
  // gym's own preferences.

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-zinc-50">
          {t("admin_settings.title")}
        </h1>
        <p className="text-sm text-zinc-400">{t("admin_settings.subtitle")}</p>
      </header>

      {/* Language preference */}
      <section className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5">
        <h2 className="text-sm font-semibold text-zinc-200">{t("lang.toggle")}</h2>
        <LanguageToggle />
      </section>

      {/* Vodafone Cash wallet number */}
      <SettingsForm vodafoneCashWallet={settings?.vodafone_cash_wallet ?? ""} />

      {/* Daily PIN */}
      {settings && (
        <DailyPinCard pin={settings.daily_pin} updatedAt={settings.updated_at} />
      )}
    </div>
  );
}
