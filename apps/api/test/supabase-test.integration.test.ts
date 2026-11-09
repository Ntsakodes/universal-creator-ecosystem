import 'reflect-metadata';
import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createSupabaseTestApplication } from '../src/supabase-test/app.js';
import { SupabaseGateway,type SupabaseTestGateway,type Identity } from '../src/supabase-test/gateway.js';
import { secureTestSchema } from '../src/supabase-test/schema.js';
import { Database } from '../src/core.js';
import { DomainError,digest } from '../../../packages/domain/policy.mjs';
import { supabaseTestConfiguration,SUPABASE_TEST_APP_URL } from '../../../packages/domain/supabase-test.mjs';

const ref='abcdefghijklmnopqrst';
const config=supabaseTestConfiguration({NODE_ENV:'test',UCE_SUPABASE_TEST_ONLY:'true',SUPABASE_TEST_PROJECT_REF:ref,SUPABASE_URL:'https://'+ref+'.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test',DATABASE_URL:'postgresql://postgres:dummy@db.'+ref+'.supabase.co:5432/postgres?schema=uce_test&sslmode=require'});
class GatewayFixture implements SupabaseTestGateway {
  users=new Map<string,{identity:Identity;password:string}>();
  tokens=new Map<string,Identity>();files=new Map<string,Buffer>();
  async verifyBucket(){}async prepareBucket(){}
  private token(identity:Identity) {
    const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
    const token=encode({alg:'none'})+'.'+encode({sub:identity.id,iss:config.url+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',jti:randomUUID()})+'.fixture';
    this.tokens.set(token,identity);return {accessToken:token};
  }
  async signUp(email:string,password:string,name:string) {
    const identity={id:randomUUID(),email,displayName:name,confirmed:!email.startsWith('pending')};
    this.users.set(email,{identity,password});
    return identity.confirmed?this.token(identity):{accessToken:null};
  }
  async signIn(email:string,password:string) {
    const user=this.users.get(email);
    if(!user||user.password!==password)throw new DomainError('Invalid fixture credentials.',401);
    return this.token(user.identity);
  }
  async identity(token:string) {
    const user=this.tokens.get(token);if(!user)throw new DomainError('Token not verified.',401);return user;
  }
  async uploadIntent(path:string){return config.url+'/storage/v1/object/upload/sign/uce-test-vault/'+path+'?token=test-fixture';}
  async read(path:string){const bytes=this.files.get(path);if(!bytes)throw new DomainError('Fixture file missing.',409);return bytes;}
  async approve(path:string,bytes:Buffer){if(this.files.has(path))throw new DomainError('No overwrite.',409);this.files.set(path,Buffer.from(bytes));}
  async download(path:string){return config.url+'/storage/v1/object/sign/uce-test-vault/'+path+'?token=test-fixture';}
}
let app:INestApplication,db:Database,base:string;
const gateway=new GatewayFixture();
before(async()=>{
  if(process.env.NODE_ENV==='production')throw new Error('Not a production test.');
  process.env.NODE_ENV='test';
  const url=new URL(process.env.DATABASE_URL!);url.pathname='/uce_supabase_test';url.searchParams.set('schema','uce_test');
  app=await createSupabaseTestApplication(config,{databaseUrl:url.toString(),gateway,scanner:async bytes=>{if(bytes.includes('REJECT_DUMMY'))throw new Error('Simulated scanner finding.');}});
  await app.listen(0,'127.0.0.1');base=await app.getUrl();db=app.get(Database);
});
after(async()=>{await app?.close();});
const cookie=(r:Response,name:string)=>r.headers.getSetCookie().find(s=>s.startsWith(name+'='))!.split(';')[0];
async function call(path:string,session='',method='GET',body?:unknown) {
  const headers:Record<string,string>={origin:SUPABASE_TEST_APP_URL};if(session)headers.cookie=session;if(body!==undefined)headers['content-type']='application/json';
  const res=await fetch(base+'/api/v1/'+path,{method,headers,body:body!==undefined?JSON.stringify(body):undefined,redirect:'manual'});
  return {res,data:res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text()};
}
async function register(email:string,name:string) {
  const form=await fetch(base+'/api/v1/auth/register');const csrf=(await form.text()).match(/name="csrf" value="([^"]+)"/)![1];
  return call('auth/supabase-test/register',cookie(form,'uce_sb_form'),'POST',{email,name,password:'testing-password-123',csrf});
}
test('test authentication, isolated tables and private immutable evidence use the existing API',async()=>{
  assert.equal((await call('supabase-test/status')).data.liveAi,false);
  const creator=await register('creator-'+randomUUID()+'@example.invalid','Supabase test creator');
  assert.equal(creator.res.status,303);const session=cookie(creator.res,'uce_session');
  assert.ok(!creator.res.headers.get('set-cookie')?.includes('access_token'));
  const me=await call('me',session);assert.equal(me.data.profile.displayName,'Supabase test creator');
  const stranger=await register('stranger-'+randomUUID()+'@example.invalid','Other test creator');
  assert.equal(stranger.res.status,303);const other=cookie(stranger.res,'uce_session');
  const pending=await register('pending-'+randomUUID()+'@example.invalid','Pending test creator');
  assert.equal(pending.res.status,201);assert.match(pending.data,/Confirm your test email/);assert.ok(!pending.res.headers.get('set-cookie')?.includes('uce_session='));
  assert.equal((await call('auth/supabase-test/login','','POST',{email:'not-authorised@example.invalid',password:'test',csrf:'forged'})).res.status,403);
  const p=await call('projects',session,'POST',{title:'Supabase test project',discipline:'Film and television'});assert.equal(p.res.status,201);
  const w=await call('projects/'+p.data.id+'/works',session,'POST',{title:'Dummy manuscript',category:'Script',claimedAuthor:'Test creator',content:'Dummy evidence text.'});assert.equal(w.res.status,201);
  const bytes=Buffer.from('A dummy text file for Supabase adapter tests.');
  const a=await call('works/'+w.data.id+'/assets',session,'POST',{filename:'dummy.txt',mimeType:'text/plain',size:bytes.length});assert.equal(a.res.status,201);
  assert.equal(a.data.expiresIn,7200);
  const asset=await db.asset.findUniqueOrThrow({where:{id:a.data.assetId}});gateway.files.set(asset.objectKey,bytes);
  assert.equal((await call('assets/'+asset.id+'/download',session,'POST')).res.status,409);
  assert.equal((await call('assets/'+asset.id+'/complete',session,'POST')).data.status,'READY');
  const recorded=await db.asset.findUniqueOrThrow({where:{id:asset.id}});
  assert.equal(recorded.sha256,digest(bytes));assert.equal(recorded.objectVersion,'approved/'+asset.id+'/'+digest(bytes));
  assert.equal((await call('assets/'+asset.id+'/download',other,'POST')).res.status,403);
  assert.match((await call('assets/'+asset.id+'/download',session,'POST')).data.url,/approved/);
  const version=await call('works/'+w.data.id+'/versions',session,'POST',{content:'With approved test evidence.',note:'Immutable test file.',assetIds:[asset.id]});assert.equal(version.res.status,201);
  assert.equal((await call('assets/'+asset.id+'/complete',session,'POST')).res.status,409);
  const rejected=await call('works/'+w.data.id+'/assets',session,'POST',{filename:'rejected.txt',mimeType:'text/plain',size:13});
  const bad=await db.asset.findUniqueOrThrow({where:{id:rejected.data.assetId}});gateway.files.set(bad.objectKey,Buffer.from('REJECT_DUMMY!'));
  assert.equal((await call('assets/'+bad.id+'/complete',session,'POST')).res.status,503);
  assert.equal((await db.asset.findUniqueOrThrow({where:{id:bad.id}})).status,'REJECTED');
  await secureTestSchema(db);
  const access=await db.$queryRaw<Array<{allowed:boolean}>>`SELECT has_schema_privilege('anon','uce_test','USAGE') AS allowed`;assert.equal(access[0].allowed,false);
  const rls=await db.$queryRaw<Array<{enabled:boolean}>>`SELECT c.relrowsecurity AS enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='uce_test' AND c.relname='User'`;assert.equal(rls[0].enabled,true);
  assert.equal((await call('ai/runs',session,'POST',{})).res.status,503);
  assert.equal((await call('funding/00000000-0000-4000-8000-000000000000/checkout',session,'POST',{})).res.status,503);
  await call('auth/logout',session,'POST');assert.equal((await call('me',session)).res.status,401);
});
test('Supabase Storage SDK disables overwrite and scopes signed URLs to the test bucket',async()=>{
  const original=globalThis.fetch;const requests:Array<{url:string;headers:Headers}>=[];
  globalThis.fetch=async(input,init)=>{
    const url=String(input);const headers=new Headers(init?.headers);requests.push({url,headers});
    if(url.endsWith('/bucket/uce-test-vault'))return new Response(JSON.stringify({id:'uce-test-vault',name:'uce-test-vault',public:false,file_size_limit:26214400}),{status:200,headers:{'content-type':'application/json'}});
    if(url.includes('/object/upload/sign/'))return new Response(JSON.stringify({url:'/object/upload/sign/uce-test-vault/quarantine/00000000-0000-4000-8000-000000000000?token=dummy'}),{status:200,headers:{'content-type':'application/json'}});
    throw new Error('Unexpected SDK endpoint in test.');
  };
  try {
    const sdk=new SupabaseGateway(config);await sdk.verifyBucket();
    const signed=await sdk.uploadIntent('quarantine/00000000-0000-4000-8000-000000000000');
    assert.match(signed,/uce-test-vault/);
    assert.notEqual(requests.at(-1)!.headers.get('x-upsert'),'true');
    assert.ok(requests.every(r=>r.url.startsWith(config.url+'/storage/v1/')));
  } finally {globalThis.fetch=original;}
});
