import { create } from "zustand";
import { NimletError } from "./client.ts";
import type { NimletClient } from "./client.ts";
import type { LoginRequest, RegisterRequest } from "./types.ts";

// Who was signed in on this device, kept beside the token so a launch without network can
// resume the session (and its cached timeline) instead of falling back to the login screen.
export interface CachedIdentity {
  userId: string;
  deviceId: string | null;
  username: string | null;
  displayName: string | null;
}

// Pluggable like TokenStorage: localStorage on web, a file on mobile.
export interface IdentityStorage {
  get(): CachedIdentity | null | Promise<CachedIdentity | null>;
  set(identity: CachedIdentity | null): void | Promise<void>;
}

interface AuthState {
  status: "idle" | "loading" | "authenticated" | "anonymous";
  isAuthenticated: boolean;
  userId: string | null;
  deviceId: string | null;
  username: string | null;
  displayName: string | null;
  register: (client: NimletClient, req: RegisterRequest) => Promise<void>;
  login: (client: NimletClient, req: LoginRequest) => Promise<void>;
  logout: (client: NimletClient) => Promise<void>;
  // Resumes a session from a token already sitting in storage (e.g. after a page reload) —
  // calls GET /me and treats a rejected token as logged out rather than throwing, since
  // "not authenticated yet" is an expected state here, not an error. When the server can't
  // be reached, a cached identity resumes the session offline.
  hydrate: (client: NimletClient, identity?: IdentityStorage) => Promise<void>;
  // The server rejected the session mid-use (401): back to logged out.
  expire: () => void;
}

// Set by hydrate(), which every app calls on launch, before any login.
let identityStorage: IdentityStorage | undefined;
const remember = (identity: CachedIdentity | null) => {
  try {
    void Promise.resolve(identityStorage?.set(identity)).catch(() => {});
  } catch {}
};
const signedIn = (identity: CachedIdentity) => ({
  status: "authenticated" as const,
  isAuthenticated: true,
  ...identity,
});
const signedOut = {
  status: "anonymous" as const,
  isAuthenticated: false,
  userId: null,
  deviceId: null,
  username: null,
  displayName: null,
};

export const rejectedSession = (err: unknown) =>
  err instanceof NimletError && (err.status === 401 || err.status === 403);

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  isAuthenticated: false,
  userId: null,
  deviceId: null,
  username: null,
  displayName: null,

  register: async (client, req) => {
    const res = await client.register(req);
    const identity = {
      userId: res.user_id,
      deviceId: res.device_id,
      username: req.username,
      displayName: req.display_name,
    };
    remember(identity);
    set(signedIn(identity));
  },

  login: async (client, req) => {
    const res = await client.login(req);
    const identity = {
      userId: res.user_id,
      deviceId: res.device_id,
      username: req.username,
      displayName: null,
    };
    remember(identity);
    set(signedIn(identity));
  },

  logout: async (client) => {
    await client.logout();
    remember(null);
    set(signedOut);
  },

  hydrate: async (client, identity) => {
    identityStorage = identity;
    set({ status: "loading" });
    try {
      const me = await client.me();
      const current = {
        userId: me.user_id,
        deviceId: me.device_id,
        username: me.username,
        displayName: me.display_name,
      };
      remember(current);
      set(signedIn(current));
    } catch (err) {
      if (!rejectedSession(err)) {
        let cached: CachedIdentity | null = null;
        try {
          cached = (await identity?.get()) ?? null;
        } catch {}
        if (cached?.userId) {
          // Offline resume: /sync confirms the session, or expires it, once reachable.
          set(signedIn(cached));
          return;
        }
      } else remember(null);
      set(signedOut);
    }
  },

  expire: () => {
    remember(null);
    set(signedOut);
  },
}));

