import { PrismaClient } from '@prisma/client';
import { readSupabaseTestConfiguration } from '../apps/api/src/supabase-test/config.js';
import { SupabaseGateway } from '../apps/api/src/supabase-test/gateway.js';
import { DomainError } from '../packages/domain/policy.mjs';

let stage='local configuration';
let db:PrismaClient|undefined;
async function main() {
  const config=readSupabaseTestConfiguration();
  console.log('PASS: local configuration format');
  stage='database connection';
  db=new PrismaClient({datasources:{db:{url:config.databaseUrl}}});
  await db.$queryRaw`SELECT 1`;
  console.log('PASS: database connection');
  stage='application tables';
  const unrelated=await db.user.findFirst({where:{NOT:{subject:{startsWith:'sb-test:'+config.projectRef+':'}}},select:{id:true}});
  if(unrelated)throw new Error('Unrelated identities');
  console.log('PASS: application tables and test identity boundary');
  stage='private bucket access';
  await new SupabaseGateway(config).verifyBucket();
  console.log('PASS: server key can read the private test bucket');
  console.log('Preflight passed. Retry npm.cmd run supabase:test; share any subsequent startup error with credentials removed.');
}
main().catch((error:unknown)=>{
  console.error('FAIL: '+stage);
  // Never print provider messages, stacks, metadata, URLs or credentials.
  if(stage==='local configuration' && error instanceof DomainError)console.error(error.message);
  const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
  const hint:Record<string,string>={
    P1000:'Database authentication failed. Check the new database password and its URL encoding.',
    P1001:'Cannot reach the database. Check the copied session-pooler host and project status.',
    P1002:'Database connection timed out.',
    P1011:'TLS connection failed. Check sslmode=require and your network.',
    P1013:'Database URL format is invalid. Check password encoding.',
    P2021:'Application tables are missing. Run the test prepare command.',
    P2022:'Application columns do not match this version of the app.'
  };
  if(/^P[0-9]{4}$/.test(code))console.error('Prisma code: '+code);
  if(hint[code])console.error(hint[code]);
  else if(stage==='private bucket access')console.error('Check that the server secret key belongs to this project and uce-test-vault is private with a file limit of at most 25 MB.');
  else if(stage==='application tables')console.error('Check that setup completed in schema uce_test and it contains only this project’s test identities.');
  else if(stage==='database connection')console.error('Check the database password, session-pooler connection, project status and network.');
  process.exitCode=1;
}).finally(async()=>{await db?.$disconnect();});
