# Security and trust boundaries

## Implemented controls

- Managed verified identity; state/nonce/PKCE, signature/issuer/audience validation and one-use auth flows.
- Opaque 256-bit random sessions, hashed at rest, bounded by ID-token expiry. HttpOnly, SameSite=Lax and production Secure cookies.
- Exact-origin checks for browser mutations, request-size bounds, schema validation, rate limiting and defensive response headers.
- Explicit project owner/editor/viewer checks; reviewer grants are separate and version scoped.
- Private object storage, short-lived grants, version pinning, byte signature validation, hashes and mandatory malware scan.
- Append-only versions, reports, rights claims and audit. Version evidence and supporting agreements must belong to the same work.
- AI disabled by default; consent and source versions recorded; no provider fallback after configuration change.
- No card processing, custody, tokens, investment return or automatic IP transfer.

## Important limits

Rate limiting uses local process memory. Configure shared limits at the ingress before running multiple replicas. Do not trust arbitrary forwarded IP headers. The API should be network-private behind the same-origin web gateway. Network policy and IAM boundaries are required; application checks do not replace them.

A signed download can remain valid for up to 60 seconds after access revocation. Previously downloaded content cannot be recalled. A running AI request may complete after consent/access changes; provider-side cancellation cannot be guaranteed.

Work versions are hashed; audit rows are append-only under application access, not independently trusted timestamps or tamper-proof evidence against a database administrator. Separate migration/runtime database roles and external audit shipping remain deployment responsibilities.

The file worker rejects unscannable uploads. It does not render PDFs or execute uploaded files. No archive or office-document support is claimed. Object quotas and storage lifecycle rules are operational requirements in addition to application file limits.

## Production gates

1. Install and lock dependencies; run schema validation, migrations against empty PostgreSQL, typecheck, production builds and HTTP integration tests.
2. Test managed registration, email confirmation, recovery, MFA, replay/invalid callback rejection, token expiry and logout against the configured Cognito pool.
3. Test S3 CORS, versioning, IAM scope, valid and malicious uploads, unavailable scanner behaviour and download isolation with real services.
4. Deploy least-privilege runtime database/IAM roles, TLS, secret rotation, monitoring and tested database/object restoration.
5. Complete POPIA notices, processing inventory, operator agreements, cross-border assessment, data request handling, retention/deletion and incident procedures with qualified review.
6. Implement a controlled retention/erasure process compatible with append-only evidence and legal holds. Do not solve erasure by casually disabling triggers. The current app has no self-service deletion endpoint.
7. Establish authorship disputes, takedown, reviewer appeals, identity checks, sensitive-knowledge protocols and moderation ownership.
8. Before enabling AI, assess provider terms/retention, verify endpoint identity, test language quality, enforce a provider spending ceiling and establish repeated-call reconciliation.
9. Before enabling payments, approve the provider, regulated operating model, webhook verification, financial ledger, reconciliation, refund/dispute rules and beneficiary verification. The current schema is not a substitute for that ledger.

No claim of POPIA compliance, copyright registration or production readiness is made by this source release.
