import "./globals.css";
import { cn } from "@/lib/utils";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SyncProvider } from "@/components/providers/sync-provider";

import type { Metadata } from "next";
import { headers } from "next/headers";
import { localeFromAcceptLanguage, setLocale, t } from "@nimchat/i18n";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { Open_Sans } from "next/font/google";

const openSans = Open_Sans({ subsets: ["latin"] });

// The HTML depends on the request's Accept-Language, so it is rendered per request.
export const dynamic = "force-dynamic";

function requestLocale() {
  return setLocale(localeFromAcceptLanguage(headers().get("accept-language")));
}

export function generateMetadata(): Metadata {
  requestLocale();
  return {
    title: "NimChat",
    description: t("Conversations and interactive surfaces, in the same context."),
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = requestLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={cn(openSans.className, "bg-[#0B1222]")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          storageKey="nimchat-theme"
        >
          <LocaleProvider locale={locale}>
            <AuthProvider>
              <SyncProvider>
                <ModalProvider />
                {children}
              </SyncProvider>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
