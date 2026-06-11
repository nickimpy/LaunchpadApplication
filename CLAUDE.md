# Launchpad Application Portal

Admissions portal for Launchpad Philly (a Building 21 program). Students apply through a 7-step process; staff manage the pipeline through an admin dashboard.

## Read first

- `PRD.md` — the full product spec. Read it before building anything. The Notion version is canonical; this copy is synced June 10, 2026.
- `school-dropdown-options.json` — canonical school names (82 dropdown options + 31 Track A partner schools). Seed a `schools` table from this; match on school ID, never on name strings.
- `public/brand/launchpad-logo-main-color.svg` — logo for header and emails (also at repo root).

## Build status (update at the end of every session)

**Done — Phase 1 (Foundation):**

- Next.js 16 app scaffolded (App Router, TypeScript, Tailwind 4, `src/` dir); builds clean
- Supabase client wiring: `src/utils/supabase/{client,server,middleware}.ts` + `src/proxy.ts` session refresh; env vars in `.env.local` (gitignored, see `.env.example`)
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
- **Route gating lives in layouts/pages, NOT the proxy** (Next.js 16 guidance): `src/app/(auth)/layout.tsx` redirects logged-in users to `/profile`; `/profile/page.tsx` redirects logged-out users to `/login`. `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`, export `proxy` — the old name 404s the whole site on Vercel) ONLY refreshes the session cookie. Phase 3+: gate new portal routes in their own server layout the same way
- Email rate-limit errors (`over_email_send_rate_limit`) are surfaced with a clear message via `src/utils/auth-errors.ts` on signup, magic link, reset, and resend
- Shared form primitives in `src/components/forms.tsx`; validation in `src/utils/validation.ts`; provisioning in `src/utils/provisioning.ts`; service-role client in `src/utils/supabase/admin.ts`. WCAG: labels on every field, `aria-describedby`/`aria-invalid` errors, keyboard navigable, mobile-first, brand tokens
- `server-only` added as a dependency (guards the admin/provisioning modules)
- Lint + production build pass clean

**Phase 2 QA status (live on Vercel):**

- ✅ End-to-end confirmed: signup → verification email → click link (same browser) → verified → `/profile` loads with the student's data
- ⏳ NOT yet QA'd: magic-link login, forgot/reset password, duplicate-email reset prompt, profile editing — blocked by the built-in email sender's rate limit (~2 emails/hour project-wide; confirmed `429 email rate limit exceeded` in Auth logs). Quota refills hourly; test opportunistically. **Must be verified before Phase 9 completes / beta.** If the limit blocks work, Resend custom SMTP can be pulled forward from Phase 9 (also unlocks editable templates + cross-device links)
- Email links are SAME-BROWSER only until Phase 9 (PKCE verifier cookie) — open the email in the browser that started the flow

**Done — Phase 3 (Portal Shell & Step Engine):**

