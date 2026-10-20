import { test, expect } from "@playwright/test";
import { mockBackend, form, agentView } from "./fixtures";
test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: "ignoreErrors" });
});

test("saved form sends all values and reconciles authoritative snapshots", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.goto("/rooms/room/surfaces/form_stateful/form_stateful");
  await expect(page.getByLabel("Ativo", { exact: true })).toHaveValue("true");
  await expect(page.getByLabel("Quantidade", { exact: true })).toHaveValue(
    "0"
  );
  await page.getByLabel("Cidade", { exact: true }).fill("Natal");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect.poll(() => api.state.commands.length).toBe(1);
  expect(api.state.commands[0].content.payload.values).toEqual({
    ...form.view.values,
    city: "Natal"
  });
  await expect(
    page.getByRole("button", { name: "Salvar", exact: true })
  ).toBeDisabled();
  api.update(
    "form_stateful",
    {
      ...form.view,
      revision: 2,
      values: { ...form.view.values, city: "Natal validado" }
    },
    api.state.commands[0]
  );
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue(
    "Natal validado"
  );
  await expect(page.getByLabel("Cidade", { exact: true })).toBeEnabled();
  await page.getByLabel("Nome *", { exact: true }).fill("Ana local");
  api.update("form_stateful", {
    ...form.view,
    revision: 3,
    values: { ...form.view.values, city: "Salvador" }
  });
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue(
    "Salvador"
  );
  await expect(page.getByLabel("Nome *", { exact: true })).toHaveValue(
    "Ana local"
  );
});

test("failed form transport preserves the draft and retries identical payload", async ({
  page
}) => {
  const api = await mockBackend(page);
  api.state.loseCommandResponse = true;
  await page.goto("/rooms/room/surfaces/form_stateful/form_stateful");
  await page.getByLabel("Cidade", { exact: true }).fill("Natal");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tentar novamente", exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue(
    "Natal"
  );
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect.poll(() => api.state.commands.length).toBe(2);
  expect(api.state.commands[1]).toEqual(api.state.commands[0]);
});

test("workflow title and poll question are rendered; empty votes are not sent", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.goto("/rooms/room/surfaces/workflow/workflow");
  await expect(
    page.getByText("Validar documento", { exact: false })
  ).toBeVisible();
  await page.goto("/rooms/room/surfaces/poll/poll");
  await expect(
    page.getByText("Quais opções escolher?", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: /Opção A/ }).click();
  await expect(
    page.getByText("Mantenha ao menos uma opção selecionada.")
  ).toBeVisible();
  expect(api.state.commands).toHaveLength(0);
  await page.getByRole("button", { name: /Opção B/ }).click();
  await expect.poll(() => api.state.commands.length).toBe(1);
  expect(api.state.commands[0].content.payload.option_ids).toEqual([
    "a",
    "b"
  ]);
});

test("pending approval survives reload, ignores a forged update and shows rejection", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.goto("/rooms/room/surfaces/approval/approval");
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect(
    page.getByText("Aguardando resposta do plugin…")
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Aprovar", exact: true })
  ).toBeDisabled();
  const command = api.state.commands[0];
  api.update(
    "approval",
    {
      title: "Aprovação pendente",
      owner_id: "me",
      revision: 2,
      status: "approved"
    },
    command,
    "attacker"
  );
  await page.waitForTimeout(350);
  await expect(
    page.getByRole("button", { name: "Aprovar", exact: true })
  ).toBeDisabled();
  api.publish("m.plugin.command.rejected", {
    plugin: "approval",
    instance_id: "approval",
    command_event_id: command.eventId,
    reason: "expired"
  });
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Comando recusado: expired" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Entendi", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Aprovar", exact: true })
  ).toBeEnabled();
});

test("pending command is resolved while its focus view is closed", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.goto("/rooms/room/surfaces/approval/approval");
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect.poll(() => api.state.commands.length).toBe(1);
  await page
    .getByRole("link", { name: "Mensagens", exact: false })
    .click();
  api.update(
    "approval",
    {
      title: "Aprovação pendente",
      owner_id: "me",
      revision: 2,
      status: "approved"
    },
    api.state.commands[0]
  );
  await expect(
    page.getByRole("link", { name: /Aprovação pendente.*Aprovado/ })
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("nimchat:pending:v1:me") ?? "{}")
      )
    )
    .toEqual({});
});

test("waiting more than 30 seconds offers an idempotent retry", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.clock.install();
  await page.goto("/rooms/room/surfaces/approval/approval");
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect(
    page.getByText("Aguardando resposta do plugin…")
  ).toBeVisible();
  await page.clock.fastForward(31000);
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect.poll(() => api.state.commands.length).toBe(2);
  expect(api.state.commands[1]).toEqual(api.state.commands[0]);
});

test("mobile home exposes conversations and drawer closes for navigation and modals", async ({
  page
}) => {
  await mockBackend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Abrir conversas", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("link", { name: "Sala teste", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/rooms\/room$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Abrir conversas", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Nova conversa", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Nova conversa", exact: true })
  ).toBeVisible();
  await page.waitForTimeout(400);
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') !== null
    )
  ).toBe(true);
});

