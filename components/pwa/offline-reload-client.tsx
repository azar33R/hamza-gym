"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Button that re-checks connectivity and reloads when back online. Also
// listens for the browser `online` event to auto-reload.
export function OfflineReloadClient() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function reload() {
    if (navigator.onLine) {
      window.location.href = "/";
    }
  }

  return (
    <Button
      onClick={reload}
      disabled={!online}
      className="mt-6 gap-2"
      variant={online ? "default" : "outline"}
    >
      <RefreshCw className="h-4 w-4" />
      {online ? "Try again" : "Waiting for connection…"}
    </Button>
  );
}
