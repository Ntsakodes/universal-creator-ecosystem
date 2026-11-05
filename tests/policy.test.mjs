import test from 'node:test';
import assert from 'node:assert/strict';
import { requireProjectAccess, requireSameOrigin, assertTransition, requireCulturalConsent, manifest, digest, pkceChallenge, matchesMime, allowPledge, validateRights } from '../packages/domain/policy.mjs';

test('project administrators retain access without membership; public visibility does not grant vault access',()=>{
  requireProjectAccess({ownerId:'a',visibility:'PUBLIC'},'a',null,'owner');
  assert.throws(()=>requireProjectAccess({ownerId:'a',visibility:'PUBLIC'},'b',null),{status:403});
});
test('viewer cannot write or change project permissions',()=>{
  requireProjectAccess({ownerId:'a'},'b',{role:'VIEWER'},'read');
  assert.throws(()=>requireProjectAccess({ownerId:'a'},'b',{role:'VIEWER'},'write'),{status:403});
  assert.throws(()=>requireProjectAccess({ownerId:'a'},'b',{role:'EDITOR'},'owner'),{status:403});
});
test('editor can write but a revoked member loses read access',()=>{
  requireProjectAccess({ownerId:'a'},'b',{role:'EDITOR'},'write');
  assert.throws(()=>requireProjectAccess({ownerId:'a'},'b',null),{status:403});
});
for(const method of ['POST','PUT','PATCH','DELETE'])test(`${method} rejects missing and foreign browser origins`,()=>{
  assert.throws(()=>requireSameOrigin(undefined,'https://uce.test',method),{status:403});
  assert.throws(()=>requireSameOrigin('https://evil.test','https://uce.test',method),{status:403});
  requireSameOrigin('https://uce.test','https://uce.test',method);
});
test('callback GET may omit origin; PKCE uses the RFC 7636 challenge',()=>{
  requireSameOrigin(undefined,'https://uce.test','GET');
  assert.equal(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});
test('review must be accepted before report; terminal records cannot reopen',()=>{
  assert.throws(()=>assertTransition('REQUESTED','COMPLETED'),{status:409});
  assertTransition('REQUESTED','ACCEPTED');assertTransition('ACCEPTED','COMPLETED');
  for(const status of ['COMPLETED','DECLINED','REVOKED'])assert.throws(()=>assertTransition(status,'ACCEPTED'),{status:409});
});
test('revocation is allowed after acceptance',()=>{assertTransition('ACCEPTED','REVOKED');});
test('sensitive cultural material cannot be sent externally, even with generic consent',()=>{
  assert.throws(()=>requireCulturalConsent({sensitive:true},'I have all required permissions to disclose.'),{status:403});
  assert.throws(()=>requireCulturalConsent({sensitive:false},'ok'));
  requireCulturalConsent({sensitive:false},'I am authorised by all contributors to share this text.');
});
test('manifest is deterministic across attachment order and sensitive to text, bytes and object version',()=>{
  const a={id:'a',sha256:digest('a'),objectVersion:'1'},b={id:'b',sha256:digest('b'),objectVersion:'1'};
  const hash=manifest('text',[a,b]);
  assert.equal(hash,manifest('text',[b,a]));
  assert.notEqual(hash,manifest('changed',[a,b]));
  assert.notEqual(hash,manifest('text',[{...a,objectVersion:'2'},b]));
  assert.notEqual(hash,manifest('text',[{...a,sha256:digest('changed')},b]));
});
test('file content is checked independently of filename and declared MIME',()=>{
  assert.equal(matchesMime(Buffer.from('plain text'),'application/pdf'),false);
  assert.equal(matchesMime(Buffer.from('%PDF-1.7'),'application/pdf'),true);
  assert.equal(matchesMime(Buffer.from([0xff,0xd8,0xff]),'image/jpeg'),true);
  assert.equal(matchesMime(Buffer.from([0xff,0xfe]),'text/plain'),false);
  assert.equal(matchesMime(Buffer.from('abc\0def'),'text/plain'),false);
  assert.equal(matchesMime(Buffer.from('Ntsako — original work'),'text/plain'),true);
  assert.equal(matchesMime(Buffer.from('content'),'application/octet-stream'),false);
});
test('interest requires an open, public campaign and cannot be self-funded',()=>{
  allowPledge({status:'OPEN_INTEREST'},true,'supporter','creator');
  assert.throws(()=>allowPledge({status:'DRAFT'},true,'supporter','creator'));
  assert.throws(()=>allowPledge({status:'OPEN_INTEREST'},false,'supporter','creator'));
  assert.throws(()=>allowPledge({status:'OPEN_INTEREST'},true,'creator','creator'));
});
test('rights precision and date bounds are validated',()=>{
  validateRights({shareBasisPoints:3333,startsAt:'2026-01-01',endsAt:'2027-01-01'});
  for(const share of [-1,10001,33.3])assert.throws(()=>validateRights({shareBasisPoints:share,startsAt:'2026-01-01'}));
  assert.throws(()=>validateRights({startsAt:'2026-01-01',endsAt:'2025-01-01'}));
});
