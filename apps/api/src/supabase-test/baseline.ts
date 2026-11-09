import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { PrismaClient } from '@prisma/client';

export const bootstrapMigrations = ['202611050001_foundation','202611050002_integrity'] as const;
export async function bootstrapSources() {
  return Promise.all(bootstrapMigrations.map(async name => ({
    name, sql: (await readFile(new URL('../../../../prisma/migrations/'+name+'/migration.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n')
  })));
}
export async function adoptPreparedTestSchema(db:PrismaClient, resolveApplied:(name:string)=>Promise<void>) {
  const exists=await db.$queryRaw<Array<{present:boolean}>>`SELECT to_regclass('uce_test._uce_test_bootstrap') IS NOT NULL AS present`;
  if(!exists[0].present)return;
  const markers=await db.$queryRaw<Array<{migration_name:string;checksum_lf:string}>>`SELECT migration_name,checksum_lf FROM uce_test._uce_test_bootstrap`;
  const sources=await bootstrapSources();
  const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
  if(markers.length!==sources.length || sources.some(s=>markers.find(m=>m.migration_name===s.name)?.checksum_lf!==hash(s.sql)))
    throw new Error('Prepared schema migration checksum mismatch.');
  // Inspect the actual foundation too; a marker alone cannot baseline an empty database.
  const tables=await db.$queryRaw<Array<{tablename:string}>>`SELECT tablename FROM pg_tables WHERE schemaname='uce_test'`;
  const expected=[...sources[0].sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map(m=>m[1]);
  if(expected.some(name=>!tables.some(t=>t.tablename===name)))throw new Error('Prepared schema is incomplete.');
  const triggers=await db.$queryRaw<Array<{tgname:string}>>`SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='uce_test' AND NOT t.tgisinternal AND t.tgenabled='O'`;
  const expectedTriggers=[...sources[1].sql.matchAll(/CREATE TRIGGER (\w+)/g)].map(m=>m[1]);
  if(expectedTriggers.some(name=>!triggers.some(t=>t.tgname===name)))throw new Error('Evidence integrity triggers are missing.');
  const historyExists=await db.$queryRaw<Array<{present:boolean}>>`SELECT to_regclass('uce_test._prisma_migrations') IS NOT NULL AS present`;
  const history=historyExists[0].present
    ?await db.$queryRaw<Array<{migration_name:string;checksum:string;finished_at:Date|null;rolled_back_at:Date|null}>>`SELECT migration_name,checksum,finished_at,rolled_back_at FROM uce_test._prisma_migrations`:[];
  // Validate everything before writing any history. Never repair failed migrations silently.
  if(history.some(h=>!h.finished_at&&!h.rolled_back_at))throw new Error('Unfinished test migration needs review.');
  for(const s of sources) {
    const applied=history.filter(h=>h.migration_name===s.name&&!h.rolled_back_at);
    const allowed=[hash(s.sql),hash(s.sql.replaceAll('\n','\r\n'))];
    if(applied.length>1 || applied.some(h=>!h.finished_at||!allowed.includes(h.checksum)))
      throw new Error('Existing Prisma history differs from the prepared foundation.');
  }
  for(const s of sources)
    if(!history.some(h=>h.migration_name===s.name&&h.finished_at&&!h.rolled_back_at))await resolveApplied(s.name);
}
