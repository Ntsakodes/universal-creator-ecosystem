import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseTestConfiguration,testConnectionOverride,supabaseTestPath } from '../packages/domain/supabase-test.mjs';

const ref='abcdefghijklmnopqrst';
const safe={NODE_ENV:'development',UCE_SUPABASE_TEST_ONLY:'true',SUPABASE_TEST_PROJECT_REF:ref,SUPABASE_URL:'https://'+ref+'.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_testing',SUPABASE_SECRET_KEY:'sb_secret_testing',DATABASE_URL:'postgresql://postgres.'+ref+':dummy@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?schema=uce_test&sslmode=require'};
test('testing configuration is isolated and contains no live-AI/payment option',()=>{
  const config=supabaseTestConfiguration({...safe,AI_ENABLED:'true',APP_URL:'https://unrelated.example'});
  assert.equal(config.bucket,'uce-test-vault');assert.equal(config.appUrl,'http://127.0.0.1:3000');
  assert.equal(config.AI_ENABLED,undefined);
});
test('testing refuses production mode or absent acknowledgement',()=>{
  assert.throws(()=>supabaseTestConfiguration({...safe,NODE_ENV:'production'}),{status:503});
  assert.throws(()=>supabaseTestConfiguration({...safe,UCE_SUPABASE_TEST_ONLY:'false'}),{status:503});
});
test('database connection must match the selected project and private test schema',()=>{
  for(const databaseUrl of [
    safe.DATABASE_URL.replace('uce_test','public'),
    safe.DATABASE_URL.replace(ref,'anotherproject0000000'),
    safe.DATABASE_URL.replace(':5432',':6543'),
    safe.DATABASE_URL.replace('sslmode=require','sslmode=disable'),
    safe.DATABASE_URL+'&options=search_path%3Dpublic'
  ])assert.throws(()=>supabaseTestConfiguration({...safe,DATABASE_URL:databaseUrl}),{status:503});
});
test('project URL, key separation and scanner destination are validated',()=>{
  assert.throws(()=>supabaseTestConfiguration({...safe,SUPABASE_URL:'https://evil.example'}),{status:503});
  assert.throws(()=>supabaseTestConfiguration({...safe,SUPABASE_SECRET_KEY:safe.SUPABASE_PUBLISHABLE_KEY}),{status:503});
  assert.throws(()=>supabaseTestConfiguration({...safe,CLAMAV_HOST:'scanner.example'}),{status:503});
  assert.throws(()=>supabaseTestConfiguration({...safe,API_BIND_ADDRESS:'0.0.0.0'}),{status:503});
});
test('direct Supabase connection also requires SSL and the private schema',()=>{
  const config=supabaseTestConfiguration({...safe,DATABASE_URL:'postgresql://postgres:dummy@db.'+ref+'.supabase.co:5432/postgres?schema=uce_test&sslmode=require'});
  assert.equal(config.projectRef,ref);
});
test('fixture override cannot become a production database bypass',()=>{
  const url='postgresql://test:test@localhost:5432/uce_supabase_test?schema=uce_test';
  assert.equal(testConnectionOverride(url,'test'),url);
  assert.throws(()=>testConnectionOverride(url,'production'),{status:503});
  assert.throws(()=>testConnectionOverride(url.replace('localhost','db.example'),'test'),{status:503});
});
test('evidence paths cannot overwrite arbitrary files or escape their prefixes',()=>{
  const id='00000000-0000-4000-8000-000000000000';
  assert.equal(supabaseTestPath('quarantine/'+id,'quarantine'),'quarantine/'+id);
  assert.equal(supabaseTestPath('approved/'+id+'/'+'a'.repeat(64),'approved'),'approved/'+id+'/'+'a'.repeat(64));
  for(const path of ['../private','approved/'+id,'quarantine/'+id+'/extra','quarantine/'+id+'?upsert=true'])assert.throws(()=>supabaseTestPath(path,'quarantine'));
});