- Portal shell at `/portal` in `src/app/(portal)/`: **server-layout auth gate** (`(portal)/layout.tsx`, same pattern as `(auth)/layout.tsx`; `src/proxy.ts` still ONLY refreshes cookies), branded header (logo → `/portal`, Profile link, Log out), skip-to-content link
- Step nav (`src/components/portal/step-nav.tsx`, client component for `usePathname`/`aria-current`): desktop = left sidebar with numbered status circles, status label, deadline per step, and an "X of 7 steps complete" progress bar; mobile = horizontal thumb strip of 48px numbered circles. WCAG: status conveyed as text not color alone, `aria-current="step"`, full `aria-label` per step. Locked steps stay visible/numbered but greyed with a lock icon — they remain links to a "complete Step 1 to unlock" notice page, not dead elements. Step 7 shows "Staff only"
- Step engine: `src/utils/steps.ts` (step metadata + status labels + **dependency map: Step 1 `complete` unlocks 2–6; Step 7 visible but never student-actionable** + student status caps mirroring RLS — steps 1/3 up to `complete`, 5/6 cap at `pending_verification`) and `src/utils/step-engine.ts` (server-only: `getPortalData()`, React-`cache`d per request — student with self-heal, active-cycle application, all 7 `step_progress` rows, deadlines, contact email; plus `setStepStatus()` for the Phase 4–6 forms — start/submit/re-open-after-submit, validated in code AND enforced by RLS)
- `/portal` overview (greeting with preferred name, progress count, continue-where-you-left-off CTA) and `/portal/steps/[1–7]` placeholder pages (status badge, deadline, who-completes-it copy, locked/staff-only/parent-form explainer panels). **No real forms yet** — Phases 4–6 replace the placeholder panels
- Deadlines + contact email read from `cycle_settings` (admin-editable, never hardcoded); a missing deadline renders "No deadline set yet". Migration **0003** seeds placeholder `step_deadlines` (only if still `{}`, so re-running never clobbers admin edits)
- `/profile` moved into the `(portal)` group (URL unchanged) — inherits the shell, dropped its duplicate header/auth check
- Post-login destination is now `/portal` everywhere (`(auth)/layout.tsx`, login + reset-password actions, `/auth/callback` + `/auth/confirm` default `next`)
- Migrations 0000–0003 validated end-to-end on local Postgres 16 (stubbed auth/storage), incl. 0003 idempotent re-run; lint + production build pass clean

**Phase 3 QA (user, on phone, after pasting migration 0003):** log in → `/portal` shows the branded step strip/sidebar with all 7 numbered steps: Step 1 actionable ("Not started"), Steps 2–6 greyed with a lock + "Locked until Step 1 is complete", Step 7 "Staff only"; deadlines visible per step. Works without 0003 too, just shows "No deadline set yet".

**Next — Phase 4 (Step 1: Student Information form):** the full Step 1 form (personal/academic/demographic/guardian fields, school dropdown + Other, all six conditional rules, college-compatibility warning + review flag, mid-form save, edit-after-submit), parent link token surfaced on screen on completion (email sending is Phase 9). Replace the placeholder panel in `/portal/steps/1`; drive status via `setStepStatus` in `src/utils/step-engine.ts` (it already handles submit/re-open and unlocking 2–6).

**Done — Phase 2 config:**

- `SUPABASE_SECRET_KEY` added to Vercel env vars and deployed (confirmed by user)
- **Vercel Framework Preset fixed: was "Other" (caused sitewide platform 404s), now "Next.js"** (project was imported before `package.json` existed, so detection failed). If sitewide 404s ever recur, check this first

**Deployment URL:** production is `https://launchpad-application.vercel.app` (Vercel). Use this — not a placeholder — for Supabase Site URL, redirect URLs, and any absolute links.

**Done — Supabase dashboard config (confirmed by user via screenshots):**

- Site URL = `https://launchpad-application.vercel.app`; Redirect URLs include `https://launchpad-application.vercel.app/**`
- Email templates are the Supabase DEFAULTS (no custom SMTP) — **no template edits needed** for Phase 2; the app's `/auth/callback` handles the default links. Custom branded templates + SMTP are Phase 9.

- "Confirm email" is ON (verified working: signup required email confirmation before login)

**Remaining for the user:**

- Paste migrations **0002** (grants) and **0003** (step deadlines) into the Supabase SQL editor
- Run the Phase 3 phone QA (see "Phase 3 QA" above)
- Finish the deferred Phase 2 QA (magic link, password reset, duplicate-email prompt, profile edit) as the hourly email quota allows
- **Local dev only (optional):** if running `npm run dev` on a laptop, create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase → Settings → API), and `SUPABASE_SECRET_KEY`. Not needed for the deployed Vercel site

**Applied to live Supabase:** migrations 0000 (schema) and 0001 (seed) confirmed applied; Vercel env vars set and deployed. Pending user paste into the SQL editor: **0002** (grants — this project doesn't auto-grant table privileges to API roles) and **0003** (placeholder step deadlines; idempotent, safe to re-run).

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
