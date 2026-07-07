import { NextResponse } from "next/server";

// Profile creation is now handled by a DB trigger on auth.users.
// This endpoint is no longer needed.
export async function POST() {
  return NextResponse.json({ error: "Deprecated — use DB trigger instead" }, { status: 410 });
}
