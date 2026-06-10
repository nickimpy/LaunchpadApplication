# Launchpad Portal -- Build Plan (Scope & Sequence)

Eleven phases, in dependency order. Each phase is roughly one to three working sessions with Claude Code. Don't start a phase until the previous one's "done when" checks pass. Beta = completing Phase 10.

**Rules for every session:**

1. Start in plan mode (Shift+Tab twice in the CLI, or ask "show me your plan first" on the web). Approve the plan before any code is written.
2. One phase per conversation. When a phase is done, start a fresh session for the next.
3. End every session with: "Commit this with a clear message, and update CLAUDE.md with what's done and what's next."
4. You personally test every "done when" item by clicking through it. You are the QA team.
5. If anything errors, paste the full error text and say "fix this." Never debug yourself.

---

## Phase 0 -- Accounts & Plumbing (no code, ~1 hour of clicking)

**What:** Create the accounts the project needs and wire them together.

- GitHub account + a new private repository named launchpad-portal (add a README so it isn't empty)
- Upload PRD.md, CLAUDE.md, BUILD_PLAN.md, school-dropdown-options.json, and the brand/ folder to the repo
- Supabase account + new project (write down the project URL, anon key, and service role key from Settings > API)
- Vercel account, "Add New Project," import the GitHub repo
- Resend account (DNS records come later, in Phase 9)
- Create the apply@launchpadphilly.org mailbox (Google Workspace admin)
- Connect the repo at claude.ai/code (or open Terminal and run claude in the project folder)

**Done when:** you can open a Claude Code session that can see PRD.md.

## Phase 1 -- Foundation: Scaffold + Database Schema

**What:** The Next.js project skeleton and the entire database design: students, guardians, schools (seeded from school-dropdown-options.json with partner flags), application steps and statuses, step submissions, interviews, decisions, admin users, audit log, cycle settings (the admin-editable copy like summer dates/location), notification log.

**Why first:** every later phase stores data in these tables. Changing a database design after five features sit on top of it is the most expensive mistake in software. Get the skeleton right while it's cheap.

**Done when:** Claude shows you the table list in Supabase, the schools table has 82 rows with 31 flagged as partners, and the empty app deploys on Vercel without errors.

**Kickoff message:** "Read PRD.md and BUILD_PLAN.md. We're doing Phase 1 only: scaffold the Next.js app and design the complete database schema in Supabase, including seeding the schools table from school-dropdown-options.json. Show me your proposed schema in plain English before you build it. Do not build any pages yet."

## Phase 2 -- Student Accounts & Login

**What:** Signup page (email, DOB, first/last name, phone), email verification gate, login with password + magic link option, duplicate-email handling with password reset, notification preference (email/SMS/both), basic profile page where students edit their info.

**Why now:** every student-facing feature requires a logged-in student. (This is where the signup page actually belongs.)

**Done when:** you create a test account end to end: sign up, get the verification email (test mode), verify, log out, log back in with a magic link, edit your profile, try signing up again with the same email and get the reset prompt.

## Phase 3 -- Portal Shell & Step Engine

**What:** The two-panel portal layout: numbered sidebar with all 7 steps, status indicators (not started / in progress / completed), greyed-out dependent steps, deadlines display, progress updates on completion. Under the hood, the "step engine": the logic that tracks each student's status per step, allows re-open/edit after submit, and restricts Steps 4-6 progression to staff. Apply the Building 21 brand (colors, Arial, 15px body, multiples of 3) and mobile-first layout here, so every later page inherits it.

**Why now:** Steps 1, 3, 5, 6 all render inside this shell. Build the frame before the rooms.

**Done when:** you log in on your phone and see the branded sidebar with all 7 steps in the right states, even though the steps themselves are empty placeholders.

## Phase 4 -- Step 1: Student Information Form

**What:** The full Step 1 form: personal, academic (school dropdown + Other), demographic, guardian 1/2, program selection with all six conditional logic rules, the college compatibility warning with flag-for-review, mid-form save, edit-after-submit. Completing it generates the parent form token/link (email sending comes in Phase 9; for now the link just appears on screen).

**Why now:** longest form, most logic, and the trigger for the parent flow. Everything downstream (parent form, reminders, admin review) consumes its data.

**Done when:** you complete Step 1 as a fake junior (never sees Lightspeed) and a fake senior (chooses programs), trigger the college warning, save halfway and resume, and see a parent link generated.

## Phase 5 -- Step 2: Parent Form + E-Signature

**What:** The tokenized no-login parent page: auto-filled read-only student info, availability question + conditional concerns box, IEP question, open comments, parent contact fields, consent text (editable copy), canvas signature pad, submission marks Step 2 complete. Student and (later) admin can update guardian contact and regenerate the link.

**Why now:** depends on Step 1's guardian data and token generation.

**Done when:** you open the parent link in a private/incognito window (no login), see your test student's name pre-filled, sign with your trackpad/finger, submit, and watch Step 2 flip to complete in the student portal.

## Phase 6 -- Steps 3, 5, 6: Essays + C2L Self-Report

**What:** Step 3 with the beta placeholder prompt ("Why do you want to join Launchpad?") built so prompts are admin-editable data, ready for the scaffolded question set later. Steps 5 and 6 as self-report checkboxes ("I applied to C2LPHL" / "I uploaded my documents") that set the step to "pending staff verification."

**Why now:** three simple forms that complete the student-facing application. After this phase, a student can do everything they can do.

**Done when:** your test student finishes Steps 3, 5, and 6, and 5/6 show "pending verification" rather than complete.

## Phase 7 -- Admin Dashboard, Part 1: Access + Table + Profiles

**What:** Admin login (invite-only email/password; you as super admin who creates/manages other admins), the applicant table (filter/sort by school, step status, track, program; inline editing; CSV export), and the individual student profile (view all submissions, upload transcript/attendance/IEP docs, copy/re-send parent link, update guardian contact, general notes).

**Why now:** with student data now flowing, staff need to see and manage it. Admin before notifications, because staff can operate the pipeline manually without emails, not vice versa.

**Done when:** you log in as admin, filter the table to one school, edit a field inline, open your test student, see their essay and signed parent form, upload a PDF transcript, and export a CSV.

## Phase 8 -- Admin Dashboard, Part 2: Interviews, Decisions, Audit

**What:** Interview logging with the full rubric (7 criteria 0-3 + per-criterion notes, pathway preference, conflicts, final rating; surfaces Step 2 status and links the essay), Track A/B auto-assignment from partner schools, C2L verification toggles for Steps 5-6, decision recording with the 8 statuses (hidden from student until release), the audit log on student edits/status changes/decisions, and the pipeline funnel dashboard.

**Why now:** these are the staff actions that move students through Steps 4-7, and they need Part 1's profile pages to live in.

**Done when:** you log an interview against your test student and Step 4 completes, verify their C2L steps, record "Offer Extended" and confirm the student portal does NOT show it, and see all of it in the audit log.

## Phase 9 -- Emails & SMS

**What:** Resend integration with DNS/domain verification (SPF/DKIM for launchpadphilly.org), all templates from the PRD notification table, the trigger logic (instant parent email, 2-5 day student reminders, 7-day parent reminder, step confirmations with click-to-verify), the manual decision email trigger (which also reveals the decision in the portal), Twilio SMS with the reply-Y opt-in, and the notification log so staff can see what was sent.

**Why later, not earlier:** emails are side effects of events you've already built. Testing them requires the whole pipeline to exist. Building them earlier means re-testing them after every phase.

**Done when:** a fresh test signup receives a real verification email, completing Step 1 sends you (as the parent) the real parent link, the reminder fires for an incomplete step (Claude can simulate the clock), and triggering the decision email reveals the decision in the portal.

## Phase 10 -- Public Link + Beta Hardening

**What:** The public status page (never-expiring URL, step status only, zero PII, "Decision pending" until release). Then the hardening pass: accessibility (WCAG) review, mobile walkthrough of every page, security review session ("review the app for ways a student could see another student's data or an outsider could reach admin pages"), wipe test data, create the real admin accounts, set up the real domain (e.g., apply.launchpadphilly.org).

**Done when:** the public link shows status and nothing else on your phone, the security review passes, and a friend who has never seen the app can complete a full application unassisted. **This is the beta.**

## Post-Beta Fast-Follows (in rough priority order)

1. Native interview scheduling (slot batches, capacity >1, reschedule/cancel, blast email, no-show state) -- there's runway since interviews happen later in the cycle
2. Full essay scaffolding once the question set is final
3. C2LPHL "applications open" blast
4. Cycle archive export to Google Drive
5. Data warehouse integration handoff to the Launchpad dev team
6. Deadline locking, if ever wanted

---

**Open product details to decide along the way** (Claude Code will ask, or decide and tell you): step dependency map confirmation, decision email per-student vs. bulk, edit-after-submit status behavior, guardian-edit resend behavior, Twilio A2P 10DLC registration status.
