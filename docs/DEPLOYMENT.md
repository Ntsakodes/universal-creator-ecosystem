# Deployment runbook

## Initial environment

Use separate development, staging and production databases, buckets, Cognito clients and secrets. Provision primary application/data infrastructure in the approved South African region. Inventory all other processors separately.

Build images using the Dockerfile targets `api`, `worker`, and `web`. The web image's `API_INTERNAL_URL` build argument must point to the private API service. No build-time secrets are required. Next.js rewrites are generated during the build, so change this argument when changing the internal API address.

Deploy the API on port 4000, web on 3000, and worker without ingress. Keep the API private; expose only the TLS frontend gateway. Supply runtime variables through the deployment secret manager, and use runtime IAM roles for S3. The Dockerfile is a starting point, not a fully provisioned cloud environment or hardened multi-stage runtime image.

## Release sequence

1. Generate/review the initial lockfile and switch build installation to `npm ci`.
2. Run validation, tests and build in CI; resolve all failures.
3. Back up the target database and confirm object versioning and recovery.
4. Run `npm run db:deploy` as a controlled release task using migration credentials.
5. Roll out compatible API/worker/web images using runtime credentials.
6. Check liveness and perform a synthetic project/profile journey in staging before production rollout.
7. Monitor errors, job failures, storage growth, provider usage and authorisation failures.

The liveness endpoint checks the process only. Add deployment readiness checks for database availability and required configured services. Back up PostgreSQL and referenced S3 object versions. Recovery targets must be approved and demonstrated through restore tests; none has been measured here.

## Runtime database privileges

Use separate owner/migration and runtime roles. Runtime needs normal table access, worker Job updates, asset finalisation and SELECT for configured schema; it must not own tables, alter schema, disable triggers, or read unrelated databases. Grant sequence privileges if future migrations introduce sequences. Database administration remains capable of altering evidence; audit such access outside the app.

## Failure handling

- Missing/invalid identity configuration: startup fails or sign-in is unavailable; no fallback login.
- Database unavailable: requests fail; investigate connectivity and restore availability.
- Scanner unavailable/malformed upload: asset is REJECTED and job FAILED; fix service and ask for a fresh upload.
- AI unavailable/provider mismatch: run is FAILED; source is not silently rerouted.
- Worker interrupted: running work is reclaimed after five minutes, up to three attempts. Exhausted work is failed for operator review.
- Payments: remain disabled until a new reviewed integration is deployed.

Do not print provider responses, raw prompts, content, cookies, token endpoint bodies or secrets into diagnostic logs.
