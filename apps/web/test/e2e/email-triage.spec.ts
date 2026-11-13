import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";

// Fictitious mailbox; no real names or addresses.
function fixture() {
  return {
    title: "Email",
    description: "",
    owner_id: "me",
    revision: 1,
    status: "open",
    producer_sequence: 1,
    view: {
      updated_at: "2026-11-13T12:00:00-03:00",
      important: [
        { id: "msg:1", short_id: "0001", from: "Banco QA", subject: "Fatura do cartão", received_at: "2026-11-13T10:00:00-03:00", priority: "act", due: "2099-01-10", amount_cents: 123456, gmail_url: "https://mail.google.com/mail/u/0/#all/abc" },
        { id: "msg:2", short_id: "0002", from: "Ana QA", subject: "Almoço", received_at: "2026-11-13T11:00:00-03:00", priority: "follow", reason: "contato" }
      ],
      recent: [{ id: "msg:3", from: "Loja QA", subject: "Pedido enviado", received_at: "2026-11-13T09:00:00-03:00" }],
      cleanup: {
        week: { archived_wrong: 12, archived_bulk: 340, review: 2 },
        review: [{ id: "grp:a", name: "joao silva pereira", domain: "operadora.example", count: 3, why: "costuma abrir esses emails", samples: [{ date: "2026-11-01", from: "Operadora QA", subject: "Sua conta" }] }],
        wrong: [{ id: "grp:b", name: "joao souza lima", domain: "loja.example", count: 9, samples: [] }],
        batches: [{ id: "20261113-090839-archive-wrong", kind: "archive", count: 1826, at: "2026-11-13T09:08:39-03:00" }]
      }
    },
    decisions: [] as any[]
  };
}
// The plugin journals a command: its receipt releases the next queued one.
function ack(api: any, view: any, i: number) {
  view.revision += 1;
  api.update("email_triage", view, api.state.commands[i]);
}
async function setup(page: any) {
  const api = await mockBackend(page);
  const view = fixture();
  api.publish("m.plugin.instance.created", { plugin: "email_triage", instance_id: "email_triage", view });
  await page.goto("/rooms/room/surfaces/email_triage/email_triage");
  return { api, view };
}
test.afterEach(async ({ context }) => context.unrouteAll({ behavior: "ignoreErrors" }));

