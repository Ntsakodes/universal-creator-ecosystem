# Local testing without cloud accounts

This runs the actual UCE frontend and API on your computer with an isolated PostgreSQL database, synthetic identities, local files and a local ClamAV scanner. No AWS account, cloud hosting, payment provider or AI API key is required. It is a development test environment, not a public deployment.

## Start

Prerequisites: Node.js 22.12–24 and an installed container engine supporting `docker compose`. The first run downloads development packages, PostgreSQL and ClamAV images and virus definitions. No cloud resources are provisioned.

From the extracted/cloned repository root:

```sh
npm install
npm run local:test
```

Wait for the scanner and application to start, then open:

**http://127.0.0.1:3000**

Use that exact address, rather than localhost, so the origin check matches. The first ClamAV initialisation can take several minutes. No existing `.env` file or AWS credentials are needed. The launcher writes an ignored `.env.local-test` file.

Choose **Sign in** to select Test Creator, Test Collaborator, Test Expert or Test Supporter. Choose **Create account** to create another synthetic account. Local registration does not test email verification, passwords, MFA or Cognito. Those production features remain unchanged.

A persistent banner marks the environment as LOCAL TEST ONLY. Use dummy creative material and invented personal details.

## Suggested walkthrough

1. Sign in as Test Creator. Edit My profile.
2. Create a private project in Projects.
3. Open IP Vault, choose the project, and record a dummy script or manuscript.
4. Upload a small UTF-8 `.txt` file. Local ClamAV must accept it before it becomes READY.
5. Record a new version and select the scanned file to include in its evidence manifest.
6. Download the file and export the evidence manifest.
7. Grant Test Collaborator VIEWER access. Sign out and sign in as that account. Confirm it can read the project but cannot add a work or change rights.
8. Sign back in as Test Creator. Select the work in IP Vault, then request a review from Test Expert under Academic network. Only selected version text is disclosed.
9. Switch to Test Expert, declare conflicts, accept the review, read the selected version and submit a structured report.
10. Switch back to Test Creator. Create a campaign draft and publish its public-safe project summary before opening interest.
11. Switch to Test Supporter and record non-binding interest. No money is collected and no IP share is granted.
12. Confirm AI assistant shows that no provider is configured.

Institution verification remains an explicit operator action; synthetic affiliations must not be presented as real credentials.

## Isolation and storage

- Dedicated database: `uce_local_test` at `127.0.0.1:5433`.
- Separate Compose project: `uce-local-test`. Existing development database containers are not reused.
- ClamAV: loopback port 3311.
- Test files: ignored `.local-test-data/files/`, never S3.
- Local API: `127.0.0.1:4000`; frontend: `127.0.0.1:3000`.
- Test sessions use the same opaque, hashed session mechanism and resource permission checks as production.
- The local entrypoint refuses production NODE_ENV, non-loopback databases, a database name other than uce_local_test, or a public bind address.
- It also refuses databases containing non-test identities.
- Neither production main.ts nor its application module registers the local login or filesystem controllers.
- Live AI is forced off and checkout remains disabled regardless of environment variables.
- Files are signature/size checked, scanned and hashed before being attached to immutable versions. Downloads recheck authentication, current permissions and file integrity.
- No database schema change is required.

## Stop and retain your test data

Press Ctrl+C in the launcher terminal, then:

```sh
npm run local:stop
```

Database/container volumes and local dummy files remain for the next session. Stopping does not erase them. Do not use destructive volume-cleanup commands if you want to keep the test records.

## If startup fails

- **docker not found / engine unavailable:** install or start a Compose-compatible container engine, then retry.
- **Port already in use:** stop the conflicting local app on 3000, 4000, 5433 or 3311.
- **Scanner timeout:** inspect `docker compose -p uce-local-test -f compose.local-test.yaml logs clamav`. Wait for definitions, then retry.
- **Rejected file:** confirm it is a supported dummy file; start a new upload after checking the scanner.
- **Sign-in returns to AWS:** the normal production/development API was started instead of `npm run local:test`. Stop it and use the local launcher.
- **Wrong origin:** open http://127.0.0.1:3000 exactly.
- **External database/production guard:** do not weaken it. Use the dedicated local test launcher.

## Verification

Pure tests cover loopback/database/production boundaries and the ClamAV wire protocol using a simulated scanner. A separate HTTP/database integration test covers synthetic registration, CSRF, login/logout, private files, clean/rejected uploads and disabled payments/AI. Its scanner is explicitly simulated; the actual local launcher always uses ClamAV. Real scanner/container startup and the browser walkthrough still require manual verification on the target computer.
