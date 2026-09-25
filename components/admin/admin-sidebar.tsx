"use client";

import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Dumbbell,
  Settings as SettingsIcon,
  Boxes,
  ShoppingBag,
  KeySquare,
  Sparkles,
  Wrench,
  Megaphone,
  BarChart3,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TransitionLink } from "@/components/ui/transition-link";
import { useI18n } from "@/lib/i18n/client";

type Item = {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const MAIN: Item[] = [
  { href: "/admin", labelKey: "nav.home", icon: LayoutDashboard, exact: true },
  { href: "/admin/triage", labelKey: "nav.triage", icon: AlertTriangle },
  { href: "/admin/clients", labelKey: "nav.clients", icon: Users },
  { href: "/admin/workouts", labelKey: "nav.workouts", icon: Dumbbell },
];

const MANAGE: Item[] = [
  { href: "/admin/plans", labelKey: "admin_settings.plan_catalog", icon: Boxes },
  { href: "/admin/shop", labelKey: "admin_settings.pro_shop", icon: ShoppingBag },
  { href: "/admin/codes", labelKey: "admin.codes.title", icon: KeySquare },
  { href: "/admin/cosmetics", labelKey: "admin.cosmetics.title", icon: Sparkles },
  { href: "/admin/machines", labelKey: "admin_settings.machine_library", icon: Wrench },
  { href: "/admin/comms", labelKey: "admin_settings.communications", icon: Megaphone },
  { href: "/admin/settings/revenue", labelKey: "admin_settings.revenue", icon: BarChart3 },
  { href: "/admin/settings", labelKey: "nav.settings", icon: SettingsIcon },
];

function NavLink({ item }: { item: Item }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <TransitionLink
      href={item.href}
      prefetch={true}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
      )}
    >
      {/* Active rail on the inline-start edge */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-primary transition-opacity",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{t(item.labelKey)}</span>
    </TransitionLink>
  );
}

function Group({ labelKey, items }: { labelKey: string; items: Item[] }) {
  const { t } = useI18n();
  return (
    <div className="mt-5">
      <p className="px-3 pb-1.5 text-[11px] font-semibold text-zinc-600">{t(labelKey)}</p>
      <div className="space-y-0.5">
        {items.map((i) => (
          <NavLink key={i.href} item={i} />
        ))}
      </div>
    </div>
  );
}

export function AdminSidebar({
  coachName,
  role,
}: {
  coachName: string | null;
  role: string;
}) {
  const { t } = useI18n();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-border bg-card/40 md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Dumbbell className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-zinc-50">{t("app.name")}</p>
          <p className="truncate text-[11px] text-zinc-500">
            {coachName ? `${role === "admin" ? t("role.admin") : t("role.staff")} ${coachName}` : role}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {MAIN.map((i) => (
            <NavLink key={i.href} item={i} />
          ))}
        </div>
        <Group labelKey="admin_settings.management" items={MANAGE} />
      </nav>
    </aside>
  );
}
