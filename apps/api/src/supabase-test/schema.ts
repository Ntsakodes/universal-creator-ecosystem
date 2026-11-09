import type { PrismaClient } from '@prisma/client';
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
export async function secureTestSchema(db:PrismaClient) {
  await db.$executeRawUnsafe('REVOKE ALL ON SCHEMA "uce_test" FROM anon, authenticated');
  await db.$executeRawUnsafe('REVOKE ALL ON ALL TABLES IN SCHEMA "uce_test" FROM anon, authenticated');
  await db.$executeRawUnsafe('REVOKE ALL ON ALL SEQUENCES IN SCHEMA "uce_test" FROM anon, authenticated');
  await db.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES IN SCHEMA "uce_test" REVOKE ALL ON TABLES FROM anon, authenticated');
  const tables=await db.$queryRaw<Array<{tablename:string}>>`SELECT tablename FROM pg_tables WHERE schemaname='uce_test'`;
  for(const table of tables)await db.$executeRawUnsafe('ALTER TABLE "uce_test".'+quote(table.tablename)+' ENABLE ROW LEVEL SECURITY');
}
