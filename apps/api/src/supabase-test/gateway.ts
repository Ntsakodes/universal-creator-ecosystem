import { createClient } from '@supabase/supabase-js';
import { DomainError, MAX_UPLOAD, ALLOWED_MIMES, digest } from '../../../../packages/domain/policy.mjs';
import { supabaseTestPath } from '../../../../packages/domain/supabase-test.mjs';
import type { SupabaseTestConfig } from './config.js';

export type Identity={id:string;email:string;confirmed:boolean;displayName:string};
export type AuthResult={accessToken:string|null};
export interface SupabaseTestGateway {
  signUp(email:string,password:string,name:string):Promise<AuthResult>;
  signIn(email:string,password:string):Promise<AuthResult>;
  identity(accessToken:string):Promise<Identity>;
  verifyBucket():Promise<void>;
  prepareBucket():Promise<void>;
  uploadIntent(path:string):Promise<string>;
  read(path:string,kind:'quarantine'|'approved'):Promise<Buffer>;
  approve(path:string,bytes:Buffer,mimeType:string):Promise<void>;
  download(path:string,filename:string):Promise<string>;
}

export class SupabaseGateway implements SupabaseTestGateway {
  private admin;
  constructor(private config:SupabaseTestConfig) {
    this.admin=this.client(config.secretKey);
  }
  private client(key:string) {
    return createClient(this.config.url,key,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,flowType:'pkce'},
      global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}
    });
  }
  private storage(){return this.admin.storage.from(this.config.bucket);}
  async signUp(email:string,password:string,name:string) {
    // Separate client per request: no shared mutable user session or refresh-token storage.
    const {data,error}=await this.client(this.config.publicKey).auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:this.config.appUrl+'/api/v1/auth/supabase-test/confirmed'}});
    if(error)throw new DomainError('Test registration could not complete. Check Auth settings, email delivery and rate limits.',400);
    return {accessToken:data.session?.access_token??null};
  }
  async signIn(email:string,password:string) {
    const {data,error}=await this.client(this.config.publicKey).auth.signInWithPassword({email,password});
    if(error||!data.session)throw new DomainError('Sign-in failed. Check your test credentials and account confirmation.',401);
    return {accessToken:data.session.access_token};
  }
  async identity(accessToken:string) {
    const {data,error}=await this.client(this.config.publicKey).auth.getUser(accessToken);
    if(error||!data.user?.email)throw new DomainError('Supabase could not verify this test identity.',401);
    const user=data.user;
    return {id:user.id,email:user.email!,confirmed:!!user.email_confirmed_at,displayName:typeof user.user_metadata.display_name==='string'?user.user_metadata.display_name.slice(0,100):'Test creator'};
  }
  async prepareBucket() {
    const existing=await this.admin.storage.getBucket(this.config.bucket);
    if(existing.error) {
      const created=await this.admin.storage.createBucket(this.config.bucket,{public:false,fileSizeLimit:MAX_UPLOAD,allowedMimeTypes:[...ALLOWED_MIMES]});
      if(created.error)throw new DomainError('Could not prepare the private test bucket.',503);
    }
    await this.verifyBucket();
  }
  async verifyBucket() {
    const {data,error}=await this.admin.storage.getBucket(this.config.bucket);
    if(error||!data||data.public||!data.file_size_limit||data.file_size_limit>MAX_UPLOAD)throw new DomainError('A private uce-test-vault bucket with a maximum file size of 25 MB is required.',503);
  }
  async uploadIntent(path:string) {
    supabaseTestPath(path,'quarantine');
    const {data,error}=await this.storage().createSignedUploadUrl(path,{upsert:false});
    if(error||!data)throw new DomainError('Could not authorise a private test upload.',503);
    return data.signedUrl;
  }
  async read(path:string,kind:'quarantine'|'approved') {
    supabaseTestPath(path,kind);
    const {data,error}=await this.storage().download(path);
    if(error||!data||data.size>MAX_UPLOAD)throw new DomainError('Test file unavailable or too large.',409);
    return Buffer.from(await data.arrayBuffer());
  }
  async approve(path:string,bytes:Buffer,mimeType:string) {
    supabaseTestPath(path,'approved');
    const {error}=await this.storage().upload(path,bytes,{contentType:mimeType,upsert:false});
    if(error) {
      // A completed copy followed by a network/DB failure can be retried without overwriting evidence.
      const existing=await this.read(path,'approved');
      if(existing.length!==bytes.length||digest(existing)!==digest(bytes))throw new DomainError('Approved evidence integrity check failed.',409);
    }
  }
  async download(path:string,filename:string) {
    supabaseTestPath(path,'approved');
    const {data,error}=await this.storage().createSignedUrl(path,60,{download:filename});
    if(error||!data)throw new DomainError('Could not authorise a private test download.',503);
    return data.signedUrl;
  }
}
