"use client";

import { t } from "@nimchat/i18n";
import { useAuthStore } from "@nimchat/sdk";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Client-side equivalent of Clerk's authMiddleware route protection — there's no
// server-side session cookie to check at the edge here, so gating happens after hydrate()
// (see AuthProvider) resolves whether the stored token is actually valid.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        {t("Loading...")}
      </div>
    );
  }
  if (status === "anonymous") {
    return null;
  }
  return <>{children}</>;
}
