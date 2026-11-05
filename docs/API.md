# API reference

Prefix: `/api/v1`. Browser mutations require `Origin` exactly matching APP_URL. Protected routes require the `uce_session` cookie. Zod validation rejects additional body fields. Errors expose safe messages, not database internals. Development Swagger lists routes; this document supplies workflow/body examples.

| Area | Methods and routes |
| --- | --- |
| Identity | GET auth/register, auth/login, auth/callback; POST auth/logout; GET me |
| Creators | GET disciplines, creators; PUT me/profile |
| Projects | GET/POST projects; GET projects/:id; PATCH projects/:id/visibility |
| Membership | POST projects/:id/members; DELETE projects/:id/members/:userId |
| Vault | POST projects/:id/works; GET works/:id; POST works/:id/versions, contributors, rights; GET works/:id/export |
| Assets | POST works/:id/assets; POST assets/:id/complete, assets/:id/download |
| Academic | PUT me/expert; GET experts, institutions; POST institutions, affiliations; GET affiliations/pending; POST affiliations/:id/confirm |
| Reviews | GET/POST review-requests; GET review-requests/:id/material; POST review-requests/:id/accept, close, report |
| Funding | GET funding, funding/mine; POST funding/projects/:id/campaign; PATCH funding/:id/status; POST funding/:id/pledges, checkout; POST funding/milestones/:id/complete |
| AI | GET ai/status, ai/runs; POST ai/runs |

## Creator and project examples

```json
{"displayName":"Your professional name","biography":"About your work","disciplines":["Film and television"],"skills":["Screenwriting"],"languages":["English"],"region":"South Africa","links":[],"visibility":"PRIVATE"}
```

```json
{"title":"Project title","summary":"Public-safe description","discipline":"Film and television"}
```

Membership: `{"userId":"PUBLIC_CREATOR_UUID","role":"EDITOR"}`. Grants take effect immediately; they are not invitations. VIEWER can read, EDITOR can add work/versions/contributors, only the project administrator manages membership, disclosure, rights claims, campaigns and AI.

## IP examples

```json
{"title":"Original screenplay","category":"Script","claimedAuthor":"Author name","content":"Original text","sensitive":false,"culturalNotes":"Consent and permitted-use context"}
```

Version: `{"content":"Revised text","note":"Revision summary","assetIds":[]}`. Every included asset must be READY and from the same work. Versions cannot be overwritten.

Upload: `{"filename":"script.pdf","mimeType":"application/pdf","size":12345}`. PUT the raw file to uploadUrl with matching Content-Type, then POST complete. Refresh work detail for status. A READY asset can be attached to a new immutable version or used as agreement evidence.

Rights: `{"party":"Named party","rightType":"Adaptation","territory":"South Africa","use":"Film adaptation","startsAt":"2026-11-05T00:00:00.000Z","shareBasisPoints":2500,"agreementAssetId":"READY_ASSET_UUID","note":"Supplied agreement details and limits"}`. `endsAt` is optional. These records are unadjudicated claims; there is no automatic agreement execution or resolution of overlapping rights allocations.

## Academic examples

Review request: `{"versionId":"VERSION_UUID","reviewerId":"EXPERT_USER_UUID","question":"What should be examined?","scope":"Selected claims/passages","consentNote":"All relevant contributors authorise disclosure of this version text.","compensation":"Agreed review and attribution terms"}`.

Accept: `{"conflictDeclaration":"Explicit conflict declaration or none"}`. Only ACCEPTED assigned reviewers can fetch material. Material includes the selected version text, not its attachments. Requesters may revoke before completion. Final reports are immutable and tied to the selected version.

Report: `{"outcome":"INCONCLUSIVE","methodology":"Methods applied","limitations":"Limits of scope and evidence","recommendations":"Recommended changes","sources":[{"title":"Source title","reference":"Citation or URL"}]}`.

## Funding and AI examples

Campaign: `{"title":"Campaign title","description":"Purpose","targetMinor":100000,"milestones":[{"title":"Draft","description":"Complete draft"}]}`. Status is DRAFT, OPEN_INTEREST or CLOSED. Opening requires a public project summary. Making a project private closes open interest.

Pledge: `{"amountMinor":5000,"kind":"SUPPORTER","acknowledgeNoPayment":true,"acknowledgeNoRights":true}`. Repeating updates the same account's interest, not a financial transaction. No money or rights transfer occurs.

AI: `{"versionId":"VERSION_UUID","instruction":"Suggest a clearer structure","consentNote":"I hold the necessary authority to share this selected text.","consentToProvider":true}`. Only project administrators can disclose source text. AI status returns provider host and model; results remain drafts. Worker jobs process requests asynchronously.

## Current limits

Collection reads are bounded (30–100 records depending on route). Cursor pagination, full-text expert search, notifications and granular institutional administration are subsequent extensions. Routes reject invalid IDs and unsupported states. No general-purpose arbitrary status-update endpoint exists for evidence or reviews.
