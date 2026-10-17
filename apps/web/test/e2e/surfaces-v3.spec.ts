import { test, expect } from "@playwright/test";
import { mockBackend, block } from "./fixtures";
test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: "ignoreErrors" });
});

test("rapid checklist toggles stay optimistic until their own acknowledgements", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.goto("/rooms/room/surfaces/checklist/checklist");
  const checkbox = page.getByRole("checkbox");
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  await expect.poll(() => api.state.commands.length).toBe(1);
  api.update(
    "checklist",
    {
      title: "Documentos QA",
      owner_id: "me",
      revision: 2,
      status: "completed",
      items: [{ id: "a", label: "Passaporte QA", checked: true }]
    },
    api.state.commands[0]
  );
  await expect.poll(() => api.state.commands.length).toBe(2);
  await expect(checkbox).not.toBeChecked();
  expect(api.state.commands[1].content.command).toBe("uncheck_item");
  api.update(
    "checklist",
    {
      title: "Documentos QA",
      owner_id: "me",
      revision: 3,
      status: "open",
      items: [{ id: "a", label: "Passaporte QA", checked: false }]
    },
    api.state.commands[1]
  );
  await expect(
    page.getByText("Aguardando resposta do plugin…")
  ).not.toBeVisible();
  await expect(checkbox).not.toBeChecked();
});

