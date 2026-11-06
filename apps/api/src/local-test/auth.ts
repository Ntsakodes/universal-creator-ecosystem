import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthGuard, Sessions } from '../auth.js';
import { Database, parse, text, uuid, type ActorRequest } from '../core.js';
import { digest, DomainError, secret } from '../../../../packages/domain/policy.mjs';
import { isLocalIdentity, LOCAL_IDENTITY_PREFIX, LOCAL_TEST_NOTICE } from '../../../../packages/domain/local-test.mjs';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const page = (heading: string, body: string) => '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>UCE local test</title><style>body{font:16px system-ui;background:#f5f4ef;color:#17302f;max-width:680px;margin:10vh auto;padding:24px}label{display:block;margin:20px 0}input,select,button{padding:12px;max-width:100%;font:inherit}button{background:#17302f;color:white;border:0;border-radius:6px}aside{padding:18px;background:#eee2bf}a{color:inherit}</style><h1>' + heading + '</h1><aside>' + LOCAL_TEST_NOTICE + '</aside>' + body + '<p><a href="/">Return home</a></p></html>';

@Controller('auth')
export class LocalAuthController {
  constructor(@Inject(Database) private db: Database, @Inject(Sessions) private sessions: Sessions) {}

  private csrf(res: Response) {
    const token = secret();
    this.sessions.cookie(res, 'uce_local_form', token, 600000);
    return '<input type="hidden" name="csrf" value="' + token + '">';
  }
  private check(req: Request, csrf: string) {
    if (!req.cookies?.uce_local_form || csrf !== req.cookies.uce_local_form) throw new DomainError('Reload the local sign-in form and try again.', 403);
  }
  private async signIn(res: Response, userId: string) {
    const token = secret();
    await this.db.session.create({data:{tokenHash:digest(token),userId,expiresAt:new Date(Date.now()+3600000)}});
    this.sessions.cookie(res,'uce_session',token,3600000);
    res.clearCookie('uce_local_form',{path:'/'});
    res.redirect(303,'/workspace');
  }
  @Get('login')
  async login(@Res() res: Response) {
    const users=await this.db.user.findMany({where:{subject:{startsWith:LOCAL_IDENTITY_PREFIX}},select:{id:true,profile:{select:{displayName:true}}},take:100,orderBy:{createdAt:'asc'}});
    const options=users.map(u=>'<option value="'+u.id+'">'+escape(u.profile?.displayName??'Test account')+' · '+u.id.slice(0,8)+'</option>').join('');
    res.type('html').send(page('Choose a local test account','<p>These synthetic identities are only for this isolated test database. No password or email service is used.</p><form method="post" action="/api/v1/auth/local-login">'+this.csrf(res)+'<label>Test identity <select name="userId">'+options+'</select></label><button>Enter test workspace</button></form><p><a href="/api/v1/auth/register">Create another test account</a></p>'));
  }
  @Get('register')
  register(@Res() res: Response) {
    res.type('html').send(page('Create a local test account','<form method="post" action="/api/v1/auth/local-register">'+this.csrf(res)+'<label>Test display name <input name="displayName" maxlength="100" required></label><label><input type="checkbox" name="acknowledge" value="yes" required> I will use dummy data only.</label><button>Create test account</button></form><p><a href="/api/v1/auth/login">Choose an existing test account</a></p>'));
  }
  @Post('local-login')
  async choose(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    const data=parse(z.object({userId:uuid,csrf:text(100)}).strict(),body);
    this.check(req,data.csrf);
    const user=await this.db.user.findUnique({where:{id:data.userId}});
    if(!user||!isLocalIdentity(user.subject))throw new DomainError('Only local test identities can sign in here.',403);
    return this.signIn(res,user.id);
  }
  @Post('local-register')
  async create(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    const data=parse(z.object({displayName:text(100),csrf:text(100),acknowledge:z.literal('yes')}).strict(),body);
    this.check(req,data.csrf);
    if(await this.db.user.count()>=100)throw new DomainError('Local test account limit reached.');
    const key=randomUUID();
    const user=await this.db.user.create({data:{subject:LOCAL_IDENTITY_PREFIX+key,email:'test-'+key+'@example.invalid',profile:{create:{displayName:data.displayName,disciplines:['Film and television'],skills:[],languages:[],links:[]}}}});
    return this.signIn(res,user.id);
  }
  @Post('logout') @UseGuards(AuthGuard)
  async logout(@Req() req: ActorRequest,@Res() res: Response) {
    await this.db.session.deleteMany({where:{tokenHash:digest(req.cookies.uce_session)}});
    res.clearCookie('uce_session',{path:'/'});
    res.json({logoutUrl:'/'});
  }
}
