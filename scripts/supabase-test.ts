import { readSupabaseTestConfiguration } from '../apps/api/src/supabase-test/config.js';
import { createSupabaseTestApplication } from '../apps/api/src/supabase-test/app.js';
async function main() {
  const config=readSupabaseTestConfiguration();
  const app=await createSupabaseTestApplication(config);
  await app.listen(4000,'127.0.0.1');
  console.log('Supabase testing API on 127.0.0.1:4000. Dummy data only; payments and live AI disabled.');
}
main().catch(()=>{console.error('Supabase test startup failed. Check the testing guide and run npm run supabase:test:prepare first. Credentials were not printed.');process.exitCode=1;});
