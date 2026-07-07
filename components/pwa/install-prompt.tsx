"use client";

import { useEffect, useState } from "react";
import { Download, X, Share2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "hamza-install-dismissed";

// Returns true when the app is already installed (running as a standalone PWA)
// or added to the home screen. In that case we never show the prompt.
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    // iOS Safari keeps its own non-standard flag.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

// iOS Safari (incl. iPadOS) does not fire beforeinstallprompt — it can only be
// installed via the Share sheet. Detect it so we can show instructions instead.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && notChrome;
}

export function InstallPrompt() {
  const { t, dir } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      // Prevent the browser's default mini-infobar so we can show our own.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onAppInstalled = () => {
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, "1");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // On iOS we can show the instructions banner immediately (the user can't be
    // auto-prompted, so a persistent nudge is the only path).
    if (isIOS()) setVisible(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  if (!visible) return null;

  const ios = !deferred && isIOS();

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-zinc-950/95 px-4 py-3 shadow-2xl backdrop-blur",
        dir === "rtl" ? "text-right" : "text-left"
      )}
      role="dialog"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {ios ? (
            <Share2 className="h-5 w-5" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-50">
            {t("pwa.install_title")}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {ios ? t("pwa.install_ios") : t("pwa.install_body")}
          </p>
        </div>

        {!ios && (
          <button
            onClick={install}
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-lime-400"
          >
            {t("pwa.install_button")}
          </button>
        )}

        <button
          onClick={dismiss}
          aria-label={t("pwa.install_dismiss")}
          className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
