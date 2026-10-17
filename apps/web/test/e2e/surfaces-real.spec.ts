import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const path = process.env.NIMCHAT_SURFACES_TEST_CONFIG;
test("real plugins: review, transfer, invitation, two editors and monthly payments", async ({ browser, request }) => {
  test.skip(!path, "Run through agent-blocks/scripts/test-surfaces-v3.py with NIMCHAT_BROWSER_TESTS=1.");
  test.setTimeout(150000);
  const c = JSON.parse(readFileSync(path!, "utf8"));
  const base = new URL(c.backend);
  expect(["localhost", "127.0.0.1", "::1"]).toContain(base.hostname);
  const alice = c.users.Alice, bob = c.users.Bob;
  const plugin = (name: string) => c.plugins.find((p: any) => p.name === name);
  async function api(method: string, url: string, token: string, data?: unknown) {
    const result = await request.fetch(url, { method, headers: { Authorization: "Bearer " + token }, data });
    expect(result.ok(), url + " HTTP " + result.status()).toBeTruthy();
    return result.status() === 204 ? null : result.json();
  }
  const contextA = await browser.newContext(), contextB = await browser.newContext();
  const a = await contextA.newPage(), b = await contextB.newPage();
  const errors: string[] = [];
  try {
    for (const [context, user] of [[contextA, alice], [contextB, bob]] as const) {
      await context.route("https://nimlet.test/**", async (route) => {
        const source = new URL(route.request().url());
        await route.fulfill({ response: await route.fetch({ url: base.origin + source.pathname + source.search }) });
      });
      await context.addInitScript((token) => localStorage.setItem("nimchat_access_token", token), user.access_token);
    }
    for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
    const p = plugin("checklist"), key = "browser-" + Date.now();
    const created = await api("POST", p.url + "/instances", p.token, { idempotency_key: key, room_id: c.source_room, owner_id: alice.user_id, title: "Compras browser QA", data: { items: [{ id: "a", label: "Item A QA" }, { id: "b", label: "Item B QA" }] } });
    await api("PUT", base.origin + "/appservice/agent-blocks/rooms/" + c.source_room + "/send/m.ui.message/" + key, "v3-test-as", { schema: "brian.message", version: "1.0", body: [{ type: "plugin", plugin: "checklist", version: "1.0", schema_version: "1.0", instance_id: created.instance_id, view: created.view, fallback_markdown: "Compras QA" }] });
    const state = () => api("GET", p.url + "/instances/" + created.instance_id, p.token);
    await a.goto("/rooms/" + c.source_room + "/surfaces/checklist/" + created.instance_id);
    await expect(a.getByRole("heading", { name: "Compras browser QA", exact: true })).toBeVisible();
    await a.getByLabel("Convidados por nome de usuário").fill("Carol");
    await a.getByRole("button", { name: "Revisar participantes", exact: true }).click();
    await expect(a.getByText("@Carol", { exact: true })).toBeVisible({ timeout: 15000 });
    expect((await state()).view.transfer).toBeUndefined();
    await a.getByRole("button", { name: "Cancelar compartilhamento", exact: true }).click();
    expect((await state()).view.transfer).toBeUndefined();
    await a.getByRole("button", { name: "Revisar participantes", exact: true }).click();
    await expect(a.getByRole("button", { name: "Confirmar compartilhamento", exact: true })).toBeEnabled({ timeout: 15000 });
    a.once("dialog", (dialog) => dialog.accept());
    await a.getByRole("button", { name: "Confirmar compartilhamento", exact: true }).click();
    await expect(a).toHaveURL(/\/shared\//, { timeout: 30000 });
    await expect(a.getByRole("heading", { name: "Compras browser QA", exact: true })).toBeVisible();
    const sharedRoom = new URL(a.url()).pathname.split("/").at(-1)!;
    await b.goto("/");
    await b.getByRole("tab", { name: "Superfícies", exact: true }).click();
    await expect(b.getByRole("button", { name: /Opções do convite para/ }).first()).toBeVisible({ timeout: 15000 });
    // There may also be the monthly invitation from fixture setup.
    const sharedName = (await api("GET", base.origin + "/rooms", bob.access_token)).rooms.find((r: any) => r.room_id === sharedRoom).name;
    // Resolve the matching invitation using its actual accessible label.
    const inviteButtons = b.getByRole("button", { name: /Opções do convite para/ });
    const names = await inviteButtons.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
    const exact = names.find((name) => name?.includes(sharedName));
    if (exact) {
      await b.getByRole("button", { name: exact, exact: true }).click();
    } else {
      // Shared invitations use a friendly title. The backend order is stable.
      const invites = (await api("GET", base.origin + "/rooms", bob.access_token)).rooms.filter((r: any) => r.state === "invite" && r.name.startsWith("#shared-surface:"));
      await inviteButtons.nth(invites.findIndex((r: any) => r.room_id === sharedRoom)).click();
    }
    await b.getByRole("menuitem", { name: /Aceitar convite para/ }).click();
    await expect(b).toHaveURL(new RegExp("/shared/" + sharedRoom + "$"), { timeout: 20000 });
    await expect(b.getByRole("heading", { name: "Compras browser QA", exact: true })).toBeVisible();
    await a.getByRole("checkbox").nth(0).check();
    await b.getByRole("checkbox").nth(1).check();
    for (const page of [a, b]) {
      await expect(page.getByRole("checkbox").nth(0)).toBeChecked();
      await expect(page.getByRole("checkbox").nth(1)).toBeChecked();
    }
    await b.reload();
    await expect(b.getByRole("checkbox").nth(0)).toBeChecked();
    await expect(b.getByRole("checkbox").nth(1)).toBeChecked();

    const bills = plugin("monthly_bills"), room = c.monthly.room_id, id = c.monthly.instance_id;
    await api("POST", base.origin + "/rooms/" + room + "/join", bob.access_token);
    for (const page of [a, b]) await page.goto("/shared/" + room);
    const openEnergy = async (page: any) => {
      const others = page.getByRole("button", { name: /^Outros/ });
      if (await others.getAttribute("aria-expanded") !== "true") await others.click();
      await page.getByRole("button", { name: /^Energia Vence/ }).click();
    };
    await openEnergy(a); await openEnergy(b);
    const amountA = a.getByLabel("Valor em R$", { exact: true }), amountB = b.getByLabel("Valor em R$", { exact: true });
    await expect(amountB).toHaveValue("242,50");
    await amountA.fill("287,40");
    await a.getByRole("button", { name: "Salvar apenas valor", exact: true }).click();
    await expect(a.getByRole("dialog")).not.toBeVisible();
    await expect(amountB).toHaveValue("287,40", { timeout: 15000 });
    await amountB.fill("999,00");
    await openEnergy(a); await amountA.fill("300,00");
    await a.getByRole("button", { name: "Salvar apenas valor", exact: true }).click();
    await expect.poll(async () => (await api("GET", bills.url + "/instances/" + id, bills.token)).view.periods["2026-10"].entries.energy.confirmed_amount_minor).toBe(30000);
    await expect(amountB).toHaveValue("999,00");
    await b.reload(); await openEnergy(b); await expect(amountB).toHaveValue("300,00");
    // Merely opening and closing the confirmation sheet cannot register a payment.
    await b.getByRole("button", { name: "Fechar painel", exact: true }).click();
    expect((await api("GET", bills.url + "/instances/" + id, bills.token)).view.periods["2026-10"].entries.energy.status).toBe("pending");
    await openEnergy(b);
    await b.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
    await expect.poll(async () => (await api("GET", bills.url + "/instances/" + id, bills.token)).view.periods["2026-10"].entries.energy.status).toBe("paid");
    const paid = (await api("GET", bills.url + "/instances/" + id, bills.token)).view.periods["2026-10"].entries.energy;
    expect(paid.paid_amount_minor).toBe(30000); expect(paid.paid_by).toBe(bob.user_id);
    expect(errors).toEqual([]);
  } finally {
    await contextA.unrouteAll({ behavior: "ignoreErrors" }); await contextB.unrouteAll({ behavior: "ignoreErrors" });
    await contextA.close(); await contextB.close();
  }
});

test("real question form: explicit false, save, valid submit and server continuation", async ({ browser, request }) => {
  test.skip(!path, "Run the isolated structured-question harness.");
  const c=JSON.parse(readFileSync(path!,"utf8"));
  test.skip(!c.questions,"NIMCHAT_QUESTION_TESTS=1 required");
  const q=c.questions, base=new URL(c.backend), plugin=c.plugins.find((p:any)=>p.name==='form_stateful');
  const context=await browser.newContext();
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await context.route('https://nimlet.test/**',async route=>{
      const url=new URL(route.request().url());
      await route.fulfill({response:await route.fetch({url:base.origin+url.pathname+url.search})});
    });
    await context.addInitScript(token=>localStorage.setItem('nimchat_access_token',token),c.users.Alice.access_token);
    const state=async()=>{
      const r=await request.get(plugin.url+'/instances/'+q.instance_id,{headers:{Authorization:'Bearer '+plugin.token}});
      expect(r.ok()).toBeTruthy();return (await r.json()).view;
    };
    await page.goto(`/rooms/${q.room_id}/surfaces/form_stateful/${q.instance_id}`);
    await expect(page.getByRole('button',{name:'Responder pelo chat',exact:true})).toBeVisible({timeout:20000});
    await expect(page.getByRole('combobox',{name:/Incluir extra/})).toHaveValue('');
    await page.getByLabel('Dia',{exact:false}).fill('10');
    await page.getByRole('combobox',{name:/Incluir extra/}).selectOption('false');
    await page.getByLabel('Nome',{exact:false}).last().fill('QA browser');
    await page.getByLabel('Data',{exact:false}).fill('2026-10-15');
    await page.getByRole('combobox',{name:/Opção/}).selectOption('A');
    await page.getByRole('button',{name:'Salvar',exact:true}).click();
    await expect.poll(async()=>(await state()).values.extra).toBe(false);
    expect((await state()).status).toBe('draft');
    await page.reload();
    await expect(page.getByRole('combobox',{name:/Incluir extra/})).toHaveValue('false');
    await page.getByRole('button',{name:'Responder pelo chat',exact:true}).click();
    await expect(page).toHaveURL(new RegExp('/rooms/'+q.room_id+'$'));
    await expect(page.getByText('Respondendo à solicitação selecionada')).toBeVisible();
    await page.goto(`/rooms/${q.room_id}/surfaces/form_stateful/${q.instance_id}`);
    await page.getByRole('button',{name:'Enviar formulário',exact:true}).click();
    await expect.poll(async()=>(await state()).status).toBe('submitted');
    await expect.poll(async()=>{
      const r=await request.get(base.origin+'/rooms/'+q.room_id+'/messages?dir=b&limit=100',{headers:{Authorization:'Bearer '+c.users.Alice.access_token}});
      return (await r.json()).chunk.some((e:any)=>e.sender_id===c.bot_id&&e.content?.metadata?.form_instance_id===q.instance_id);
    },{timeout:20000}).toBe(true);
    expect(errors).toEqual([]);
  } finally {await context.close();}
});