test("new invitation appears within a foreground polling interval", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Sala teste", exact: true })
  ).toBeVisible();
  api.state.rooms.push({
    room_id: "new-invite",
    name: "Novo convite",
    state: "invite",
    role: "member",
    join_rule: "invite_only"
  });
  await expect(
    page.getByRole("button", {
      name: "Opções do convite para Novo convite",
      exact: true
    })
  ).toBeVisible({ timeout: 20000 });
});

test("acceptance opens the room even if the subsequent room list fails", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "Opções do convite para Convite teste",
      exact: true
    })
    .click();
  api.state.failRooms = true;
  await page
    .getByRole("menuitem", {
      name: "Aceitar convite para Convite teste",
      exact: true
    })
    .click();
  await expect(page).toHaveURL(/\/rooms\/invited$/);
  await expect(
    page.getByRole("heading", { name: "Convite teste", exact: true })
  ).toBeVisible();
});

test("messages, surfaces, focus, preferences and origin remain connected", async ({
  page
}) => {
  await mockBackend(page);
  await page.goto("/rooms/room");
  await page.getByRole("link", { name: /Cadastro salvo.*Abrir/ }).click();
  await expect(page).toHaveURL(/surfaces\/form_stateful\/form_stateful$/);
  await page.getByRole("button", { name: "Fixar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Desafixar", exact: true })
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Superfícies desta conversa", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fixadas", exact: true })
  ).toBeVisible();
  await page.getByRole("link", { name: /Cadastro salvo/ }).click();
  await page
    .getByRole("link", { name: "Ver origem", exact: true })
    .click();
  await expect(page).toHaveURL(/focusEvent=card-form_stateful/);
  await expect(
    page.locator('[id="event-card-form_stateful"]')
  ).toHaveClass(/ring-2/);
});

test("latest trusted agent status remains inline and expandable", async ({
  page
}) => {
  const api = await mockBackend(page);
  await page.goto("/rooms/room");
  await expect(
    page.getByText("Pensando QA", { exact: true }).last()
  ).toBeVisible();
  api.update("agent_status", {
    ...agentView,
    revision: 2,
    sequence: 2,
    status: "completed",
    current_status: "Concluído QA",
    finished_at: new Date().toISOString()
  });
  await expect(
    page.getByText("Concluído QA", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Expandir atividade do agente",
      exact: true
    })
    .click();
  await expect(page.getByText(/Primeira etapa QA/)).toBeVisible();
  api.update("agent_status", { ...agentView, revision: 1, sequence: 1 });
  await page.waitForTimeout(350);
  await expect(
    page.getByText("Concluído QA", { exact: true })
  ).toBeVisible();
});

test("failed text send preserves the message draft", async ({ page }) => {
  const api = await mockBackend(page);
  api.state.failText = true;
  await page.goto("/rooms/room");
  await page
    .getByPlaceholder("Mensagem para Sala teste")
    .fill("Rascunho preservado");
  await page.getByPlaceholder("Mensagem para Sala teste").press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "texto foi preservado" })
  ).toBeVisible();
  await expect(
    page.getByPlaceholder("Mensagem para Sala teste")
  ).toHaveValue("Rascunho preservado");
});

test("publisher-only agent status remains in messages after completion and reload", async ({
  page
}) => {
  const api = await mockBackend(page);
  api.state.events = api.state.events.filter(
    (event) => event.event_id !== "card-agent_status"
  );
  api.update("agent_status", agentView);
  await page.goto("/rooms/room");
  await expect(page.getByText("Pensando QA", { exact: true })).toHaveCount(
    1
  );
  await page
    .getByRole("button", {
      name: "Expandir atividade do agente",
      exact: true
    })
    .click();
  await expect(page.getByText(/Primeira etapa QA/)).toBeVisible();
  api.update("agent_status", {
    ...agentView,
    revision: 2,
    sequence: 2,
    status: "completed",
    current_status: "Concluído QA",
    finished_at: new Date().toISOString()
  });
  await expect(
    page.getByText("Concluído QA", { exact: true })
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByText("Concluído QA", { exact: true })
  ).toHaveCount(1);
  await expect(page.getByText(/Primeira etapa QA/)).toBeVisible();
});

test("invitation menu dismisses locally, survives refresh/reload and restores without joining", async ({
  page
}) => {
  const api = await mockBackend(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "Opções do convite para Convite teste",
    exact: true
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      /O convite continua no servidor e nos outros dispositivos/
    )
  ).toBeVisible();
  await page
    .getByRole("menuitem", {
      name: "Dispensar neste dispositivo",
      exact: true
    })
    .click();
  await expect(trigger).toHaveCount(0);
  await page
    .getByRole("button", { name: "Atualizar conversas", exact: true })
    .click();
  await page.reload();
  await expect(trigger).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Mostrar convites dispensados neste dispositivo (1)",
      exact: true
    })
    .click();
  await trigger.click();
  await page
    .getByRole("menuitem", { name: "Restaurar convite", exact: true })
    .click();
  await expect(trigger).toBeFocused();
  expect(
    api.state.rooms.find((room) => room.room_id === "invited")?.state
  ).toBe("invite");
  expect(writes).toEqual([]);
});

