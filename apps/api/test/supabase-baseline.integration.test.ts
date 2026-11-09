import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { adoptPreparedTestSchema, bootstrapSources } from '../src/supabase-test/baseline.js';

test('prepared hosted schema can be adopted, retried and rejects checksum drift',async()=>{
  const url=new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname,'localhost');assert.equal(url.pathname,'/uce_test');
  url.pathname='/uce_supabase_baseline';url.searchParams.set('schema','uce_test');
  const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
  const run=async(args:string[])=>new Promise<void>((resolve,reject)=>{
    const child=spawn(process.execPath,['../../node_modules/prisma/build/index.js',...args],{cwd:process.cwd(),stdio:'inherit',windowsHide:true,env:{...process.env,DATABASE_URL:url.toString()}});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Prisma failed')));
  });
  try {
    // CI creates this disposable fixture from SQL, without Prisma migration history.
    const sources=await bootstrapSources();
    await db.$executeRawUnsafe('CREATE TABLE uce_test._uce_test_bootstrap (migration_name text PRIMARY KEY, checksum_lf text NOT NULL)');
    for(const s of sources)await db.$executeRaw`INSERT INTO uce_test._uce_test_bootstrap VALUES (${s.name},${createHash('sha256').update(s.sql).digest('hex')})`;
    await db.$executeRaw`UPDATE uce_test._uce_test_bootstrap SET checksum_lf='wrong' WHERE migration_name=${sources[0].name}`;
    let calls=0;
    await assert.rejects(()=>adoptPreparedTestSchema(db,async()=>{calls++;}),/checksum mismatch/);assert.equal(calls,0);
    await db.$executeRaw`UPDATE uce_test._uce_test_bootstrap SET checksum_lf=${createHash('sha256').update(sources[0].sql).digest('hex')} WHERE migration_name=${sources[0].name}`;
    await adoptPreparedTestSchema(db,async name=>{calls++;await run(['migrate','resolve','--applied',name]);});
    assert.equal(calls,2);
    await adoptPreparedTestSchema(db,async()=>{throw new Error('Already adopted');});
    await run(['migrate','deploy']);
    const history=await db.$queryRaw<Array<{count:bigint}>>`SELECT count(*) FROM uce_test._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    assert.equal(Number(history[0].count),2);
  } finally {await db.$disconnect();}
});
