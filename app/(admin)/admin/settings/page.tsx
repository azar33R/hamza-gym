import Link from "next/link";
import { getGymSettings } from "@/lib/gym-settings-actions";
import { SettingsForm } from "@/components/admin/settings-form";
import { DailyPinCard } from "@/components/admin/daily-pin-card";
import {
  Cpu,
  CreditCard,
  Megaphone,
  ShoppingBag,
  Sparkles,
  Ticket,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireStaffOrAdmin } from "@/lib/admin";
import { LanguageToggle } from "@/components/language-toggle";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getT();
  const { profile, role } = await requireStaffOrAdmin();
  const { settings } = await getGymSettings();
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          {t("admin_settings.title")}
        </h1>
        <p className="text-sm text-zinc-400">
          {t("admin_settings.subtitle")}
        </p>
      </header>

      {/* Language preference */}
      <section className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-zinc-200">{t("lang.toggle")}</h2>
        <LanguageToggle />
      </section>

      {/* Vodafone Cash wallet number */}
      <SettingsForm
        vodafoneCashWallet={settings?.vodafone_cash_wallet ?? ""}
      />

      {/* Daily PIN */}
      {settings && (
        <DailyPinCard pin={settings.daily_pin} updatedAt={settings.updated_at} />
      )}

      {/* Quick links to less-used admin pages */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          {t("admin_settings.management")}
        </h2>
        <div className="grid gap-2">
          {isAdmin && (
          <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
            <Link href="/admin/settings/revenue">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div className="text-start">
                <p className="text-sm font-medium text-zinc-50">{t("admin_settings.revenue")}</p>
                <p className="text-xs text-zinc-500">{t("admin_settings.revenue_desc")}</p>
              </div>
            </Link>
          </Button>
          )}
          <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
            <Link href="/admin/machines">
              <Cpu className="h-4 w-4 text-primary" />
              <div className="text-start">
                <p className="text-sm font-medium text-zinc-50">{t("admin_settings.machine_library")}</p>
                <p className="text-xs text-zinc-500">{t("admin_settings.machine_library_desc")}</p>
              </div>
            </Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
              <Link href="/admin/plans">
                <CreditCard className="h-4 w-4 text-primary" />
                <div className="text-start">
                  <p className="text-sm font-medium text-zinc-50">{t("admin_settings.plan_catalog")}</p>
                  <p className="text-xs text-zinc-500">{t("admin_settings.plan_catalog_desc")}</p>
                </div>
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
              <Link href="/admin/comms">
                <Megaphone className="h-4 w-4 text-primary" />
                <div className="text-start">
                  <p className="text-sm font-medium text-zinc-50">{t("admin_settings.communications")}</p>
                  <p className="text-xs text-zinc-500">{t("admin_settings.communications_desc")}</p>
                </div>
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
              <Link href="/admin/shop">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <div className="text-start">
                  <p className="text-sm font-medium text-zinc-50">{t("admin_settings.pro_shop")}</p>
                  <p className="text-xs text-zinc-500">{t("admin_settings.pro_shop_desc")}</p>
                </div>
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
              <Link href="/admin/cosmetics">
                <Sparkles className="h-4 w-4 text-primary" />
                <div className="text-start">
                  <p className="text-sm font-medium text-zinc-50">{t("admin_settings.cosmetics")}</p>
                  <p className="text-xs text-zinc-500">{t("admin_settings.cosmetics_desc")}</p>
                </div>
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
              <Link href="/admin/codes">
                <Ticket className="h-4 w-4 text-primary" />
                <div className="text-start">
                  <p className="text-sm font-medium text-zinc-50">{t("admin_settings.codes")}</p>
                  <p className="text-xs text-zinc-500">{t("admin_settings.codes_desc")}</p>
                </div>
              </Link>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