test("mobile invitation menu supports keyboard dismissal and reopening", async ({
  page
}) => {
  await mockBackend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Abrir conversas", exact: true })
    .click();
  const trigger = page.getByRole("button", {
    name: "Opções do convite para Convite teste",
    exact: true
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: /Aceitar convite para/ })
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", {
      name: "Dispensar neste dispositivo",
      exact: true
    })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Mostrar convites dispensados neste dispositivo (1)",
      exact: true
    })
    .click();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: /Aceitar convite para/ })
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

for (const width of [1280, 390])
  test(`agent activity and reply share one block without publisher identity (${width}px)`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const api = await mockBackend(page);
    api.state.events = api.state.events.filter(
      (event) => event.event_id !== "card-agent_status"
    );
    api.update("agent_status", agentView);
    await page.goto("/rooms/room");
    const turn = page
      .locator("[data-agent-turn]")
      .filter({ hasText: "Pensando QA" });
    await expect(turn).toHaveCount(1);
    await expect(turn.getByText("Agente QA", { exact: true })).toHaveCount(
      1
    );
    const key = await turn.getAttribute("data-agent-turn");
    await expect(
      page.getByText("Publisher QA", { exact: true })
    ).toHaveCount(0);
    await turn
      .getByRole("button", {
        name: "Expandir atividade do agente",
        exact: true
      })
      .click();
    const response = api.publish(
      "m.room.message",
      {
        body: "Resposta no mesmo bloco",
        metadata: { request_event_id: "qa" }
      },
      "review-agent"
    );
    api.update("agent_status", {
      ...agentView,
      revision: 2,
      sequence: 2,
      status: "completed",
      current_status: "Concluído QA",
      finished_at: new Date().toISOString()
    });
    const completed = page
      .locator("[data-agent-turn]")
      .filter({ hasText: "Resposta no mesmo bloco" });
    await expect(completed).toHaveCount(1);
    await expect(completed).toHaveAttribute("data-agent-turn", key!);
    await expect(
      completed.getByText("Concluído QA", { exact: true })
    ).toBeVisible();
    await expect(
      completed.getByText("Agente QA", { exact: true })
    ).toHaveCount(1);
    await expect(completed.getByText(/Primeira etapa QA/)).toBeVisible();
    await expect(
      page.locator(`[id="event-${response.event_id}"]`)
    ).toHaveCount(1);
    await page.reload();
    await expect(
      page
        .locator("[data-agent-turn]")
        .filter({ hasText: "Resposta no mesmo bloco" })
    ).toHaveCount(1);
    await expect(
      page.getByText("Publisher QA", { exact: true })
    ).toHaveCount(0);
    await testInfo.attach("agent-turn", {
      body: await completed.screenshot(),
      contentType: "image/png"
    });
  });

test("a reload resumes /sync from the cached cursor and shows cached messages at once", async ({
  page
}) => {
  const api = await mockBackend(page);
  const syncs: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/sync") syncs.push(url.search);
  });
  await page.goto("/rooms/room");
  await expect(page.getByText("Cadastro salvo").first()).toBeVisible();
  expect(syncs[0]).not.toContain("since=");
  // A batch with events is what carries a cursor to persist.
  api.publish("m.room.message", { msgtype: "m.text", body: "Mensagem em cache" }, "me");
  await expect(page.getByText("Mensagem em cache")).toBeVisible();
  // Past the persister debounce, so the snapshot with the cursor is written.
  await page.waitForTimeout(700);

  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/rooms/room/messages**", async (route) => {
    await held;
    await route.fallback();
  });
  syncs.length = 0;
  await page.reload();
  // /messages is still held: these come from the local snapshot.
  await expect(page.getByText("Mensagem em cache")).toBeVisible();
  await expect(page.getByText("Cadastro salvo").first()).toBeVisible();
  await expect.poll(() => syncs.length).toBeGreaterThan(0);
  expect(syncs[0]).toContain("since=opaque-qa-cursor");
  release();
});

test("a reload without network reopens the cached conversation instead of the login", async ({
  page
}) => {
  await mockBackend(page);
  await page.goto("/rooms/room");
  await expect(page.getByText("Cadastro salvo").first()).toBeVisible();
  // Past the persister debounce, so the snapshot (rooms included) is written.
  await page.waitForTimeout(700);
  await page.route("https://nimlet.test/**", (route) => route.abort("internetdisconnected"));
  await page.reload();
  await expect(page.getByText("Cadastro salvo").first()).toBeVisible();
  await expect(page).toHaveURL(/\/rooms\/room$/);
});

test("a session the server rejects mid-use goes back to the login", async ({
  page
}) => {
  await mockBackend(page);
  await page.goto("/rooms/room");
  await expect(page.getByText("Cadastro salvo").first()).toBeVisible();
  await page.route("https://nimlet.test/sync**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  await expect(page).toHaveURL(/\/login/, { timeout: 45000 });
});
