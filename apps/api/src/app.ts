import { Controller, Get, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController, AuthGuard, Sessions } from './auth.js';
import { configuration } from './config.js';
import { Database } from './core.js';
import { CreatorsController } from './creators.js';
import { ProjectsController } from './projects.js';
import { VaultController } from './vault.js';
import { ObjectStore, StorageController } from './storage.js';
import { AcademicController } from './academic.js';
import { FundingController } from './funding.js';
import { AiController } from './ai.js';

@Global() @Module({providers:[Database,Sessions,AuthGuard,ObjectStore,{provide:'CONFIG',useFactory:configuration}],exports:[Database,Sessions,AuthGuard,ObjectStore,'CONFIG']})
class InfrastructureModule{}
@Module({controllers:[AuthController,CreatorsController]})class IdentityModule{}
@Module({controllers:[ProjectsController,VaultController,StorageController]})class CreatorModule{}
@Module({controllers:[AcademicController]})class AcademicModule{}
@Module({controllers:[FundingController]})class CommunityModule{}
@Module({controllers:[AiController]})class IntelligenceModule{}
@Controller('health') class HealthController{@Get() health(){return{status:'ok',service:'uce-api'};}}
@Module({
  imports:[InfrastructureModule,ThrottlerModule.forRoot([{ttl:60000,limit:120}]),IdentityModule,CreatorModule,AcademicModule,CommunityModule,IntelligenceModule],
  controllers:[HealthController],providers:[{provide:APP_GUARD,useClass:ThrottlerGuard}]
})
export class AppModule{}
