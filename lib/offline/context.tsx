"use client";

// ============================================================================
//  OfflineProvider — the React context every component reads from.
//
//  Exposes: isOnline, isSyncing, pendingCount, lastSyncedAt, syncNow().
//  Drives automatic sync on mount, focus, visibilitychange, and the browser
//  `online` event. Also polls the pending queue count so badges stay current.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { syncNow, flushQueue } from "./sync";
import { getQueueCount, getLastSynced } from "./db";
import { offlineStorageAvailable } from "./db";

type OfflineContextValue = {
  isOnline: boolean;
  storageAvailable: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  storageAvailable: false,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  syncNow: async () => {},
});

export function useOffline() {
  return useContext(OfflineContext);
}

// Hook for components that want a "X ago" label for stale cached data.
export function useRelativeStaleness(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Probe real connectivity — navigator.onLine is unreliable in some PWA/WebView contexts.
async function probeConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("/manifest.webmanifest", {
      cache: "no-store",
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refreshing = useRef(false);

  const refreshPending = useCallback(async () => {
    try {
      setPendingCount(await getQueueCount());
      setLastSyncedAt((await getLastSynced()) ?? null);
    } catch {
      // ignore
    }
  }, []);

  const doSync = useCallback(
    async (force = false) => {
      if (refreshing.current) return;
      if (!isOnline) return;
      refreshing.current = true;
      setIsSyncing(true);
      try {
        await syncNow(force);
        await refreshPending();
      } finally {
        refreshing.current = false;
        setIsSyncing(false);
      }
    },
    [isOnline, refreshPending]
  );

  const syncNowHandler = useCallback(async () => {
    await doSync(true);
  }, [doSync]);

  useEffect(() => {
    setStorageAvailable(offlineStorageAvailable());

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Active connectivity probe — corrects false navigator.onLine in PWA/WebView.
    probeConnectivity().then((ok) => {
      setIsOnline(ok);
    });

    // Periodic re-probe to catch spurious offline events.
    const probeInterval = setInterval(() => {
      probeConnectivity().then((ok) => setIsOnline(ok));
    }, 30000);

    if (storageAvailable) {
      const onVisible = () => {
        if (document.visibilityState === "visible") {
          doSync(false);
        }
      };
      const onFocus = () => doSync(false);

      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", onFocus);

      doSync(false);
      refreshPending();

      const pollId = setInterval(refreshPending, 15000);

      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", onFocus);
        clearInterval(pollId);
        clearInterval(probeInterval);
      };
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(probeInterval);
    };
  }, [storageAvailable, doSync, refreshPending]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        storageAvailable,
        isSyncing,
        pendingCount,
        lastSyncedAt,
        syncNow: syncNowHandler,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

// Small helper to call after enqueueing a write while online — kicks an
// immediate flush so the user doesn't wait for the next interval.
export function useEnqueueThenFlush() {
  return useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      await flushQueue();
    }
  }, []);
}
