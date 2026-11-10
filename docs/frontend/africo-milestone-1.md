# Africo frontend foundation — milestone 1

Date: 10 November 2026. Scope: foundation baseline and shared design system only.

## Baseline and design sources

- Repository: Ntsakodes/universal-creator-ecosystem.
- Clean starting branch: `main`, commit `9f528f4f08af51b16e21105cf7a8d7a068258a9f`.
- Integration branch: `frontend/africo-milestone-1`.
- Other remote branches at inspection: `foundation/local-testing`, `foundation/supabase-testing`.
- Existing stack retained: Next.js/React frontend, NestJS API, Prisma/PostgreSQL. Existing `/api/v1` rewrite retained.
- Approved plan recovered from chat `6af2daa5-7da0-83ea-965f-97c015c58f62`.
- The referenced `/mnt/data` directory does not exist on this Windows host. The supplied export was found at `C:/Users/iMac/Downloads/design-agent-prompt.md`; all 11 screenshots were found in `C:/Users/iMac/Pictures/design-screenshots.zip` and unpacked outside the repository.
- Export document ID: `204793f2-0b4a-4b86-961e-d2a554930e77`, generated `2026-11-10T10:31:17.429Z`.
- The landing, creator identity, project workspace and IP Vault screenshots informed the shared ivory/charcoal/bronze palette, white bordered surfaces, editorial headings and sidebar foundation. Screen-specific layouts and sample records were not implemented.

## Exact file inventory

| File | Change |
| --- | --- |
| `apps/web/lib/design/tokens.css` | Raw light/dark colors, typography scale, spacing, radii and shadows from the export; semantic accessibility corrections for controls, focus and status foregrounds. |
| `apps/web/app/globals.css` | Import tokens and apply shared typography, surfaces, controls, focus, shell, mobile navigation and reduced-motion styles while retaining existing feature selectors. |
| `apps/web/app/layout.tsx` | Load Inter, Playfair Display and JetBrains Mono through Next font optimization with swap behavior and fallback fonts. |
| `apps/web/components/layout/AppShell.tsx` | Shared responsive workspace frame; all seven existing destinations, selected-state announcement, compact mobile menu, skip link, content focus after navigation, and account actions available on mobile. |
| `apps/web/components/layout/PageHeader.tsx` | Shared heading and optional action slot. |
| `apps/web/components/ui/Button.tsx` | Native button props, explicit variants, safe default type and existing disabled/submit semantics. |
| `apps/web/components/ui/Card.tsx` | Reusable panel with a programmatically associated heading. |
| `apps/web/components/ui/FormField.tsx` | Extract existing field behavior, preserving names, defaults, required flags, select options and numeric precision. |
| `apps/web/components/ui/StatusBadge.tsx` | Neutral and semantic visual tones; caller supplies the factual label. |
| `apps/web/components/ui/States.tsx` | Empty, loading and error building blocks with status/error announcements. |
| `apps/web/app/workspace/workspace.tsx` | Use shared shell, heading, panels, fields, submit button, loading and error states. Preserve business logic, requests, payloads, callbacks, permissions and all feature sections. Normalize line endings. |
| `apps/web/test/foundation.test.tsx` | Four rendering regression tests covering submission semantics, fields, labels/announcements and every shell destination. |
| `apps/web/package.json` | Frontend test command and explicit tsx development dependency, already used by the API. |
| `package.json` | Include frontend regression tests in the existing root test command and CI path. |
| `package-lock.json` | First reviewed dependency lockfile, required by the existing CI guidance; generated with npm 12.0.2 on Node 24.22.2. No runtime dependency was added. Resolved Next version: 16.4.6, within the existing declared range. |
| `apps/web/tsconfig.json` | Next-generated development type include. |
| `apps/web/next-env.d.ts` | Next-generated route/root parameter type references. |
| `docs/frontend/africo-milestone-1.md` | Baseline, exact change inventory, validation and remaining gates. |

## Original validation snapshot

The outstanding browser and local integration checks were subsequently completed. See [the milestone 1 review](africo-milestone-1-review.md) for current fixes, evidence and remaining service limits.

### Initial results

- Existing domain/AI/policy tests: 19 passed.
- New frontend component rendering tests: 4 passed.
- Root typecheck: passed for both API and frontend after generating the Prisma client.
- Root production build: passed, including Prisma client generation, API compilation and Next static output for `/`, `/_not-found` and `/workspace`.
- Initial typecheck exposed the missing generated Prisma client after installation scripts were blocked by npm. Explicit `npm run db:generate` resolved that setup issue; no schema or database was changed.
- An intermediate build caught a duplicate local Field declaration during extraction; it was removed and the checks rerun successfully.
- No root, API or frontend lint script is configured. No lint pass is claimed.
- `npm run test:integration` could not start because `.env` is absent. No disposable database is configured; Docker and psql are unavailable. No credentials were copied from unrelated installations and no live database was contacted.
- Local production HTTP smoke checks: `/` returned 200 and `/workspace` returned 200. Browser preview initialization timed out twice. Visual layout, interactive keyboard/mobile behavior and authenticated end-to-end workflows remain unverified in a browser.
- Font fetching succeeded during the build. Cold builds need access to the Google font source; generated assets are self-hosted by Next at runtime.
- Dark tokens are preserved behind explicit `data-theme="dark"`; no automatic mode or theme switcher was introduced. Complete dark-theme validation remains outstanding.
- The added rendering tests verify semantic markup; they do not replace browser interaction, contrast auditing or authenticated API integration tests.

## Scope boundary and review gate

No API contracts, database schema/migrations, backend files, authentication, permission logic, private storage behavior, security rules or service configuration were changed. The landing page source and all workspace business operations remain intact. Existing academic, community funding and AI functionality is retained.

The landing, creator profile, project workspace and IP Vault redesign milestones have not begun. Review this foundation and complete the outstanding environment/browser verification before authorizing later milestones. No deployment or merge is part of this delivery.
