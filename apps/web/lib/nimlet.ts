import { LocalStorageTokenStorage, NimletClient } from "@nimchat/sdk";

// Nimlet server URL, inlined at build time. The browser calls it directly, so the server
// must allow this origin (CORS).
export const NIMLET_URL = process.env.NEXT_PUBLIC_NIMLET_URL ?? "";

let client: NimletClient | null = null;

// Lazy singleton: NimletClient touches window.localStorage via LocalStorageTokenStorage,
// which doesn't exist during Next.js server-side rendering/build — only construct it in the
// browser, the first time a client component actually asks for it.
export function getNimletClient(): NimletClient {
  if (typeof window === "undefined") {
    throw new Error("getNimletClient() called outside the browser");
  }
  if (!NIMLET_URL) {
    throw new Error("NEXT_PUBLIC_NIMLET_URL is not set; point it at your Nimlet server");
  }
  if (!client) {
    client = new NimletClient({
      baseUrl: NIMLET_URL,
      storage: new LocalStorageTokenStorage(),
    });
  }
  return client;
}
