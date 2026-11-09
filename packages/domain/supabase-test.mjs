import { DomainError } from './policy.mjs';

export const SUPABASE_TEST_NOTICE = 'SUPABASE TEST ONLY — dummy data. Payments and live AI are disabled.';
export const SUPABASE_TEST_APP_URL = 'http://127.0.0.1:3000';
export const SUPABASE_TEST_BUCKET = 'uce-test-vault';

export function supabaseTestConfiguration(env) {
  if (!['development','test'].includes(env.NODE_ENV ?? 'development')) throw new DomainError('Supabase testing cannot run in production.',503);
  if (env.UCE_SUPABASE_TEST_ONLY !== 'true') throw new DomainError('Explicit test-only acknowledgement is required.',503);
  const ref=env.SUPABASE_TEST_PROJECT_REF;
  if (typeof ref!=='string'||!(/^[a-z0-9]{20}$/).test(ref)) throw new DomainError('Supply the dedicated test project reference.',503);
  if (env.SUPABASE_URL!=='https://'+ref+'.supabase.co') throw new DomainError('The Supabase URL must match the dedicated test project.',503);
  if (!env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY || env.SUPABASE_PUBLISHABLE_KEY===env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY.startsWith('sb_publishable_')) throw new DomainError('Separate public and server-only test keys are required.',503);
  let database;
  try { database=new URL(env.DATABASE_URL); } catch { throw new DomainError('Supply the test database connection string.',503); }
  const direct=database.hostname==='db.'+ref+'.supabase.co'&&decodeURIComponent(database.username)==='postgres';
  const pooler=database.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(database.username)==='postgres.'+ref;
  const allowed=new Set(['schema','sslmode','connection_limit','pool_timeout','connect_timeout']);
  if(database.protocol!=='postgresql:'||(!direct&&!pooler)||!['','5432'].includes(database.port)||database.pathname!=='/postgres'||database.searchParams.getAll('schema').length!==1||database.searchParams.get('schema')!=='uce_test'||database.searchParams.get('sslmode')!=='require'||[...database.searchParams.keys()].some(k=>!allowed.has(k))) {
    throw new DomainError('Use this project’s direct or session-pooler connection on port 5432, schema uce_test, with sslmode=require.',503);
  }
  if(env.API_BIND_ADDRESS&&env.API_BIND_ADDRESS!=='127.0.0.1') throw new DomainError('The testing API must bind to loopback.',503);
  const port=Number(env.CLAMAV_PORT??3310);
  if(!Number.isInteger(port)||port<1||port>65535)throw new DomainError('Invalid local scanner port.',503);
  if(env.CLAMAV_HOST&&!['localhost','127.0.0.1','::1'].includes(env.CLAMAV_HOST))throw new DomainError('The test scanner must be local.',503);
  return {
    projectRef:ref,url:env.SUPABASE_URL,publicKey:env.SUPABASE_PUBLISHABLE_KEY,secretKey:env.SUPABASE_SECRET_KEY,
    databaseUrl:env.DATABASE_URL,bucket:SUPABASE_TEST_BUCKET,appUrl:SUPABASE_TEST_APP_URL,
    scannerHost:env.CLAMAV_HOST??'127.0.0.1',scannerPort:port
  };
}

export function testConnectionOverride(databaseUrl,nodeEnv) {
  const u=new URL(databaseUrl);
  if(nodeEnv!=='test'||u.protocol!=='postgresql:'||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/uce_supabase_test'||u.searchParams.get('schema')!=='uce_test') {
    throw new DomainError('Adapter fixtures require an isolated loopback test database.',503);
  }
  return databaseUrl;
}

export function supabaseTestPath(path,kind) {
  const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const expression=kind==='quarantine'?'^quarantine/'+uuid+'$':'^approved/'+uuid+'/[0-9a-f]{64}$';
  if(!new RegExp(expression).test(path))throw new DomainError('Invalid test evidence path.',400);
  return path;
}
