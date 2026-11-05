import { CanActivate, Controller, ExecutionContext, Get, Inject, Injectable, Post, Req, Res, UseGuards } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Request, Response } from 'express';
import { Database, type ActorRequest } from './core.js';
import type { Config } from './config.js';
import { digest, DomainError, pkceChallenge, secret } from '../../../packages/domain/policy.mjs';

@Injectable()
export class Sessions {
  constructor(@Inject(Database) private db: Database, @Inject('CONFIG') private config: Config) {}
  async actor(req: Request) {
    const token: unknown = req.cookies?.uce_session;
    if (typeof token !== 'string' || token.length > 100) throw new DomainError('Please sign in.', 401);
    const session = await this.db.session.findUnique({ where: { tokenHash: digest(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) throw new DomainError('Your session has expired. Please sign in.', 401);
    return { id: session.user.id, email: session.user.email };
  }
  cookie(res: Response, name: string, value: string, maxAge: number) {
    res.cookie(name, value, { httpOnly: true, secure: this.config.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge });
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Sessions) private sessions: Sessions) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ActorRequest>();
    req.actor = await this.sessions.actor(req);
    return true;
  }
}
@Controller('auth')
export class AuthController {
  private keys: ReturnType<typeof createRemoteJWKSet>;
  constructor(@Inject(Database) private db: Database, @Inject(Sessions) private sessions: Sessions, @Inject('CONFIG') private config: Config) {
    this.keys = createRemoteJWKSet(new URL(`${config.AUTH_ISSUER}/.well-known/jwks.json`));
  }
  @Get('login')
  login(@Res() res: Response) { return this.begin(res, false); }
  @Get('register')
  register(@Res() res: Response) { return this.begin(res, true); }
  private async begin(res: Response, register: boolean) {
    const state = secret(), verifier = secret(), nonce = secret();
    await this.db.authFlow.create({ data: { stateHash: digest(state), verifier, nonce, expiresAt: new Date(Date.now() + 600000) } });
    this.sessions.cookie(res, 'uce_flow', state, 600000);
    const url = new URL(register ? '/signup' : '/oauth2/authorize', this.config.AUTH_DOMAIN);
    url.search = new URLSearchParams({ response_type: 'code', client_id: this.config.AUTH_CLIENT_ID, redirect_uri: `${this.config.APP_URL}/api/v1/auth/callback`, scope: 'openid email profile', state, nonce, code_challenge: pkceChallenge(verifier), code_challenge_method: 'S256' }).toString();
    res.redirect(url.toString());
  }
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const { state, code } = req.query;
    if (typeof state !== 'string' || typeof code !== 'string' || state !== req.cookies?.uce_flow) throw new DomainError('Sign-in state is invalid. Start sign-in again.', 401);
    const consumed = await this.db.$transaction(async tx => {
      const flow = await tx.authFlow.findUnique({ where: { stateHash: digest(state) } });
      if (!flow || flow.expiresAt <= new Date()) throw new DomainError('Sign-in expired.', 401);
      await tx.authFlow.delete({ where: { stateHash: flow.stateHash } });
      return flow;
    });
    res.clearCookie('uce_flow', { path: '/' });
    const result = await fetch(new URL('/oauth2/token', this.config.AUTH_DOMAIN), {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, redirect: 'error', signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: this.config.AUTH_CLIENT_ID, code, redirect_uri: `${this.config.APP_URL}/api/v1/auth/callback`, code_verifier: consumed.verifier })
    });
    if (!result.ok) throw new DomainError('Identity provider could not complete sign-in.', 401);
    const tokens = await result.json() as { id_token?: string };
    if (!tokens.id_token) throw new DomainError('Identity token missing.', 401);
    const { payload } = await jwtVerify(tokens.id_token, this.keys, { issuer: this.config.AUTH_ISSUER, audience: this.config.AUTH_CLIENT_ID, algorithms: ['RS256'] });
    if (!payload.sub || payload.nonce !== consumed.nonce || payload.token_use !== 'id' || payload.email_verified !== true || typeof payload.email !== 'string' || !payload.exp) throw new DomainError('Verified identity required.', 401);
    const user = await this.db.user.upsert({ where: { subject: payload.sub }, update: { email: payload.email.toLowerCase() }, create: { subject: payload.sub, email: payload.email.toLowerCase() } });
    const token = secret();
    const expiresAt = new Date(Math.min(payload.exp * 1000, Date.now() + 3600000));
    await this.db.session.create({ data: { tokenHash: digest(token), userId: user.id, expiresAt } });
    this.sessions.cookie(res, 'uce_session', token, expiresAt.getTime() - Date.now());
    res.redirect(`${this.config.APP_URL}/workspace`);
  }
  @Post('logout') @UseGuards(AuthGuard)
  async logout(@Req() req: ActorRequest, @Res() res: Response) {
    await this.db.session.deleteMany({ where: { tokenHash: digest(req.cookies.uce_session) } });
    res.clearCookie('uce_session', { path: '/' });
    const url = new URL('/logout', this.config.AUTH_DOMAIN);
    url.search = new URLSearchParams({ client_id: this.config.AUTH_CLIENT_ID, logout_uri: this.config.APP_URL }).toString();
    res.json({ logoutUrl: url.toString() });
  }
}
