# Supabase for testing only

This optional entrypoint uses a dedicated Supabase test project for PostgreSQL, Auth and private Storage. It does not change the production Cognito/S3 entrypoints, create an AWS account, collect payments or enable live AI. The frontend and NestJS API still run on your computer; Supabase does not deploy them.

Use dummy creative files and test identities. Do not connect an existing production project or import real IP, indigenous knowledge or personal records.

## 1. Create a dedicated Free project

Create a NEW Supabase project named UCE Testing in a Free organisation. Do not upgrade, enable paid add-ons or use an existing production database for this test. The app does not have billing permissions or an automated project-creation step.

Hosted Free projects have storage/database/egress limits and can pause when inactive. Keep files small. Supabase is not guaranteed to stay free for a production workload.

## 2. Keep configuration on your computer

Install Node.js 22.12–24. Download/check out this branch and run:

```sh
npm install
```

Copy `.env.supabase-test.example` to `.env.supabase-test`. In PowerShell:

```powershell
Copy-Item .env.supabase-test.example .env.supabase-test
```

Fill the file locally with:

- The dedicated project's reference and HTTPS project URL.
- The publishable key and separate SERVER-ONLY secret key from project API Keys settings. Legacy anon/service_role keys may be used in those corresponding fields.
- The database session-pooler connection from the project's Connect dialog, using port 5432. Keep `schema=uce_test&sslmode=require`; URL-encode special characters in the database password.
- `UCE_SUPABASE_TEST_ONLY=true` to acknowledge use of the dedicated test project.

Do not paste the secret key or database password into ChatGPT, GitHub, issues, screenshots or frontend code. The ignored test file is not read by the normal production entrypoint. Neither key needs a NEXT_PUBLIC prefix in this integration.

Direct `db.PROJECT_REF.supabase.co` database connections on port 5432 are also supported, but may require IPv6 on your network. Do not use transaction-pooler port 6543 for migrations. The selected database connection and project URL must match the same project reference.

## 3. Prepare only the test schema and private bucket

```sh
npm run supabase:test:prepare
```

This creates/migrates schema `uce_test`, revokes direct anon/authenticated access to its tables, enables row-level security, and creates private bucket `uce-test-vault` with a 25 MB file limit.

It does not migrate Supabase's auth/storage schemas or any public tables. Do not add uce_test to the project's exposed Data API schemas, and do not add public/user policies to the test bucket. UCE authorises access on its backend. Secret keys bypass RLS and remain server-only.

Existing buckets must already be private with a file limit of at most 25 MB. The app refuses unsafe bucket settings instead of changing a public bucket behind your back. Use a fresh project if unsure.

## 4. Configure test authentication

Enable email/password authentication. Set Site URL to:

`http://127.0.0.1:3000`

Allow this confirmation redirect:

`http://127.0.0.1:3000/api/v1/auth/supabase-test/confirmed`

The default Supabase sender only sends to authorised project-team addresses and is heavily rate-limited. For a small no-email test, create confirmed dummy users through Supabase's Auth dashboard, then sign in with their test email/password in UCE. Do not buy an email service just for this test.

Registration honours Supabase's confirmation settings. After confirming, return to the UCE sign-in form. Confirmation does not automatically grant an application session. No fake-account bypass or automatic production-user creation is added.

UCE verifies the identity with Supabase Auth, maps its subject to an internal UCE user, and issues the existing hashed opaque session. UCE does not persist or return Supabase access/refresh tokens in its own API responses. Application sessions expire within one hour or the verified access-token expiry, whichever is sooner.

## 5. Start and view UCE

```sh
npm run supabase:test
```

Open **http://127.0.0.1:3000**. Use this exact address so the request origin matches.

The launcher waits for the testing API before starting the frontend. It never loads a normal .env file, and does not pass the database password or server key to the frontend process. The banner identifies SUPABASE TEST ONLY. Press Ctrl+C to stop the local processes.

Without a local scanner you can already test registration/sign-in, profiles, projects, text versions, contributors, expert profiles/reviews and non-binding campaign interest. Payments and live AI always return unavailable in this mode regardless of AI settings elsewhere.

## 6. Optional file-upload testing

File approval still requires malware scanning. If you already have a Compose-compatible container engine, start just the existing ClamAV service:

```sh
docker compose up -d clamav
```

Wait for its definitions to initialise. It uses loopback port 3310 by default. No local PostgreSQL container is needed when using Supabase.

1. Create a project and a dummy work.
2. Upload a small UTF-8 text file in IP Vault.
3. The upload goes into the private test bucket's quarantine prefix, using a signed upload URL with overwrite disabled.
4. On completion, the API validates bytes/size/type and sends them to local ClamAV.
5. Accepted bytes are copied to a UNIQUE approved path containing the asset ID and SHA-256 hash, then recorded as READY.
6. Select the READY file when recording a new immutable work version.
7. Downloads require current project permission and receive a 60-second signed URL.

Supabase does not provide S3 object versioning. This adapter stores the immutable approved path in the existing objectVersion field as a provider-specific evidence pointer. Production S3 still uses real S3 version IDs. Do not configure the production S3 worker against this test bucket.

A scanner failure never approves a file. Start a fresh dummy upload after fixing scanner readiness. Quarantine and unused objects remain private and count toward storage; delete them manually only after checking they are unreferenced. Never overwrite or delete approved files linked to a version.

## Scope and limits

- Testing is loopback-only, rejects production NODE_ENV and uses a fixed private schema/bucket.
- It cannot technically detect your Supabase billing plan; choose Free yourself and do not connect a paid or production project.
- Supabase handles password authentication; UCE still owns project permissions, review scope, rights records, scanning and evidence manifests.
- Public creator visibility is an explicit UCE setting, not permission to read a private vault.
- An already-issued download link may work until its 60-second expiry after revocation.
- The backend database connection is privileged. Keep it private; schema isolation/RLS do not replace backend authorisation.
- This test-only schema is not a reviewed production migration, backup strategy or POPIA compliance determination.
- No production database migration, paid infrastructure or live provider account was performed while preparing this branch.

## Tests

`npm test` covers provider configuration boundaries and immutable storage paths. `npm run test:supabase-integration` uses a disposable local PostgreSQL database named uce_supabase_test with schema uce_test, simulated Supabase Auth/Storage and a simulated scanner. It covers session handling, pending confirmation, CSRF, cross-user denial, approved/rejected files, version attachment, private-schema controls, disabled payments/AI and the real Storage SDK's signed-upload options.

CI runs these fixtures without Supabase credentials. They do not prove connectivity to your hosted project, email delivery, bucket CORS, real ClamAV or the browser walkthrough. Those remain manual acceptance steps once you configure your dedicated project.

## Official references

- https://supabase.com/pricing
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/prisma
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
- https://supabase.com/docs/guides/storage/s3/compatibility
