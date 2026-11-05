import { createHash, randomBytes } from 'node:crypto';

export const DISCIPLINES = Object.freeze(['Film and television', 'Literature and publishing', 'Music and sound', 'Animation', 'Gaming', 'Comics and illustration', 'Journalism and documentary', 'Podcasting and audio storytelling', 'Cultural heritage']);
export const IP_NOTICE = 'UCE records evidence and claims. Timestamps and hashes do not establish copyright ownership or legal registration.';
export const FUNDING_NOTICE = 'Pledges record non-binding interest only. No money is collected and no intellectual property rights are granted.';
export const AI_NOTICE = 'AI draft: review all claims, sources, translations and creative decisions before use.';
export const MAX_UPLOAD = 25 * 1024 * 1024;
export const ALLOWED_MIMES = Object.freeze(['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'audio/mpeg', 'audio/wav']);

export class DomainError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const digest = value => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export const pkceChallenge = verifier => createHash('sha256').update(verifier).digest('base64url');

/** @param {{ownerId: string}} project @param {string} userId @param {{role: string}|null|undefined} membership @param {string} action */
export function requireProjectAccess(project, userId, membership, action = 'read') {
  if (project.ownerId === userId) return;
  if (action === 'owner') throw new DomainError('Only the project administrator may perform this action.', 403);
  if (!membership || (action === 'write' && membership.role !== 'EDITOR')) throw new DomainError('Project access denied.', 403);
}

export function requireSameOrigin(origin, expected, method) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && origin !== new URL(expected).origin) {
    throw new DomainError('Request origin is not allowed.', 403);
  }
}

export function assertTransition(current, next) {
  const allowed = { REQUESTED: ['ACCEPTED', 'DECLINED', 'REVOKED'], ACCEPTED: ['COMPLETED', 'REVOKED'] };
  if (!(allowed[current] ?? []).includes(next)) throw new DomainError('This review transition is not allowed.', 409);
}

/** @param {{sensitive: boolean}} work @param {string} consentNote */
export function requireCulturalConsent(work, consentNote) {
  if (work.sensitive) throw new DomainError('Sensitive cultural material is excluded from external review and AI in this foundation release.', 403);
  if (consentNote.trim().length < 20) throw new DomainError('Describe the authority and permission for sharing this material.');
}

export function validateRights(input) {
  if (input.shareBasisPoints != null && (!Number.isInteger(input.shareBasisPoints) || input.shareBasisPoints < 0 || input.shareBasisPoints > 10000)) throw new DomainError('Share must be between 0 and 10000 basis points.');
  if (input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) throw new DomainError('Rights end date must follow the start date.');
}

export function manifest(content, assets) {
  const ordered = assets.map(asset => ({ id: asset.id, sha256: asset.sha256, objectVersion: asset.objectVersion })).sort((a,b) => a.id.localeCompare(b.id));
  return digest(JSON.stringify({ schema: 1, content, assets: ordered }));
}

export function matchesMime(bytes, mime) {
  if (mime === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'audio/wav') return bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WAVE';
  if (mime === 'audio/mpeg') return bytes.subarray(0,3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  if (mime === 'text/plain') {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return !bytes.includes(0); } catch { return false; }
  }
  return false;
}

export function allowPledge(campaign, publicProject, actorId, ownerId) {
  if (campaign.status !== 'OPEN_INTEREST' || !publicProject) throw new DomainError('This campaign is not accepting interest.', 409);
  if (actorId === ownerId) throw new DomainError('Creators cannot pledge to their own campaign.');
}
