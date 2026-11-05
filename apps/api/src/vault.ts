import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from './auth.js';
import { Database, audit, id, parse, projectAccess, serial, text, uuid, workAccess, type ActorRequest } from './core.js';
import { DomainError, IP_NOTICE, manifest, validateRights } from '../../../packages/domain/policy.mjs';

const workSchema=z.object({title:text(200),category:z.enum(['Music','Film','Literature','Script','Artwork','Photography','Animation','Game concept','Cultural documentary']),claimedAuthor:text(200),claimedCreatedAt:z.iso.datetime().optional(),sensitive:z.boolean().default(false),culturalNotes:z.string().trim().max(3000).default(''),content:z.string().max(50000).default('')}).strict();
@Controller() @UseGuards(AuthGuard)
export class VaultController {
  constructor(@Inject(Database) private db:Database){}
  @Post('projects/:projectId/works') async create(@Req() req:ActorRequest,@Param('projectId') projectId:string,@Body() body:unknown) {
    const {content,claimedCreatedAt,...data}=parse(workSchema,body);
    return serial(this.db,async tx=>{
      const project=await projectAccess(tx,projectId,req.actor.id,'write');
      if(await tx.work.count({where:{projectId}})>=100)throw new DomainError('Pilot limit: 100 works per project.');
      if(data.sensitive && project.visibility==='PUBLIC') throw new DomainError('Make this project private before recording sensitive material.');
      const work=await tx.work.create({data:{...data,projectId,claimedCreatedAt:claimedCreatedAt?new Date(claimedCreatedAt):undefined,versions:{create:{number:1,content,note:'Initial record',recordedBy:req.actor.id,manifestHash:manifest(content,[])}}},include:{versions:true}});
      await audit(tx,req.actor.id,'work.recorded',work.id,{notice:IP_NOTICE});return work;
    });
  }
  @Get('works/:workId') async detail(@Req() req:ActorRequest,@Param('workId') workId:string) {
    await workAccess(this.db,workId,req.actor.id);
    const work=await this.db.work.findUniqueOrThrow({where:{id:workId},include:{versions:{orderBy:{number:'desc'},include:{assets:{include:{asset:{select:{id:true,filename:true,sha256:true,status:true}}}}}},assets:{select:{id:true,filename:true,status:true,sha256:true,size:true}},contributors:true,rights:true}});
    return {...work,notice:IP_NOTICE};
  }
  @Post('works/:workId/versions') async version(@Req() req:ActorRequest,@Param('workId') workId:string,@Body() body:unknown) {
    const data=parse(z.object({content:z.string().max(50000),note:text(1000),assetIds:z.array(uuid).max(20).default([])}).strict(),body);
    return serial(this.db,async tx=>{
      await workAccess(tx,workId,req.actor.id,'write');
      const assets=await tx.asset.findMany({where:{id:{in:data.assetIds},workId,status:'READY'}});
      if(assets.length!==new Set(data.assetIds).size) throw new DomainError('All evidence assets must be scanned and belong to this work.');
      const latest=await tx.workVersion.findFirstOrThrow({where:{workId},orderBy:{number:'desc'}});
      const version=await tx.workVersion.create({data:{workId,number:latest.number+1,content:data.content,note:data.note,recordedBy:req.actor.id,manifestHash:manifest(data.content,assets),assets:{create:assets.map(a=>({assetId:a.id}))}}});
      await audit(tx,req.actor.id,'work.version_recorded',workId,{versionId:version.id,number:version.number});return version;
    });
  }
  @Post('works/:workId/contributors') async contributor(@Req() req:ActorRequest,@Param('workId') workId:string,@Body() body:unknown) {
    const data=parse(z.object({name:text(200),role:text(100),note:z.string().max(2000).default('')}).strict(),body);
    return serial(this.db,async tx=>{
      await workAccess(tx,workId,req.actor.id,'write');
      const contributor=await tx.contributor.create({data:{workId,...data}});
      await audit(tx,req.actor.id,'work.contributor_recorded',workId,{contributorId:contributor.id});return contributor;
    });
  }
  @Post('works/:workId/rights') async rights(@Req() req:ActorRequest,@Param('workId') workId:string,@Body() body:unknown) {
    const data=parse(z.object({party:text(200),rightType:text(100),territory:text(200),use:text(500),startsAt:z.iso.datetime(),endsAt:z.iso.datetime().optional(),shareBasisPoints:z.number().int().min(0).max(10000).optional(),agreementAssetId:uuid,note:text(3000)}).strict(),body);
    validateRights(data);
    return serial(this.db,async tx=>{
      await workAccess(tx,workId,req.actor.id,'owner');
      const evidence=await tx.asset.findFirst({where:{id:data.agreementAssetId,workId,status:'READY'}});
      if(!evidence) throw new DomainError('Attach a scanned supporting agreement belonging to this work.');
      const record=await tx.rightsRecord.create({data:{...data,workId,startsAt:new Date(data.startsAt),endsAt:data.endsAt?new Date(data.endsAt):undefined}});
      await audit(tx,req.actor.id,'work.rights_claim_documented',workId,{rightsRecordId:record.id});
      return {...record,status:'DOCUMENTED_CLAIM',notice:'This record documents supplied agreement details. UCE has not adjudicated or legally verified them.'};
    });
  }
  @Get('works/:workId/export') async export(@Req() req:ActorRequest,@Param('workId') workId:string) {
    await workAccess(this.db,workId,req.actor.id);
    const work=await this.db.work.findUniqueOrThrow({where:{id:workId},include:{versions:{orderBy:{number:'asc'},include:{assets:{include:{asset:{select:{id:true,filename:true,size:true,mimeType:true,sha256:true,objectVersion:true}}}},reviews:{include:{report:true}}}},contributors:true,rights:true}});
    const events=await this.db.auditEvent.findMany({where:{resourceId:id(workId)},orderBy:{createdAt:'asc'}});
    await audit(this.db,req.actor.id,'work.exported',workId);
    return {schemaVersion:1,exportedAt:new Date(),notice:IP_NOTICE,rightsStatus:'DOCUMENTED_CLAIMS_NOT_ADJUDICATED',work,events};
  }
}
