# CHANGELOG.md

Append-only project history. Do not rewrite earlier entries.

## 2026-10-24 | Specification pack | owner decisions incorporated
- Added: explicit single-Superadmin-only MVP requirement.
- Added: fresh-folder-only rule; old project remains untouched.
- Added: Cloudflare D1, private R2, Clerk setup is owner-guided and step-by-step.
- Added: separate leads, lead activity history, lead notes, and newsletter subscriber concepts.
- Added: centralized website contact intake, manual leads, source tags, five-stage pipeline, quick actions, and follow-up requirements.
- Added: deployment/remote-migration/secret safety gates.
- Note: this is a documentation pack. No Cloudflare resources, secrets, migrations, or application code have been created or changed.

## 2026-10-24 | Step 1 — Foundation and single Superadmin auth
- Added: npm workspaces monorepo structure (`packages/shared`, `apps/api`, `apps/web`).
- Added: `@infohq/shared` with Zod validation schemas for auth, health check, and standardized API error structures.
- Added: Cloudflare Worker backend (`apps/api`) using Hono with `DB` and `FILES` bindings in `wrangler.jsonc`.
- Added: Clerk JWT verification and server-side Superadmin allowlist middleware in `apps/api/src/middleware/auth.ts`.
- Added: Public health check route `GET /api/health` and protected identity route `GET /api/me`.
- Added: Initial D1 SQL migration `migrations/0001_init.sql` for `users` allowlist table, validated locally.
- Added: React frontend shell with Vite, TypeScript, Tailwind CSS, Lucide icons, and Lenis following `docs/univerrule.md`.
- Added: Clerk `<SignIn />` integration and dedicated `AccessRestrictedScreen` for unapproved accounts.
- Added: Automated unit test suite with 6 passing tests for health and auth flows.

## 2026-10-24 | Step 2 — Leads core and data model
- Added: D1 SQL migration `migrations/0002_leads_core.sql` creating `leads`, `lead_activities` (append-only timeline), and `lead_notes` with constraints and indexes.
- Added: Shared Zod schemas in `@infohq/shared` for `Lead`, `CreateLeadSchema`, `LeadActivity`, `LeadNote`, and `LeadListQuerySchema`.
- Added: Service layer `apps/api/src/services/leadService.ts` implementing parameterized queries, pagination, duplicate detection, and atomic D1 batch writes.
- Added: Leads router `apps/api/src/routes/leads.ts` with `GET /api/leads`, `POST /api/leads`, `GET /api/leads/check-duplicate`, and `GET /api/leads/:id`.
- Added: Automated test suite in `apps/api/test/leads.test.ts` covering validation, atomic batch writes, duplicate detection (409), and pagination.
- Added: React frontend `LeadsInbox` component with stage filter pills, search bar, desktop table, responsive mobile card view, and pagination.
- Added: `AddLeadModal` supporting quick 30-second manual entry with live duplicate warning.
- Applied: Migration `0002_leads_core.sql` tested and confirmed in local D1 dev database.

## 2026-10-24 | Cloudflare deploy fix — Root wrangler configuration
- Added: Root `wrangler.jsonc` specifying Worker name `infohq-command-center`, entry `apps/api/src/index.ts`, assets directory `apps/web/dist`, and D1 binding `DB` (`infohq-command-center`).
- Added: `assets.run_worker_first: ["/api/*"]` routing pattern ensuring API calls route to the Worker and static assets serve the SPA with single-page fallback.
- Upgraded: `wrangler` devDependency to `4.152.0` in root `package.json` for deployment CLI compatibility.
- Retained: `apps/api/wrangler.jsonc` untouched for isolated backend development.
- Verified: `npm run build` and `npx wrangler deploy --dry-run` successfully executed locally with 0 errors.



