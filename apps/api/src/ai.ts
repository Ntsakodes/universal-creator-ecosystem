import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from './auth.js';
import { Database, audit, parse, serial, text, uuid, workAccess, type ActorRequest } from './core.js';
import type { Config } from './config.js';
import { AI_NOTICE, DomainError, requireCulturalConsent } from '../../../packages/domain/policy.mjs';

@Controller('ai') @UseGuards(AuthGuard)
export class AiController {
  constructor(@Inject(Database) private db:Database,@Inject('CONFIG')private config:Config){}
  @Get('status') status(){return {enabled:this.config.AI_ENABLED==='true',provider:this.config.AI_PROVIDER,providerHost:this.config.AI_ENDPOINT?new URL(this.config.AI_ENDPOINT).hostname:'',model:this.config.AI_MODEL,notice:AI_NOTICE};}
  @Get('runs') list(@Req() req:ActorRequest){return this.db.aiRun.findMany({where:{userId:req.actor.id},orderBy:{createdAt:'desc'},take:30});}
  @Post('runs') async create(@Req() req:ActorRequest,@Body() body:unknown){
    if(this.config.AI_ENABLED!=='true')throw new DomainError('AI is disabled until a provider and processing terms are configured.',503);
    const data=parse(z.object({versionId:uuid,instruction:text(3000),consentNote:text(2000),consentToProvider:z.literal(true)}).strict(),body);
    return serial(this.db,async tx=>{
      const v=await tx.workVersion.findUnique({where:{id:data.versionId}});
      if(!v)throw new DomainError('Version not found.',404);
      // Only the project administrator can disclose source material to an AI provider.
      const work=await workAccess(tx,v.workId,req.actor.id,'owner');
      requireCulturalConsent(work,data.consentNote);
      const today=new Date();today.setUTCHours(0,0,0,0);
      const used=await tx.aiRun.count({where:{userId:req.actor.id,createdAt:{gte:today}}});
      if(used>=this.config.AI_DAILY_LIMIT)throw new DomainError('Daily AI limit reached.',429);
      const run=await tx.aiRun.create({data:{userId:req.actor.id,projectId:work.projectId,versionId:v.id,instruction:data.instruction,provider:this.config.AI_PROVIDER,endpoint:this.config.AI_ENDPOINT,model:this.config.AI_MODEL,consentAt:new Date()}});
      await tx.job.create({data:{kind:'AI',resourceId:run.id}});
      await audit(tx,req.actor.id,'ai.consent_recorded',work.id,{runId:run.id,versionId:v.id,provider:run.provider,model:run.model,consentNote:data.consentNote});
      return {...run,notice:AI_NOTICE};
    });
  }
}
