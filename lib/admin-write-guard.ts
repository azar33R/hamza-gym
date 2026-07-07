"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useOffline } from "@/lib/offline/context";

// Admin write guard. Returns `can(action)` — when offline, it shows a toast
// and returns false so the caller bails out without hitting the (unreachable)
// server action. Use at the top of any admin mutation handler:
//
//   const can = useWriteGuard();
//   if (!can("approve payment")) return;
export function useWriteGuard() {
  const { isOnline } = useOffline();
  return useCallback(
    (actionLabel: string): boolean => {
      if (!isOnline) {
        toast.error(`Can't ${actionLabel} while offline — reconnect and try again.`);
        return false;
      }
      return true;
    },
    [isOnline]
  );
}
