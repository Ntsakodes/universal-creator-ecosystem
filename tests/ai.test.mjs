import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDraft } from '../packages/domain/ai.mjs';
const base={enabled:true,key:'test-key',model:'test-model',endpoint:'https://provider.example/messages'};
test('AI is fail-closed when disabled or provider is unsupported',async()=>{
  await assert.rejects(generateDraft({...base,enabled:false,provider:'openai-compatible'},'help','text'),{status:503});
  await assert.rejects(generateDraft({...base,provider:'unknown'},'help','text'),{status:503});
  await assert.rejects(generateDraft({...base,endpoint:'http://provider.example',provider:'anthropic'},'help','text'),{status:503});
});
test('OpenAI-compatible adapter sends only chosen source, limits output, and labels drafts',async()=>{
  let request;
  const response=await generateDraft({...base,provider:'openai-compatible'},'Suggest a structure','Selected work text',async(url,init)=>{request={url,init};return{ok:true,json:async()=>({choices:[{message:{content:'A draft'}}]})};});
  const body=JSON.parse(request.init.body);
  assert.equal(request.init.headers.authorization,'Bearer test-key');
  assert.equal(request.init.redirect,'error');
  assert.equal(body.model,'test-model');assert.equal(body.max_completion_tokens,1500);
  assert.match(body.messages[1].content,/<untrusted_source>\nSelected work text/);
  assert.equal(response.text,'A draft');assert.match(response.notice,/review/i);
});
test('Anthropic adapter normalises text blocks and ignores tool content',async()=>{
  let request;
  const result=await generateDraft({...base,provider:'anthropic'},'Help','Text',async(url,init)=>{request=init;return{ok:true,json:async()=>({content:[{type:'text',text:'First'},{type:'tool_use',name:'ignored'},{type:'text',text:'Second'}]})};});
  assert.equal(request.headers['x-api-key'],'test-key');
  assert.equal(result.text,'First\nSecond');
});
test('provider errors and empty responses are not presented as successful drafts',async()=>{
  await assert.rejects(generateDraft({...base,provider:'anthropic'},'help','text',async()=>({ok:false})),{status:502});
  await assert.rejects(generateDraft({...base,provider:'openai-compatible'},'help','text',async()=>({ok:true,json:async()=>({})})),{status:502});
});
