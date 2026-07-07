import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/config";

import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

// ============================================================================
//  Server-side i18n — used by the root layout + Server Components + Server
//  Actions. The locale is read from the `locale` cookie (default Arabic).
// ============================================================================

// A flat dictionary keyed by dotted string paths (e.g. "nav.home").
export type Dict = Record<string, string>;

const DICTS: Record<Locale, Dict> = {
  ar: ar as Dict,
  en: en as Dict,
};

export const MESSAGES = DICTS; // re-export for the client provider seed.

// Read the locale from the cookie. Falls back to DEFAULT_LOCALE (ar).
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value ?? null;
  return normalizeLocale(raw);
}

// Load the dictionary for a locale.
export async function getDict(locale?: Locale): Promise<Dict> {
  const loc = locale ?? (await getLocale());
  return DICTS[loc] ?? DICTS[DEFAULT_LOCALE];
}

// Build a `t()` bound to a dictionary. Supports {var} interpolation.
export function makeT(dict: Dict) {
  return function t(key: string, vars?: Record<string, string | number>): string {
    let str = dict[key];
    if (str === undefined) {
      // Missing key — fall back to the default locale, then the key itself.
      str = DICTS[DEFAULT_LOCALE][key] ?? key;
    }
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, String(v));
      }
    }
    return str;
  };
}

export type T = ReturnType<typeof makeT>;

// Convenience: get a ready-to-use t() in a Server Component.
export async function getT(): Promise<T> {
  return makeT(await getDict());
}

// Keep TS happy for the JSON imports (TS doesn't know .json resolves by default
// under bundler resolution, but it does — this is just a type assertion).
export const AVAILABLE_LOCALES = LOCALES;
