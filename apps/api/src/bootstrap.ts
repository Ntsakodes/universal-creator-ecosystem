import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.js';
import { configuration } from './config.js';
import { Errors } from './core.js';
import { requireSameOrigin } from '../../../packages/domain/policy.mjs';

export async function createApplication(){
  const config=configuration();
  const app=await NestFactory.create(AppModule,{bodyParser:false});
  app.setGlobalPrefix('api/v1');
  app.use(helmet());app.use(json({limit:'256kb'}));app.use(cookieParser());
  app.use((req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{
    res.setHeader('Cache-Control','no-store');
    try{requireSameOrigin(req.headers.origin,config.APP_URL,req.method);next();}
    catch{res.status(403).json({message:'Request origin is not allowed.'});}
  });
  app.useGlobalFilters(new Errors());app.enableShutdownHooks();
  if(config.NODE_ENV!=='production'){
    const doc=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('UCE foundation API').setVersion('1').addCookieAuth('uce_session').build());
    SwaggerModule.setup('api/docs',app,doc);
  }
  return app;
}
