import { NimletClient } from "@nimchat/sdk";

import { SecureStoreTokenStorage } from "./secure-token-storage";

// Nimlet server URL, inlined into the bundle at build time. Mirrors apps/web/lib/nimlet.ts
// without the SSR guard: there's no server-rendering phase in the app.
export const NIMLET_URL = process.env.EXPO_PUBLIC_NIMLET_URL ?? "";

const tokenStorage = new SecureStoreTokenStorage();

let client: NimletClient | null = null;

export function getNimletClient(): NimletClient {
  if (!NIMLET_URL) {
    throw new Error("EXPO_PUBLIC_NIMLET_URL is not set; point it at your Nimlet server");
  }
  if (!client) {
    client = new NimletClient({ baseUrl: NIMLET_URL, storage: tokenStorage });
  }
  return client;
}

// Exposed separately so components that only need the raw token (e.g. to build an
// Authorization header for <Image>/expo-file-system) don't have to reach into the client.
export function getTokenStorage() {
  return tokenStorage;
}
