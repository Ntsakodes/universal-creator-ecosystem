import { Body, Controller, Get, Inject, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthGuard } from '../auth.js';
import { Database, audit, id, parse, serial, text, workAccess, type ActorRequest } from '../core.js';
import { ALLOWED_MIMES, digest, DomainError, MAX_UPLOAD, matchesMime } from '../../../../packages/domain/policy.mjs';

export type Scanner = (bytes: Buffer) => Promise<void>;
type LocalOptions = { directory: string; scanner: Scanner };

@Controller() @UseGuards(AuthGuard)
export class LocalStorageController {
  constructor(@Inject(Database) private db: Database,@Inject('LOCAL_STORAGE') private options: LocalOptions) {}
  private file(assetId: string) { return join(this.options.directory,id(assetId)); }
  private async asset(assetId: string,userId: string,action='read') {
    const asset=await this.db.asset.findUnique({where:{id:id(assetId)}});
    if(!asset||!asset.objectKey.startsWith('local-test/'))throw new DomainError('Local test asset not found.',404);
    await workAccess(this.db,asset.workId,userId,action);
    return asset;
  }

  @Post('works/:workId/assets')
  async initiate(@Req() req: ActorRequest,@Param('workId') workId: string,@Body() body: unknown) {
    const data=parse(z.object({filename:text(200).refine(s=>!/[\\/\u0000-\u001f]/.test(s),'Use a plain filename.'),mimeType:z.enum(ALLOWED_MIMES as [string,...string[]]),size:z.number().int().min(1).max(MAX_UPLOAD)}).strict(),body);
    const asset=await serial(this.db,async tx=>{
      await workAccess(tx,workId,req.actor.id,'write');
      if(await tx.asset.count({where:{workId}})>=100)throw new DomainError('Local asset limit reached.');
      const result=await tx.asset.create({data:{workId,...data,objectKey:'local-test/'+randomUUID()}});
      await audit(tx,req.actor.id,'local.asset_upload_requested',workId,{assetId:result.id});
      return result;
    });
    return {assetId:asset.id,uploadUrl:'/api/v1/local-files/'+asset.id+'/content',expiresIn:0};
  }

  @Put('local-files/:assetId/content')
  async upload(@Req() req: ActorRequest,@Param('assetId') assetId: string) {
    const asset=await this.asset(assetId,req.actor.id,'write');
    if(asset.status!=='PENDING')throw new DomainError('Start a new upload.',409);
    const bytes=req.body;
    if(!Buffer.isBuffer(bytes)||bytes.length!==asset.size||bytes.length>MAX_UPLOAD||!matchesMime(bytes,asset.mimeType))throw new DomainError('Upload size or file type does not match.');
    await mkdir(this.options.directory,{recursive:true,mode:0o700});
    try { await writeFile(this.file(asset.id),bytes,{flag:'wx',mode:0o600}); }
    catch { throw new DomainError('This upload already exists or local storage is unavailable. Start a fresh upload.',409); }
    return {status:'PENDING',message:'File stored locally; malware scan is still required.'};
  }

  @Post('assets/:assetId/complete')
  async complete(@Req() req: ActorRequest,@Param('assetId') assetId: string) {
    const asset=await this.asset(assetId,req.actor.id,'write');
    if(asset.status!=='PENDING')throw new DomainError('This file has already been processed.',409);
    let bytes: Buffer;
    try { bytes=await readFile(this.file(asset.id)); }
    catch { throw new DomainError('Upload the file before completing it.'); }
    if(bytes.length!==asset.size||!matchesMime(bytes,asset.mimeType))throw new DomainError('Stored file validation failed.');
    try { await this.options.scanner(bytes); }
    catch {
      await this.db.asset.updateMany({where:{id:asset.id,status:'PENDING'},data:{status:'REJECTED'}});
      throw new DomainError('File rejected or scanner unavailable. Wait for ClamAV, then start a fresh dummy-file upload.',503);
    }
    const hash=digest(bytes);
    return serial(this.db,async tx=>{
      await workAccess(tx,asset.workId,req.actor.id,'write');
      await tx.asset.updateMany({where:{id:asset.id,status:'PENDING'},data:{status:'READY',sha256:hash,objectVersion:'local-test:'+hash}});
      await audit(tx,req.actor.id,'local.asset_scanned',asset.workId,{assetId:asset.id,sha256:hash});
      return {status:'READY',message:'Dummy file validated and scanned locally.'};
    });
  }

  @Post('assets/:assetId/download')
  async download(@Req() req: ActorRequest,@Param('assetId') assetId: string) {
    const asset=await this.asset(assetId,req.actor.id);
    if(asset.status!=='READY')throw new DomainError('This file is not available.',409);
    await audit(this.db,req.actor.id,'local.asset_download_granted',asset.workId,{assetId});
    // Local download rechecks the session and current permission on every GET.
    return {url:'/api/v1/local-files/'+asset.id+'/download',expiresIn:0};
  }

  @Get('local-files/:assetId/download')
  async content(@Req() req: ActorRequest,@Param('assetId') assetId: string,@Res() res: Response) {
    const asset=await this.asset(assetId,req.actor.id);
    if(asset.status!=='READY')throw new DomainError('This file is not available.',409);
    const bytes=await readFile(this.file(asset.id));
    if(digest(bytes)!==asset.sha256)throw new DomainError('Local evidence integrity check failed.',409);
    res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(asset.filename));
    res.type('application/octet-stream').send(bytes);
  }
}
