// Manual smoke test against a running Nimlet — not a unit test, just a quick end-to-end
// proof that the SDK's request shapes match the live server. It registers throwaway users.
// Run with:
//   SMOKE_BASE_URL=http://localhost:8080 npx tsx packages/sdk/smoke.ts
// Import directly from client.ts/storage.ts, not the barrel index.ts — index.ts also
// re-exports the zustand-backed stores, and zustand's default entry pulls in `react`, which
// this standalone Node script (unlike apps/web or apps/mobile) doesn't have installed.
import { NimletClient } from "./src/client.js";
import { InMemoryTokenStorage } from "./src/storage.js";

const baseUrl = process.env.SMOKE_BASE_URL;
if (!baseUrl) throw new Error("set SMOKE_BASE_URL to a Nimlet server");

async function main() {
  const suffix = Date.now().toString(36);
  const a = new NimletClient({
    baseUrl,
    storage: new InMemoryTokenStorage(),
  });
  const b = new NimletClient({
    baseUrl,
    storage: new InMemoryTokenStorage(),
  });

  const alice = await a.register({
    username: `sdk_smoke_alice_${suffix}`,
    password: "sdk-smoke-test-password-1",
    display_name: "SDK Smoke Alice",
    device_name: "smoke-script",
  });
  console.log("registered alice:", alice.user_id);

  const bob = await b.register({
    username: `sdk_smoke_bob_${suffix}`,
    password: "sdk-smoke-test-password-1",
    display_name: "SDK Smoke Bob",
    device_name: "smoke-script",
  });
  console.log("registered bob:", bob.user_id);

  const me = await a.me();
  console.log("alice /me:", me.user_id === alice.user_id ? "matches register response" : "MISMATCH");

  const resolved = await a.resolveUsername(`sdk_smoke_bob_${suffix}`);
  console.log("resolved bob by username:", resolved.user_id === bob.user_id ? "matches" : "MISMATCH");

  const room = await a.createRoom({ name: `sdk-smoke-room-${suffix}` });
  console.log("created room:", room.room_id);

  await a.inviteUser(room.room_id, bob.user_id);
  await b.joinRoom(room.room_id);
  console.log("bob joined room");

  const aliceRooms = await a.listRooms();
  const inList = aliceRooms.rooms.some((r) => r.room_id === room.room_id && r.state === "join");
  console.log("alice's GET /rooms includes the new room as joined:", inList);

  const sent = await a.sendEvent(room.room_id, "m.room.message", `smoke-${suffix}`, {
    msgtype: "m.text",
    body: "hello from the sdk smoke test",
  });
  console.log("sent event:", sent.event_id, "room_seq:", sent.room_seq);

  const synced = await b.sync({ timeout: 5000 });
  const found = synced.events.find((e) => e.event_id === sent.event_id);
  if (!found) {
    throw new Error(
      `bob's /sync did not return alice's event — got ${synced.events.length} events`,
    );
  }
  console.log("bob synced and saw:", found.content);

  // dir="f" without from lists history oldest-first, ordered by room_seq.
  const history = await b.getMessages(room.room_id, { dir: "f", limit: 10 });
  console.log("history chunk length:", history.chunk.length);
  const seqs = history.chunk.map((e) => e.room_seq);
  if (seqs.some((s, i) => i > 0 && s <= seqs[i - 1])) throw new Error(`room_seq not increasing: ${seqs}`);
  if (!history.chunk.some((e) => e.event_id === sent.event_id && e.room_seq === sent.room_seq)) {
    throw new Error("history does not contain the sent event at its room_seq");
  }

  console.log("\nSMOKE TEST OK");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
