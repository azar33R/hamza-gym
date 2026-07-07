import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every matched request.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) =>
        request.cookies.set(name, value)
      );
      supabaseResponse = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(name, value, options)
      );
    },
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieMethods }
  );

  // IMPORTANT: getUser() must run so the session cookie is refreshed.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth.
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup");

  // Detect whether the user likely has a session locally (the sb-* auth tokens
  // in cookies). When getUser() errors AND we have a session cookie, the
  // failure is almost certainly transient (offline / Supabase unreachable) — so
  // let the request through instead of bounce-redirecting to /login. The app's
  // offline layer will serve cached content; if the session truly expired, the
  // next online request will refresh and redirect as normal.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));

  const userFetchFailed = !!userError;

  if (!user && !isAuthRoute) {
    // No session cookie at all → genuinely signed out → redirect to login.
    if (!hasSessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    // Has a session cookie but getUser() failed → treat as transient. Let it
    // through so cached/offline pages can render. (Only redirect if we can
    // confirm there's no user AND the call succeeded.)
    if (!userFetchFailed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    // Transient failure with an existing cookie → fall through.
    return supabaseResponse;
  }

  if (user && isAuthRoute) {
    // Already signed in → check role and route accordingly.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
