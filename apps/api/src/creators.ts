import { Body, Controller, Get, Inject, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Database, parse, text, type ActorRequest } from './core.js';
import { AuthGuard } from './auth.js';
import { DISCIPLINES } from '../../../packages/domain/policy.mjs';

const list = (max = 20) => z.array(text(100)).max(max).default([]);
const profileSchema = z.object({ displayName: text(100), biography: z.string().trim().max(3000).default(''), disciplines: z.array(z.enum(DISCIPLINES as [string, ...string[]])).min(1).max(9), skills: list(), languages: list(), region: z.string().trim().max(100).default(''), links: z.array(z.url().refine(s => new URL(s).protocol === 'https:', 'Use HTTPS links.')).max(8).default([]), visibility: z.enum(['PRIVATE','PUBLIC']).default('PRIVATE') }).strict();

@Controller()
export class CreatorsController {
  constructor(@Inject(Database) private db: Database) {}
  @Get('disciplines') disciplines() { return DISCIPLINES; }
  @Get('creators') async publicProfiles() {
    return this.db.creatorProfile.findMany({ where: { visibility: 'PUBLIC' }, select: { userId:true,displayName:true,biography:true,disciplines:true,skills:true,languages:true,region:true,links:true }, take: 50, orderBy: { updatedAt: 'desc' } });
  }
  @Get('me') @UseGuards(AuthGuard)
  async me(@Req() req: ActorRequest) {
    return this.db.user.findUniqueOrThrow({ where: { id: req.actor.id }, select: { id:true,email:true,profile:true,expert:true } });
  }
  @Put('me/profile') @UseGuards(AuthGuard)
  async save(@Req() req: ActorRequest, @Body() body: unknown) {
    const data = parse(profileSchema, body);
    return this.db.$transaction(async tx => {
      const result = await tx.creatorProfile.upsert({ where: { userId:req.actor.id }, create: { userId:req.actor.id,...data }, update:data });
      await tx.auditEvent.create({ data: { actorId:req.actor.id,action:'profile.updated',resourceId:req.actor.id,detail:{ visibility:data.visibility } } });
      return result;
    });
  }
}
