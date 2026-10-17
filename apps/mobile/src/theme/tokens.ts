// NimChat design tokens. Brand values come from the Nimlet/NimChat brand guide;
// the UX Spec v2 marks them as preliminary, so every screen reads them from here
// instead of hardcoding hex values.
export const brand = {
  mint: "#14D8A6",
  cyan: "#06B6D4",
  blue: "#3B82F6",
  violet: "#8B5CF6",
  lavender: "#A78BFA",
  ink: "#0F172A",
  mist: "#E2E8F0",
  snow: "#F8FAFC",
} as const;

const dark = {
  background: "#0B1222",
  surface: brand.ink,
  surfaceRaised: "#1A2338",
  surfaceSunken: "#0A101E",
  border: "#26324A",
  borderStrong: "#334155",
  text: brand.snow,
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  textFaint: "#64748B",
  primary: brand.violet,
  primarySoft: "rgba(139, 92, 246, 0.16)",
  primaryText: "#FFFFFF",
  accent: brand.blue,
  link: "#93B4FF",
  success: brand.mint,
  info: brand.cyan,
  warning: "#F5B84B",
  danger: "#F87171",
  dangerSoft: "rgba(248, 113, 113, 0.14)",
  overlay: "rgba(5, 8, 18, 0.72)",
};

export type Palette = Record<keyof typeof dark, string>;

// Light values are structured for a future light mode; the app ships dark-only for now.
export const light: Palette = {
  background: brand.snow,
  surface: "#FFFFFF",
  surfaceRaised: "#F1F5F9",
  surfaceSunken: brand.mist,
  border: brand.mist,
  borderStrong: "#CBD5E1",
  text: brand.ink,
  textSecondary: "#334155",
  textMuted: "#64748B",
  textFaint: "#94A3B8",
  primary: brand.violet,
  primarySoft: "rgba(139, 92, 246, 0.10)",
  primaryText: "#FFFFFF",
  accent: brand.blue,
  link: brand.blue,
  success: "#0EA47E",
  info: "#0891B2",
  warning: "#B7791F",
  danger: "#DC2626",
  dangerSoft: "rgba(220, 38, 38, 0.08)",
  overlay: "rgba(15, 23, 42, 0.4)",
};

export const colors: Palette = dark;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
// Android accessibility guidance: interactive targets of at least 48dp.
export const touch = 48;
