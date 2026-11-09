import { spawn } from 'node:child_process';
import { readFileSync,existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { supabaseTestConfiguration } from '../packages/domain/supabase-test.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const children=new Set();
let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
async function main() {
  const values=parseEnv(readFileSync(resolve(root,'.env.supabase-test'),'utf8'));
  const config=supabaseTestConfiguration({...values,NODE_ENV:process.env.NODE_ENV??'development',API_BIND_ADDRESS:process.env.API_BIND_ADDRESS??values.API_BIND_ADDRESS});
  if(!existsSync(resolve(root,'node_modules/next/dist/bin/next')))throw new Error('Run npm install first.');
  const publicEnv={...process.env,NODE_ENV:'development',APP_URL:config.appUrl,API_INTERNAL_URL:'http://127.0.0.1:4000',NEXT_TELEMETRY_DISABLED:'1',AI_ENABLED:'false'};
  for(const name of ['DATABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_PUBLISHABLE_KEY','AI_API_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN'])delete publicEnv[name];
  const start=(args,env)=>{
    const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});children.add(child);
    child.once('error',()=>{console.error('A testing process could not start.');stop();});
    child.once('exit',code=>{children.delete(child);if(!stopping){process.exitCode=code||1;stop();}});
    return child;
  };
  const api=start(['--import','tsx','scripts/supabase-test.ts'],{...process.env,AI_ENABLED:'false'});
  let ready=false;
  for(let i=0;i<60&&!stopping;i++){
    try{const r=await fetch('http://127.0.0.1:4000/api/v1/supabase-test/status',{signal:AbortSignal.timeout(1000)});const s=await r.json();if(r.ok&&s.projectRef===config.projectRef){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(stopping)return;
  if(!ready){api.kill('SIGTERM');throw new Error('Testing API did not become ready. Check the dedicated project configuration.');}
  start(['node_modules/next/dist/bin/next','dev','apps/web','--hostname','127.0.0.1','--port','3000'],publicEnv);
  console.log('\nOpen '+config.appUrl+'. Payments and live AI are disabled. No AWS account is needed.\nText/project testing works without Docker. File approval requires local ClamAV on '+config.scannerHost+':'+config.scannerPort+'.\nPress Ctrl+C to stop.\n');
}
main().catch(error=>{console.error(error.code==='ENOENT'?'Copy .env.supabase-test.example to .env.supabase-test and fill it locally.':'Supabase test launch failed. Check docs/SUPABASE_TESTING.md. No credentials were printed.');process.exitCode=1;stop();});
