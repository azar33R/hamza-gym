import { Dumbbell, WifiOff } from "lucide-react";
import { OfflineReloadClient } from "@/components/pwa/offline-reload-client";

// Brand-consistent offline fallback. Shown when the SW can't reach the server
// AND there's no cached copy of the requested page. Rendered inside the root
// layout, so it shares the app's chrome. Middleware lets this route through
// without auth (so the SW can cache it during install for signed-out users).
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Dumbbell className="h-8 w-8" />
      </div>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-zinc-500">
        <WifiOff className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
        You&apos;re offline
      </h1>
      <p className="mt-2 max-w-xs text-sm text-zinc-400">
        We couldn&apos;t reach the gym. Open the app again once you&apos;re
        connected to sync your latest data.
      </p>
      <p className="mt-1 max-w-xs text-xs text-zinc-600">
        Tip: pages you&apos;ve visited before are available offline from the
        app home screen.
      </p>
      <OfflineReloadClient />
    </div>
  );
}
