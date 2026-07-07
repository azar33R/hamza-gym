// ============================================================================
//  i18n config — shared by server + client.
//
//  Strategy: a single `locale` cookie drives everything. No URL prefixes, no
//  route restructuring. Arabic is the DEFAULT locale; users can toggle to
//  English. The cookie is read server-side (root layout, Server Components)
//  and seeded into the client provider so there's no flash-of-wrong-language.
// ============================================================================

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

// Arabic is the app default — the gym's primary audience is Arabic-speaking.
export const DEFAULT_LOCALE: Locale = "ar";

// Cookie name. Read by the root layout (next/headers cookies()) and set by
// the setLocale server action.
export const LOCALE_COOKIE = "locale";

// Cookie lifetime for the preference. 1 year is plenty for a UI preference.
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Arabic is right-to-left; English is left-to-right.
export function isRTL(locale: Locale): boolean {
  return locale === "ar";
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return isRTL(locale) ? "rtl" : "ltr";
}

// Coerce an arbitrary string (e.g. a raw cookie value) into a valid Locale.
export function normalizeLocale(raw: string | null | undefined): Locale {
  if (raw && (LOCALES as readonly string[]).includes(raw)) {
    return raw as Locale;
  }
  return DEFAULT_LOCALE;
}

// Human label for each locale, shown in the language toggle.
export const LOCALE_LABELS: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};
