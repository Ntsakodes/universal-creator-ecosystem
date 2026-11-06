import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { INestApplication } from '@nestjs/common';
import { createLocalTestApplication } from '../src/local-test/app.js';
import { Database } from '../src/core.js';
import { LOCAL_APP_URL, LOCAL_IDENTITY_PREFIX } from '../../../packages/domain/local-test.mjs';

let app:INestApplication,db:Database,base:string,directory:string;
before(async()=>{
  if(process.env.NODE_ENV==='production')throw new Error('Not a production test.');
  process.env.NODE_ENV='test';
  const database=new URL(process.env.DATABASE_URL!);database.pathname='/uce_local_test';
  directory=await mkdtemp(join(tmpdir(),'uce-local-test-'));
  app=await createLocalTestApplication({
    databaseUrl:database.toString(),directory,
    // Explicit test fixture. The actual local launcher always uses real ClamAV.
    scanner:async bytes=>{if(bytes.includes('TEST_REJECT'))throw new Error('Simulated scanner rejection.');}
  });
  await app.listen(0,'127.0.0.1');base=await app.getUrl();db=app.get(Database);
});
after(async()=>{await app?.close();if(directory)await rm(directory,{recursive:true,force:true});});
const cookie=(r:Response,name:string)=>r.headers.getSetCookie().find(s=>s.startsWith(name+'='))!.split(';')[0];
async function call(path:string,session='',method='GET',body?:unknown,origin=LOCAL_APP_URL){
  const headers:Record<string,string>={origin};
  if(session)headers.cookie=session;
  if(body!==undefined)headers['content-type']='application/json';
  const res=await fetch(base+'/api/v1/'+path,{method,headers,body:body!==undefined?JSON.stringify(body):undefined,redirect:'manual'});
  const data=res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text();
  return {res,data};
}
async function login(subject:string){
  const form=await fetch(base+'/api/v1/auth/login');
  const html=await form.text();
  const csrf=html.match(/name="csrf" value="([^"]+)"/)![1];
  const user=await db.user.findUniqueOrThrow({where:{subject}});
  const result=await call('auth/local-login',cookie(form,'uce_local_form'),'POST',{userId:user.id,csrf});
  assert.equal(result.res.status,303);
  return {session:cookie(result.res,'uce_session'),userId:user.id};
}
test('local test accounts, registration and private scanned files use the real application API',async()=>{
  assert.equal((await call('local-test/status')).data.liveAi,false);
  const creator=await login(LOCAL_IDENTITY_PREFIX+'creator');
  const collaborator=await login(LOCAL_IDENTITY_PREFIX+'collaborator');
  const p=await call('projects',creator.session,'POST',{title:'Local test film',discipline:'Film and television'});
  assert.equal(p.res.status,201);
  const w=await call('projects/'+p.data.id+'/works',creator.session,'POST',{title:'Dummy manuscript',category:'Script',claimedAuthor:'Test creator',content:'Dummy text only.'});
  assert.equal(w.res.status,201);
  const bytes='Dummy evidence for local testing.';
  const asset=await call('works/'+w.data.id+'/assets',creator.session,'POST',{filename:'dummy.txt',mimeType:'text/plain',size:Buffer.byteLength(bytes)});
  assert.equal(asset.res.status,201);
  assert.match(asset.data.uploadUrl,/^\/api\/v1\/local-files\//);
  const uploaded=await fetch(base+asset.data.uploadUrl,{method:'PUT',headers:{origin:LOCAL_APP_URL,cookie:creator.session,'content-type':'text/plain'},body:bytes});
  assert.equal(uploaded.status,200);
  assert.equal((await call('assets/'+asset.data.assetId+'/download',creator.session,'POST')).res.status,409);
  assert.equal((await call('assets/'+asset.data.assetId+'/complete',creator.session,'POST')).data.status,'READY');
  const version=await call('works/'+w.data.id+'/versions',creator.session,'POST',{content:'Version with scanned evidence.',note:'Local file attached.',assetIds:[asset.data.assetId]});
  assert.equal(version.res.status,201);
  const grant=await call('assets/'+asset.data.assetId+'/download',creator.session,'POST');
  const downloaded=await fetch(base+grant.data.url,{headers:{cookie:creator.session}});
  assert.equal(downloaded.status,200);assert.equal(await downloaded.text(),bytes);
  assert.equal((await call('assets/'+asset.data.assetId+'/download',collaborator.session,'POST')).res.status,403);
  assert.equal((await call('auth/local-login','','POST',{userId:creator.userId,csrf:'forged'})).res.status,403);
  assert.equal((await call('projects',creator.session,'POST',{title:'CSRF',discipline:'Film and television'},'https://evil.invalid')).res.status,403);
  const blocked='TEST_REJECT';
  const bad=await call('works/'+w.data.id+'/assets',creator.session,'POST',{filename:'rejected.txt',mimeType:'text/plain',size:blocked.length});
  await fetch(base+bad.data.uploadUrl,{method:'PUT',headers:{origin:LOCAL_APP_URL,cookie:creator.session,'content-type':'text/plain'},body:blocked});
  assert.equal((await call('assets/'+bad.data.assetId+'/complete',creator.session,'POST')).res.status,503);
  assert.equal((await db.asset.findUniqueOrThrow({where:{id:bad.data.assetId}})).status,'REJECTED');
  assert.equal((await call('ai/runs',creator.session,'POST',{})).res.status,503);
  assert.equal((await call('funding/00000000-0000-4000-8000-000000000000/checkout',creator.session,'POST',{})).res.status,503);
  const form=await fetch(base+'/api/v1/auth/register');
  const csrf=(await form.text()).match(/name="csrf" value="([^"]+)"/)![1];
  const registered=await call('auth/local-register',cookie(form,'uce_local_form'),'POST',{displayName:'New synthetic creator',csrf,acknowledge:'yes'});
  assert.equal(registered.res.status,303);
  const newSession=cookie(registered.res,'uce_session');
  assert.equal((await call('me',newSession)).data.profile.displayName,'New synthetic creator');
  const loggedOut=await call('auth/logout',newSession,'POST');
  assert.equal(loggedOut.res.status,201);
  assert.equal((await call('me',newSession)).res.status,401);
});
