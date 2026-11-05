import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../src/bootstrap.js';
import { Database } from '../src/core.js';
import { digest, secret } from '../../../packages/domain/policy.mjs';

// Use a disposable, migrated database. Tests seed sessions; the app has no authentication bypass.
let app:INestApplication,db:Database,base:string;
const actorTokens:string[]=[],actorIds:string[]=[];
const origin='http://localhost:3000';
before(async()=>{
  if(process.env.NODE_ENV==='production')throw new Error('Integration tests cannot use production.');
  process.env.AUTH_CLIENT_ID='integration-client';process.env.APP_URL=origin;process.env.AI_ENABLED='false';
  app=await createApplication();await app.listen(0,'127.0.0.1');base=await app.getUrl();db=app.get(Database);
  for(let n=0;n<3;n++){
    const user=await db.user.create({data:{subject:`integration-${secret()}`,email:`test-${n}@example.invalid`,profile:{create:{displayName:`Test ${n}`,disciplines:['Film and television'],skills:[],languages:['English'],links:[],visibility:'PUBLIC'}}}});
    const token=secret();await db.session.create({data:{userId:user.id,tokenHash:digest(token),expiresAt:new Date(Date.now()+3600000)}});
    actorIds.push(user.id);actorTokens.push(token);
  }
});
after(async()=>{await app?.close();});
async function request(path:string,actor=0,method='GET',body?:unknown,customOrigin:string|undefined=origin){
  const headers:Record<string,string>={'content-type':'application/json'};
  if(actor>=0)headers.cookie=`uce_session=${actorTokens[actor]}`;
  if(customOrigin)headers.origin=customOrigin;
  const res=await fetch(`${base}/api/v1/${path}`,{method,headers,body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json()};
}
test('creator → immutable IP version → scoped expert review → pledge interest',async()=>{
  assert.equal((await request('projects',-1)).status,401);
  assert.equal((await request('projects',0,'POST',{title:'Forbidden',discipline:'Film and television'},'https://evil.invalid')).status,403);
  const created=await request('projects',0,'POST',{title:'Integration film',summary:'Public-safe summary',discipline:'Film and television'});
  assert.equal(created.status,201);const project=created.data;
  assert.equal((await request(`projects/${project.id}`,1)).status,403);
  assert.equal((await request(`projects/${project.id}/members`,0,'POST',{userId:actorIds[1],role:'VIEWER'})).status,201);
  assert.equal((await request(`projects/${project.id}`,1)).status,200);
  assert.equal((await request(`projects/${project.id}/works`,1,'POST',{title:'No permission',category:'Script',claimedAuthor:'Viewer'})).status,403);
  const recorded=await request(`projects/${project.id}/works`,0,'POST',{title:'Script',category:'Script',claimedAuthor:'Creator',content:'Only this version may be reviewed.'});
  assert.equal(recorded.status,201);const work=recorded.data,version=work.versions[0];
  await assert.rejects(db.workVersion.update({where:{id:version.id},data:{content:'Tampered'}}));
  assert.equal((await request(`works/${work.id}`,2)).status,403);
  assert.equal((await request('me/expert',2,'PUT',{biography:'Researcher',qualifications:'Research experience',expertise:['History'],languages:['English'],regions:['South Africa'],publications:[],available:true,public:true})).status,200);
  const r=await request('review-requests',0,'POST',{versionId:version.id,reviewerId:actorIds[2],question:'Assess the historical setting.',scope:'The selected text only.',consentNote:'All contributors authorise this selected text for expert review.',compensation:'Unpaid pilot review by agreement.'});
  assert.equal(r.status,201);
  assert.equal((await request(`review-requests/${r.data.id}/material`,2)).status,403);
  assert.equal((await request(`review-requests/${r.data.id}/accept`,2,'POST',{conflictDeclaration:'No conflicts of interest.'})).status,201);
  const material=await request(`review-requests/${r.data.id}/material`,2);assert.equal(material.status,200);assert.equal(material.data.version.content,version.content);assert.equal(material.data.version.assets,undefined);
  assert.equal((await request(`works/${work.id}/export`,2)).status,403);
  const report=await request(`review-requests/${r.data.id}/report`,2,'POST',{outcome:'PARTIALLY_SUPPORTED',methodology:'Compared to archival sources.',limitations:'Limited sample; not whole-project certification.',recommendations:'Revise the opening date.',sources:[{title:'Pilot reference',reference:'Synthetic fixture source'}]});assert.equal(report.status,201);
  await assert.rejects(db.reviewReport.update({where:{id:report.data.id},data:{outcome:'SUPPORTED'}}));
  assert.equal((await request(`review-requests/${r.data.id}/material`,2)).status,403);
  const exported=await request(`works/${work.id}/export`);assert.equal(exported.status,200);assert.equal(exported.data.work.versions[0].reviews[0].versionId,version.id);
  await request(`projects/${project.id}/members/${actorIds[1]}`,0,'DELETE');assert.equal((await request(`projects/${project.id}`,1)).status,403);
  const campaign=await request(`funding/projects/${project.id}/campaign`,0,'POST',{title:'Support production',description:'Non-binding pilot interest.',targetMinor:100000,milestones:[{title:'Development',description:'First draft'}]});assert.equal(campaign.status,201);
  assert.equal((await request(`funding/${campaign.data.id}/status`,0,'PATCH',{status:'OPEN_INTEREST'})).status,400);
  await request(`projects/${project.id}/visibility`,0,'PATCH',{visibility:'PUBLIC'});
  assert.equal((await request(`funding/${campaign.data.id}/status`,0,'PATCH',{status:'OPEN_INTEREST'})).status,200);
  const pledge={amountMinor:5000,kind:'SUPPORTER',acknowledgeNoPayment:true,acknowledgeNoRights:true};
  assert.equal((await request(`funding/${campaign.data.id}/pledges`,1,'POST',pledge)).status,201);
  assert.equal((await request(`funding/${campaign.data.id}/pledges`,1,'POST',pledge)).status,201);
  assert.equal(await db.pledge.count({where:{campaignId:campaign.data.id}}),1);
  assert.equal((await request(`funding/${campaign.data.id}/checkout`,1,'POST',{})).status,503);
  assert.equal((await request('ai/runs',0,'POST',{})).status,503);
  await request(`projects/${project.id}/visibility`,0,'PATCH',{visibility:'PRIVATE'});
  assert.equal((await request(`funding/${campaign.data.id}/pledges`,1,'POST',pledge)).status,409);
});
