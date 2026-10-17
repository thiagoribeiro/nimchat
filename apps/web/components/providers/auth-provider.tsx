"use client";

import { useAuthStore } from "@nimchat/sdk";
import { useEffect } from "react";

import { getNimletClient } from "@/lib/nimlet";

// Resumes a session on page load by calling GET /me with whatever token is already in
// localStorage — replaces Clerk's server-side session cookie resolution, since Nimlet
// auth is a client-held bearer token instead.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate(getNimletClient());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
