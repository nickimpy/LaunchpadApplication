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

**Done — Phase 5 (Step 2: Parent Form + E-Signature) — code complete, user QA pending:**

- **No new migration needed.** Phase 1 already created `parent_form_submissions` (every PRD field incl. `consent_text_snapshot`/`signature_image_path`/`signature_typed_name`/`signed_at`/`signer_ip`) and the private `signatures` storage bucket, both RLS'd so only the service role can write them
- **Route tree `src/app/parent/`** is deliberately **ungated** — parents never have accounts, so it must NOT copy the session checks in `(auth)/layout.tsx` / `(portal)/layout.tsx` (commented in-file to stop a future "fix"). The link token IS the credential. `src/proxy.ts` needs no change: it only refreshes a session cookie and passes through when there isn't one
- `src/utils/parent-form.ts` — `loadParentForm(token)` reads **everything through `createAdminClient()`**, because `anon` has zero table grants (migration 0002) and the students/applications/cycle_settings policies are all `auth.uid()`-scoped. Returns a discriminated union `not_found | already_submitted | form`. Guards the token against a UUID regex **before** querying (a non-UUID compared to a `uuid` column is a Postgres error, not an empty result → would 500 instead of 404). `cycle_settings` is read scoped to the **application's own `cycle_id`**, not the active cycle, so an old link still renders correct copy after a cycle rolls over
- `src/app/parent/parent-actions.ts` — `submitParentForm(token, prev, formData)` (Server Action, matching the `saveStep1`/`useActionState` convention; token bound via `.bind(null, token)`). Re-resolves the application from the token server-side, re-reads the consent copy fresh for `consent_text_snapshot` (never trusts the client's echo), validates, decodes the base64 PNG and checks magic bytes + a byte floor, captures IP, uploads to `signatures/{application_id}/signature.png` (`upsert: true`), inserts the submission treating a **`23505` unique violation as success** (a concurrent second tab, not an error), then flips step 2. **`setStepStatus()` is unusable here** — it requires a session and rejects Step 2 (`studentActionable: false`) — so the `step_progress` write is done directly via the admin client with `updated_by: null`
- `regenerateParentLink()` — student-side, ordinary authenticated client (RLS covers it). Note the column default `gen_random_uuid()` only fires on INSERT, so the new token is generated in code and written explicitly
- **Accessibility:** a `<canvas>` can't be signed with a keyboard or screen reader, but `signature_image_path` is NOT NULL — so `SignaturePad` exposes `renderTypedName()`, and on submit, if the canvas is empty and a full legal name is typed, that name is rendered to the canvas as the signature image. A typed name with clear intent to sign is valid under ESIGN/UETA, so nobody is locked out. UI copy states this explicitly. Canvas is devicePixelRatio-scaled (or strokes blur/offset on retina + mobile), has a keyboard-operable Clear button, and an `aria-live` captured/not-captured status
- Step 2 portal page now shows the shareable link + "Create a new link" (hidden once complete) + status. It deliberately does **not** show the parent's answers — `parent_form_submissions` is admin-select only, and per-PRD student-facing surfaces show status, not content. Step 1's `ParentLink` was extracted to the shared `src/components/portal/parent-link-box.tsx`
- `next.config.ts` sets `experimental.serverActions.bodySizeLimit: "2mb"` (a real signature is tens of KB; this just makes the ceiling explicit)
- Lint, `tsc --noEmit`, and production build all pass clean. Verified locally: `/parent/{bad-token}` and `/parent/{unknown-uuid}` both 404 (not 500); a real token renders 200 with student name auto-filled, the canvas + ARIA wiring present, and the availability question interpolating `summer_location`/`summer_dates` from `cycle_settings` rather than hardcoded copy

**Phase 5 verified end-to-end (automated, 2026-08-17):** submitted the real form against the dev database — `parent_form_submissions` row written (consent snapshot, typed name, `signed_at`, `signer_ip`), `signature.png` uploaded to the private bucket, Step 2 flipped to `complete` with `updated_by: null`, and revisiting the link renders the receipt with zero form/canvas markup. Test data was then deleted and Step 2 reset to `not_started`.

**Phase 5 QA still owed (user):** drawing a real signature by hand (the automated test exercised the typed-name path), a phone pass for signature legibility/devicePixelRatio, and "Create a new link" invalidating the old URL.

### Three bugs found and fixed during Phase 5 QA (2026-08-17)

1. **Form wiped on validation error (Phase 4 regression, reported by Nick on Step 1).** **React 19 resets uncontrolled fields once a form action returns**, and `saveStep1` returned its validation errors *before* persisting anything — so one bad field discarded the entire form. Fixed on both forms: (a) a failed submit now **persists like a save** and only then reports errors (never stamping `parent_link_generated_at` or marking complete — `hasErrors` gates both), so nothing is lost even if the tab closes; and (b) `Step1State`/`ParentFormState` carry a `values` object echoed back on every error return, which the forms prefer over their server-loaded defaults (`const values = state.values ?? data.values`). **Any future form in this app needs the same treatment** — this is a framework behavior, not a one-off.
2. **Typed-name signature fallback silently didn't work.** `renderTypedName` set React state, but state updates are async and the browser serializes the form synchronously, so the hidden input was still empty at submit. Fixed by writing the DOM node directly via a ref *and* setting state (`setSignature`).
3. **`MIN_SIGNATURE_BYTES` was the wrong idea and the canvas could size itself to ~0px.** A mostly-white PNG compresses to a few hundred bytes, so a byte floor either rejects genuine faint signatures or accepts blank ones — it's resolution-dependent and unreliable. Replaced with a structural check only (real PNG magic bytes, `MIN_PNG_BYTES`/`MAX_SIGNATURE_BYTES` bounds); whether ink exists is decided client-side where the canvas is inspectable, and the separately-required typed legal name is the independently-validated part of the record. Canvas sizing moved from a one-shot `getBoundingClientRect()` at mount to a **`ResizeObserver`** that skips zero-width layouts, fixing blurry/blank canvases in not-yet-laid-out containers.

**Local dev gotcha:** killing/restarting `next dev` repeatedly can leave an orphaned `next-server` holding port 3000 while refusing connections — `next dev` then starts silently and never binds. Fix: `pkill -9 -f next-server`, confirm with `lsof -nP -iTCP:3000`, then restart. Also, plain-Node scripts against `@supabase/supabase-js` fail under Node 26 ESM (`ERR_INVALID_PACKAGE_CONFIG` from `storage-js`) — use `require()` in a `.cjs` file instead; the app itself is unaffected.

**Done — Phase 2 config:**

- `SUPABASE_SECRET_KEY` added to Vercel env vars and deployed (confirmed by user)
- **Vercel Framework Preset fixed: was "Other" (caused sitewide platform 404s), now "Next.js"** (project was imported before `package.json` existed, so detection failed). If sitewide 404s ever recur, check this first

**Done — Phase 6 (Steps 3, 5, 6: Essays + C2L Self-Report) — code complete, user QA pending:**

- **Step 3 (short answers):** `src/utils/step3.ts` (`getStep3Data` — active `essay_prompts` for the application's own cycle, joined with the student's `essay_responses`), `src/utils/step3-options.ts` (shared, no `server-only`: `responseField(promptId)` + `Step3State`), `step3-actions.ts` (`saveStep3`), `src/components/portal/step3-form.tsx`. **Prompt text is data, never code** — the scaffolded question set replaces the beta "Why do you want to join Launchpad?" prompt as a DB change, no deploy. Field names derive from prompt ids, so adding prompts needs no code edit. Save/Submit intent split like Step 1; submit requires every active prompt answered; **no word minimum** (the real prompts are still TBD, so any limit would be a guess). Live word count per box, via a new optional `onChange` on the `Textarea` primitive (matching `SelectField`/`RadioGroup`, which already had it).
- **Steps 5 & 6 (C2LPHL self-report):** `src/utils/c2l-options.ts` (shared `C2LState`, `isC2LStep` type guard, and all per-step copy in `C2L_COPY` so the two steps share one component), `src/utils/c2l.ts` (`getC2LUrl` — admin-editable outbound URL), `c2l-actions.ts` (`reportC2LStep`, bound per step), `src/components/portal/c2l-report-form.tsx`. Checking the box sets `pending_verification`; unchecking walks back to `in_progress`. Students can never reach `complete` here — staff verify (Phase 8).
- **Staff verification is final:** `reportC2LStep` refuses to change a step already `complete`. **RLS does NOT stop this** — `step_progress_own_update`'s `USING` clause restricts which steps a student may touch and `WITH CHECK` caps the status they may set, but neither restricts the status they may set *from*, so a `complete` → `in_progress` downgrade is permitted at the database level. This action-level guard is the only thing preventing a student from silently undoing staff verification.
- `PortalData` now carries `cycleId` (both Step 3's prompts and the C2L settings are cycle-scoped).
- **Migration 0005** (`20260817000005_c2l_settings.sql`) seeds `c2l_application_url` + `c2l_documents_url` as empty admin-editable settings. **Already applied to the dev database**, and idempotent (`on conflict do nothing`), so pasting it into the SQL editor later is a safe no-op. **Not blocking:** the pages render the outbound link button only when a URL is set, and fall back to "we'll post the link here" copy with the contact email when it's empty. Fill these in when C2LPHL publishes them.
- **Deliberately NOT built:** the PRD's video-submission option ("email a video, then write 'I sent a video'"). It's tied to the two long source prompts that are being decomposed, and it would hardcode two staff email addresses as copy, which the conventions forbid. It belongs with the scaffolded question set.

**Phase 6 verified (automated, 2026-08-17):** `tsc`, lint, and production build all clean; `/portal/steps/{3,5,6}` all resolve (307 → login when logged out, no runtime errors); the `essay_responses` upsert conflict target (`application_id,prompt_id`) confirmed against the real table — a second upsert updates in place rather than duplicating or erroring — and the test row was deleted afterwards (`essay_responses` back to 0).

**Phase 6 QA still owed (user)** — everything behind the login, since driving those forms needs a password: Step 3 save-partial → resume → submit-with-a-blank-answer (confirm the answers survive on screen and nothing is marked complete) → submit valid; Steps 5/6 check-and-submit → confirm the sidebar shows **"Pending verification", not Complete** (the phase's stated "done when") → uncheck → back to In progress.

**Done — Phase 7 (Admin Dashboard, Part 1: Access + Table + Profiles) — code complete, user QA pending:**

- **Access:** `src/app/(admin)/` route group with a server-layout auth gate (same pattern as `(auth)/` and `(portal)/`; `src/proxy.ts` still only refreshes cookies). `src/utils/admin.ts` holds `getAdminUser()` (React-cached; returns null for anyone not an ACTIVE admin), `isActiveAdmin()`, `hasStudentRecord()`, and `logAdminAction()`. Non-admins hitting `/admin` are redirected to `/login` **without** being told the dashboard exists.
- **Dual roles are supported on purpose.** Staff emails are shared with students at Launchpad (it's why the PRD rules out domain SSO), so one auth user can be both. The dashboard header links to "My application" and the portal links back. **Nick's `nick@launchpadphilly.org` account is exactly this case — he now lands on `/admin` after login, not `/portal`.**
- **Two guards stop the roles colliding:** the portal layout redirects staff-only accounts to `/admin`, and **`getPortalData()` refuses to self-heal a student record for an admin**. Without that second guard, any staff account visiting `/portal` would have silently been provisioned a students row + application + step_progress and appeared in the applicant pipeline as a fake applicant.
- **Migration 0006** bootstraps the first super admin (chicken-and-egg: `admin_users_write` requires `is_super_admin()`, so row one can't come from the app). Edit the email at the top before running. **Already applied to the dev database for `nick@launchpadphilly.org`.** Idempotent.
- **Applicant table** (`/admin/applicants`): per-step status pips, filters (search text, school, program, track, step+status pair), five sort orders, and **inline interview-track editing that saves on change** — setting it marks `track_overridden` so Phase 8's auto-assignment never silently undoes a staff decision. Filters live in the URL, so a filtered view is shareable and the CSV export reuses the same query string. **Filtering runs in memory, not SQL** (~200 applicants/cycle per the PRD, so the set fits in one round trip; revisit if a cycle grows 10x).
- **CSV export** (`/admin/applicants/export`): on-demand only, honours the current filters, UTF-8 BOM so Excel opens names correctly.
- **Applicant profile** (`/admin/applicants/[id]`): Step 1 answers, demographics (labelled funder-reporting-only), essays, the signed parent form with its consent snapshot and a link to the stored signature; editable student contact details and guardian contacts (the PRD's wrong-email recovery); parent-link copy **and regenerate** (rotates the token, so the old URL dies); document upload; staff notes; and the activity log.
- **Every staff edit is audit-logged** with before/after (`student.update`, `guardian.update`, `parent_link.regenerate`, `document.upload`/`delete`, `application.track_update`, `admin.invite`/`deactivate`), shown at the bottom of each profile. `logAdminAction` deliberately never throws — a failed audit write must not roll back the edit staff actually made.
- **Documents:** upload to the private `documents` bucket with type/size/extension checks; the storage object is cleaned up if the row insert fails. Private files are reachable only through `/admin/documents`, which mints a **60-second signed URL**. That route and the CSV route **re-check admin access themselves** — route handlers don't run inside layouts, and both responses are full of applicant PII.
- **Staff management** (`/admin/staff`, super admin only): invite (creates the auth user via service role, upserts `admin_users`, and returns a **one-time set-password link shown once on screen** — transactional email is Phase 9, so nothing is sent; from Phase 9 this same link just gets emailed), plus revoke/restore. Revoking flips `is_active`, which `is_admin()` checks, so **a revoked admin is refused by RLS at the database**, not merely hidden in the UI. You cannot revoke your own access.
- Admin reads go through the **staff member's own session**, not the service role, so RLS stays the real gatekeeper everywhere except the two places that genuinely need to bypass it (bootstrap and auth-user creation).

**Phase 7 verified (automated, 2026-08-17):** `tsc`, lint, and production build all clean; all six admin routes compile (`/admin`, `/applicants`, `/applicants/[id]`, `/applicants/export`, `/documents`, `/staff`); every profile query and the table's nested joins (`students`, `schools`, `step_progress`, `essay_responses→essay_prompts`, `admin_notes→admin_users`) validated against the real schema; `generateLink` confirmed to return a usable action link.

**Phase 7 QA still owed (user)** — all of it is behind the login: log in (you'll land on `/admin`), filter the table to one school, change a track inline, open your test applicant, confirm the essay + signed parent form render, upload a PDF transcript and re-open it, export the CSV, then add a second staff member and confirm the one-time link works.

**Known gap for local dev:** Supabase rejects `redirect_to` values that aren't in its allow-list and silently falls back to the Site URL — so a staff invite link generated on `localhost` will point at the production site. Add `http://localhost:3000/**` to Supabase → Authentication → URL Configuration → Redirect URLs to test invites locally.

**Deferred to Phase 8 (as scoped in BUILD_PLAN):** Track A/B **auto**-assignment from the partner-school list (the inline override exists and is respected), C2L verification toggles for Steps 5/6, and bulk counselor sign-off — that last one is really a bulk version of the Phase 8 verification toggle, which is why it isn't here.

**Test accounts (decided 2026-08-17, keep these roles separate):**

- **`nick@launchpadphilly.org` = ADMIN ONLY.** Its student record was deleted on 2026-08-17 so staff and applicant roles never mix again. Logging in lands on `/admin`; `/portal` redirects back to `/admin` (no student record, and `getPortalData` won't self-heal one for an admin).
- **`nicholasimparato@gmail.com` = the test student.** Sign up through `/signup` like a real applicant.
- Both roles CAN coexist on one auth user (the app supports it, since staff emails are shared with students at Launchpad) — we're just choosing not to, so QA exercises the admin-only path honestly.
- **Deleting the student side is safe; deleting the auth user is NOT.** `admin_users.id` references `auth.users(id)`, so removing the auth user cascade-deletes super admin access and locks everyone out of the dashboard. Delete the `students` row only — the application, step_progress, guardians, demographics, essays, and parent form all cascade from there.

**Deployment URL:** production is `https://launchpad-application.vercel.app` (Vercel). Use this — not a placeholder — for Supabase Site URL, redirect URLs, and any absolute links.

**Done — Supabase dashboard config (confirmed by user via screenshots):**

- Site URL = `https://launchpad-application.vercel.app`; Redirect URLs include `https://launchpad-application.vercel.app/**`
- Email templates are the Supabase DEFAULTS (no custom SMTP) — **no template edits needed** for Phase 2; the app's `/auth/callback` handles the default links. Custom branded templates + SMTP are Phase 9.

- "Confirm email" is ON (verified working: signup required email confirmation before login)

**Remaining for the user:**

- **Phase 4 QA:** complete Step 1 as a junior (grad 2027/2028 — never sees Lightspeed, goes to Foundations) and as a senior (chooses a program); trigger the college warning; save halfway and resume; submit and confirm Steps 2–6 unlock; edit Step 1 after submitting and confirm 2–6 stay unlocked; copy the parent link shown on screen
- Run the Phase 3 phone QA (see "Phase 3 QA" above)
- Finish the deferred Phase 2 QA (magic link, password reset, duplicate-email prompt, profile edit) as the hourly email quota allows

**Applied to live Supabase (confirmed 2026-08-17 after a ~2-month gap):** migrations 0000–0004 all confirmed applied — 0002 (grants) verified by successful authenticated reads/writes on `/portal/steps/1`; 0003 (step deadlines) verified directly against `cycle_settings`; 0004 (widened `graduation_year`) verified by saving Step 1 with grad year 2028. Vercel env vars set and deployed. Supabase free-tier project had auto-paused from inactivity and needed a minute to wake back up — expect this after any long gap.

**Local dev environment (set up 2026-08-17):** repo cloned locally, `gh`/`vercel` CLIs linked (`vercel link --project launchpad-application`), `.env.local` populated and `npm run dev` confirmed working end-to-end against live Supabase. **Caveat:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` are flagged **Sensitive** in Vercel, which is one-way and means `vercel env pull` can never fetch their real values (returns a placeholder, breaks local dev with "Invalid supabaseUrl"). Values were copied by hand from the Supabase dashboard instead. Fix for good: delete and re-add those three vars in Vercel as non-sensitive, then `vercel env pull` will work normally on any machine.

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
