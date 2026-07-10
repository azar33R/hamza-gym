"use client";

"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Dumbbell,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TransitionLink } from "@/components/ui/transition-link";
import { useI18n } from "@/lib/i18n/client";
import type { UserRole } from "@/lib/constants";

type Tab = {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

// Core tabs always shown. Less-used pages (Machines, Plans, Comms) live inside
// the Settings page as quick-link cards.
const CORE_TABS: Tab[] = [
  { href: "/admin", labelKey: "nav.home", icon: LayoutDashboard, exact: true },
  { href: "/admin/triage", labelKey: "nav.triage", icon: AlertTriangle },
  { href: "/admin/clients", labelKey: "nav.clients", icon: Users },
  { href: "/admin/workouts", labelKey: "nav.workouts", icon: Dumbbell },
];

export function AdminBottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const settingsPaths = ["/admin/settings", "/admin/machines", "/admin/plans", "/admin/comms", "/admin/shop", "/admin/cosmetics", "/admin/codes"];
  const onSettingsArea = settingsPaths.some((p) => pathname.startsWith(p));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-around px-1 py-1.5">
        {CORE_TABS.map(({ href, labelKey, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <TransitionLink
              key={href}
              href={href}
              prefetch={true}
              className={cn(
                "ripple flex min-w-[3.5rem] flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors active:scale-95",
                active ? "text-primary" : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(labelKey)}
            </TransitionLink>
          );
        })}
        <TransitionLink
          href="/admin/settings"
          prefetch={true}
          className={cn(
            "ripple flex min-w-[3.5rem] flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors active:scale-95",
            onSettingsArea ? "text-primary" : "text-zinc-500 hover:text-zinc-200"
          )}
        >
          <Settings className="h-5 w-5" />
          {t("nav.settings")}
        </TransitionLink>
      </div>
    </nav>
  );
}
