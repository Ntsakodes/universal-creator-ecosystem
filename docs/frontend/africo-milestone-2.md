# Africo landing page — milestone 2

Date: 10 November 2026. Integration branch: `frontend/africo-milestone-1`. Starting commit: `4333a5873fd031946c13e21738c064d6e6e8e064`.

## Delivered scope

Implemented the public landing page at `/` using the approved Africo export and `Landing Page.png`. The layout follows the reference's white brand/navigation bar, editorial hero on ivory, three bordered feature cards, split content section, and dark closing call to action. It reuses the milestone 1 font families, color/spacing/radius tokens and button/card styling.

The page remains server-rendered. No client-side landing-page state, runtime dependencies, new API endpoints, database changes or authentication changes were introduced.

### Deliberate design and trust adaptations

- Headline: “Own your narrative. Document your work.” This supports the approved evidence language without promising legal protection or ownership verification.
- Three factual cards describe the IP Vault, Academic Network and Creative Workspace. The disabled-by-default AI service is not promoted as an active feature.
- The secondary hero action opens the existing workspace. No non-functional film player or marketplace action was introduced.
- A locally authored creative-process illustration replaces the reference's bottle photograph. It contains generic process copy, not invented account records, verification scores or claims about deployed services.
- The footer includes the IP-evidence limitation and native, keyboard-accessible pilot privacy/use disclosures. The user explicitly approved pilot disclosures while formal policy URLs are pending. These are labelled as incomplete policies and are not presented as reviewed legal terms.
- The normal sign-in and registration links remain plain anchors to `/api/v1/auth/login` and `/api/v1/auth/register`. Workspace links remain `/workspace`.

## Exact file changes

| File | Change |
| --- | --- |
| `apps/web/app/page.tsx` | Render the new landing component on the existing public route. |
| `apps/web/components/landing/LandingPage.tsx` | Server-rendered header, hero, feature cards, creative-process section, closing CTA and approved pilot footer disclosures. |
| `apps/web/components/landing/LandingPage.module.css` | Scoped responsive landing styles, token-based surfaces and accessible button contrast, including dark/hover states. |
| `apps/web/components/ui/ButtonLink.tsx` | Reusable native anchor styled with the shared button system; preserves ordinary authentication navigation. |
| `apps/web/test/foundation.test.tsx` | Add an anchor-destination regression test covering sign-in, registration and workspace links. |
| `apps/web/test/landing-check.mjs` | New local browser checks for layout, semantics, destinations, keyboard behavior, disclosures, themes, fonts and existing PKCE auth-start redirects. |
| `apps/web/test/browser-check.mjs` | Wait for fonts and finite CSS transitions before accessibility measurements, preventing intermediate theme colors from producing flaky regression results. No workspace production code changed. |
| `apps/web/package.json` | Add the `test:landing` command using the existing browser-test dependencies. |
| `package.json` | Expose `npm run test:landing` at the repository root. |
| `docs/frontend/africo-milestone-2.md` | This scope, file inventory and verification report. |
| `docs/frontend/africo-milestone-2-checks.json` | Sanitized landing and workspace browser results. No session tokens or credentials. |

## Checks

| Check | Result |
| --- | --- |
| `npm test` | 24 passed: 19 domain/policy/AI tests plus 5 frontend rendering tests. |
| `npm run typecheck` | API and frontend passed. |
| `npm run build` | Prisma client generation, API compilation and Next production build passed. |
| `npm run build --workspace @uce/web` | Passed again after the final landing contrast correction. |
| `npm run test:integration` | Existing API workflow passed against disposable local PostgreSQL. Covers permissions, immutable evidence, scoped expert review, revocation and non-binding funding behavior. |
| `npm run test:landing` | Passed. Nine axe scans: light at 320/390/768/1024/1440 px, expanded disclosures, dark at 390/1440 px and reduced motion. Zero detected violations, horizontal overflow or uncaught page errors. |
| Landing destinations | All expected anchor destinations verified; three registration links and two sign-in links preserved. Existing login/register endpoints return 302 redirects with S256 PKCE to the configured provider paths. The workspace action reaches the signed-out workspace state. |
| `npm run test:browser` | Existing workspace regression passed: 49 recorded checks, including 39 accessibility scans with zero violations, real profile/project/work submissions, mobile menu/keyboard behavior and session expiry. |
| Visual review | Desktop and mobile browser captures inspected against the supplied landing reference. Captures are generated in ignored `test-results/landing/`. |
| `git diff --check` | Passed. |
| Lint | No lint script is configured; no lint pass claimed. |

The initial concurrent browser attempts timed out on the local preview services. Restarting the API and frontend as direct local processes restored responsive operation; subsequent suites passed. A dark closing-button contrast issue was found and corrected before delivery. A separate workspace scan caught a brief theme-transition color; the harness now waits for finite transitions to settle before evaluating contrast.

## Preservation and remaining limits

The API, authentication logic, Prisma schema/migrations, domain/security packages, Next API proxy, root layout, shared global stylesheet, lockfile and workspace feature implementation are unchanged from the approved milestone 1 baseline. All landing styles are scoped to its CSS module. No dependency was added or upgraded.

Browser/API tests used synthetic data in the isolated local `uce_m1_review` PostgreSQL 18.6 database. No hosted or production database was contacted. External identity-provider login/signup completion, private storage and malware scanning remain unverified local-service limitations from milestone 1; the local auth-start contracts were verified. Formal privacy/terms documents remain a public-release requirement; pilot disclosures are included as approved.

The in-app visual helper intermittently timed out during this turn. Visual QA and captures were completed using the existing installed-Chrome Playwright runner. Automated accessibility checks are not a complete WCAG conformance audit.

## Review gate

Milestone 2 is ready for review on the same integration branch. No merge, deployment, creator-profile redesign or subsequent milestone was started.
