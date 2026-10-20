import { useAuthStore } from "@nimchat/sdk";
import type { CachedIdentity, IdentityStorage } from "@nimchat/sdk";
import { File, Paths } from "expo-file-system";
import { useEffect } from "react";

import { getNimletClient } from "@/lib/nimlet";
import { registerForPushNotificationsAsync } from "@/lib/push-notifications";

// Resumes a session on app launch by calling GET /me with whatever token SecureStore
// already has — mirrors apps/web's auth-provider.tsx (there it's localStorage, here it's
// SecureStore, same hydrate() call either way).
// Not a credential (the token stays in SecureStore): it only lets a launch without network
// reopen the cached conversations instead of the login screen.
const identityFile = () => new File(Paths.document, "nimchat-identity.json");
const identity: IdentityStorage = {
  get: () => {
    try {
      const f = identityFile();
      const data = f.exists ? (JSON.parse(f.textSync()) as CachedIdentity) : null;
      return typeof data?.userId === "string" ? data : null;
    } catch {
      return null;
    }
  },
  set: (value) => {
    try {
      const f = identityFile();
      if (!value) {
        if (f.exists) f.delete();
        return;
      }
      if (!f.exists) f.create();
      f.write(JSON.stringify(value));
    } catch {}
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    hydrate(getNimletClient(), identity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fires for both a fresh login/register and a hydrate-resumed session — either way,
  // isAuthenticated flips true and the device's push token needs (re)registering.
  useEffect(() => {
    if (!isAuthenticated) return;
    void registerForPushNotificationsAsync(getNimletClient());
  }, [isAuthenticated]);

  return <>{children}</>;
}
