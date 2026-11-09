import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { readSupabaseTestConfiguration } from '../apps/api/src/supabase-test/config.js';
import { SupabaseGateway } from '../apps/api/src/supabase-test/gateway.js';
import { secureTestSchema } from '../apps/api/src/supabase-test/schema.js';

async function main() {
  const config=readSupabaseTestConfiguration();
  const db=new PrismaClient({datasources:{db:{url:config.databaseUrl}}});
  try {
    // Fixed test schema only; auth/storage schemas and public tables are not migrated.
    await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS "uce_test"');
    await db.$executeRawUnsafe('REVOKE ALL ON SCHEMA "uce_test" FROM anon, authenticated');
    await new Promise<void>((resolve,reject)=>{
      const child=spawn(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{stdio:'inherit',windowsHide:true,env:{...process.env,DATABASE_URL:config.databaseUrl}});
      child.once('error',()=>reject(new Error('Migration process could not start.')));
      child.once('exit',code=>code===0?resolve():reject(new Error('Test migrations failed.')));
    });
    await secureTestSchema(db);
    await new SupabaseGateway(config).prepareBucket();
    console.log('Dedicated Supabase test schema and private bucket are ready. No production configuration was changed.');
  }finally{await db.$disconnect();}
}
main().catch(()=>{console.error('Test setup failed. Check the dedicated project, session-pooler connection, private bucket settings and server-only keys. Credentials were not printed.');process.exitCode=1;});
