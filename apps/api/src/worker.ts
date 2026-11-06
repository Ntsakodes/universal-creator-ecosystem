import 'reflect-metadata';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { scanWithClamav } from '../../../packages/domain/clamav.mjs';
import { configuration } from './config.js';
import { Database, audit, serial, workAccess } from './core.js';
import { ObjectStore } from './storage.js';
import { digest, MAX_UPLOAD, matchesMime } from '../../../packages/domain/policy.mjs';
import { generateDraft } from '../../../packages/domain/ai.mjs';

const config=configuration();
const db=new Database();
const storage=new ObjectStore(config);
let stopping=false;
process.on('SIGTERM',()=>{stopping=true;});
process.on('SIGINT',()=>{stopping=true;});

async function scanAsset(assetId:string){
  storage.configured();
  const asset=await db.asset.findUniqueOrThrow({where:{id:assetId},include:{work:{include:{project:true}}}});
  if(asset.status!=='PENDING')return;
  const head=await storage.client.send(new HeadObjectCommand({Bucket:config.S3_BUCKET,Key:asset.objectKey}));
  if(!head.VersionId||head.VersionId==='null')throw new Error('Object versioning must be enabled.');
  if(head.ContentLength!==asset.size||head.ContentLength>MAX_UPLOAD)throw new Error('Upload size does not match.');
  const object=await storage.client.send(new GetObjectCommand({Bucket:config.S3_BUCKET,Key:asset.objectKey,VersionId:head.VersionId}));
  if(!object.Body)throw new Error('Object body missing.');
  const pieces:Buffer[]=[];let total=0;
  for await(const chunk of object.Body as AsyncIterable<Uint8Array>){total+=chunk.length;if(total>MAX_UPLOAD)throw new Error('Upload too large.');pieces.push(Buffer.from(chunk));}
  const bytes=Buffer.concat(pieces);
  if(total!==asset.size||!matchesMime(bytes,asset.mimeType))throw new Error('Upload content does not match its declared type.');
  await scanWithClamav(bytes,config.CLAMAV_HOST,config.CLAMAV_PORT);
  await db.$transaction(async tx=>{
    const updated=await tx.asset.updateMany({where:{id:asset.id,status:'PENDING'},data:{status:'READY',objectVersion:head.VersionId,sha256:digest(bytes)}});
    if(updated.count)await audit(tx,asset.work.project.ownerId,'asset.scanned',asset.workId,{assetId:asset.id,sha256:digest(bytes)});
  });
}
async function ai(runId:string){
  const run=await db.aiRun.findUniqueOrThrow({where:{id:runId},include:{version:{include:{work:true}}}});
  if(run.status!=='PENDING')return;
  if(config.AI_ENABLED!=='true'||config.AI_PROVIDER!==run.provider||config.AI_MODEL!==run.model||config.AI_ENDPOINT!==run.endpoint)throw new Error('AI configuration changed after consent.');
  await workAccess(db,run.version.workId,run.userId,'owner');
  if(run.version.work.sensitive)throw new Error('Sensitive material is excluded.');
  const result=await generateDraft({enabled:true,key:config.AI_API_KEY,model:run.model,provider:run.provider,endpoint:run.endpoint},run.instruction,run.version.content);
  await db.$transaction(async tx=>{
    const current=await tx.aiRun.findUniqueOrThrow({where:{id:run.id}});
    if(current.status!=='PENDING')return;
    await tx.aiRun.update({where:{id:run.id},data:{status:'COMPLETED',output:result.text}});
    await audit(tx,run.userId,'ai.draft_created',run.version.workId,{runId:run.id,provider:run.provider,model:run.model});
  });
}
async function tick(){
  const abandoned=await db.job.findMany({where:{state:'RUNNING',attempts:{gte:3},lockedAt:{lt:new Date(Date.now()-300000)}}});
  for(const j of abandoned)await db.$transaction(async tx=>{
    await tx.job.update({where:{id:j.id},data:{state:'FAILED',error:'Worker interrupted repeatedly. Operator review required.'}});
    if(j.kind==='SCAN')await tx.asset.updateMany({where:{id:j.resourceId,status:'PENDING'},data:{status:'REJECTED'}});
    if(j.kind==='AI')await tx.aiRun.updateMany({where:{id:j.resourceId,status:'PENDING'},data:{status:'FAILED'}});
  });
  // A crashed worker is reclaimed after five minutes. All jobs are idempotent at storage level.
  const jobs=await db.$queryRaw<Array<{id:string;kind:string;resourceId:string;attempts:number}>>`
    UPDATE "Job" SET state='RUNNING', "lockedAt"=NOW(), attempts=attempts+1
    WHERE id=(SELECT id FROM "Job" WHERE (state='PENDING' OR (state='RUNNING' AND "lockedAt" < NOW()-INTERVAL '5 minutes')) AND attempts < 3 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id,kind,"resourceId",attempts`;
  const job=jobs[0];if(!job)return false;
  try{
    if(job.kind==='SCAN')await scanAsset(job.resourceId);
    else if(job.kind==='AI')await ai(job.resourceId);
    else throw new Error('Unsupported job type.');
    await db.job.update({where:{id:job.id},data:{state:'DONE',error:null}});
  }catch{
    // Error bodies can contain private material or provider secrets; never persist them.
    await db.$transaction(async tx=>{
      await tx.job.update({where:{id:job.id},data:{state:'FAILED',error:'Processing failed. Operator review required.'}});
      if(job.kind==='SCAN')await tx.asset.updateMany({where:{id:job.resourceId,status:'PENDING'},data:{status:'REJECTED'}});
      if(job.kind==='AI')await tx.aiRun.updateMany({where:{id:job.resourceId,status:'PENDING'},data:{status:'FAILED'}});
    });
  }
  return true;
}
async function main(){
  await db.$connect();
  try{
    while(!stopping){
      const busy=await tick();
      if(!busy){
        await db.authFlow.deleteMany({where:{expiresAt:{lt:new Date()}}});
        await db.session.deleteMany({where:{expiresAt:{lt:new Date()}}});
        await new Promise(resolve=>setTimeout(resolve,1000));
      }
    }
  }finally{await db.$disconnect();storage.client.destroy();}
}
main().catch(()=>{console.error('Worker stopped unexpectedly. Check service health.');process.exitCode=1;});
