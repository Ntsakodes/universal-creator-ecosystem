import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalTestEnvironment, LOCAL_APP_URL, LOCAL_DATABASE } from '../packages/domain/local-test.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const env={...process.env,NODE_ENV:'development',DATABASE_URL:LOCAL_DATABASE,APP_URL:LOCAL_APP_URL,API_INTERNAL_URL:'http://127.0.0.1:4000',API_BIND_ADDRESS:'127.0.0.1',NEXT_TELEMETRY_DISABLED:'1',AI_ENABLED:'false',AI_API_KEY:'',S3_BUCKET:''};
assertLocalTestEnvironment({nodeEnv:process.env.NODE_ENV??'development',databaseUrl:LOCAL_DATABASE,appUrl:LOCAL_APP_URL});
const children=new Set();
function run(command,args,wait=true) {
  const child=spawn(command,args,{cwd:root,env,stdio:'inherit',windowsHide:true});
  children.add(child);
  child.once('exit',()=>children.delete(child));
  if(!wait) { child.on('error',()=>{console.error('A local service could not start.');stop();});child.on('exit',()=>{if(!stopping){console.error('A local service stopped.');stop();}});return child; }
  return new Promise((resolve,reject)=>{
    child.once('error',()=>reject(new Error('Required command not available: '+command)));
    child.once('exit',code=>code===0?resolve():reject(new Error(command+' failed.')));
  });
}
let stopping=false;
function stop() {
  if(stopping)return;
  stopping=true;
  for(const child of children)child.kill('SIGTERM');
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
function scannerReady() {
  return new Promise(resolve=>{
    const socket=createConnection({host:'127.0.0.1',port:3311});
    let settled=false;
    const finish=ok=>{if(!settled){settled=true;socket.destroy();resolve(ok);}};
    socket.setTimeout(2000,()=>finish(false));
    socket.on('error',()=>finish(false));
    socket.on('connect',()=>socket.write('zPING\0'));
    socket.on('data',chunk=>finish(chunk.toString().includes('PONG')));
  });
}
async function main() {
  if(!existsSync(resolve(root,'node_modules/next/dist/bin/next')))throw new Error('Run npm install first.');
  const compose=['compose','-p','uce-local-test','-f','compose.local-test.yaml'];
  await run('docker',[...compose,'up','-d','--wait','postgres']);
  await run('docker',[...compose,'up','-d','clamav']);
  await writeFile(resolve(root,'.env.local-test'),'NODE_ENV=development\nAPP_URL='+LOCAL_APP_URL+'\nAPI_INTERNAL_URL=http://127.0.0.1:4000\nAI_ENABLED=false\nNEXT_TELEMETRY_DISABLED=1\n',{mode:0o600});
  await run(process.execPath,['node_modules/prisma/build/index.js','generate']);
  await run(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy']);
  console.log('Waiting for the local malware scanner. Its first download can take several minutes.');
  let ready=false;
  for(let i=0;i<150&&!stopping;i++) {
    if(await scannerReady()){ready=true;break;}
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if(stopping)return;
  if(!ready)throw new Error('ClamAV is not ready. Check docker compose -p uce-local-test -f compose.local-test.yaml logs clamav, then retry.');
  run(process.execPath,['--import','tsx','scripts/local-test.ts'],false);
  run(process.execPath,['--env-file=.env.local-test','node_modules/next/dist/bin/next','dev','apps/web','--hostname','127.0.0.1','--port','3000'],false);
  console.log('\nOpen '+LOCAL_APP_URL+' in your browser. Choose Sign in for the four test accounts, or Create account for a new synthetic account.\nUse dummy data only. Press Ctrl+C to stop the app. To stop containers: npm run local:stop\n');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;stop();});