test("technical rooms appear only as shared surfaces and open directly in focus", async ({
  page
}) => {
  const api = await mockBackend(page);
  const name = "#shared-surface:11111111-1111-4111-8111-111111111111#";
  api.state.rooms.push({
    room_id: "shared",
    name,
    state: "join",
    role: "member",
    join_rule: "invite_only"
  });
  const b = block("checklist", {
    title: "Compras da família",
    status: "open",
    items: [{ id: "milk", label: "Leite", checked: false }],
    acl: { me: "editor" },
    shared: {
      id: "11111111-1111-4111-8111-111111111111",
      room_id: "shared",
      participants: [{ user_id: "me", username: "Alice", state: "join" }]
    }
  });
  api.publish(
    "m.plugin.instance.created",
    { plugin: "checklist", instance_id: "checklist", view: b.view },
    "review-publisher",
    "shared"
  );
  await page.goto("/");
  await expect(page.getByText(name, { exact: true })).not.toBeVisible();
  await page
    .getByRole("tab", { name: "Superfícies", exact: true })
    .click();
  await page.getByRole("link", { name: /Compras da família/ }).click();
  await expect(page).toHaveURL(/\/shared\/shared$/);
  await expect(
    page.getByRole("heading", { name: "Compras da família", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pedir ao Brian", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(/Criada em|Data de criação indisponível/)
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/surfaces-v3-shared.png",
    fullPage: true
  });
  api.state.rooms.find((r) => r.room_id === "shared")!.state = "leave";
  await page.getByRole("button", { name: "Atualizar conversas" }).click();
  await expect(
    page.getByText(
      "Aceite o convite em Superfícies para acessar esta superfície."
    )
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeVisible();
});

test("mentions carry validated identities independently of their visible name", async ({
  page
}) => {
  await mockBackend(page);
  await page.goto("/rooms/room");
  const input = page.getByPlaceholder("Mensagem para Sala teste");
  await input.fill("Brian, na @Doc");
  await page
    .getByRole("button", { name: /@Documentos QA · Checklist/ })
    .click();
  const request = page.waitForRequest((r) =>
    r.url().includes("/send/m.room.message/")
  );
  await input.press("Enter");
  const payload = (await request).postDataJSON();
  expect(payload.metadata.surface_references[0]).toMatchObject({
    type: "reference",
    kind: "surface",
    room_id: "room",
    metadata: { plugin: "checklist", instance_id: "checklist" }
  });
});


test("waiting activity offers an explicit reply target and composer sends its correlation", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.goto("/rooms/room");
  const source = api.state.events.find(
    (e) => e.event_id === "card-agent_status"
  )!;
  const initial = (source.content as any).body[0].view;
  api.update("agent_status", {
    ...initial,
    status: "waiting_user",
    current_status: "Qual horário?",
    finished_at: new Date().toISOString(),
    sequence: 2,
    revision: 2
  });
  await page
    .getByRole("button", {
      name: "Responder a esta solicitação",
      exact: true
    })
    .click();
  await expect(
    page.getByText(/Respondendo à solicitação selecionada/)
  ).toBeVisible();
  const outgoing = page.waitForRequest((r) =>
    r.url().includes("/send/m.room.message/")
  );
  await page.getByPlaceholder("Mensagem para Sala teste").fill("Às oito");
  await page.getByPlaceholder("Mensagem para Sala teste").press("Enter");
  expect((await outgoing).postDataJSON().metadata.continuation_of).toBe(
    "qa"
  );
});


test("sharing reviews named participants before moving and prevents duplicate confirmation", async ({ page }) => {
  const api = await mockBackend(page);
  await page.goto("/rooms/room/surfaces/checklist/checklist");
  await page.getByRole("button", { name: "Revisar participantes", exact: true }).click();
  await expect.poll(() => api.state.commands.length).toBe(1);
  expect(api.state.commands[0].content.command).toBe("preview_share");
  expect(api.state.commands[0].content.payload.invitees).toEqual([]);
  expect(api.state.commands.some((c) => c.content.command === "share")).toBe(false);
  api.publish("m.plugin.command.rejected", { plugin: "checklist", instance_id: "checklist", command_event_id: api.state.commands[0].eventId, reason: "Escolha com quem compartilhar. Nenhum convite foi enviado." });
  await expect(page.getByText(/Escolha com quem compartilhar/)).toBeVisible();
  await page.getByRole("button", { name: "Entendi", exact: true }).click();
  await page.getByLabel("Convidados por nome de usuário").fill("Carolina");
  await page.getByRole("button", { name: "Revisar participantes", exact: true }).click();
  await expect.poll(() => api.state.commands.length).toBe(2);
  const view = { title: "Documentos QA", owner_id: "me", revision: 2, status: "open", items: [{ id: "a", label: "Passaporte QA", checked: false }], sharing_preview: { token: "approved-selection", invitees: ["Carolina"], expires_at: new Date(Date.now()+600000).toISOString(), participants: [{ user_id: "me", username: "Alice" }, { user_id: "carol", username: "Carolina" }] } };
  api.update("checklist", view, api.state.commands[1]);
  await expect(page.getByText("@Carolina", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar compartilhamento", exact: true }).click();
  expect(api.state.commands.some((c) => c.content.command === "share")).toBe(false);
  await page.getByRole("button", { name: "Revisar participantes", exact: true }).click();
  await expect.poll(() => api.state.commands.length).toBe(3);
  api.update("checklist", { ...view, revision: 3 }, api.state.commands[2]);
  const confirm = page.getByRole("button", { name: "Confirmar compartilhamento", exact: true });
  page.once("dialog", (d) => { expect(d.message()).toContain("@Carolina"); return d.dismiss(); });
  await confirm.click();
  expect(api.state.commands.some((c) => c.content.command === "share")).toBe(false);
  page.once("dialog", (d) => d.accept());
  await confirm.click();
  await expect.poll(() => api.state.commands.length).toBe(4);
  expect(api.state.commands[3].content).toMatchObject({ command: "share", payload: { preview_token: "approved-selection" } });
  await expect(confirm).toBeDisabled();
  expect(api.state.commands.filter((c) => c.content.command === "share")).toHaveLength(1);
  api.update("checklist", { ...view, revision: 5, transfer: { phase: "frozen" } });
  // A later snapshot alone cannot clear the command. Its older correlated ACK can.
  api.update("checklist", { ...view, revision: 4, transfer: { phase: "preparing" } }, api.state.commands[3]);
  await expect(page.getByText("Aguardando resposta do plugin…")).not.toBeVisible();
});

test("shared list recovers its publication behind cached messages and older history", async ({ page, context }) => {
  const api = await mockBackend(page);
  const id = "11111111-1111-4111-8111-111111111111";
  api.state.rooms.push({ room_id: "shared-paged", name: `#shared-surface:${id}#`, state: "join", role: "member", join_rule: "invite_only" });
  const card = api.publish("m.plugin.instance.created", { plugin: "checklist", instance_id: "checklist", view: { title: "Publicação antiga QA", owner_id: "me", revision: 1, status: "open", items: [{ id: "a", label: "Item QA", checked: false }], shared: { id, room_id: "shared-paged", participants: [] } } }, "review-publisher", "shared-paged");
  api.state.queue.splice(0);
  const message = api.publish("m.room.message", { body: "Mensagem posterior QA", msgtype: "m.text" }, "me", "shared-paged");
  let requests = 0;
  await context.route("https://nimlet.test/rooms/shared-paged/messages**", async (route) => {
    requests++;
    const older = new URL(route.request().url()).searchParams.has("from");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(older ? { chunk: [card], start: 1, end: 1 } : { chunk: [message], start: 150, end: 150 }) });
  });
  await page.goto("/");
  await expect.poll(() => api.state.queue.length).toBe(0);
  await page.getByRole("tab", { name: "Superfícies", exact: true }).click();
  await expect(page.getByRole("link", { name: /Publicação antiga QA/ })).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(2);
});
