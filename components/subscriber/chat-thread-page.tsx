"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markThreadRead } from "@/lib/chat-actions";

// Calls markThreadRead once per mount so the thread shows as read whenever the
// user views it. Silent — the parent renders the actual UI. Refreshes the route
// afterwards so the bottom-nav badge and inbox clear without a manual reload.
export function ChatThreadReadMarker({ otherUserId }: { otherUserId: string }) {
  const router = useRouter();
  const calledRef = useRef(false);
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    void markThreadRead(otherUserId).then(() => router.refresh());
  }, [otherUserId, router]);
  return null;
}
