"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { unreadChatCount } from "@/lib/chat-actions";

export function ChatUnreadBadge() {
  const { t } = useI18n();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      const { count } = await unreadChatCount();
      if (active) setCount(count);
    };
    tick();
    const id = setInterval(tick, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (count <= 0) return null;
  return (
    <span className="absolute end-1 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}
