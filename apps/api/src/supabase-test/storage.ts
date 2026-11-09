import { Body,Controller,Inject,Param,Post,Req,UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthGuard } from '../auth.js';
import { Database,audit,id,parse,serial,text,workAccess,type ActorRequest } from '../core.js';
import { ALLOWED_MIMES,MAX_UPLOAD,digest,DomainError,matchesMime } from '../../../../packages/domain/policy.mjs';
import type { SupabaseTestGateway } from './gateway.js';

export type Scanner=(bytes:Buffer)=>Promise<void>;
@Controller() @UseGuards(AuthGuard)
export class SupabaseTestStorageController {
  constructor(@Inject(Database)private db:Database,@Inject('SB_GATEWAY')private gateway:SupabaseTestGateway,@Inject('SB_SCANNER')private scanner:Scanner){}
  private async asset(assetId:string,userId:string,action='read') {
    const asset=await this.db.asset.findUnique({where:{id:id(assetId)}});
    if(!asset||!asset.objectKey.startsWith('quarantine/'))throw new DomainError('Test asset not found.',404);
    await workAccess(this.db,asset.workId,userId,action);return asset;
  }
  @Post('works/:workId/assets')
  async initiate(@Req()req:ActorRequest,@Param('workId')workId:string,@Body()body:unknown) {
    const data=parse(z.object({filename:text(200).refine(s=>!/[\\/\u0000-\u001f]/.test(s),'Use a plain filename.'),mimeType:z.enum(ALLOWED_MIMES as [string,...string[]]),size:z.number().int().min(1).max(MAX_UPLOAD)}).strict(),body);
    const asset=await serial(this.db,async tx=>{
      await workAccess(tx,workId,req.actor.id,'write');
      if(await tx.asset.count({where:{workId}})>=100)throw new DomainError('Test work asset limit reached.');
      const asset=await tx.asset.create({data:{workId,...data,objectKey:'quarantine/'+randomUUID()}});
      await audit(tx,req.actor.id,'supabase_test.upload_requested',workId,{assetId:asset.id});return asset;
    });
    return {assetId:asset.id,uploadUrl:await this.gateway.uploadIntent(asset.objectKey),expiresIn:7200};
  }
  @Post('assets/:assetId/complete')
  async complete(@Req()req:ActorRequest,@Param('assetId')assetId:string) {
    const asset=await this.asset(assetId,req.actor.id,'write');
    if(asset.status!=='PENDING')throw new DomainError('This upload has already been processed.',409);
    const bytes=await this.gateway.read(asset.objectKey,'quarantine');
    if(bytes.length!==asset.size||bytes.length>MAX_UPLOAD||!matchesMime(bytes,asset.mimeType))throw new DomainError('File size or content type does not match.');
    try { await this.scanner(bytes); }
    catch {
      await this.db.asset.updateMany({where:{id:asset.id,status:'PENDING'},data:{status:'REJECTED'}});
      throw new DomainError('File rejected or local ClamAV unavailable. Start a new dummy upload after checking the scanner.',503);
    }
    const hash=digest(bytes),approved='approved/'+asset.id+'/'+hash;
    await this.gateway.approve(approved,bytes,asset.mimeType);
    return serial(this.db,async tx=>{
      await workAccess(tx,asset.workId,req.actor.id,'write');
      await tx.asset.updateMany({where:{id:asset.id,status:'PENDING'},data:{status:'READY',sha256:hash,objectVersion:approved}});
      await audit(tx,req.actor.id,'supabase_test.asset_scanned',asset.workId,{assetId:asset.id,sha256:hash});
      return {status:'READY',message:'Test evidence scanned and preserved under a unique path.'};
    });
  }
  @Post('assets/:assetId/download')
  async download(@Req()req:ActorRequest,@Param('assetId')assetId:string) {
    const asset=await this.asset(assetId,req.actor.id);
    if(asset.status!=='READY'||!asset.objectVersion)throw new DomainError('This file has not passed validation and scanning.',409);
    const url=await this.gateway.download(asset.objectVersion,asset.filename);
    await audit(this.db,req.actor.id,'supabase_test.download_granted',asset.workId,{assetId});
    return {url,expiresIn:60};
  }
}
