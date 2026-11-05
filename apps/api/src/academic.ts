import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from './auth.js';
import { Database, audit, id, parse, serial, text, uuid, workAccess, type ActorRequest } from './core.js';
import { assertTransition, DomainError, requireCulturalConsent } from '../../../packages/domain/policy.mjs';

const strings=z.array(text(150)).max(30);
const expertSchema=z.object({biography:text(3000),qualifications:text(2000),expertise:strings.min(1),languages:strings,regions:strings,publications:z.array(z.url().refine(s=>new URL(s).protocol==='https:')).max(20),available:z.boolean(),public:z.boolean()}).strict();
@Controller() @UseGuards(AuthGuard)
export class AcademicController {
  constructor(@Inject(Database) private db:Database){}
  @Put('me/expert') async expert(@Req() req:ActorRequest,@Body() body:unknown){
    const data=parse(expertSchema,body);
    return this.db.expertProfile.upsert({where:{userId:req.actor.id},create:{userId:req.actor.id,...data},update:data});
  }
  @Get('experts') async experts(@Req() req:ActorRequest){
    return this.db.expertProfile.findMany({where:{public:true,available:true},select:{userId:true,biography:true,qualifications:true,expertise:true,languages:true,regions:true,publications:true,user:{select:{profile:{select:{displayName:true}}}},affiliations:{select:{title:true,confirmedAt:true,institution:{select:{name:true,verifiedAt:true}}}}},take:100});
  }
  @Get('institutions') institutions(){return this.db.institution.findMany({select:{id:true,name:true,kind:true,website:true,description:true,verifiedAt:true},take:100});}
  @Post('institutions') async institution(@Req() req:ActorRequest,@Body() body:unknown){
    const data=parse(z.object({name:text(200),kind:z.enum(['University','Research centre','Library','Archive','Community organisation']),website:z.url().refine(s=>new URL(s).protocol==='https:'),description:text(3000)}).strict(),body);
    return this.db.$transaction(async tx=>{
      const i=await tx.institution.create({data:{...data,adminId:req.actor.id}});
      await audit(tx,req.actor.id,'institution.created_unverified',i.id);return i;
    });
  }
  @Post('affiliations') async affiliation(@Req() req:ActorRequest,@Body() body:unknown){
    const data=parse(z.object({institutionId:uuid,title:text(200)}).strict(),body);
    if(!await this.db.expertProfile.findUnique({where:{userId:req.actor.id}}))throw new DomainError('Create an expert profile first.');
    return this.db.affiliation.create({data:{...data,expertId:req.actor.id}});
  }
  @Post('affiliations/:affiliationId/confirm') async confirm(@Req() req:ActorRequest,@Param('affiliationId') affiliationId:string){
    return serial(this.db,async tx=>{
      const a=await tx.affiliation.findUnique({where:{id:id(affiliationId)},include:{institution:true}});
      if(!a||a.institution.adminId!==req.actor.id||!a.institution.verifiedAt)throw new DomainError('A verified institution representative is required.',403);
      const confirmed=await tx.affiliation.update({where:{id:a.id},data:{confirmedAt:new Date()}});
      await audit(tx,req.actor.id,'affiliation.confirmed',a.id);return confirmed;
    });
  }
  @Get('affiliations/pending') pending(@Req() req:ActorRequest){
    return this.db.affiliation.findMany({where:{institution:{adminId:req.actor.id},confirmedAt:null},include:{expert:{select:{userId:true,biography:true}},institution:{select:{name:true,verifiedAt:true}}},take:100});
  }
  @Post('review-requests') async request(@Req() req:ActorRequest,@Body() body:unknown){
    const data=parse(z.object({versionId:uuid,reviewerId:uuid,question:text(2000),consentNote:text(3000),scope:text(2000),compensation:text(1000)}).strict(),body);
    return serial(this.db,async tx=>{
      const version=await tx.workVersion.findUnique({where:{id:data.versionId}});
      if(!version)throw new DomainError('Version not found.',404);
      const work=await workAccess(tx,version.workId,req.actor.id,'owner');
      requireCulturalConsent(work,data.consentNote);
      const reviewer=await tx.expertProfile.findUnique({where:{userId:data.reviewerId}});
      if(!reviewer?.public||!reviewer.available||data.reviewerId===req.actor.id)throw new DomainError('Choose another available expert.');
      const existing=await tx.reviewRequest.count({where:{versionId:data.versionId,reviewerId:data.reviewerId,status:{in:['REQUESTED','ACCEPTED']}}});
      if(existing)throw new DomainError('There is already an active request for this expert and version.',409);
      const r=await tx.reviewRequest.create({data:{...data,requestedBy:req.actor.id}});
      await audit(tx,req.actor.id,'review.requested',work.id,{requestId:r.id,versionId:version.id});return r;
    });
  }
  @Get('review-requests') async requests(@Req() req:ActorRequest){
    return this.db.reviewRequest.findMany({where:{OR:[{requestedBy:req.actor.id},{reviewerId:req.actor.id}]},include:{report:true,version:{select:{number:true,work:{select:{id:true,title:true}}}}},orderBy:{createdAt:'desc'},take:100});
  }
  @Get('review-requests/:requestId/material') async material(@Req() req:ActorRequest,@Param('requestId') requestId:string){
    const r=await this.db.reviewRequest.findUnique({where:{id:id(requestId)},include:{version:{select:{id:true,number:true,content:true,manifestHash:true}}}});
    if(!r||r.reviewerId!==req.actor.id||r.status!=='ACCEPTED')throw new DomainError('Accept an active assigned request to view its material.',403);
    await audit(this.db,req.actor.id,'review.material_read',r.id);
    // Only the selected version text is disclosed. No vault attachments or other versions.
    return {scope:r.scope,question:r.question,version:r.version};
  }
  @Post('review-requests/:requestId/accept') async accept(@Req() req:ActorRequest,@Param('requestId') requestId:string,@Body() body:unknown){
    const data=parse(z.object({conflictDeclaration:text(2000)}).strict(),body);
    return serial(this.db,async tx=>{
      const r=await tx.reviewRequest.findUnique({where:{id:id(requestId)}});
      if(!r||r.reviewerId!==req.actor.id)throw new DomainError('Review access denied.',403);
      assertTransition(r.status,'ACCEPTED');
      const affiliations=await tx.affiliation.findMany({where:{expertId:req.actor.id,confirmedAt:{not:null},institution:{verifiedAt:{not:null}}},select:{title:true,institution:{select:{id:true,name:true,verifiedAt:true}}}});
      const snapshot=JSON.parse(JSON.stringify(affiliations));
      const reviewer=await tx.user.findUniqueOrThrow({where:{id:req.actor.id},include:{profile:true,expert:true}});
      const reviewerSnapshot={userId:reviewer.id,displayName:reviewer.profile?.displayName??'',qualifications:reviewer.expert?.qualifications??'',expertise:reviewer.expert?.expertise??[]};
      const result=await tx.reviewRequest.update({where:{id:r.id},data:{status:'ACCEPTED',...data,affiliationSnapshot:snapshot,reviewerSnapshot}});
      await audit(tx,req.actor.id,'review.accepted',r.id);return result;
    });
  }
  @Post('review-requests/:requestId/close') async close(@Req() req:ActorRequest,@Param('requestId') requestId:string){
    return serial(this.db,async tx=>{
      const r=await tx.reviewRequest.findUnique({where:{id:id(requestId)}});
      if(!r||(r.requestedBy!==req.actor.id&&r.reviewerId!==req.actor.id))throw new DomainError('Review access denied.',403);
      const next=r.requestedBy===req.actor.id?'REVOKED':'DECLINED';
      assertTransition(r.status,next);
      const result=await tx.reviewRequest.update({where:{id:r.id},data:{status:next}});
      await audit(tx,req.actor.id,`review.${next.toLowerCase()}`,r.id);return result;
    });
  }
  @Post('review-requests/:requestId/report') async report(@Req() req:ActorRequest,@Param('requestId') requestId:string,@Body() body:unknown){
    const data=parse(z.object({outcome:z.enum(['SUPPORTED','PARTIALLY_SUPPORTED','NOT_SUPPORTED','INCONCLUSIVE','COMMUNITY_KNOWLEDGE_REVIEWED']),methodology:text(4000),limitations:text(4000),recommendations:text(8000),sources:z.array(z.object({title:text(300),reference:text(2000)}).strict()).min(1).max(30)}).strict(),body);
    return serial(this.db,async tx=>{
      const r=await tx.reviewRequest.findUnique({where:{id:id(requestId)}});
      if(!r||r.reviewerId!==req.actor.id)throw new DomainError('Review access denied.',403);
      assertTransition(r.status,'COMPLETED');
      const report=await tx.reviewReport.create({data:{requestId:r.id,...data}});
      await tx.reviewRequest.update({where:{id:r.id},data:{status:'COMPLETED'}});
      await audit(tx,req.actor.id,'review.completed',r.id,{reportId:report.id,versionId:r.versionId});return report;
    });
  }
}
