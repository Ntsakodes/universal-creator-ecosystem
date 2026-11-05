# Universal Creator Ecosystem

Foundation source for a unified creator platform, based on `AGENTS.md`.

## Release status

This is an initial implementation for review and an online build, not a deployed or production-certified service. No production data or sample accounts are seeded. Package downloads and Git cloning were blocked in the authoring environment; Docker and PostgreSQL were unavailable. The dependency-free policy/AI tests passed. Dependency installation, Prisma validation, SQL execution, typechecking, browser journeys, and live identity/storage/AI integration remain to be run in the target development environment. See [verification](docs/VERIFICATION.md).

## Included

- Next.js responsive landing page and creator workspace with real API-backed forms and empty states.
- Cognito managed registration/sign-in using authorization code, PKCE, state, nonce, verified identity tokens, and database-backed opaque sessions. Passwords and provider tokens are not stored by UCE.
- Creator profiles, multiple disciplines, privacy settings, public creator directory, private projects, scoped collaborators and revocation.
- IP works separate from project workspaces, immutable text versions, contributor records, supporting agreement claims, evidence manifests and audit events.
- Private S3 upload intents; a worker validates size/type, scans with ClamAV, binds an immutable S3 object version, and grants short-lived downloads.
- Expert and institution profiles, affiliation requests, operator-controlled institution verification, version-specific review requests, conflicts, sources, limitations and final reports.
- Campaign drafts, public expressions of interest, supporter/sponsor distinctions and self-reported milestones. No money movement.
- Optional queued AI drafts with OpenAI-compatible and Anthropic adapters, explicit disclosure consent, daily limits and immutable source references.
- PostgreSQL/Prisma schema, two migrations, domain tests, HTTP/database integration test, CI workflow and Docker build targets.

## Start locally

Prerequisites: Node.js 22.12+ (22 LTS recommended), npm, Docker, an AWS Cognito user pool, a private versioned S3 bucket and an IAM identity authorised for that bucket.

```sh
cp .env.example .env
# Edit .env with real development configuration before starting the application.
npm install
npm run db:validate
npm run db:generate
docker compose up -d postgres clamav
npm run db:deploy
npm test
npm run typecheck
npm run build
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp` if preferred. The example database password is for a loopback-bound local database only.

Run these in three terminals at the repository root:

```sh
npm run dev:api
npm run dev:web
npm run worker
```

Open `http://localhost:3000`. Development API documentation is at `http://localhost:4000/api/docs`. API liveness: `http://localhost:4000/api/v1/health`.

The first successful online install must generate and commit `package-lock.json`. Review the resolved dependencies and security advisories, then change installation commands in CI and Docker to `npm ci`. No unverified lockfile was fabricated.

## Identity setup

Configure Cognito managed login with:

- A public app client without a client secret.
- Authorization-code grant and scopes `openid`, `email`, `profile`.
- Email verification and self-service registration enabled.
- Callback `http://localhost:3000/api/v1/auth/callback`.
- Sign-out URL `http://localhost:3000`.
- Production equivalents using HTTPS when deploying.
- `AUTH_ISSUER`, `AUTH_DOMAIN`, and `AUTH_CLIENT_ID` in `.env`.

Managed login handles email confirmation, recovery and configured MFA. No development login bypass exists. UCE sessions expire no later than the verified identity token; the user signs in again rather than storing refresh tokens. Disabling a Cognito account does not revoke an already-issued UCE session immediately; incident operations must also delete that user's Session rows. Event-driven revocation is a follow-up.

The app creates a local user after the first verified callback. Complete the creator profile, create a project, then record work in the IP Vault.

## File storage setup

Use a private S3 bucket with public access blocked, versioning enabled and encryption configured. Allow browser `PUT` from the exact `APP_URL` through bucket CORS and allow the necessary signed headers. Restrict IAM to this bucket's `quarantine/` prefix, including `PutObject`, `GetObject` and `GetObjectVersion`. Configure a lifecycle policy for abandoned uploads after reviewing retained evidence requirements; do not expire referenced object versions.

The upload limit is 25 MB. Supported types: PDF, UTF-8 plain text, PNG, JPEG, MP3 and WAV. Raw source files are downloaded as attachments, not embedded into the application. Malware scanning is mandatory: unavailable scanners or invalid files cause rejection, never automatic acceptance. ClamAV may need several minutes to initialise virus definitions. Rejected files require a new upload in this release.

## Academic verification

Institution registration does not verify it. An authorised deployment operator must check the institution and representative's mandate, then record the evidence reference:

```sh
npx tsx --env-file=.env scripts/verify-institution.ts INSTITUTION_UUID OPERATOR_USER_UUID "Checked official representative mandate; case reference UCE-123"
```

This command requires database access and is not exposed to users. A verified institution administrator can confirm affiliations. Confirming an affiliation does not certify a project or establish cultural authority.

Reviews disclose selected version text only, after acceptance. They do not expose vault attachments, other versions or general project membership. Scope, compensation, disclosure authority and conflicts are recorded. Reports are final and append-only. Corrections/superseding-report UX is a follow-up; do not overwrite existing reports through SQL.

## Funding and AI

Campaigns record non-binding interest in ZAR minor units. An interest pledge cannot become a payment, investment or IP share. Checkout returns HTTP 503 until a separately reviewed payment integration is implemented. No bank information, card data or provider credentials are collected.

AI defaults to disabled. Set the provider, HTTPS endpoint, API key, model and `AI_ENABLED=true` only after approving provider processing terms and retention. `openai-compatible` expects a chat-completions endpoint that accepts `max_completion_tokens`; `anthropic` expects a Messages endpoint. The worker sends only the selected immutable version text and instruction, never attachments. A provider, endpoint or model change invalidates queued consent. User requests are capped per UTC day. Provider outputs are drafts, not verified facts.

AI has at-least-once execution: a worker crash after a provider call can cause a repeated charge. Reconciliation/provider idempotency and budget alerts are required before scaling usage.

## Tests

```sh
npm test
# Disposable PostgreSQL only: this creates synthetic fixture users and evidence.
npm run test:integration
```

The integration test exercises HTTP session guards, origin checks, cross-user denial, collaboration revocation, immutable database records, review scope, campaign publication and pledge idempotency. It does not exercise Cognito, S3, ClamAV or live AI. Do not run it against user data. Use a separate `DATABASE_URL` and apply migrations first.

## Deployment

See [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), [security](docs/SECURITY.md) and [deployment](docs/DEPLOYMENT.md). Build targets: `api`, `worker`, `web`. Run migrations as a separate release task; never apply them on every server startup. All production secrets belong in the deployment secret manager.

## Boundaries and next work

This release uses direct grants to existing public creator accounts rather than email invitations. One work belongs to one project while retaining separate identity and versions; sharing a work across projects and cross-media adaptations are later migrations. Ownership allocations remain unadjudicated documented claims rather than executable agreements. Rights conflict resolution, electronic signatures, notifications, portfolio media previews, full-text discovery, account export/deletion administration, moderator dashboards, automated credential checks, paid funding, licences and advanced AI remain follow-ups.

Before any public launch: run the pending checks, complete live provider journeys, implement the retention/deletion and dispute workflows, review privacy/legal terms, assess infrastructure costs, configure monitoring/backups and perform an independent security review. See the production gates in the security document.
