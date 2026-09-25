"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell,
  Home,
  MessageCircle,
  Settings,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ChatUnreadBadge } from "@/components/subscriber/chat-unread-badge";
import { useTabContext } from "@/app/(subscriber)/tab-context";
import { useI18n } from "@/lib/i18n/client";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ProfileAvatar() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("face_photo_url, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setPhoto((data as { face_photo_url: string | null }).face_photo_url ?? null);
        setName((data as { full_name: string | null }).full_name ?? null);
      }
    })();
  }, []);

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name ?? "profile"}
        className="h-7 w-7 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-100">
      {initials(name)}
    </span>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { activeTab, switchTab } = useTabContext();
  const { t } = useI18n();

  const isHome = activeTab === "dashboard" || pathname === "/dashboard";
  const isWorkout = activeTab === "workout" || pathname.startsWith("/workout");
  const isChat = pathname.startsWith("/chat");
  const isFood = pathname.startsWith("/nutrition");
  const isProfile = pathname.startsWith("/settings");

  const labelClass = (active: boolean) =>
    cn(
      "text-[11px] font-semibold leading-none",
      active ? "text-lime-400" : "text-zinc-500"
    );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="px-3 pb-3">
        {/* Locked LTR so the visual order always matches the design:
            [profile] [chat] [HOME] [workouts] [food] left → right */}
        <div
          dir="ltr"
          className="mx-auto flex max-w-md items-end justify-between rounded-[28px] border border-white/10 bg-[#0b0b0d]/95 px-3 pb-2 pt-2 shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
        >
          {/* 1 — Profile (avatar + gear badge) */}
          <Link
            href="/settings"
            prefetch={true}
            className="ripple flex flex-1 flex-col items-center gap-1.5 rounded-xl py-1.5 active:scale-95"
          >
            <span
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                isProfile ? "border-lime-400" : "border-zinc-700"
              )}
            >
              <ProfileAvatar />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-white/10">
                <Settings className="h-2.5 w-2.5 text-zinc-300" />
              </span>
            </span>
            <span className={labelClass(isProfile)}>{t("nav.profile")}</span>
          </Link>

          {/* 2 — Chat */}
          <Link
            href="/chat"
            prefetch={true}
            className="ripple relative flex flex-1 flex-col items-center gap-1.5 rounded-xl py-1.5 active:scale-95"
          >
            <MessageCircle
              className={cn("h-6 w-6", isChat ? "text-lime-400" : "text-zinc-500")}
            />
            <span className={labelClass(isChat)}>{t("nav.chat")}</span>
            <ChatUnreadBadge />
          </Link>

          {/* 3 — HOME (center, raised glowing circle) */}
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <button
              onClick={() => switchTab("dashboard", "/dashboard")}
              aria-label={t("nav.home")}
              className={cn(
                "ripple flex h-16 w-16 -translate-y-4 items-center justify-center rounded-full border transition-transform active:scale-95",
                isHome
                  ? "border-lime-400/60 bg-zinc-800 text-lime-400 shadow-[0_0_28px_rgba(132,204,22,0.55)]"
                  : "border-white/10 bg-zinc-800 text-zinc-400 shadow-[0_0_18px_rgba(132,204,22,0.25)]"
              )}
            >
              <Home className="h-7 w-7 fill-current" />
            </button>
            <span className={cn(labelClass(isHome), "-mt-2")}>{t("nav.home")}</span>
          </div>

          {/* 4 — Workouts */}
          <button
            onClick={() => switchTab("workout", "/workout")}
            className="ripple flex flex-1 flex-col items-center gap-1.5 rounded-xl py-1.5 active:scale-95"
          >
            <Dumbbell
              className={cn("h-6 w-6", isWorkout ? "text-lime-400" : "text-zinc-500")}
            />
            <span className={labelClass(isWorkout)}>{t("nav.workouts")}</span>
          </button>

          {/* 5 — Food */}
          <Link
            href="/nutrition"
            prefetch={true}
            className="ripple flex flex-1 flex-col items-center gap-1.5 rounded-xl py-1.5 active:scale-95"
          >
            <UtensilsCrossed
              className={cn("h-6 w-6", isFood ? "text-lime-400" : "text-zinc-500")}
            />
            <span className={labelClass(isFood)}>{t("nav.nutrition")}</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
