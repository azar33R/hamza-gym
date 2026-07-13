// Minimal type declarations for @supabase/ssr (v0.5.2 ships no .d.ts files).
// The project intentionally uses an untyped Database (queries are typed ad-hoc
// via `.returns<T>()` / `.single<T>()`), so returning a bare `SupabaseClient`
// keeps full method typings while leaving row shapes as `any`.
declare module "@supabase/ssr" {
  import type { SupabaseClient } from "@supabase/supabase-js";

  export interface CookieMethodsServer {
    getAll(): { name: string; value: string }[];
    setAll(
      cookiesToSet: {
        name: string;
        value: string;
        options?: Record<string, unknown>;
      }[]
    ): void;
  }

  export interface CookieMethodsServerOptions {
    cookies?: CookieMethodsServer;
    [key: string]: unknown;
  }

  export function createServerClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: CookieMethodsServerOptions
  ): SupabaseClient;

  export function createBrowserClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: Record<string, unknown>
  ): SupabaseClient;
}
