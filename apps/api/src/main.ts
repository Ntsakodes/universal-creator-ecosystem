import { createApplication } from './bootstrap.js';
import { configuration } from './config.js';

async function main(){
  const config=configuration();
  const app=await createApplication();
  // Bind privately by default; deploy behind the web gateway. Override explicitly in a container.
  await app.listen(config.PORT,process.env.API_BIND_ADDRESS??'127.0.0.1');
}
main().catch(()=>{console.error('API startup failed. Verify database and configuration.');process.exitCode=1;});
