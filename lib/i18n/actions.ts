"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALES,
} from "@/lib/i18n/config";

// Persist the chosen locale to the `locale` cookie. The root layout reads it on
// the next request to set <html lang/dir> + seed the client provider, so the
// whole UI flips instantly (no navigation, no reload of auth state).
export async function setLocale(locale: string): Promise<void> {
  if (!LOCALES.includes(locale as (typeof LOCALES)[number])) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false, // not sensitive; keeping it readable is fine
  });

  // Revalidate the whole tree — every screen renders locale-dependent text.
  revalidatePath("/", "layout");
}
