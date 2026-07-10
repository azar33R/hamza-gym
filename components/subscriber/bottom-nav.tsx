"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Dumbbell, Home, Trophy, User, MessageCircle, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatUnreadBadge } from "@/components/subscriber/chat-unread-badge";
import { useTabContext, type TabId } from "@/app/(subscriber)/tab-context";
import { useI18n } from "@/lib/i18n/client";

const tabs: { href: string; labelKey: string; icon: typeof Home; tabId?: TabId }[] = [
  { href: "/dashboard", labelKey: "nav.home", icon: Home, tabId: "dashboard" },
  { href: "/workout", labelKey: "nav.workouts", icon: Dumbbell, tabId: "workout" },
  { href: "/leaderboard", labelKey: "nav.ranks", icon: Trophy, tabId: "leaderboard" },
  { href: "/nutrition", labelKey: "nav.nutrition", icon: UtensilsCrossed },
  { href: "/chat", labelKey: "nav.chat", icon: MessageCircle },
  { href: "/settings", labelKey: "nav.profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { activeTab, switchTab } = useTabContext();
  const { t } = useI18n();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {tabs.map(({ href, labelKey, icon: Icon, tabId }) => {
          const active = tabId
            ? activeTab === tabId
            : pathname === href || pathname.startsWith(href + "/");
          return tabId ? (
            <button
              key={href}
              onClick={() => switchTab(tabId, href)}
              className={cn(
                "ripple flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors active:scale-95",
                active ? "text-primary" : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(labelKey)}
            </button>
          ) : (
            <Link
              key={href}
              href={href}
              prefetch={true}
              className={cn(
                "ripple flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors active:scale-95",
                active ? "text-primary" : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(labelKey)}
              {href === "/chat" && <ChatUnreadBadge />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
