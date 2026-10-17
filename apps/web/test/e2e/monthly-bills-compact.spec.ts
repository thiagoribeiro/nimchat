import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";
const month = new Date()
  .toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  .slice(0, 7);
const names = [
  "Água (Casa da praia)",
  "Luz (Casa da praia)",
  "Internet (Casa da praia)",
  "Água (Apartamento)",
  "Luz (Apartamento)",
  "Internet (Apartamento)",
  "Escola (Crianças)",
  "Inglês (Crianças)",
  "Futebol (Crianças)",
  "Karatê (Crianças)",
  "Celular",
  "Terreno",
  "Faxina",
  "Guardar",
  "Condomínio (Casa da praia)"
];
function fixture() {
  const items = names.map((name, id) => ({
    id: String(id),
    name,
    due_day: 10,
    active: true,
    group: name.includes("Casa da praia")
      ? "Casa da praia"
      : name.includes("Apartamento")
        ? "Apartamento"
        : name.includes("Crianças")
          ? "Crianças"
          : null
  }));
  return {
    title: "Contas a pagar QA",
    owner_id: "me",
    revision: 1,
    status: "open",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    selected_period: month,
    items,
    periods: {
      [month]: {
        entries: Object.fromEntries(
          items.map((i) => [
            i.id,
            {
              item_id: i.id,
              name: i.name,
              due_date: month + "-10",
              status: "pending",
              confirmed_amount_minor: null,
              suggested_amount_minor: i.id === "0" ? 12000 : null,
              suggestion_source_period: "2026-09"
            }
          ])
        )
      }
    }
  };
}
async function setup(page: any) {
  const api = await mockBackend(page);
  const view = fixture();
  api.publish("m.plugin.instance.created", {
    plugin: "monthly_bills",
    instance_id: "monthly_bills",
    view
  });
  await page.goto("/rooms/room/surfaces/monthly_bills/monthly_bills");
  return { api, view };
}
test.afterEach(async ({ context }) =>
  context.unrouteAll({ behavior: "ignoreErrors" })
);
test("four compact groups fit a phone and keep only the last opened group", async ({
  page
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setup(page);
  const groups = ["Apartamento", "Casa da praia", "Crianças", "Outros"];
  for (const name of groups)
    await expect(
      page.getByRole("button", { name: new RegExp("^" + name) })
    ).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: "+ Adicionar conta", exact: true })
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Renomear", exact: true })
  ).not.toBeVisible();
  await page.screenshot({ path: "test-results/bills-compact-360.png" });
  await page.getByRole("button", { name: /^Casa da praia/ }).click();
  await expect(
    page.getByRole("button", { name: /^Água Vence/ })
  ).toBeVisible();
  await page.getByRole("button", { name: /^Crianças/ }).click();
  await expect(
    page.getByRole("button", { name: /^Casa da praia/ })
  ).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Crianças/ })
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Opções de contas" }).click();
  await expect(
    page.getByRole("button", { name: "Gerenciar recorrências" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Renomear", exact: true })
  ).toBeVisible();
});
test("payment keeps draft on network failure, retries same intent and closes only after its receipt", async ({
  page
}) => {
  const { api, view } = await setup(page);
  await page.getByRole("button", { name: /^Casa da praia/ }).click();
  await page.getByRole("button", { name: /^Água Vence/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Estimativa anterior/)).toBeVisible();
  const value = dialog.getByLabel("Valor em R$", { exact: true });
  await value.fill("130,50");
  // Unrelated remote amount change must not discard this unsaved local edit.
  view.revision = 2;
  view.periods[month].entries["0"].suggested_amount_minor = 14000;
  api.update("monthly_bills", view);
  await expect(value).toHaveValue("130,50");
  api.state.loseCommandResponse = true;
  await dialog
    .getByRole("button", { name: "Registrar pagamento", exact: true })
    .click();
  await expect.poll(() => api.state.commands.length).toBe(1);
  await expect(dialog).toBeVisible();
  await expect(value).toHaveValue("130,50");
  await dialog.getByRole("button", { name: "Fechar painel", exact: true }).click();
  await page.getByRole("button", { name: /^Luz Vence/ }).click();
  await expect(dialog.getByRole("heading", { name: names[0], exact: true })).toBeVisible();
  await expect(value).toHaveValue("130,50");
  await dialog
    .getByRole("button", { name: "Reenviar o mesmo comando" })
    .click();
  await expect.poll(() => api.state.commands.length).toBe(2);
  expect(api.state.commands[0].txn).toBe(api.state.commands[1].txn);
  expect(api.state.commands[1].content.payload).toMatchObject({
    confirmed: true,
    amount_minor: 13050,
    period: month,
    item_id: "0"
  });
  view.revision = 3;
  Object.assign(view.periods[month].entries["0"], {
    status: "paid",
    confirmed_amount_minor: 13050,
    paid_amount_minor: 13050,
    paid_by: "me",
    paid_at: new Date().toISOString(),
    paid_on: month + "-17"
  });
  api.update("monthly_bills", view, api.state.commands[1]);
  await expect(dialog).not.toBeVisible();
  await page.getByRole("tab", { name: "Pagas", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Água Pago/ })
  ).toBeVisible();
});
test("saving only amount remains pending and supports editing group and real month selector", async ({
  page
}) => {
  const { api, view } = await setup(page);
  await page.getByRole("button", { name: /^Casa da praia/ }).click();
  await page.getByRole("button", { name: /^Água Vence/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor em R$", { exact: true }).fill("150,00");
  await dialog
    .getByRole("button", { name: "Salvar apenas valor" })
    .click();
  await expect.poll(() => api.state.commands.length).toBe(1);
  expect(api.state.commands[0].content.command).toBe("confirm_amount");
  view.revision = 2;
  view.periods[month].entries["0"].confirmed_amount_minor = 15000 as any;
  api.update("monthly_bills", view, api.state.commands[0]);
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Água Vence/ })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ Adicionar conta", exact: true })
    .click();
  await dialog.getByLabel("Nome da conta").fill("Conta QA");
  await dialog.getByLabel("Grupo", { exact: true }).fill("Nova casa");
  await dialog.getByRole("button", { name: "Salvar conta" }).click();
  await expect.poll(() => api.state.commands.length).toBe(2);
  expect(api.state.commands[1].content.payload.group).toBe("Nova casa");
});

