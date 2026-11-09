import 'reflect-metadata';
import { Controller,Get,Inject,Module } from '@nestjs/common';
import { NestFactory,APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard,ThrottlerModule } from '@nestjs/throttler';
import { json,urlencoded,type Request,type Response,type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Database,Errors } from '../core.js';
import { AuthGuard,Sessions } from '../auth.js';
import { CreatorsController } from '../creators.js';
import { ProjectsController } from '../projects.js';
import { VaultController } from '../vault.js';
import { AcademicController } from '../academic.js';
import { FundingController } from '../funding.js';
import { AiController } from '../ai.js';
import type { Config } from '../config.js';
import type { SupabaseTestConfig } from './config.js';
import { SupabaseGateway,type SupabaseTestGateway } from './gateway.js';
import { SupabaseTestAuthController } from './auth.js';
import { SupabaseTestStorageController,type Scanner } from './storage.js';
import { requireSameOrigin } from '../../../../packages/domain/policy.mjs';
import { scanWithClamav } from '../../../../packages/domain/clamav.mjs';
import { SUPABASE_TEST_NOTICE,supabaseTestConfiguration,testConnectionOverride } from '../../../../packages/domain/supabase-test.mjs';

@Controller()
class TestInfoController {
  constructor(@Inject('SB_CONFIG')private config:SupabaseTestConfig){}
  @Get('supabase-test/status')status(){return {enabled:true,notice:SUPABASE_TEST_NOTICE,projectRef:this.config.projectRef,payments:false,liveAi:false};}
  @Get('health')health(){return {status:'ok',mode:'supabase-test'};}
}
@Module({})class SupabaseTestModule{}

export async function createSupabaseTestApplication(config:SupabaseTestConfig,fixtures?:{databaseUrl:string;gateway:SupabaseTestGateway;scanner:Scanner}) {
  // Revalidate even callers constructing config directly. Fixtures are possible only in the isolated test harness.
  supabaseTestConfiguration({NODE_ENV:process.env.NODE_ENV??'development',UCE_SUPABASE_TEST_ONLY:'true',SUPABASE_TEST_PROJECT_REF:config.projectRef,SUPABASE_URL:config.url,SUPABASE_PUBLISHABLE_KEY:config.publicKey,SUPABASE_SECRET_KEY:config.secretKey,DATABASE_URL:config.databaseUrl,API_BIND_ADDRESS:process.env.API_BIND_ADDRESS,CLAMAV_HOST:config.scannerHost,CLAMAV_PORT:String(config.scannerPort)});
  if(config.appUrl!=='http://127.0.0.1:3000'||config.bucket!=='uce-test-vault')throw new Error('Fixed testing origin and bucket required.');
  const databaseUrl=fixtures?testConnectionOverride(fixtures.databaseUrl,process.env.NODE_ENV):config.databaseUrl;
  const apiConfig:Config={NODE_ENV:process.env.NODE_ENV==='test'?'test':'development',DATABASE_URL:databaseUrl,APP_URL:config.appUrl,PORT:4000,AUTH_ISSUER:'https://unused.example.invalid',AUTH_DOMAIN:'https://unused.example.invalid',AUTH_CLIENT_ID:'unused-supabase-test',AWS_REGION:'af-south-1',S3_BUCKET:'',CLAMAV_HOST:config.scannerHost,CLAMAV_PORT:config.scannerPort,AI_ENABLED:'false',AI_PROVIDER:'openai-compatible',AI_ENDPOINT:'',AI_MODEL:'',AI_API_KEY:'',AI_DAILY_LIMIT:1};
  const gateway=fixtures?.gateway??new SupabaseGateway(config);
  const app=await NestFactory.create({
    module:SupabaseTestModule,imports:[ThrottlerModule.forRoot([{ttl:60000,limit:120}])],
    controllers:[TestInfoController,SupabaseTestAuthController,CreatorsController,ProjectsController,VaultController,SupabaseTestStorageController,AcademicController,FundingController,AiController],
    providers:[{provide:Database,useFactory:()=>new Database({datasources:{db:{url:databaseUrl}}})},Sessions,AuthGuard,{provide:'CONFIG',useValue:apiConfig},{provide:'SB_CONFIG',useValue:config},{provide:'SB_GATEWAY',useValue:gateway},{provide:'SB_SCANNER',useValue:fixtures?.scanner??((bytes:Buffer)=>scanWithClamav(bytes,config.scannerHost,config.scannerPort))},{provide:APP_GUARD,useClass:ThrottlerGuard}]
  },{bodyParser:false});
  app.setGlobalPrefix('api/v1');app.use(helmet());
  app.use((req:Request,res:Response,next:NextFunction)=>{
    res.setHeader('Cache-Control','no-store');
    try {
      if(!['127.0.0.1','localhost','[::1]'].includes(new URL('http://'+req.headers.host).hostname))return res.status(403).json({message:'Loopback host required.'});
      requireSameOrigin(req.headers.origin,config.appUrl,req.method);next();
    }catch{res.status(403).json({message:'Test request origin rejected.'});}
  });
  app.use(json({limit:'256kb'}));app.use(urlencoded({extended:false,limit:'16kb'}));app.use(cookieParser());
  app.useGlobalFilters(new Errors());app.enableShutdownHooks();
  try {
    await app.init();
    const db=app.get(Database);
    if(await db.user.findFirst({where:{NOT:{subject:{startsWith:'sb-test:'+config.projectRef+':'}}}}))throw new Error('Test schema contains unrelated identities.');
    await gateway.verifyBucket();
    return app;
  }catch(error){await app.close();throw error;}
}
