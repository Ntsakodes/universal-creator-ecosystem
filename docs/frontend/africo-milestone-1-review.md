# Milestone 1 review and verification

Reviewed 10 November 2026, against approved chat `6af2daa5-7da0-83ea-965f-97c015c58f62`, the supplied design export and creator-facing screenshots. Starting review commit: `37e26836b761beb96866b98d136658ea8eb86f30`. Branch: `frontend/africo-milestone-1`.

## Outcome

The shared foundation meets the reviewed milestone 1 scope after the fixes below. The outstanding local browser and API integration checks now pass. The four screen redesigns remain deferred; no milestone 2 work, merge or deployment was performed.

## Plan and screenshot review

| Approved requirement | Review result |
| --- | --- |
| Keep Next.js and the existing backend | Preserved. No changes to API source, contracts, database schema, migrations, security logic or the API proxy. |
| Establish reusable foundations | Shared buttons, fields, panels, heading, statuses, states and responsive shell exist; the existing workspace uses the principal shared components. |
| Follow Africo visual foundations | 84 exported light/dark color, spacing and radius values match the supplied JSON exactly. Ivory background, white bordered surfaces, charcoal text and restrained bronze navigation match the reference direction. |
| Use approved fonts | Browser review found fallback fonts; fixed. Computed body font is Inter and headings use Playfair Display. JetBrains Mono remains defined for technical identifiers. |
| Preserve functionality | All seven workspace destinations remain available. Real profile, project and work submissions succeeded against the existing API. Academic, community funding and AI panels render and remain navigable. |
| Accessible responsive navigation | Checked at widths 320, 390, 768, 1024 and 1440. Mobile menu, selected state, skip link, keyboard navigation and content focus passed. Short desktop sidebar retains account access. |
| Trust corrections | No screenshot sample identities, invented scores, ownership guarantees, blockchain claims or payment features were introduced. Existing IP disclaimer and disabled paid/AI behavior remain intact. |
| Keep later screen work separate | Landing page source, profile screen, project workspace feature markup and IP Vault feature markup were not redesigned in this review. Existing layouts and ornamental banner remain until their approved screen milestone. |

This is a foundation comparison, not a claim of pixel-for-pixel reproduction of the four full screens.

## Fixes made

1. **Font scope:** Next font variables were attached to `body`, while semantic font aliases were defined on `:root`; the browser consequently rendered Georgia/Arial. Moving the font variable classes to `html` makes the approved fonts resolve correctly.
2. **Navigation contrast:** Decorative navigation numbers inherited 60% opacity and measured approximately 2.58:1. Remove the opacity reduction and use the exported label-size token. Repeat scans show no contrast violations in checked states.
3. **Mobile project context:** The badge and selector compressed the selected project text. Give context labels a full row at mobile widths and allow selects to flex. At 390 px, the checked selector measured 258.125 px wide.
4. **Short viewport access:** Allow the desktop sidebar to scroll, preserving access to the account actions in a 500 px tall viewport.
5. **Regression coverage:** Add an explicit `npm run test:browser` command with Playwright 1.65.0 and axe 4.14.0 as development dependencies. The suite checks live app behavior and rejects non-loopback or non-test/review databases. It uses synthetic session records through the normal authentication guard and removes its session afterward; it introduces no authentication bypass.

## Exact files changed during this review

- `apps/web/app/layout.tsx` — font variable scope.
- `apps/web/app/globals.css` — number contrast, sidebar scrolling and context selector sizing.
- `apps/web/test/browser-check.mjs` — repeatable live browser regression checks.
- `apps/web/package.json` — browser command and development-only test tools.
- `package.json` — root browser command.
- `package-lock.json` — four added development packages; no runtime dependency upgrade.
- `docs/frontend/africo-milestone-1.md` — identify the original verification snapshot and point to this review.
- `docs/frontend/africo-milestone-1-review.md` — this review report.
- `docs/frontend/africo-milestone-1-browser-results.json` — sanitized browser results, including all scanned states.

## Verification evidence

- `npm test`: **23 passed** (19 domain/policy/AI plus 4 frontend rendering tests).
- `npm run typecheck`: **passed** for API and frontend.
- `npm run build`: **passed** for Prisma client generation, API compilation and Next production output.
- `npm run test:integration`: **passed**, one end-to-end API workflow with assertions for unauthenticated access, foreign-origin denial, viewer restrictions, immutable versions/reports, scoped expert material, revoked membership, campaign interest and disabled payments/AI.
- `npm run test:browser` using installed Chrome: **passed**, 49 recorded checks including **39 axe scans with zero violations**, zero horizontal overflow in scanned states and zero uncaught page errors. Also verifies real profile/project/work submissions, signed-out state, expired-session handling, keyboard skip/menu behavior, dark project/vault/profile states and short viewport account access.
- Two existing database migrations applied successfully to a **new disposable local PostgreSQL 18.6 database**. No existing or hosted database was used.
- `git diff --check`: passed. Protected source comparison against `main` (API, Prisma, domain packages, Next proxy and landing page source): unchanged.
- No lint script is configured; no lint pass is claimed.

The desktop/browser helper still failed to initialize (`orchestrator_helper_incomplete`). Browser checks were completed through the automated installed-browser runner instead. Windows briefly locked the Prisma DLL while local services were running; stopping the review services released the file and the build passed.

## Repeating browser checks

Use a migrated disposable loopback PostgreSQL database whose name contains `test` or `review`. Set `NODE_ENV=test`, `DATABASE_URL`, `APP_URL=http://localhost:3000` and the existing required API configuration in the ignored root `.env`. Run the real API on port 4000 and the built frontend on port 3000. No paid services or real documents are required.

With dependencies installed, install a test browser with `npx playwright install chromium`, then run `npm run test:browser`. On a machine with Chrome installed, set `BROWSER_CHANNEL=chrome` instead. The command writes screenshots and JSON to ignored `test-results/browser/`. It adds synthetic fixture records to the disposable database; it does not clear arbitrary database data.

On Windows, stop the running API/test processes before `npm run build` so Prisma can replace its generated DLL.

## Remaining limits

These are service/release checks, not blockers for the verified local foundation:

- Real external identity-provider login/logout was not exercised; the test used ordinary database-backed session records and verified expiry.
- Private object storage, signed downloads and malware scanning were not exercised because S3/private-storage and ClamAV services are not configured locally.
- This run used local PostgreSQL rather than the planned hosted Supabase environment, and PostgreSQL 18.6 rather than CI's 17 image. Hosted service and CI-environment parity remain separate checks.
- Browser coverage is Chrome/Chromium. Safari, Firefox, assistive-technology testing and a complete WCAG audit were not performed; zero automated violations is not a conformance certification.
- No theme switcher was added. The preserved dark tokens were enabled only by the test to inspect representative existing panels.

Milestone 2 remains unstarted.
