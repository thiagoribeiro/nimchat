import { test } from "node:test";
import assert from "node:assert/strict";
import { setLocale } from "@nimchat/i18n";
import { billSummary, billOpenLabel, groupBills, shiftBillMonth, validBillDate, shortBillName, validMonthlyBills } from "../src/monthly-bills.ts";
setLocale("en");
const names=["water (Beach house)","power (Beach house)","internet (Beach house)","water (City flat)","power (City flat)","internet (City flat)","school (Kids)","english (Kids)","football (Kids)","karate (Kids)","phone","land plot","cleaning","storage","condo (Beach house)"];
const items=names.map((name,id)=>({id:String(id),name,due_day:10,active:true,group:name.includes("Beach house")?"Beach house":name.includes("City flat")?"City flat":name.includes("Kids")?"Kids":null}));
const entries=Object.fromEntries(items.map(i=>[i.id,{item_id:i.id,name:i.name,due_date:"2026-10-10",status:"pending",confirmed_amount_minor:null,suggested_amount_minor:null}]));
const view={title:"Bills",owner_id:"me",revision:1,status:"open",currency:"BRL",timezone:"UTC",selected_period:"2026-10",items,periods:{"2026-10":{entries}}};
test("fifteen recurrences appear once in their explicit groups",()=>{
 const groups=groupBills(view,"2026-10","pending","2026-10-17");
 assert.deepEqual(groups.map(g=>[g.name,g.entries.length]),[["Beach house",4],["City flat",3],["Kids",4],["Other",4]]);
 assert.equal(new Set(groups.flatMap(g=>g.entries.map(e=>e.item_id))).size,15);
 assert.equal(validMonthlyBills(view),true);
});
test("group is presentation-only across historical months and survives archived recurrences",()=>{
 const snapshot=JSON.stringify(view.periods);
 const copy={...view,items:items.map(i=>i.id==="0"?{...i,group:"New house",active:false}:i)};
 const groups=groupBills(copy,"2026-10","all","2026-10-17");
 assert.equal(groups.find(g=>g.name==="New house")?.entries[0].item_id,"0");assert.equal(JSON.stringify(copy.periods),snapshot);
 assert.equal(groupBills({...view,items:items.map(({group,...i})=>i)},"2026-10","all","2026-10-17").find(g=>g.name==="Other")?.entries.length,15);
});
test("unknown, zero, estimate, paid and cancelled are distinct",()=>{
 const list=[{status:"pending",due_date:"2026-10-10",confirmed_amount_minor:0},{status:"pending",due_date:"2026-10-20",suggested_amount_minor:12000},{status:"pending",due_date:"2026-10-10"},{status:"paid",paid_amount_minor:5000},{status:"cancelled",confirmed_amount_minor:99999}];
 const totals=billSummary(list,"2026-10-17");assert.deepEqual(totals,{open:12000,paid:5000,pending:3,overdue:2,unknown:1,estimated:1});
 assert.match(billOpenLabel(totals),/^≈ .*120,00 \+ 1 without amount$/);
 assert.equal(billOpenLabel(billSummary([list[2]],"2026-10-17")),"1 without amount");
 setLocale("pt-BR");assert.equal(billOpenLabel(billSummary([list[2]],"2026-10-17")),"1 sem valor");setLocale("en");
 const big=billSummary(Array.from({length:100},()=>({status:"pending",due_date:"2026-10-20",confirmed_amount_minor:Number.MAX_SAFE_INTEGER})),"2026-10-17");
 assert.equal(big.open,BigInt(Number.MAX_SAFE_INTEGER)*100n);
});
test("ordering, filters and empty groups preserve navigation",()=>{
 const modified={...view,periods:{"2026-10":{entries:{...entries,"0":{...entries["0"],status:"paid",paid_amount_minor:100},"1":{...entries["1"],due_date:"2026-10-25"},"2":{...entries["2"],status:"cancelled"}}}}};
 assert.deepEqual(groupBills(modified,"2026-10","pending","2026-10-17")[0].entries.map(e=>e.item_id),["14","1"]);
 assert.equal(groupBills(modified,"2026-10","paid","2026-10-17")[0].entries.length,1);
 assert.equal(groupBills(modified,"2026-10","all","2026-10-17")[0].entries.length,4);
 assert.equal(groupBills(view,"2026-11","all","2026-10-17").length,4);
});
test("month rollover, real calendar dates and display names",()=>{
 assert.equal(shiftBillMonth("2026-12",1),"2027-01");assert.equal(shiftBillMonth("2026-01",-1),"2025-12");
 assert.equal(validBillDate("2026-02-30"),false);assert.equal(validBillDate("2028-02-29"),true);
 assert.equal(shortBillName("water (Beach house)","Beach house"),"water");assert.equal(shortBillName("land plot","Other"),"land plot");
});
