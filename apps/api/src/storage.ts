import { Body, Controller, Inject, Injectable, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { AuthGuard } from './auth.js';
import { Database, audit, id, parse, serial, text, workAccess, type ActorRequest } from './core.js';
import type { Config } from './config.js';
import { ALLOWED_MIMES, MAX_UPLOAD, DomainError } from '../../../packages/domain/policy.mjs';

@Injectable()
export class ObjectStore {
  client:S3Client;
  constructor(@Inject('CONFIG') readonly config:Config){this.client=new S3Client({region:config.AWS_REGION});}
  configured(){if(!this.config.S3_BUCKET)throw new DomainError('Private file storage is not configured.',503);}
}
@Controller() @UseGuards(AuthGuard)
export class StorageController {
  constructor(@Inject(Database) private db:Database,@Inject(ObjectStore) private storage:ObjectStore){}
  @Post('works/:workId/assets') async upload(@Req() req:ActorRequest,@Param('workId') workId:string,@Body() body:unknown){
    this.storage.configured();
    const data=parse(z.object({filename:text(200).refine(s=>!/[\\/\u0000-\u001f]/.test(s),'Use a filename without path separators.'),mimeType:z.enum(ALLOWED_MIMES as [string,...string[]]),size:z.number().int().min(1).max(MAX_UPLOAD)}).strict(),body);
    await workAccess(this.db,workId,req.actor.id,'write');
    const key=`quarantine/${randomUUID()}`;
    const asset=await serial(this.db,async tx=>{
      await workAccess(tx,workId,req.actor.id,'write');
      const count=await tx.asset.count({where:{workId}});
      if(count>=100) throw new DomainError('This work has reached the pilot limit of 100 assets.');
      const a=await tx.asset.create({data:{workId,...data,objectKey:key}});
      await audit(tx,req.actor.id,'asset.upload_requested',workId,{assetId:a.id});return a;
    });
    const uploadUrl=await getSignedUrl(this.storage.client,new PutObjectCommand({Bucket:this.storage.config.S3_BUCKET,Key:key,ContentType:data.mimeType,ContentLength:data.size}),{expiresIn:300});
    return {assetId:asset.id,uploadUrl,expiresIn:300};
  }
  @Post('assets/:assetId/complete') async complete(@Req() req:ActorRequest,@Param('assetId') assetId:string){
    const asset=await this.db.asset.findUnique({where:{id:id(assetId)}});
    if(!asset)throw new DomainError('Asset not found.',404);
    return serial(this.db,async tx=>{
      await workAccess(tx,asset.workId,req.actor.id,'write');
      if(asset.status!=='PENDING')throw new DomainError('This upload has already been processed.',409);
      await tx.job.upsert({where:{resourceId:assetId},update:{},create:{resourceId:assetId,kind:'SCAN'}});
      return {status:'PENDING',message:'Upload queued for file validation and malware scanning.'};
    });
  }
  @Post('assets/:assetId/download') async download(@Req() req:ActorRequest,@Param('assetId') assetId:string){
    this.storage.configured();
    const asset=await this.db.asset.findUnique({where:{id:id(assetId)}});
    if(!asset)throw new DomainError('Asset not found.',404);
    await workAccess(this.db,asset.workId,req.actor.id);
    if(asset.status!=='READY'||!asset.objectVersion)throw new DomainError('This asset is not available.',409);
    const url=await getSignedUrl(this.storage.client,new GetObjectCommand({Bucket:this.storage.config.S3_BUCKET,Key:asset.objectKey,VersionId:asset.objectVersion,ResponseContentType:'application/octet-stream',ResponseContentDisposition:`attachment; filename*=UTF-8''${encodeURIComponent(asset.filename)}`}),{expiresIn:60});
    await audit(this.db,req.actor.id,'asset.download_granted',asset.workId,{assetId});
    return {url,expiresIn:60};
  }
}