test("important mail: bill first, no body, no agent; a tap hides it until the producer applies it", async ({ page }) => {
  const { api, view } = await setup(page);
  await expect(page.getByRole("tab", { name: "Importantes (2)" })).toHaveAttribute("aria-selected", "true");
  const items = page.locator("li");
  await expect(items.first()).toContainText("Banco QA — Fatura do cartão");
  await expect(items.first()).toContainText("Agir até");
  await expect(items.first()).toContainText(/R\$\s?1\.234,56/);
  const gmail = page.getByRole("link", { name: "Abrir no Gmail" }).first();
  await expect(gmail).toHaveAttribute("href", "https://mail.google.com/mail/u/0/#all/abc");
  await expect(gmail).toHaveAttribute("rel", /noopener/);
  await expect(page.getByRole("button", { name: "Pedir ao Brian" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Renomear", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Paguei" }).click();
  await expect.poll(() => api.state.commands.length).toBe(1);
  expect(api.state.commands[0].content).toMatchObject({ plugin: "email_triage", command: "mark_done", payload: { item_id: "msg:1" } });
  await expect(page.getByText("Fatura do cartão")).toHaveCount(0); // optimistic
  // a second tap is queued, not dropped: it goes out after the first receipt
  await page.getByRole("button", { name: "Não era importante" }).click();
  await expect(page.getByText("Almoço")).toHaveCount(0);
  ack(api, view, 0);
  await expect.poll(() => api.state.commands.length).toBe(2);
  expect(api.state.commands[1].content.command).toBe("not_important");

  // the plugin journals both; the producer applies one and reports the other failed
  view.revision = 3;
  view.decisions = [
    { id: "d2", command: "mark_done", target: "msg:1", actor: "me", created_at: "x", state: "pending" },
    { id: "d3", command: "not_important", target: "msg:2", actor: "me", created_at: "x", state: "pending" }
  ];
  api.update("email_triage", view, api.state.commands[1]);
  await expect(page.getByText(/^Aplicando 2 decisão/)).toBeVisible();
  view.revision = 4;
  view.producer_sequence = 2;
  view.view.important = [view.view.important[1]];
  view.decisions[0].state = "applied";
  Object.assign(view.decisions[1], { state: "failed", error: "imap indisponível" });
  api.update("email_triage", view);
  await expect(page.getByText("Não aplicado: imap indisponível")).toBeVisible();
  await expect(page.getByText("Almoço")).toBeVisible(); // failed: back in the list
});

test("recent and cleanup: should-alert, group decisions and a confirmed undo", async ({ page }) => {
  const { api, view } = await setup(page);
  await page.getByRole("tab", { name: "Recentes" }).click();
  await page.getByRole("button", { name: "Devia ter avisado" }).click();
  await expect.poll(() => api.state.commands.length).toBe(1);
  expect(api.state.commands[0].content.payload).toEqual({ item_id: "msg:3" });
  ack(api, view, 0);

  await page.getByRole("tab", { name: "Limpeza" }).click();
  await expect(page.getByText("Nesta semana: 12 de destinatário errado e 340 em massa arquivados; 2 para revisar.")).toBeVisible();
  const review = page.getByRole("region", { name: "Revisar" });
  await review.getByRole("button", { name: /joao silva pereira/ }).click();
  await expect(review.getByText("Operadora QA — Sua conta")).toBeVisible();
  await review.getByRole("button", { name: "Não é meu" }).click();
  await expect.poll(() => api.state.commands.length).toBe(2);
  expect(api.state.commands[1].content).toMatchObject({ command: "group_not_mine", payload: { group_id: "grp:a" } });
  ack(api, view, 1);
  // wrong-recipient groups only offer "it's mine"
  const wrong = page.getByRole("region", { name: "Destinatário errado" });
  await expect(wrong.getByRole("button", { name: "Não é meu" })).toHaveCount(0);
  await wrong.getByRole("button", { name: "É meu" }).click();
  await expect.poll(() => api.state.commands.length).toBe(3);
  ack(api, view, 2);

  const batches = page.getByRole("region", { name: "Lotes" });
  page.once("dialog", (d) => d.dismiss());
  await batches.getByRole("button", { name: "Desfazer" }).click();
  await page.waitForTimeout(300);
  expect(api.state.commands.length).toBe(3); // cancelled: nothing sent
  page.once("dialog", (d) => d.accept());
  await batches.getByRole("button", { name: "Desfazer" }).click();
  await expect.poll(() => api.state.commands.length).toBe(4);
  expect(api.state.commands[3].content).toMatchObject({ command: "undo_batch", payload: { batch_id: "20261113-090839-archive-wrong", confirmed: true } });
});

test("a view from an untrusted sender is ignored", async ({ page }) => {
  const api = await mockBackend(page);
  api.publish("m.plugin.instance.created", { plugin: "email_triage", instance_id: "email_triage", view: fixture() }, "intruder");
  await page.goto("/rooms/room/surfaces/email_triage/email_triage");
  await expect(page.getByText("Fatura do cartão")).toHaveCount(0);
});

test("fits a phone: touch targets and no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setup(page);
  const paid = page.getByRole("button", { name: "Paguei" });
  expect((await paid.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/email-important-360.png", fullPage: true });
  await page.getByRole("tab", { name: "Limpeza" }).click();
  await page.getByRole("button", { name: /joao silva pereira/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/email-cleanup-360.png", fullPage: true });
});
