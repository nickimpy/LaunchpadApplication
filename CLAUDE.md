# Launchpad Application Portal

Admissions portal for Launchpad Philly (a Building 21 program). Students apply through a 7-step process; staff manage the pipeline through an admin dashboard.

## Read first

- `PRD.md` — the full product spec. Read it before building anything. The Notion version is canonical; this copy is synced June 10, 2026.
- `school-dropdown-options.json` — canonical school names (82 dropdown options + 31 Track A partner schools). Seed a `schools` table from this; match on school ID, never on name strings.
- `public/brand/launchpad-logo-main-color.svg` — logo for header and emails (also at repo root).

## Build status (update at the end of every session)

**Done — Phase 1 (Foundation):**

- Next.js 16 app scaffolded (App Router, TypeScript, Tailwind 4, `src/` dir); builds clean
- Supabase client wiring: `src/utils/supabase/{client,server,middleware}.ts` + `src/middleware.ts` session refresh; env vars in `.env.local` (gitignored, see `.env.example`)
- Complete schema in `supabase/migrations/`: 19 tables (students, applications, demographics isolated for funder-only use, guardians, schools, step_progress engine, parent_form_submissions, essay prompts/responses, interviews + interview_scores rubric, decisions with `released_at` gating, admin_users, audit_log, notification_log, documents, admin_notes, cycles, cycle_settings), RLS on every table, private `documents`/`signatures` storage buckets
- Seed migration: 82 schools (31 Track A partners), active `2026-2027` cycle, placeholder cycle settings, beta essay prompt
- Migrations validated against a local Postgres 16 with stubbed auth/storage schemas; seed is idempotent
- Decision made (PRD open item): step dependency map = Step 1 unlocks 2–6 (parallel); Step 7 admin-only

**Done — Phase 2 (Student Accounts & Login):**

- Auth pages in `src/app/(auth)/` (shared logo card layout): `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`; plus `/auth/confirm` (route handler) and `/auth/auth-error`
- Signup collects email, password, DOB, first/last name, phone, notification preference (email/sms/both, required, no opt-out). Server action validates, then provisions via service role: `students` row + `applications` row for the active cycle + 7 `step_progress` rows. Signup fields also stashed in auth user metadata
- **Email link flow (default templates):** Supabase's built-in email service does NOT allow editing template bodies without custom SMTP (Phase 9), so we use the DEFAULT templates. Their `{{ .ConfirmationURL }}` hits Supabase's `/auth/v1/verify`, which confirms the token and redirects to `?code=` (PKCE). All auth calls pass `emailRedirectTo`/`redirectTo` → `/auth/callback`, which runs `exchangeCodeForSession`, syncs `students.email` on email-change, and redirects (recovery → `/reset-password` via `?next=`). Origin is derived per-request in `src/utils/origin.ts` (no hardcoded URL). Caveat: PKCE code exchange needs the verifier cookie, so links work when opened in the SAME browser that started the flow; cross-device requires the token_hash path below.
- `/auth/confirm` (token_hash flow) is kept ready for **Phase 9**: once custom SMTP + branded templates exist, point templates at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` for cross-device links and retire the `/auth/callback` dependency.
- Login: email/password + magic-link tab (`signInWithOtp`, `shouldCreateUser:false`). Forgot/reset password flow. Unverified login bounces to `/verify-email` with a resend button
- Duplicate email at signup: checks `students` by email with the service role (Supabase obfuscates this on the public API), shows the PRD reset prompt, and sends the reset to the original address. The `data.user.identities.length===0` placeholder case is also caught
- Profile page (`/profile`, gated): view/edit first/last name, preferred name, phone, DOB, notification preference, and email (email change goes through a confirmation link); log out. Self-heals missing student rows from auth metadata on load
- Middleware now gates routes: unauthenticated → `/login` for `/profile`; authenticated → `/profile` for `/login`/`/signup`
- Shared form primitives in `src/components/forms.tsx`; validation in `src/utils/validation.ts`; provisioning in `src/utils/provisioning.ts`; service-role client in `src/utils/supabase/admin.ts`. WCAG: labels on every field, `aria-describedby`/`aria-invalid` errors, keyboard navigable, mobile-first, brand tokens
- `server-only` added as a dependency (guards the admin/provisioning modules)
- Lint + production build pass clean

**Next — Phase 3 (Portal Shell & Step Engine):** two-panel layout, numbered sidebar with all 7 steps + status indicators, greyed-out dependent steps, deadlines, progress updates. Add new portal route prefixes to `PROTECTED_PREFIXES` in `src/utils/supabase/middleware.ts`.

**Done — Phase 2 config:**

- `SUPABASE_SECRET_KEY` added to Vercel env vars and deployed (confirmed by user)

**Deployment URL:** production is `https://launchpad-application.vercel.app` (Vercel). Use this — not a placeholder — for Supabase Site URL, redirect URLs, and any absolute links.

**Done — Supabase dashboard config (confirmed by user via screenshots):**

- Site URL = `https://launchpad-application.vercel.app`; Redirect URLs include `https://launchpad-application.vercel.app/**`
- Email templates are the Supabase DEFAULTS (no custom SMTP) — **no template edits needed** for Phase 2; the app's `/auth/callback` handles the default links. Custom branded templates + SMTP are Phase 9.

**Remaining for the user:**

- Confirm **"Confirm email" is ON** (Authentication → Providers → Email) so the verification gate is enforced
- Heads-up: the built-in email service is rate-limited (~a few messages/hour) — fine for QA, replaced by Resend in Phase 9
- **Local dev only (optional):** if running `npm run dev` on a laptop, create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase → Settings → API), and `SUPABASE_SECRET_KEY`. Not needed for the deployed Vercel site

**Applied to live Supabase:** migrations 0000 (schema) and 0001 (seed) confirmed applied; Vercel env vars set and deployed. Migration 0002 (grants — this project doesn't auto-grant table privileges to API roles) pending user paste into the SQL editor.

## Stack (decided, do not revisit)

- Next.js (App Router, TypeScript) on Vercel
- Supabase: Postgres, Auth, Storage (transcripts ~200/cycle)
- Resend for transactional email; Twilio for SMS
- Native canvas e-signature (signature_pad), no third-party e-sign provider

## Non-negotiable rules from the PRD

- Mobile-first; Building 21 brand (colors/typography in PRD Brand & Design section); font sizes in multiples of 3, body 15px, 1.3 line height
- Parents never create accounts; the parent form is reached by tokenized link only
- The public student status link shows step status only, never PII, essays, or demographics
- Admissions decisions are hidden from students until an admin manually triggers the decision email
- Students can edit steps after submitting; only staff progress Steps 4, 5, 6
- Audit-log all admin edits to student info, interview/status updates, and decisions
- Demographic data is for funder reporting only and must never affect application logic
- Strive for WCAG compliance on all public-facing pages

## Conventions

- Cycle-specific copy (dates, locations, program info) lives in the database as admin-editable settings, never hardcoded
- School lists (dropdown + partner flags) are admin-editable data, seeded from school-dropdown-options.json
- Decision statuses: Offer Extended, Waitlisted, Denied, Withdrew, Acceptance Rescinded, Offer Accepted, Offer Not Accepted, Ineligible
