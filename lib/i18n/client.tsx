"use client";

import React, { createContext, useContext } from "react";
import {
  dir as dirOf,
  type Locale,
} from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/server";

// ============================================================================
//  Client-side i18n context. The dictionary + locale are seeded by the server
//  (the root layout passes them in), so there's NO flash of the wrong language
//  and NO client-side fetch. Client components call useI18n() to get t().
// ============================================================================

type TFn = (key: string, vars?: Record<string, string | number>) => string;

type I18nContextValue = {
  t: TFn;
  locale: Locale;
  dir: "rtl" | "ltr";
};

const I18nContext = createContext<I18nContextValue>({
  t: (key) => key,
  locale: "ar",
  dir: "rtl",
});

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

// Shorthand for just the translator (the common case in client components).
export function useT(): TFn {
  return useContext(I18nContext).t;
}

export function I18nProvider({
  locale,
  dict,
  fallbackDict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  fallbackDict: Dict;
  children: React.ReactNode;
}) {
  const t: TFn = (key, vars) => {
    let str = dict[key] ?? fallbackDict[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, String(v));
      }
    }
    return str;
  };

  const value: I18nContextValue = {
    t,
    locale,
    dir: dirOf(locale),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
