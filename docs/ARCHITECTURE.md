# Foundation architecture

Implementation follows the approved direction: Next.js + NestJS modular monolith, PostgreSQL and a separate durable worker. Modules share identity, authorisation, projects, works, storage and audit. The worker uses PostgreSQL `FOR UPDATE SKIP LOCKED` jobs; job creation is transactional with the initiating domain write.

## Source map

| Path | Responsibility |
| --- | --- |
| apps/web/app | Landing page, responsive workspace and API-backed forms |
| apps/api/src/auth.ts | PKCE registration/login, verified callbacks, opaque sessions |
| apps/api/src/creators.ts | Private/public creator profiles |
| apps/api/src/projects.ts | Projects, scoped members, summary visibility |
| apps/api/src/vault.ts | Works, versions, contributors, agreement claims, export |
| apps/api/src/storage.ts | Private upload and download grants |
| apps/api/src/academic.ts | Institutions, experts, affiliations, reviews |
| apps/api/src/funding.ts | Campaigns, non-binding pledges, milestones |
| apps/api/src/ai.ts | Consent, quotas and queued AI runs |
| apps/api/src/worker.ts | File validation/scanning and provider execution |
| packages/domain | Shared pure security/business policy and AI adapters |
| prisma | Relational schema and append-only integrity migrations |

## Data relationships

User has one optional creator profile, one optional expert profile and multiple project memberships. A project has one workspace administrator and multiple editor/viewer members. A work belongs to a project but has independent authorship claims and multiple versions. Versions refer to scanned asset records through VersionAsset. Assets bind a specific S3 object version and SHA-256 hash after scanning.

ReviewRequest references an exact WorkVersion and a reviewer. Accepting a request records conflicts and a snapshot of verified affiliations. ReviewReport refers to one request, carries sources/limitations and is immutable. Institutions and affiliations have independent verification states.

A project may have one campaign and multiple milestones. Each account has at most one updatable expression-of-interest pledge per campaign. Funding is deliberately not a financial ledger: amount fields never represent paid, escrowed or investable money.

AiRun records user, project, source version, provider, endpoint, model, instruction and consent time. Job references its resource by UUID and type. AuditEvent is append-only. User-facing reads never return passwords, sessions, identity tokens, storage credentials or API keys.

## Implementation decisions

1. Managed identity with server-held PKCE and opaque app sessions. No custom password storage and no fake local authentication.
2. Project membership is authorisation, not IP ownership. Public summary visibility does not grant file access.
3. Initial work ownership is one project to many works, rather than many projects to many works. This keeps access boundaries explicit; cross-project work sharing needs a dedicated access model before introduction.
4. Direct creator grants are used for the first foundation. A future invitation must add expiry, recipient verification and acceptance without changing the current role rules.
5. Version numbers are allocated inside serializable transactions with conflict retries. Database constraints enforce uniqueness; immutability triggers reject updates and deletes.
6. Rights records preserve supplied agreement details as claims, not validated percentage allocations. No automatic transfer, licence execution, revenue distribution or legal certification occurs.
7. Cultural-sensitive works cannot be externally reviewed, sent to AI or placed in a public-summary project. Community-governed disclosure requires a future protocol implementation.
8. No Redis, external search cluster, microservices or investment infrastructure is introduced.
9. PostgreSQL row-level security is not enabled in this first implementation. Authorisation is in application services with transaction checks. Runtime database credentials must remain server-only. RLS requires explicit connection-context design and its own integration tests before adoption.
10. AI requests are one-off tasks, not autonomous agents. They cannot publish, change rights, move money or grant access.

## References checked during implementation

- Next.js rewrites: https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites
- Cognito PKCE: https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html
- Cognito authorization: https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html
- Prisma migrations: https://www.prisma.io/docs/orm/v6/prisma-migrate/getting-started
- Anthropic Messages: https://platform.claude.com/docs/en/api/messages/create
- OpenAI chat completions: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
