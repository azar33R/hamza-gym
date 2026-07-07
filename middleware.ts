import { type NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: import("next/server").NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Match all routes except static assets, Next internals, the service worker,
  // and the offline fallback (which must stay reachable for signed-out users
  // so the SW can precache it during install).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
