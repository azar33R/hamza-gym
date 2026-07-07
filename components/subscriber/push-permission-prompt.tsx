"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function PushPermissionPrompt() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!vapidPublicKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (localStorage.getItem("push-prompt-dismissed") === "1") return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!sub && Notification.permission === "default") setShow(true);
      })
      .catch(() => {});
  }, [vapidPublicKey]);

  async function enable() {
    if (!vapidPublicKey) return;
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setShow(false);
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
    });

    const json = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(json),
    });

    setShow(false);
  }

  function dismiss() {
    setShow(false);
    setDismissed(true);
    localStorage.setItem("push-prompt-dismissed", "1");
  }

  if (!show || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-xl border border-border bg-card p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bell className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-50">{t("push.title")}</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {t("push.desc")}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={enable} className="flex-1">
              {t("push.enable")}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} className="px-2">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
