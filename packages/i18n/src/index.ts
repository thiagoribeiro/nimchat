// Tiny gettext-style translation layer shared by the web and mobile apps.
//
// Source strings are English and double as message keys: `t("Cancel")`.
// Catalogs map them to other languages; a missing entry falls back to English.
// Placeholders use `{name}`: `t("Invite {name}", { name })`.
// When one English string needs different translations, prefix it with a
// context: `t("status::Open")` shows "Open" in English and "Aberto" in pt-BR.
//
// The locale is detected once when this module loads (device/browser locale),
// so module-level code that runs later already sees it. Never call `t()` while a
// module is being evaluated: the web server renders each request after
// `setLocale()` has been called for it.
import { ptBR } from "./pt-BR.ts";

export type Locale = "en" | "pt-BR";
export type Vars = Record<string, string | number>;

const catalogs: Record<Locale, Record<string, string> | undefined> = {
  en: undefined,
  "pt-BR": ptBR,
};

/** Maps any BCP 47 tag to a supported locale. */
export function resolveLocale(tag?: string | null): Locale {
  return tag?.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

/** Device or browser locale tag, e.g. "pt-BR" or "en-US". */
export function detectLocaleTag(): string {
  try {
    if (typeof document !== "undefined" && document.documentElement?.lang)
      return document.documentElement.lang;
    if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en";
  }
}

let current: Locale = resolveLocale(detectLocaleTag());

export function setLocale(tag?: string | null): Locale {
  current = resolveLocale(tag);
  return current;
}

/** The active UI locale; also a valid tag for Intl and toLocale* APIs. */
export function locale(): Locale {
  return current;
}

/** The device time zone, or UTC when it cannot be determined. */
export function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function withoutContext(message: string): string {
  const at = message.indexOf("::");
  return at < 0 ? message : message.slice(at + 2);
}

export function t(message: string, vars?: Vars): string {
  const text = catalogs[current]?.[message] ?? withoutContext(message);
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Marks a message for translation without translating it (for tables read later with t()). */
export const msg = (message: string): string => message;

/** Picks the singular or plural message by `count`, which is also available as `{count}`. */
export function tn(count: number, one: string, other: string, vars?: Vars): string {
  return t(count === 1 ? one : other, { count, ...vars });
}

/** Parses an Accept-Language header into a supported locale. */
export function localeFromAcceptLanguage(header?: string | null): Locale {
  const first = header?.split(",")[0]?.split(";")[0]?.trim();
  return resolveLocale(first);
}

export { ptBR };
