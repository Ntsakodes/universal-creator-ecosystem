# Verification record

## Supabase testing update — 9 November 2026

- Source branch: `foundation/supabase-testing`, pull request #2.
- [Automated checks](https://github.com/Ntsakodes/universal-creator-ecosystem/actions/runs/42600956731) exercise locked dependency installation, Prisma schema validation/generation, both original migrations, domain tests, API and web typechecks, original API/database integration, Supabase adapter fixtures, prepared-schema adoption and application builds.
- Prepared-schema integration uses an isolated PostgreSQL database created from the original SQL without Prisma history. It verifies checksum rejection before writes, successful `migrate resolve`, repeat setup and subsequent `migrate deploy`.
- Hosted project `fqccfciqaakvxezfwhty` was verified as UCE Testing in a Free organisation. Applied the original two migrations to private schema `uce_test`, with checksum metadata, fixed function search paths, revoked browser-role access and RLS on all 24 tables (23 application tables plus bootstrap metadata).
- Created private `uce-test-vault` bucket, limited to 25 MB and the supported MIME types. No user-facing Storage policies were added.
- Hosted transactional checks passed for immutable versions and rejection of unscanned evidence. All dummy rows were rolled back; no application accounts were seeded.
- Security advisor: informational RLS-without-policies notices are expected because browser roles have no schema access and all application authorisation runs through the backend. Health advisor: no findings. Performance advisor reports 13 unindexed foreign keys and 9 unused indexes in this empty test schema; index tuning is deferred.
- The online install reported 4 high-severity dependency advisories. The lockfile makes this reproducible; a dependency security review remains a release gate.
- Hosted Auth/Storage HTTP requests, email delivery, real ClamAV, container image builds and browser journeys have not been exercised in this session. API Auth/Storage/scanner responses in CI are fixtures, not hosted-provider validation.
- Runtime server key/database password must be filled privately in ignored `.env.supabase-test`; Auth redirect settings must match the documented loopback URL. The frontend and API are not deployed by Supabase.
- Local command execution is still blocked by the Windows sandbox helper provisioning error. Source updates and checks were performed through GitHub. Production data, paid infrastructure, payments and live AI were not used.

## Historical authoring record — 5 November 2026

The original source was authored while package downloads, Git cloning and local Docker/PostgreSQL were unavailable. Nineteen dependency-free domain tests and syntax-only TypeScript parsing ran at that point. Later GitHub Actions runs supersede the original unverified build/migration status. Live production Cognito/S3/AI journeys and public-launch security/privacy gates remain outstanding.
