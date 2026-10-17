import { test, expect } from "@playwright/test";

const backend = process.env.NIMCHAT_TEST_BACKEND_URL;
test("two real accounts: auth, live invite, DM, sync, pagination, media and reaction", async ({ page, browser, request }) => {
  test.skip(!backend, "Set NIMCHAT_TEST_BACKEND_URL to the isolated local Nimlet server.");
  test.setTimeout(90000);
  const base = new URL(backend!);
  expect(["localhost", "127.0.0.1", "::1"]).toContain(base.hostname);
  const suffix = Date.now().toString(36), password = "local-regression-test-only";
  const nameA = "fix_a_" + suffix, nameB = "fix_b_" + suffix;
  async function api(path: string, token?: string, body?: unknown, method = body ? "POST" : "GET") {
    const response = await request.fetch(base.origin + path, {
      method, headers: token ? { Authorization: "Bearer " + token } : {}, data: body,
    });
    expect(response.ok(), path + " HTTP " + response.status()).toBeTruthy();
    return response.status() === 204 ? null : response.json();
  }
  const a = await api("/register", undefined, { username: nameA, password, display_name: "Alice QA", device_name: "qa" });
  const b = await api("/register", undefined, { username: nameB, password, display_name: "Bob QA", device_name: "qa" });
  expect((await api("/me", a.access_token)).user_id).toBe(a.user_id);
  expect((await api("/users/by-username/" + nameB, a.access_token)).user_id).toBe(b.user_id);
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  try {
    for (const context of [page.context(), contextB]) {
      await context.route("https://nimlet.test/**", async (route) => {
        const source = new URL(route.request().url());
        await route.fulfill({ response: await route.fetch({ url: base.origin + source.pathname + source.search }) });
      });
    }
    await contextB.addInitScript((token) => localStorage.setItem("nimchat_access_token", token), b.access_token);
    await page.goto("/login");
    await page.getByPlaceholder("Username").fill(nameA);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText("Bem-vindo ao NimChat")).toBeVisible();
    await pageB.goto("http://127.0.0.1:3106/");
    await expect(pageB.getByText("Bem-vindo ao NimChat")).toBeVisible();
    const roomName = "Sala local " + suffix;
    await page.getByRole("button", { name: "Nova conversa", exact: true }).first().click();
    await page.getByRole("button", { name: /Criar sala Reunir/ }).click();
    await page.getByPlaceholder("general", { exact: true }).fill(roomName);
    await page.getByRole("button", { name: "Criar sala", exact: true }).click();
    await expect(page.getByRole("heading", { name: roomName, exact: true })).toBeVisible();
    const roomId = new URL(page.url()).pathname.split("/")[2];
    await page.getByRole("button", { name: "Convidar pessoa para esta sala", exact: true }).click();
    await page.getByPlaceholder("alice", { exact: true }).fill(nameB);
    await page.getByRole("button", { name: "Enviar convite", exact: true }).click();
    await expect(page.getByText("Convite enviado!", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pageB.getByRole("button", { name: "Opções do convite para " + roomName, exact: true })).toBeVisible({ timeout: 20000 });
    expect((await api("/rooms", b.access_token)).rooms.find((room: { room_id: string }) => room.room_id === roomId).state).toBe("invite");
    await pageB.getByRole("button", { name: "Opções do convite para " + roomName, exact: true }).click();
    await pageB.getByRole("menuitem", { name: "Aceitar convite para " + roomName, exact: true }).click();
    await expect(pageB).toHaveURL(new RegExp("/rooms/" + roomId + "$"));
    expect((await api("/rooms", b.access_token)).rooms.find((room: { room_id: string }) => room.room_id === roomId).state).toBe("join");
    await page.getByPlaceholder("Mensagem para " + roomName).fill("Mensagem local de regressão");
    await page.getByPlaceholder("Mensagem para " + roomName).press("Enter");
    await expect(pageB.getByText("Mensagem local de regressão", { exact: true })).toBeVisible();
    const history = await api("/rooms/" + roomId + "/messages?dir=b&limit=50", b.access_token);
    const source = history.chunk.find((event: { type: string }) => event.type === "m.room.message");
    await api("/rooms/" + roomId + "/send/m.room.reaction/qa-reaction", b.access_token, { relates_to: source.event_id, emoji: "👍" }, "PUT");
    await expect(page.getByText("👍 1", { exact: true })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({ name: "qa.txt", mimeType: "text/plain", buffer: Buffer.from("Arquivo QA local") });
    await expect(pageB.getByText("qa.txt", { exact: true })).toBeVisible();
    const attachments = await api("/rooms/" + roomId + "/messages?dir=b&limit=50", b.access_token);
    const attachment = attachments.chunk.find((event: { type: string }) => event.type === "m.room.attachment");
    const mediaId = attachment.content.content_uri.split("/").at(-1);
    const media = await request.get(base.origin + "/media/" + mediaId, { headers: { Authorization: "Bearer " + b.access_token } });
    expect(await media.text()).toBe("Arquivo QA local");
    for (let i = 0; i < 53; i++) await api("/rooms/" + roomId + "/send/m.room.message/page-" + i, a.access_token, { msgtype: "m.text", body: "Histórico local " + i }, "PUT");
    await pageB.reload();
    const first = await api("/rooms/" + roomId + "/messages?dir=b&limit=50", b.access_token);
    const older = await api("/rooms/" + roomId + "/messages?dir=b&limit=50&from=" + first.end, b.access_token);
    expect(first.chunk).toHaveLength(50); expect(older.chunk.length).toBeGreaterThan(0);
    const sync = await api("/sync?timeout=1", b.access_token);
    expect(typeof sync.next_batch).toBe("string");
    expect((await api("/sync?timeout=1&since=" + encodeURIComponent(sync.next_batch), b.access_token)).next_batch).toBeTruthy();
    await page.getByRole("button", { name: "Nova conversa", exact: true }).first().click();
    await page.getByRole("button", { name: /Mensagem direta Encontrar/ }).click();
    await page.getByRole("textbox", { name: "Nome de usuário", exact: true }).fill(nameA);
    await page.getByRole("button", { name: "Iniciar conversa", exact: true }).click();
    await expect(page.getByText("Escolha outra pessoa.", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Nome de usuário", exact: true }).fill("missing_" + suffix);
    await page.getByRole("button", { name: "Iniciar conversa", exact: true }).click();
    await expect(page.getByText("Usuário não encontrado neste namespace.", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Nome de usuário", exact: true }).fill(nameB);
    await page.getByRole("button", { name: "Iniciar conversa", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mensagem direta", exact: true })).toBeVisible();
    const dmId = new URL(page.url()).pathname.split("/")[2];
    expect((await api("/dm/" + b.user_id, a.access_token, undefined, "POST")).room_id).toBe(dmId);
    expect((await api("/dm/" + a.user_id, b.access_token, undefined, "POST")).room_id).toBe(dmId);
  } finally {
    await page.context().unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
    await contextB.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
    await contextB.close().catch(() => {});
  }
});
