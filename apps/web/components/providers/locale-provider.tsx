"use client";

import { setLocale, type Locale } from "@nimchat/i18n";

// The server picks the locale from Accept-Language and renders <html lang>.
// Setting it here, during render, makes client components produce the same text
// on the server (SSR) and in the browser, so hydration matches.
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  setLocale(locale);
  return <>{children}</>;
}
