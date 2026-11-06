import { createLocalTestApplication } from '../apps/api/src/local-test/app.js';
async function main() {
  const app=await createLocalTestApplication();
  await app.listen(4000,'127.0.0.1');
  console.log('UCE local test API on 127.0.0.1:4000. Synthetic data only. No cloud services.');
}
main().catch(()=>{console.error('Local test startup failed. Use npm run local:test and check the isolated PostgreSQL container.');process.exitCode=1;});
