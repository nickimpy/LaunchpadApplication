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

**Done — Phase 4 (Step 1: Student Information form):**

- Full Step 1 form replaces the placeholder for `/portal/steps/1` (branched inside `src/app/(portal)/portal/steps/[step]/page.tsx` — `stepNumber === 1` renders `<Step1Form>`; all other steps keep their placeholders). Personal / academic / program / demographic / guardian sections, mobile-first, brand tokens, reusing `src/components/forms.tsx`
- **Question content is verbatim from the 2026 application PDF** (provided by Nick), captured in PRD.md and centralized in `src/utils/step1-options.ts`: program-specific Lightspeed (6 Qs) and Foundations (3 Qs) question sets, demographic option lists, the **7** household-income brackets + "Prefer not to say", graduation years (`Before 2025`..`2028`). Program answers are stored in `applications.program_answers` (jsonb); only the active program's block is persisted
- **All six PRD conditional rules** wired client-side and re-checked server-side: Foundations hides Lightspeed Qs / Lightspeed hides Foundations Qs; **grad year 2028 (class of 2028 = current juniors) → no program selector, Lightspeed hidden, forced to Foundations; class of 2027 are rising seniors and choose between programs normally**; 2nd-guardian = Yes reveals Guardian 2; school = Other reveals free-text. (Also: gender/pronouns/race "Other" reveal their free-text columns.)
- **College-compatibility warning:** Foundations post-HS plan = "attend college NOT in Philly…" shows a non-blocking inline warning (points to contact email) and sets `applications.college_warning_flagged = true` for staff review; the student may still continue
- **Save / submit / edit:** the form uses `noValidate` + full **server-side** validation so "Save progress" persists partial answers (Step 1 → `in_progress`, never downgrades a complete step) while "Submit Step 1" enforces every required field, then calls `setStepStatus(1,'complete')` (unlocks 2–6). After completion the form shows a single "Save changes" button (intent=save) — editing keeps Step 1 `complete` and never re-locks 2–6
- **Parent link:** on first submit, `applications.parent_link_generated_at` is stamped and the copyable `/parent/{parent_link_token}` link is surfaced on screen (Copy button). **No email/SMS is sent — that's Phase 9.** The `/parent/...` route itself is Phase 5
- Writes go through the **authenticated** client (RLS already permits own rows): `students` (legal name, preferred name, phone — email stays read-only, managed in Profile to avoid duplicating the auth email-change flow), `applications`, `demographics` (upsert, funder-only), `guardians` (upsert pos 1; upsert/delete pos 2). New files: `src/utils/step1.ts` (server loader `getStep1Data`), `src/app/(portal)/portal/steps/step1-actions.ts` (`saveStep1`), `src/components/portal/step1-form.tsx`; new form primitives `SelectField`/`RadioGroup`/`CheckboxGroup`/`Textarea`/`ActionButton` + `TextField` `readOnly`; new validators in `src/utils/validation.ts`
- **Migration 0004** (`20260617000004_widen_graduation_year.sql`) drops & re-adds the `applications.graduation_year` check to `'Before 2025'..'2028'`. Validated on local Postgres 16 (stubbed auth/storage): all migrations 0000→0004 apply clean, `'2028'` accepted, old `'Before 2024'` rejected. Lint + production build pass clean
- **PRD updated:** Step 1 academic/demographic/program-question sections match the PDF; junior rule corrected to class of 2028 only; **Step 3** records the two source personal-statement prompts + video option and the decision to **decompose them into smaller scaffolded sub-questions** (not reuse the two long essays)

**Next — Phase 5 (Step 2: Parent Form + E-Signature):** the tokenized, no-login parent page at `/parent/{token}` (the token + on-screen link already exist from Phase 4). Auto-filled read-only student info; availability + conditional concerns; IEP; comments; parent contact; editable consent copy (`cycle_settings.parent_form_consent_text`); native canvas signature pad (signature_pad) storing image + typed name + timestamp + IP to the private `signatures` bucket via a server route (service role — no parent login/RLS session). Submission writes `parent_form_submissions` and flips Step 2 to `complete`. Student (and later admin) can update guardian contact + regenerate the link.

**Done — Phase 2 config:**

- `SUPABASE_SECRET_KEY` added to Vercel env vars and deployed (confirmed by user)
- **Vercel Framework Preset fixed: was "Other" (caused sitewide platform 404s), now "Next.js"** (project was imported before `package.json` existed, so detection failed). If sitewide 404s ever recur, check this first

**Deployment URL:** production is `https://launchpad-application.vercel.app` (Vercel). Use this — not a placeholder — for Supabase Site URL, redirect URLs, and any absolute links.

**Done — Supabase dashboard config (confirmed by user via screenshots):**

- Site URL = `https://launchpad-application.vercel.app`; Redirect URLs include `https://launchpad-application.vercel.app/**`
- Email templates are the Supabase DEFAULTS (no custom SMTP) — **no template edits needed** for Phase 2; the app's `/auth/callback` handles the default links. Custom branded templates + SMTP are Phase 9.

- "Confirm email" is ON (verified working: signup required email confirmation before login)

**Remaining for the user:**

- Paste migrations **0002** (grants), **0003** (step deadlines), and **0004** (widen `graduation_year` to `Before 2025`..`2028` — required before Step 1 submit will accept the new grad years) into the Supabase SQL editor
- **Phase 4 QA:** complete Step 1 as a junior (grad 2027/2028 — never sees Lightspeed, goes to Foundations) and as a senior (chooses a program); trigger the college warning; save halfway and resume; submit and confirm Steps 2–6 unlock; edit Step 1 after submitting and confirm 2–6 stay unlocked; copy the parent link shown on screen
- Run the Phase 3 phone QA (see "Phase 3 QA" above)
- Finish the deferred Phase 2 QA (magic link, password reset, duplicate-email prompt, profile edit) as the hourly email quota allows
- **Local dev only (optional):** if running `npm run dev` on a laptop, create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase → Settings → API), and `SUPABASE_SECRET_KEY`. Not needed for the deployed Vercel site

**Applied to live Supabase:** migrations 0000 (schema) and 0001 (seed) confirmed applied; Vercel env vars set and deployed. Pending user paste into the SQL editor: **0002** (grants — this project doesn't auto-grant table privileges to API roles), **0003** (placeholder step deadlines; idempotent, safe to re-run), and **0004** (widen `graduation_year`; safe to re-run — drops/re-adds the check constraint).

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
