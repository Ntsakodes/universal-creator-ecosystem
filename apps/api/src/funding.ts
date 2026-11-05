import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from './auth.js';
import { Database, audit, id, parse, projectAccess, serial, text, type ActorRequest } from './core.js';
import { allowPledge, DomainError, FUNDING_NOTICE } from '../../../packages/domain/policy.mjs';

@Controller('funding') @UseGuards(AuthGuard)
export class FundingController {
  constructor(@Inject(Database) private db:Database){}
  @Get() async list(){
    const campaigns=await this.db.campaign.findMany({where:{status:'OPEN_INTEREST',project:{visibility:'PUBLIC'}},include:{project:{select:{title:true,summary:true,discipline:true}},milestones:true,_count:{select:{pledges:true}}},take:50});
    return {notice:FUNDING_NOTICE,campaigns};
  }
  @Get('mine') async mine(@Req() req:ActorRequest){
    const campaigns=await this.db.campaign.findMany({where:{project:{ownerId:req.actor.id}},include:{milestones:true,_count:{select:{pledges:true}}},take:100});
    const totals=await this.db.pledge.groupBy({by:['campaignId'],where:{campaignId:{in:campaigns.map(c=>c.id)}},_sum:{amountMinor:true}});
    return {notice:FUNDING_NOTICE,campaigns:campaigns.map(c=>({...c,interestMinor:totals.find(t=>t.campaignId===c.id)?._sum.amountMinor??0,paidMinor:0}))};
  }
  @Post('projects/:projectId/campaign') async create(@Req() req:ActorRequest,@Param('projectId') projectId:string,@Body() body:unknown){
    const data=parse(z.object({title:text(200),description:text(3000),targetMinor:z.number().int().positive().max(100000000),milestones:z.array(z.object({title:text(200),description:text(1000)}).strict()).min(1).max(12)}).strict(),body);
    return serial(this.db,async tx=>{
      await projectAccess(tx,projectId,req.actor.id,'owner');
      const c=await tx.campaign.create({data:{projectId,title:data.title,description:data.description,targetMinor:data.targetMinor,milestones:{create:data.milestones}}});
      await audit(tx,req.actor.id,'campaign.drafted',c.id);return {...c,notice:FUNDING_NOTICE};
    });
  }
  @Patch(':campaignId/status') async status(@Req() req:ActorRequest,@Param('campaignId') campaignId:string,@Body() body:unknown){
    const data=parse(z.object({status:z.enum(['OPEN_INTEREST','CLOSED'])}).strict(),body);
    return serial(this.db,async tx=>{
      const c=await tx.campaign.findUniqueOrThrow({where:{id:id(campaignId)}});
      const p=await projectAccess(tx,c.projectId,req.actor.id,'owner');
      if(data.status==='OPEN_INTEREST'&&p.visibility!=='PUBLIC')throw new DomainError('Publish the project summary before opening interest.');
      const result=await tx.campaign.update({where:{id:c.id},data});await audit(tx,req.actor.id,'campaign.status_changed',c.id,data);return result;
    });
  }
  @Post(':campaignId/pledges') async pledge(@Req() req:ActorRequest,@Param('campaignId') campaignId:string,@Body() body:unknown){
    const data=parse(z.object({amountMinor:z.number().int().positive().max(10000000),kind:z.enum(['SUPPORTER','SPONSOR']),acknowledgeNoPayment:z.literal(true),acknowledgeNoRights:z.literal(true)}).strict(),body);
    return serial(this.db,async tx=>{
      const c=await tx.campaign.findUnique({where:{id:id(campaignId)},include:{project:true}});
      if(!c)throw new DomainError('Campaign not found.',404);
      allowPledge(c,c.project.visibility==='PUBLIC',req.actor.id,c.project.ownerId);
      const result=await tx.pledge.upsert({where:{campaignId_userId:{campaignId,userId:req.actor.id}},create:{campaignId,userId:req.actor.id,amountMinor:data.amountMinor,kind:data.kind},update:{amountMinor:data.amountMinor,kind:data.kind}});
      await audit(tx,req.actor.id,'campaign.interest_recorded',c.id,{amountMinor:data.amountMinor,kind:data.kind});return {...result,notice:FUNDING_NOTICE};
    });
  }
  @Post('milestones/:milestoneId/complete') async milestone(@Req() req:ActorRequest,@Param('milestoneId') milestoneId:string){
    return serial(this.db,async tx=>{
      const m=await tx.milestone.findUniqueOrThrow({where:{id:id(milestoneId)},include:{campaign:true}});
      await projectAccess(tx,m.campaign.projectId,req.actor.id,'owner');
      const result=await tx.milestone.update({where:{id:m.id},data:{completedAt:new Date()}});
      await audit(tx,req.actor.id,'milestone.self_reported_complete',m.campaignId,{milestoneId:m.id});return result;
    });
  }
  @Post(':campaignId/checkout') checkout(){throw new DomainError('Payments are disabled. A reviewed payment-provider integration is required before collecting money.',503);}
}
