"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { syncNow } from "@/lib/offline/sync";

// Registers the service worker (/public/sw.js) on mount. The SW handles:
//  - app-shell precaching + offline fallback (the PWA opens offline)
//  - stale-while-revalidate for static assets
//  - web push notifications
//  - Background Sync (Android) — on iOS, the app-layer sync engine covers it.
//
// Also: listens for the SW's "SYNC_NOW" message (fired by Background Sync) and
// prompts the user to reload when a new SW version is waiting.
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Listen for the Background Sync wake-up message from the SW.
    const onMessage = (event: MessageEvent) => {
      if (event.data === "SYNC_NOW") {
        // The SW was woken by the browser after connectivity returned —
        // flush the offline queue + refresh the snapshot.
        syncNow(true).catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Register Background Sync where the platform supports it, so queued
          // writes flush even if the app is closed. (iOS Safari lacks this —
          // harmless no-op there; foreground sync handles it.)
          try {
            const anyReg = reg as ServiceWorkerRegistration & {
              sync?: { register: (tag: string) => Promise<void> };
            };
            if (anyReg.sync) {
              anyReg.sync.register("hamza-sync").catch(() => {});
            }
          } catch {
            // not supported — ignore
          }

          // When a new SW version is waiting, offer a reload.
          const promptUpdate = () => {
            toast("Update available", {
              description: "A new version of the app is ready.",
              duration: 12000,
              action: {
                label: (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="h-3.5 w-3.5" /> Reload
                  </span>
                ) as unknown as string,
                onClick: () => {
                  reg.waiting?.postMessage("SKIP_WAITING");
                  window.location.reload();
                },
              },
            });
          };

          if (reg.waiting) promptUpdate();
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && reg.waiting) {
                promptUpdate();
              }
            });
          });
        })
        .catch((err) => console.warn("[pwa] SW registration failed:", err));
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
