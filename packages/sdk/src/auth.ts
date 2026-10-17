import { create } from "zustand";
import type { NimletClient } from "./client";
import type { LoginRequest, RegisterRequest } from "./types";

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
  // calls GET /me and treats a failure (no token, expired session) as logged out rather than
  // throwing, since "not authenticated yet" is an expected state here, not an error.
  hydrate: (client: NimletClient) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  isAuthenticated: false,
  userId: null,
  deviceId: null,
  username: null,
  displayName: null,

  register: async (client, req) => {
    const res = await client.register(req);
    set({
      status: "authenticated",
      isAuthenticated: true,
      userId: res.user_id,
      deviceId: res.device_id,
      username: req.username,
      displayName: req.display_name,
    });
  },

  login: async (client, req) => {
    const res = await client.login(req);
    set({
      status: "authenticated",
      isAuthenticated: true,
      userId: res.user_id,
      deviceId: res.device_id,
      username: req.username,
      displayName: null,
    });
  },

  logout: async (client) => {
    await client.logout();
    set({
      status: "anonymous",
      isAuthenticated: false,
      userId: null,
      deviceId: null,
      username: null,
      displayName: null,
    });
  },

  hydrate: async (client) => {
    set({ status: "loading" });
    try {
      const me = await client.me();
      set({
        status: "authenticated",
        isAuthenticated: true,
        userId: me.user_id,
        deviceId: me.device_id,
        username: me.username,
        displayName: me.display_name,
      });
    } catch {
      set({ status: "anonymous", isAuthenticated: false, userId: null, deviceId: null });
    }
  },
}));
