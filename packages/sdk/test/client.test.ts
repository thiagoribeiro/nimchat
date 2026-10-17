import assert from "node:assert/strict";
import test from "node:test";
import { NimletClient, NimletError } from "../src/client.ts";
import { InMemoryTokenStorage } from "../src/storage.ts";

type Call = { url: string; init: RequestInit };

function mockFetch(responses: Array<() => Response>) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request " + url);
    return next();
  }) as typeof fetch;
  return calls;
}
const json = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("login stores the token and later requests send it", async () => {
  const storage = new InMemoryTokenStorage();
  const client = new NimletClient({ baseUrl: "https://nimlet.test/", storage });
  const calls = mockFetch([
    json(200, { access_token: "tok", user_id: "u", device_id: "d" }),
    json(200, { user_id: "u", device_id: "d", username: "alice" }),
  ]);
  await client.login({ username: "alice", password: "pw" } as any);
  assert.equal(await storage.getToken(), "tok");
  await client.me();
  assert.equal(calls[0].url, "https://nimlet.test/login");
  assert.equal(new Headers(calls[0].init.headers).get("Authorization"), null);
  assert.equal(calls[1].url, "https://nimlet.test/me");
  assert.equal(new Headers(calls[1].init.headers).get("Authorization"), "Bearer tok");
});

test("errors carry status and JSON body", async () => {
  const client = new NimletClient({ baseUrl: "https://nimlet.test", storage: new InMemoryTokenStorage() });
  mockFetch([json(404, { error: "not_found" })]);
  await assert.rejects(client.me(), (err: unknown) => {
    assert.ok(err instanceof NimletError);
    assert.equal(err.status, 404);
    assert.deepEqual(err.body, { error: "not_found" });
    return true;
  });
});

test("listRooms follows pagination and refuses a cursor that does not advance", async () => {
  const client = new NimletClient({ baseUrl: "https://nimlet.test", storage: new InMemoryTokenStorage() });
  const calls = mockFetch([
    json(200, { rooms: [{ room_id: "a" }], next: "c1" }),
    json(200, { rooms: [{ room_id: "b" }] }),
  ]);
  const { rooms } = await client.listRooms();
  assert.deepEqual(rooms.map((r) => r.room_id), ["a", "b"]);
  assert.equal(calls[1].url, "https://nimlet.test/rooms?limit=100&after=c1");

  mockFetch([json(200, { rooms: [], next: "same" }), json(200, { rooms: [], next: "same" })]);
  await assert.rejects(client.listRooms(), /did not advance/);
});

test("media URLs keep only the media ID, whatever the server name", () => {
  const client = new NimletClient({ baseUrl: "https://nimlet.test", storage: new InMemoryTokenStorage() });
  assert.equal(client.getMediaUrl("mxc://example.org/abc-123"), "https://nimlet.test/media/abc-123");
  assert.equal(client.getMediaUrl("mxc://nimlet/xyz"), "https://nimlet.test/media/xyz");
});
