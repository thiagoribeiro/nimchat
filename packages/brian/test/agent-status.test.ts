import { test } from "node:test";
import assert from "node:assert/strict";
import { supported, project, instanceKey, activeSurfaces, statusStale, statusDuration } from "../src/index.ts";
import type { Block, Event } from "../src/index.ts";
const started="2026-10-07T15:02:00Z";
const view=(revision=1,status="running")=>({title:"Atividade do agente",owner_id:"me",request_id:"request",revision,sequence:revision,status,current_status:status==="completed"?"Concluído":"Pensando",started_at:started,updated_at:started,heartbeat_at:started,finished_at:status==="completed"?"2026-10-07T15:02:40Z":null,history_total:1,active_activities:[],history:[{id:"phase",label:"Pensando",status:"completed",started_at:started,finished_at:"2026-10-07T15:02:20Z",duration_ms:20000}]});
const trust={userId:"me",publishers:new Set(["service"]),agents:new Set(["agent"])};
const event=(id:string,pos:number,content:unknown,type="m.plugin.state.updated",sender="service",room="room"):Event=>({event_id:id,room_seq:pos,content,type,sender_id:sender,room_id:room});
const block:Block={type:"plugin",plugin:"agent_status",version:"1.0",schema_version:"1.0",instance_id:"card",view:view(),fallback_markdown:"Pensando",surface:{auto_pin:true}};
test("agent activity validates and only trusted monotonic snapshots change it",()=>{
 assert.equal(supported(block),true);
 const message=event("card",1,{schema:"brian.message",version:"1.0",body:[block]},"m.ui.message","agent");
 const update=event("done",3,{plugin:"agent_status",instance_id:"card",view:view(3,"completed")});
 const old=event("old",4,{plugin:"agent_status",instance_id:"card",view:view(2)});
 const surface=project([message,update,old,update],trust).get(instanceKey("room","agent_status","card"))!;
 assert.equal(surface.block.view.status,"completed");assert.equal(activeSurfaces(project([message,update],trust)).length,0);
 assert.equal(project([message,{...update,sender_id:"human"}],trust).get(surface.key)?.block.view.status,"running");
 assert.equal(project([message,{...update,room_id:"other"}],trust).get(surface.key)?.block.view.status,"running");
});
test("staleness preserves last activity and stops on terminal status",()=>{
 assert.equal(statusStale(view(),Date.parse(started)+60001),true);
 assert.equal(statusStale(view(),Date.parse(started)+59000),false);
 assert.equal(statusStale(view(2,"completed"),Date.parse(started)+90000),false);
 assert.equal(statusDuration(started,"2026-10-07T15:03:25Z"),"1min 25s");
});
test("personal pins survive completion and malformed reports are unsupported",()=>{
 const done=event("done",2,{plugin:"agent_status",instance_id:"card",view:view(2,"completed")});
 const pin=event("pin",3,{plugin:"agent_status",instance_id:"card",user_pin:true,dismissed:false},"m.ui.surface.preference.updated","me");
 assert.equal(activeSurfaces(project([done,pin],trust)).length,1);
 assert.equal(supported({...block,view:{...view(),history: [{id:"bad",label:"Missing status"}]}}),false);
});
