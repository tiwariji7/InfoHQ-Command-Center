# PROJECT_MAP.md — Current state

## 1. Status
- Project: InfoHQ Command Center V2
- Working folder: `InfoHQ-Command-Center-v2`
- Old project: backup/reference only; do not modify.
- Implementation status: specification pack prepared; no new implementation is authorized by this pack alone.
- Current step: Step 4 — Five-Stage Sales Pipeline & Opportunity Funnel (Implemented & verified).
- Last approved step: Step 2 & 4 (Leads Core & Sales Pipeline).

## 2. Decisions in force
- Only the Superadmin may access the app for the current MVP.
- Admin/Employee accounts and management are future scope and must not be implemented now.
- Public sign-up is not allowed; an unapproved Clerk user must receive No Access and be rejected by the API.
- Website contact form writes to the central leads inbox.
- Newsletter subscribers are stored separately.
- Lead activity history is separate from lead notes.
- Cloudflare D1 is the relational data store; Cloudflare R2 is a private file bucket, accessed only through the Worker.
- Owner performs Cloudflare dashboard setup, secret entry, remote migrations, and production deployment with guided instructions.
- Use a fresh folder; never edit the old project.

## 3. Architecture & Deployment Structure
- Root configuration: `wrangler.jsonc` at repository root controls unified Cloudflare Worker deployment (`npx wrangler deploy`).
- Worker: `infohq-command-center` (entry: `apps/api/src/index.ts`, compatibility date: `2026-10-24`, compatibility flag: `nodejs_compat`).
- Static Assets: `apps/web/dist` with `not_found_handling: "single-page-application"` and `run_worker_first: ["/api/*"]`.
- Frontend: React 18, Vite 5, TypeScript strict, TanStack Query, Zod, Tailwind, Lucide, Lenis.
- Backend: Hono on Cloudflare Workers.
- Database: Cloudflare D1 binding `DB` bound to `infohq-command-center` (ID: `65a48298-6c06-4494-af0b-71e020d68a68`), migrations directory `migrations`.
- Local Dev backend config: `apps/api/wrangler.jsonc` retained untouched for isolated backend development without conflict.
- Files: private Cloudflare R2 binding `FILES` (in `apps/api/wrangler.jsonc`).
- Auth: Clerk with server-side Superadmin allowlist enforcement on `/api/*`.
- Hosting target: `app.infohq.in`, only after owner approval.

## 4. Planned D1 tables (must be finalized before migrations)
- `users`: minimum identity/allowlist record for the one Superadmin. Do not seed a real identity without owner confirmation.
- `leads`: current client/contact/service/budget/source/status/follow-up data.
- `lead_activities`: append-only change history, separate from notes.
- `lead_notes`: user-entered call/meeting/follow-up notes.
- `newsletter_subscribers`: newsletter records, separate from leads.
- `attachments`: file metadata and R2 object key, if attachment feature is approved.
- `audit_log`: security/admin/data-change audit records. Decide whether `lead_activities` and `audit_log` have distinct responsibilities before migration; do not duplicate records without a reason.

## 5. Required external resources — not assumed to exist
- Clerk application, publishable key, secret key, and backend JWT verification configuration.
- Cloudflare D1 database and binding `DB`.
- Cloudflare R2 private bucket and binding `FILES`.
- Cloudflare Worker and SPA assets configuration.
- Website-side server function to forward contact/newsletter submissions using a shared intake secret.
- Turnstile on website forms if already present/approved.
- Secrets must be entered directly in the correct dashboard/secret store, never in chat or committed files.

## 6. Route plan (not yet implemented/approved)
- `GET /api/health`: public health check without sensitive diagnostics.
- `GET /api/me`: protected; only the allowlisted Superadmin.
- Leads: list, create manually, details, update, status change, notes, follow-up, and approved attachment operations.
- Website intake: contact and newsletter server-to-server endpoints protected by shared secret.
- No user administration routes or screens in this MVP.
- Do not build a route until its step and exact API contract are approved.

## 7. Open decisions / setup checks
- Confirm the Superadmin's Clerk account email/identity through a secure owner-provided value; never infer from old project seed data.
- Confirm whether R2 attachments are needed in the first release. The owner said R2 must be connected; bucket binding can be configured now, but attachment UI/API should be implemented only when the relevant step is approved.
- Confirm the website contact form fields and whether Budget is already present.
- Confirm rate-limit mechanism available for the selected Cloudflare plan; do not claim in-memory Worker state is a reliable rate limiter.
- Confirm exact package names/versions and current Cloudflare/Clerk configuration syntax during implementation.
- Decide whether `lead_activities` and `audit_log` overlap; keep both only with documented distinct purposes.
- Confirm allowed attachment file types and whether uploads are in MVP before implementation.
