import assert from "node:assert/strict";
import test from "node:test";
import { useAuthStore } from "../src/auth.ts";
import type { CachedIdentity, IdentityStorage } from "../src/auth.ts";
import { NimletClient } from "../src/client.ts";
import { InMemoryTokenStorage } from "../src/storage.ts";

const me = { user_id: "u1", device_id: "d1", username: "ana", display_name: "Ana" };
const cachedAna: CachedIdentity = { userId: "u1", deviceId: "d1", username: "ana", displayName: "Ana" };
function memory(initial: CachedIdentity | null = null) {
  let value = initial;
  const storage: IdentityStorage = { get: () => value, set: (v) => { value = v; } };
  return { storage, get value() { return value; } };
}
const client = () => new NimletClient({ baseUrl: "https://nimlet.test", storage: new InMemoryTokenStorage() });
const respond = (status: number, body: unknown = {}) => {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
};
const offline = () => {
  globalThis.fetch = (async () => { throw new TypeError("Network request failed"); }) as typeof fetch;
};

test("a reachable server confirms the session and refreshes the cached identity", async () => {
  const id = memory();
  respond(200, me);
  await useAuthStore.getState().hydrate(client(), id.storage);
  assert.equal(useAuthStore.getState().status, "authenticated");
  assert.deepEqual(id.value, cachedAna);
});

test("without network, the cached identity resumes the session", async () => {
  const id = memory(cachedAna);
  offline();
  await useAuthStore.getState().hydrate(client(), id.storage);
  const s = useAuthStore.getState();
  assert.equal(s.status, "authenticated");
  assert.equal(s.userId, "u1");
  assert.deepEqual(id.value, cachedAna);
});

test("a server error also resumes from the cache; only 401/403 log out", async () => {
  const id = memory(cachedAna);
  respond(502);
  await useAuthStore.getState().hydrate(client(), id.storage);
  assert.equal(useAuthStore.getState().status, "authenticated");
  respond(401);
  await useAuthStore.getState().hydrate(client(), id.storage);
  assert.equal(useAuthStore.getState().status, "anonymous");
  assert.equal(id.value, null, "a rejected session forgets the identity");
});

test("without a cached identity, no network still means the login screen", async () => {
  offline();
  await useAuthStore.getState().hydrate(client(), memory().storage);
  assert.equal(useAuthStore.getState().status, "anonymous");
});

test("expire() ends the session and forgets the identity", async () => {
  const id = memory(cachedAna);
  offline();
  await useAuthStore.getState().hydrate(client(), id.storage);
  useAuthStore.getState().expire();
  assert.equal(useAuthStore.getState().isAuthenticated, false);
  assert.equal(id.value, null);
});
