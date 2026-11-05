import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Database, audit, id, parse, projectAccess, serial, text, uuid, type ActorRequest } from './core.js';
import { AuthGuard } from './auth.js';
import { DISCIPLINES, DomainError } from '../../../packages/domain/policy.mjs';

const schema = z.object({ title:text(200),summary:z.string().trim().max(3000).default(''),discipline:z.enum(DISCIPLINES as [string,...string[]]) }).strict();
@Controller('projects') @UseGuards(AuthGuard)
export class ProjectsController {
  constructor(@Inject(Database) private db: Database) {}
  @Get() list(@Req() req: ActorRequest) {
    return this.db.project.findMany({ where:{ OR:[{ownerId:req.actor.id},{members:{some:{userId:req.actor.id}}}] }, include:{_count:{select:{works:true,members:true}}}, orderBy:{updatedAt:'desc'},take:100 });
  }
  @Post() async create(@Req() req: ActorRequest,@Body() body: unknown) {
    const data = parse(schema,body);
    return this.db.$transaction(async tx => {
      if(await tx.project.count({where:{ownerId:req.actor.id}})>=50)throw new DomainError('Pilot limit: 50 projects per creator.');
      const p = await tx.project.create({data:{...data,ownerId:req.actor.id}});
      await audit(tx,req.actor.id,'project.created',p.id);
      return p;
    });
  }
  @Get(':projectId') async detail(@Req() req: ActorRequest,@Param('projectId') projectId:string) {
    await projectAccess(this.db,projectId,req.actor.id);
    return this.db.project.findUniqueOrThrow({where:{id:projectId},include:{works:{include:{_count:{select:{versions:true}}}},members:{select:{userId:true,role:true,user:{select:{profile:{select:{displayName:true}}}}}}}});
  }
  @Patch(':projectId/visibility') async visibility(@Req() req: ActorRequest,@Param('projectId') projectId:string,@Body() body:unknown) {
    const data = parse(z.object({visibility:z.enum(['PRIVATE','PUBLIC'])}).strict(),body);
    return serial(this.db,async tx=>{
      await projectAccess(tx,projectId,req.actor.id,'owner');
      if(data.visibility==='PUBLIC') {
        const sensitive = await tx.work.count({where:{projectId,sensitive:true}});
        if(sensitive) throw new DomainError('Projects containing sensitive material cannot be published in this release.');
      }
      const p=await tx.project.update({where:{id:projectId},data});
      if(data.visibility==='PRIVATE') await tx.campaign.updateMany({where:{projectId,status:'OPEN_INTEREST'},data:{status:'CLOSED'}});
      await audit(tx,req.actor.id,'project.visibility',projectId,data); return p;
    });
  }
  @Post(':projectId/members') async member(@Req() req: ActorRequest,@Param('projectId') projectId:string,@Body() body:unknown) {
    const data=parse(z.object({userId:uuid,role:z.enum(['EDITOR','VIEWER'])}).strict(),body);
    return serial(this.db,async tx=>{
      const p=await projectAccess(tx,projectId,req.actor.id,'owner');
      if(p.ownerId===data.userId) throw new DomainError('The administrator already has access.');
      const target=await tx.user.findUnique({where:{id:data.userId},include:{profile:true}});
      if(!target?.profile || target.profile.visibility!=='PUBLIC') throw new DomainError('Choose an existing public creator profile. Use their creator ID.');
      const member=await tx.projectMember.upsert({where:{projectId_userId:{projectId,userId:data.userId}},create:{projectId,...data},update:{role:data.role}});
      await audit(tx,req.actor.id,'project.member_granted',projectId,data); return member;
    });
  }
  @Delete(':projectId/members/:userId') async remove(@Req() req:ActorRequest,@Param('projectId') projectId:string,@Param('userId') userId:string) {
    return serial(this.db,async tx=>{
      await projectAccess(tx,projectId,req.actor.id,'owner');
      await tx.projectMember.deleteMany({where:{projectId,userId:id(userId)}});
      // Revoke queued access as well as interactive access.
      await tx.aiRun.updateMany({where:{projectId,userId,status:'PENDING'},data:{status:'CANCELLED'}});
      await audit(tx,req.actor.id,'project.member_revoked',projectId,{userId}); return {ok:true};
    });
  }
}
