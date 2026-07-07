"use client";

import { useEffect, useRef } from "react";
import { markThreadRead } from "@/lib/chat-actions";

// Calls markThreadRead once per mount so the thread shows as read whenever the
// user views it. Silent — the parent renders the actual UI.
export function ChatThreadReadMarker({ otherUserId }: { otherUserId: string }) {
  const calledRef = useRef(false);
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    void markThreadRead(otherUserId);
  }, [otherUserId]);
  return null;
}
