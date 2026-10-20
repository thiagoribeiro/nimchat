"use client";

import { useAuthStore } from "@nimchat/sdk";
import type { CachedIdentity, IdentityStorage } from "@nimchat/sdk";
import { useEffect } from "react";

import { getNimletClient } from "@/lib/nimlet";

// Resumes a session on page load by calling GET /me with whatever token is already in
// localStorage — replaces Clerk's server-side session cookie resolution, since Nimlet
// auth is a client-held bearer token instead.
// Not a credential (the token stays in its own key): it only lets a reload without network
// reopen the cached conversations instead of the login screen.
const KEY = "nimchat_identity";
const identity: IdentityStorage = {
  get: () => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) ?? "null") as CachedIdentity | null;
      return typeof data?.userId === "string" ? data : null;
    } catch {
      return null;
    }
  },
  set: (value) => {
    try {
      if (value) localStorage.setItem(KEY, JSON.stringify(value));
      else localStorage.removeItem(KEY);
    } catch {}
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate(getNimletClient(), identity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
