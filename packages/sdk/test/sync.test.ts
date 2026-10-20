import assert from "node:assert/strict";
import test from "node:test";
import { NimletClient } from "../src/client.ts";
import { InMemoryTokenStorage } from "../src/storage.ts";
import { SyncEngine } from "../src/sync.ts";

// A /sync that never answers until its request is aborted.
function hangingFetch() {
  const signals: AbortSignal[] = [];
  globalThis.fetch = ((_url: string, init: RequestInit = {}) => {
    const signal = init.signal as AbortSignal;
    signals.push(signal);
    return new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
    );
  }) as typeof fetch;
  return signals;
}

const tick = () => new Promise((r) => setTimeout(r, 10));

test("stop() aborts the open long-poll without reporting an error", async () => {
  const signals = hangingFetch();
  const errors: unknown[] = [];
  const engine = new SyncEngine({
    client: new NimletClient({ baseUrl: "https://nimlet.test", storage: new InMemoryTokenStorage() }),
    onEvents: () => {},
    onError: (e) => errors.push(e),
  });
  engine.start();
  await tick();
  assert.equal(signals.length, 1);
  engine.stop();
  await tick();
  assert.equal(signals[0].aborted, true, "the server must see the disconnect");
  assert.deepEqual(errors, []);
  assert.equal(signals.length, 1, "a stopped engine does not reopen /sync");
});

test("start() right after stop() reopens /sync at once, without the error backoff", async () => {
  const signals = hangingFetch();
  const errors: unknown[] = [];
  const engine = new SyncEngine({
    client: new NimletClient({ baseUrl: "https://nimlet.test", storage: new InMemoryTokenStorage() }),
    onEvents: () => {},
    onError: (e) => errors.push(e),
  });
  engine.start();
  await tick();
  engine.stop();
  engine.start();
  await tick();
  assert.equal(signals.length, 2);
  assert.equal(signals[1].aborted, false);
  assert.deepEqual(errors, []);
  engine.stop();
  await tick();
});