test("large type, touch targets and keyboard dismissal keep the sheet usable", async ({
  page
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setup(page);
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  const region = page.getByRole("region", { name: "Contas a pagar" });
  expect(
    await region.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
  ).toBe(true);
  for (const name of ["Mês anterior", "Próximo mês", "Opções de contas"]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: /^Casa da praia/ }).click();
  await page.getByRole("button", { name: /^Água Vence/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Valor em R$", { exact: true })
  ).toHaveValue("120,00");
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
  ).toBe(true);
  await page.screenshot({
    path: "test-results/bills-sheet-large-type.png"
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("month selector opens a new period through a confirmed command", async ({page}) => {
 const {api,view}=await setup(page);
 const monthButton=page.getByRole("region",{name:"Contas a pagar"}).getByRole("button").nth(1);
 await monthButton.click();await expect(page.getByRole("dialog")).toBeVisible();
 const next=month.slice(0,4)+"-12";
 if(next===month)await page.getByRole("button",{name:"Ano anterior",exact:true}).click();
 await page.getByRole("dialog").getByRole("button",{name:"dezembro",exact:true}).click();
 await expect(page.getByRole("dialog")).not.toBeVisible();
 await expect.poll(()=>api.state.commands.length).toBe(1);
 expect(api.state.commands[0].content.command).toBe("open_period");
 const selected=api.state.commands[0].content.payload.period;
 view.revision=2;view.periods[selected]={entries:{}};api.update("monthly_bills",view,api.state.commands[0]);
 await expect(page.getByText("Preparando mês…")).not.toBeVisible();
});
