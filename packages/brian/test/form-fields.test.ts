import { test } from "node:test";
import assert from "node:assert/strict";
import { formValues, reconcileDraft, formInputValue, formQuestion } from "../src/form-fields.ts";
const fields=[{id:"enabled",type:"boolean"},{id:"count",type:"number"},{id:"date",type:"date"}];
test("unanswered boolean stays distinct from false and zero",()=>{
 assert.equal(Object.hasOwn(formValues({fields,values:{}}),"enabled"),false);
 assert.deepEqual(formValues({fields,values:{enabled:false,count:0}}),{enabled:false,count:0,date:""});
});
test("dirty drafts survive a remote revision, including explicit false",()=>{
 const draft={values:{enabled:false,count:4},dirty:{enabled:true,count:true}};
 const next=reconcileDraft(draft,{fields,values:{enabled:true,count:9,date:"2026-10-15"}},false);
 assert.deepEqual(next.values,{enabled:false,count:4,date:"2026-10-15"});
 assert.deepEqual(reconcileDraft(draft,{fields,values:{enabled:false,count:4}},true).dirty,{});
});
test("numeric form inputs accept decimal comma and preserve invalid drafts for validation",()=>{
 assert.equal(formInputValue("number","12,50"),12.5);
 assert.equal(formInputValue("number","0"),0);
 for(const invalid of ["","1,2,3","Infinity","1.000,50","1.","abc"]) assert.equal(formInputValue("number",invalid),invalid);
 assert.equal(formInputValue("date","2026-10-15"),"2026-10-15");
});
test("question metadata is only a navigation hint on form cards",()=>{
 const q={question_id:"q",request_event_id:"request"};
 assert.deepEqual(formQuestion({plugin:"form_stateful",metadata:{agent_question:q}}),q);
 assert.equal(formQuestion({plugin:"checklist",metadata:{agent_question:q}}),undefined);
});
