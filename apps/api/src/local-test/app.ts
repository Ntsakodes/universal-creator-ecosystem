import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, raw, urlencoded, type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { Database, Errors } from '../core.js';
import { AuthGuard, Sessions } from '../auth.js';
import { CreatorsController } from '../creators.js';
import { ProjectsController } from '../projects.js';
import { VaultController } from '../vault.js';
import { AcademicController } from '../academic.js';
import { FundingController } from '../funding.js';
import { AiController } from '../ai.js';
import type { Config } from '../config.js';
import { LocalAuthController } from './auth.js';
import { LocalStorageController, type Scanner } from './storage.js';
import { scanWithClamav } from '../../../../packages/domain/clamav.mjs';
import { MAX_UPLOAD, requireSameOrigin } from '../../../../packages/domain/policy.mjs';
import { assertLocalTestEnvironment, LOCAL_APP_URL, LOCAL_DATABASE, LOCAL_IDENTITY_PREFIX, LOCAL_TEST_NOTICE } from '../../../../packages/domain/local-test.mjs';

@Controller()
class LocalInfoController {
  @Get('local-test/status') status() {
    return {enabled:true,notice:LOCAL_TEST_NOTICE,payments:false,liveAi:false,storage:'local',registration:'synthetic'};
  }
  @Get('health') health() { return {status:'ok',mode:'local-test'}; }
}
@Module({}) class LocalTestModule {}

/** Imported only by the separate local launcher and integration tests, never production main.ts. */
export async function createLocalTestApplication(options: {databaseUrl?:string;directory?:string;scanner?:Scanner} = {}) {
  const databaseUrl=options.databaseUrl??LOCAL_DATABASE;
  assertLocalTestEnvironment({nodeEnv:process.env.NODE_ENV??'development',databaseUrl,appUrl:LOCAL_APP_URL,bindAddress:process.env.API_BIND_ADDRESS??'127.0.0.1'});
  // Prisma reads this value at client creation. It has already passed the strict loopback/database guard.
  process.env.DATABASE_URL=databaseUrl;
  const config:Config={
    NODE_ENV:process.env.NODE_ENV==='test'?'test':'development',DATABASE_URL:databaseUrl,APP_URL:LOCAL_APP_URL,PORT:4000,
    AUTH_ISSUER:'https://unused.example.invalid',AUTH_DOMAIN:'https://unused.example.invalid',AUTH_CLIENT_ID:'unused-local-test',
    AWS_REGION:'af-south-1',S3_BUCKET:'',CLAMAV_HOST:'127.0.0.1',CLAMAV_PORT:3311,
    AI_ENABLED:'false',AI_PROVIDER:'openai-compatible',AI_ENDPOINT:'',AI_MODEL:'',AI_API_KEY:'',AI_DAILY_LIMIT:1
  };
  const app=await NestFactory.create({
    module:LocalTestModule,
    controllers:[LocalInfoController,LocalAuthController,CreatorsController,ProjectsController,VaultController,LocalStorageController,AcademicController,FundingController,AiController],
    providers:[Database,Sessions,AuthGuard,{provide:'CONFIG',useValue:config},{provide:'LOCAL_STORAGE',useValue:{directory:options.directory??resolve('.local-test-data/files'),scanner:options.scanner??((bytes:Buffer)=>scanWithClamav(bytes,'127.0.0.1',3311))}}]
  },{bodyParser:false});
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use((req:Request,res:Response,next:NextFunction)=>{
    res.setHeader('Cache-Control','no-store');
    try {
      const host=new URL('http://'+(req.headers.host??'')).hostname;
      if(!['localhost','127.0.0.1','[::1]'].includes(host))return res.status(403).json({message:'Loopback host required.'});
      requireSameOrigin(req.headers.origin,LOCAL_APP_URL,req.method);
      next();
    } catch { res.status(403).json({message:'Local test request rejected.'}); }
  });
  app.use('/api/v1/local-files',raw({type:()=>true,limit:MAX_UPLOAD}));
  app.use(json({limit:'256kb'}));
  app.use(urlencoded({extended:false,limit:'16kb'}));
  app.use(cookieParser());
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  try {
    await app.init();
    const db=app.get(Database);
    const foreignUser=await db.user.findFirst({where:{NOT:{subject:{startsWith:LOCAL_IDENTITY_PREFIX}}}});
    if(foreignUser)throw new Error('Refusing a database containing non-local-test identities.');
    for(const name of ['Creator','Collaborator','Expert','Supporter']) {
      const user=await db.user.upsert({
        where:{subject:LOCAL_IDENTITY_PREFIX+name.toLowerCase()},update:{},
        create:{subject:LOCAL_IDENTITY_PREFIX+name.toLowerCase(),email:name.toLowerCase()+'@example.invalid',profile:{create:{displayName:'Test '+name,disciplines:['Film and television'],skills:[],languages:['English'],links:[],visibility:'PUBLIC'}}}
      });
      if(name==='Expert')await db.expertProfile.upsert({where:{userId:user.id},update:{},create:{userId:user.id,biography:'Synthetic reviewer for local testing only.',qualifications:'Test fixture — no real credentials.',expertise:['History'],languages:['English'],regions:['South Africa'],publications:[],available:true,public:true}});
    }
    return app;
  } catch(error) { await app.close(); throw error; }
}
