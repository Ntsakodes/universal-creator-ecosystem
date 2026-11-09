import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { supabaseTestConfiguration } from '../../../../packages/domain/supabase-test.mjs';

export type SupabaseTestConfig = ReturnType<typeof supabaseTestConfiguration>;
// Read only the explicit test file. A production .env is never loaded by this entrypoint.
export function readSupabaseTestConfiguration() {
  const values=parseEnv(readFileSync(resolve('.env.supabase-test'),'utf8'));
  return supabaseTestConfiguration({...values,NODE_ENV:process.env.NODE_ENV??'development',API_BIND_ADDRESS:process.env.API_BIND_ADDRESS??values.API_BIND_ADDRESS});
}
