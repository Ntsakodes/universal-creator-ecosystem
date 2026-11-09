import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request,Response } from 'express';
import { decodeJwt } from 'jose';
import { z } from 'zod';
import { AuthGuard,Sessions } from '../auth.js';
import { Database,audit,id,parse,text,type ActorRequest } from '../core.js';
import { digest,DomainError,secret } from '../../../../packages/domain/policy.mjs';
import { SUPABASE_TEST_NOTICE } from '../../../../packages/domain/supabase-test.mjs';
import type { SupabaseTestConfig } from './config.js';
import type { SupabaseTestGateway } from './gateway.js';

const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const page=(heading:string,body:string)=>'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>UCE Supabase testing</title><style>body{font:16px system-ui;background:#f5f4ef;color:#17302f;max-width:650px;margin:10vh auto;padding:24px}label{display:block;margin:20px 0}input,button{font:inherit;padding:12px;max-width:100%}button{background:#17302f;color:white;border:0;border-radius:6px}aside{padding:16px;background:#eee2bf}a{color:inherit}</style><h1>'+heading+'</h1><aside>'+SUPABASE_TEST_NOTICE+'</aside>'+body+'<p><a href="/">Return home</a></p></html>';

@Controller('auth')
export class SupabaseTestAuthController {
  constructor(@Inject(Database)private db:Database,@Inject(Sessions)private sessions:Sessions,@Inject('SB_CONFIG')private config:SupabaseTestConfig,@Inject('SB_GATEWAY')private gateway:SupabaseTestGateway){}
  private csrf(res:Response) {
    const token=secret();this.sessions.cookie(res,'uce_sb_form',token,600000);
    return '<input type="hidden" name="csrf" value="'+token+'">';
  }
  private check(req:Request,csrf:string) {
    if(!req.cookies?.uce_sb_form||csrf!==req.cookies.uce_sb_form)throw new DomainError('Reload the test sign-in form.',403);
  }
  private async issue(accessToken:string,res:Response) {
    // getUser performs server-side verification; decoded claims are checked only after that succeeds.
    const identity=await this.gateway.identity(accessToken);
    const claims=decodeJwt(accessToken);
    if(!identity.confirmed||claims.sub!==identity.id||claims.iss!==this.config.url+'/auth/v1'||!claims.exp||claims.exp*1000<=Date.now())throw new DomainError('A confirmed test identity is required.',401);
    id(identity.id);
    const expiresAt=new Date(Math.min(claims.exp*1000,Date.now()+3600000));
    const subject='sb-test:'+this.config.projectRef+':'+identity.id;
    const user=await this.db.user.upsert({where:{subject},update:{email:identity.email.toLowerCase()},create:{subject,email:identity.email.toLowerCase(),profile:{create:{displayName:identity.displayName||'Test creator',disciplines:['Film and television'],skills:[],languages:[],links:[]}}}});
    const token=secret();
    await this.db.$transaction(async tx=>{
      await tx.session.create({data:{tokenHash:digest(token),userId:user.id,expiresAt}});
      await audit(tx,user.id,'supabase_test.signed_in',user.id);
    });
    // Supabase access/refresh tokens never reach the browser or application database.
    this.sessions.cookie(res,'uce_session',token,expiresAt.getTime()-Date.now());
    res.clearCookie('uce_sb_form',{path:'/'});
    res.redirect(303,'/workspace');
  }
  @Get('login')
  login(@Res()res:Response) {
    res.type('html').send(page('Sign in to your test project','<form method="post" action="/api/v1/auth/supabase-test/login">'+this.csrf(res)+'<label>Test email <input name="email" type="email" required maxlength="254" autocomplete="username"></label><label>Password <input name="password" type="password" required maxlength="128" autocomplete="current-password"></label><button>Sign in</button></form><p><a href="/api/v1/auth/register">Register a test account</a></p>'));
  }
  @Get('register')
  register(@Res()res:Response) {
    res.type('html').send(page('Register a test account','<p>Use a dedicated test identity and dummy creative content.</p><form method="post" action="/api/v1/auth/supabase-test/register">'+this.csrf(res)+'<label>Display name <input name="name" required maxlength="100"></label><label>Test email <input name="email" type="email" required maxlength="254"></label><label>Password <input name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label><button>Register</button></form><p>Supabase email confirmation settings apply. The default sender is restricted; see the testing guide if confirmation email is unavailable.</p>'));
  }
  @Post('supabase-test/login') @Throttle({default:{limit:6,ttl:60000}})
  async signIn(@Req()req:Request,@Res()res:Response,@Body()body:unknown) {
    const data=parse(z.object({email:z.email().max(254),password:z.string().min(1).max(128),csrf:text(100)}).strict(),body);
    this.check(req,data.csrf);
    const result=await this.gateway.signIn(data.email,data.password);
    if(!result.accessToken)throw new DomainError('Test sign-in failed.',401);
    return this.issue(result.accessToken,res);
  }
  @Post('supabase-test/register') @Throttle({default:{limit:4,ttl:60000}})
  async signUp(@Req()req:Request,@Res()res:Response,@Body()body:unknown) {
    const data=parse(z.object({name:text(100),email:z.email().max(254),password:z.string().min(12).max(128),csrf:text(100)}).strict(),body);
    this.check(req,data.csrf);
    const result=await this.gateway.signUp(data.email,data.password,data.name);
    if(result.accessToken)return this.issue(result.accessToken,res);
    res.clearCookie('uce_sb_form',{path:'/'});
    res.type('html').send(page('Confirm your test email','<p>If registration is eligible, follow the confirmation email, then return here to sign in.</p><p><a href="/api/v1/auth/login">Return to test sign-in</a></p>'));
  }
  @Get('supabase-test/confirmed')
  confirmed(@Res()res:Response) { res.redirect(303,'/api/v1/auth/login#'); }
  @Post('logout') @UseGuards(AuthGuard)
  async logout(@Req()req:ActorRequest,@Res()res:Response) {
    await this.db.session.deleteMany({where:{tokenHash:digest(req.cookies.uce_session)}});
    res.clearCookie('uce_session',{path:'/'});
    res.json({logoutUrl:'/'});
  }
}
