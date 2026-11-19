# Outreach Hub: spin-up plan

**Draft, Thu 2026-11-19 (Philly time). For Jay and Nick.** Nothing here is agreed or built. Everything marked DECISION needs Jay, Nick, or both. Research behind every line is in `launchpad/drafts/outreach-hub-research/` (files 01 to 06). No contact details, credentials, or student data are in this plan or may be put in the repo.

## 1. What the hub is

A staff-only area of the existing portal (Next.js 16, Supabase, Vercel) that replaces the Partner Database sheet and its Apps Script. It holds partners, contacts, outreach history, visits and info sessions, the slot calendar, shift sign-up, message templates and sends, reminders and the morning digest. It reuses the app's staff login, audit log, settings pattern, email and text sending, and daily cron. It does not hold student applications (those stay in the applicant side), finance, Mastery (Nick's), or the Communication App (Building 21's).

## 2. Principles

- **The sheet stays the source of truth for each module until that module has parity.** One-way import, then a cutover per module. Never two live sources.
- **Draft, don't act.** Anything that sends email or text to a person outside Launchpad needs a human click, a passed test, and a typed confirmation, exactly like the current merge. No auto-send of school-facing mail. Reminders to schools stay in test mode until Jay turns them on.
- **Dates are real dates.** Weekday is derived, never stored. No UI paste path to a date column. This removes the scramble class of bug (11/9, 11/16, 11/17, 11/19).
- **PII is restricted.** Contacts, staff ZIPs and travel modes, and any student data are role-gated, never in the repo, never in logs, never in test fixtures.
- **Follow Nick's rules in `CLAUDE.md`:** plan mode first, one phase per session, migrations pasted into the Supabase SQL editor before deploy, server-layout auth gates (proxy only refreshes cookies), `"use server"` files export only async functions, constants in `*-options.ts` modules, `SelectField` for dropdowns, staff error text through `dbErrorMessage()`, mobile-first, WCAG AA, `tsc --noEmit` is not proof for pages behind a login (test with real sessions).
- **Business rules from the current script are ported with their tests first** (section 9). The script's wording lint (no dollar amounts, em dashes, "college credit", hourly rates, "Eastern Time", ET) becomes a shared function.

## 3. Before anyone branches (Phase 0 checklist)

- [ ] Nick agrees the hub lives in his repo, and says who reviews and merges.
- [ ] Decide the outreach role: separate `outreach_users` (recommended) vs reuse `admin_users`. Reason: every admin today can read all applicant PII; outreach staff (Dannyelle, Iman, Lauren) need partners and shifts, not students.
- [ ] Confirm a staging Supabase project or a branch database exists. Migrations 0016 onward must not run against live until reviewed.
- [ ] Decide the Gmail path (7.1) and the calendar free/busy path (7.2): both need Google Workspace admin action.
- [ ] Rotate and remove the two Drive docs that contain shared logins and a signature-service credential (flagged in research 01 and 02). The hub never imports them.
- [ ] Add `.gitignore` entries: `records/`, `*.csv`, `import-input/`. All import input stays out of git.
- [ ] Approved-facts record (section 8): Jay and Nick fill in the conflicting facts (apply link, internship pay, certification names, schedule wording) so templates stop disagreeing.

## 4. Architecture

Routes (new route group `(hub)`, URL prefix `/hub`, own server layout that calls `getOutreachUser()` and bounces everyone else exactly like `(admin)`):

```
/hub                         today board (digest view), follow-ups due, holds waiting
/hub/partners                list, filters (network, status, tier, pipeline, stage, follow-up)
/hub/partners/[id]           profile: contacts, timeline (contact log), agreement, season stats, obligations
/hub/slots                   week grid and list, status colors, filters
/hub/shifts                  shift board: needs someone / mine / everything; claim and release
/hub/free                    Who's Free (availability by shift)
/hub/activities/[id]         visit or session: details, run-of-show, staff, follow-up, feedback
/hub/templates               template library, test gate status
/hub/send                    segment, preview, test, queue (phase 6)
/hub/inbox                   replies and bounces triage (phase 6)
/hub/reports                 weekly numbers, funnel by school, per-touch-type reach
/hub/settings                outreach settings, approved facts, season dates, DRY_RUN
/hub/staff                   staff profiles (own profile editable by each person)
/api/cron/hub-daily          daily job (Vercel Cron, CRON_SECRET)
/api/cron/hub-weekly         Monday summary
/api/hub/bridge/*            token-guarded endpoints for the Apps Script bridge (phase 3)
```

**Code layout** mirrors Nick's: `src/app/(hub)/hub/...`, `src/components/hub/*`, `src/utils/hub/*` (server loaders, rules, lint, ranking), `src/utils/hub/*-options.ts` for shared constants, tests in `src/utils/hub/__tests__` run with plain node (port the existing node tests first).

**Auth:** `outreach_users(id uuid pk references auth.users, role text check in ('lead','staff','viewer'), is_active, created_at)`, SQL helpers `is_outreach()` and `is_outreach_lead()` (security definer, same pattern as `is_admin()`), `getOutreachUser()` cached per request. Dual roles allowed (a person can be admin, outreach, and student); the layouts link across like the admin layout does. Audit writes reuse `audit_log`; a migration widens its insert policy to `is_admin()` or `is_outreach()`.

**Time:** all dates `date`, all instants `timestamptz`, display in America/New_York with explicit-option formatters (never `dateStyle` with `timeZoneName`: it throws).

## 5. Data model (migrations 0016 onward; names are proposals)

Types: text enums as Postgres enums where the value set is stable, lookup tables where staff edit it.

### 0016 foundation

- `outreach_users`, helpers, audit policy widening, `outreach_settings(key text pk, value jsonb, updated_at, updated_by)` (RLS: outreach staff read, leads write).
- `approved_facts(key, value, source_note, approved_by, approved_on, valid_until)`: apply link, internship pay wording, certification names, schedule wording, deadlines. Templates reference keys, not text.

### 0017 partners

- `networks` (SDP, Mastery, Charter, Catholic / Private, Community org, Workforce nonprofit, College / university, Employer / job board, Other).
- `orgs(id, name, network_id, school_id nullable fk schools, org_type, status, pipeline, tier_override, notes, snooze_until, owner uuid, is_active, created_at)`. Status vocabulary is DECISION 3: the reconstructed lifecycle is Prospect, Outreach 1, Outreach 2, Outreach 3, Meeting scheduled, First meeting done, Second meeting done, Verbal yes, Reviewing agreement, Signed, Active partner, On hold (reason), Not responsive, Declined, Not a good fit. Map the sheet's current four (partners, potential partner, not a good fit, no contact) and the 2022 glossary onto it. Never hard delete: `is_active` plus `archived_at`.
- `org_roles` and `org_contacts(id, org_id, role enum, name, greeting, title, email, phone, is_champion, position, verify_flag, source, confidence enum('public website','internal','inferred from email format','not found'), last_verified_on, do_not_contact, is_active)`. Replaces the five contact slots and the packed "More Contacts" text. RLS: outreach staff only. Contact fields never in logs or exports without a lead's action.
- `org_school_facts(org_id pk, dismissal_time_12th time, early_release enum('yes','no','unsure','not asked'), roster_owner_contact_id, enrollment_10th, enrollment_11th, enrollment_12th, school_type, district_prerequisite_met boolean, back_to_school_night date)`.
- `contact_log(id, org_id, contact_id nullable, occurred_at, channel enum('email','call','text','in person','linkedin','form','other'), direction, owner uuid, summary, next_step_text, next_step_due date, template_key, gmail_thread_id)`. Replaces the 49 cell comments, Next Step prose, and Last Contacted. `orgs.last_contacted_at` becomes a view (max over email sends and logged touches), forward-only as today.
- `agreements(id, org_id, status enum('verbal yes','reviewing','signed','terminated'), template_variant, signed_on, signatory_roles jsonb, annual_review_due date, annual_review_outcome enum('continue','plan','hold'), data_sharing_in_place boolean, release_form_status, termination_notice_on, pdf_drive_id)`. Seed from the 7 confirmed signed PDFs only; everything else starts at its sheet value flagged "unconfirmed". No end date: model "annual review due", not "expires".
- `org_obligations(id, org_id, cycle_id, kind enum(...), due_on, sent_on, notes)`: application process feedback form 12/1, mini-report 1/6, monthly newsletter, quarterly progress report, first year reflections 6/1, partner-side items (liaison named, 4 access dates, documents by 11/1).
- `partner_year_stats(org_id, cycle_id, tabling_status, tabling_headcount, info_sessions_count, info_headcount, applied, cohort_1..4, completed, responsive smallint check 0..2, access smallint check 0..2)`. `partner_score` and tier are computed in SQL views from thresholds in `outreach_settings` (Reach 2 pts at 40, Applied 2 at 5, Enrolled 2 at 5, Responsive and Access typed; Anchor at least 8, Growing at least 5, Developing 1 to 4, Not started).
- **Applicant PII never enters these tables:** only counts (applied, enrolled) per org per cycle, entered by staff or computed from the applicant side by school id.

### 0018 slots and shifts

- `slot_windows(code pk, label, start_time, end_time, sort)`: 1a to 4b exactly as in the rebuilt sheet.
- `calendar_days(day date pk, kind enum('school day','no school','holiday','closed','liftoff only','reserved'), note)`: closures, holidays, the 12/15 to 1/15 LiftOff-only block, Launchpad closed 12/23 to 1/1. Settings, not code constants.
- `slots(id, slot_date date not null, window_code fk, status enum('open','offered','hold','booked','blocked','no school','completed'), org_id nullable, activity_id nullable, event_title, slot_type enum('tabling','info session','liftoff'), notes, relief_wanted text, created_at, updated_at, unique(slot_date, window_code))`. Weekday is `to_char(slot_date,'Dy')` in views. A trigger rejects a slot on a no school or closed day unless status is no school. No stored Day column, no nightly sort, no backup tabs: ordering is a query; point-in-time history is an append-only `slots_history` trigger table plus Supabase backups.
- `slot_assignments(slot_id, staff_user_id, position smallint check in (1,2), unique(slot_id, position), unique(slot_id, staff_user_id))`. Claim is one transaction (`select ... for update`), release deletes the row. The "Open shift" magic string disappears: an unfilled position is simply absent.
- `staff_profiles(user_id pk, display_name, label, shifts_per_week enum, usual_times text[], travel_modes text[], zip text, scheduling_mode enum('schedule me from my calendar','ask me first'), loop_in_channels text[], interests text[], notes, notice_days_rule jsonb, is_excluded_from_free boolean)`. ZIP and travel mode readable only by the person and leads.
- `availability_blocks(user_id, kind enum('recurring','out'), weekday smallint nullable, start_time, end_time, start_on, end_on, source enum('calendar bridge','self'))`. Bridge-filled busy time is stored as minutes per slot window, not event titles (privacy rule from today's Who's Free: never show or store personal event titles).
- Views: `v_slots_needing_staff`, `v_could_cover` (computed, replaces column K), `v_free_for_shift` (replaces Who's Free), `v_open_windows_for_org` (replaces the merge's windows logic: open, no org, availability yes, at least 7 days ahead, pool end dates from settings, Tue and Thu first, two per org on different dates, not offered to another org in the last 21 days, reserved block rules).

### 0019 activities (visits, sessions, events)

- `activities(id, org_id nullable, kind enum('info session full','info session fast pitch','tabling','fair','lunch application session','back to school night','office hours','interview visit','webinar','alumni event','other'), title, status enum('hold','confirmed','completed','cancelled'), start_at, end_at, location_kind enum('at school','at launchpad','virtual','event or fair'), address_text, audience_grades text, audience_under_18_only boolean, seniors_present boolean, room_size int, minutes_available int, setup_notes, early_release enum(...), form_shared_by, liftoff_in_session boolean, deck_version, student_story_used, presenter_mode enum('solo','paired'), headcount int, headcount_confirmed_by_host boolean, interest_forms int, follow_up_sent_on date, answers_source enum('email thread','partners notes','phone call','in person','guess'), still_needed text[] computed, google_event_id, notes)`.
- `activity_slots(activity_id, slot_id)`: one activity can use more than one window.
- `activity_staff(activity_id, user_id, role enum('lead','support','travel with'))`.
- `activity_contacts(activity_id, contact_id)` replaces the Contact line parsed out of calendar descriptions.
- `run_of_show_templates` and `run_of_show_segments(activity_id, order, label, owner_user, room, minutes)` for the Mastery-style sessions and the 20 to 25 minute session.
- `allowable_activity_checks(activity_id, checked_by, checked_on, ok boolean, note)`: AmeriCorps rule (research 01): verify alignment, ensure allowable, ask supervisor if unsure. Blocking gate for events flagged community.
- Feedback and attendance: `activity_feedback(activity_id, note, rating smallint 1..3)`; registrations separate from attendance (`activity_people` with `registered`, `attended` nullable: unmarked means unknown, not absent).

### 0020 templates, messages, replies

- `templates(key pk, name, audience enum, channel enum('email','sms'), subject, body, attachments text[] (Drive file ids), flags text[] ('ignore-next-step','skip-replied','pool:liftoff','plain'), notes, version, content_hash, last_reviewed_on)`, `signature(id, html, text)`.
- `template_tests(template_key, content_hash, tested_by, tested_at, approved boolean)`: the 14-day test gate, keyed by content hash exactly as today.
- `people_lists` (RESTRICTED, separate schema or RLS to leads only): `people(id, kind enum('student','parent','alum'), first_name, email, phone, grade_band, source enum('interest form','waitlist','alumni','text campaign'), consent_status, opted_out_at, bounced_at, do_not_contact)`. Students and parents are not org contacts. DECISION 6 on whether v1 includes this at all.
- `message_batches(id, kind, template_key, created_by, created_at, status)`, `messages(id, batch_id, org_id nullable, contact_id nullable, person_id nullable, channel, to_hash, status enum('queued','test','drafted','sent','failed','cancelled','skipped'), skip_reason, error, provider_id, thread_id, windows_offered jsonb, sent_at, bounce enum('address not found','blocked','mailbox full','bounced'), content_hash)`, `replies(id, message_id, received_at, kind enum('reply','auto-reply'), handled boolean)`. Foreign keys, not row numbers.
- `send_queue` is a state of `messages` plus a job runner (7.4), not a sheet.

### 0021 reporting, jobs, logs

- `job_runs(id, job, started_at, finished_at, status, detail)` and `event_log(type, key, detail, created_at, unique(type, key) where dedupe)`: replaces the Log tab scan and the runner guard (one scheduler).
- `weekly_numbers` as a view over messages, slots, activities (definitions in research 04, section 3.6), plus a saved history table for manual snapshots.
- `funnel_counts(org_id, cycle_id, info_headcount, applied, interviewed, accepted, enrolled)` seeded from the old sheet totals (2022 to 2025: 2,952 reached, 462 applied, 250 enrolled; 2025 columns look unfinished and must be reviewed before import).

### RLS pattern for every hub table

Enable row level security; select for `is_outreach()`; write for `is_outreach()` or `is_outreach_lead()` per table; contacts and people restricted to leads or explicit grants; no anon grants (follow migration 0002); sensitive writes also guarded by BEFORE-UPDATE triggers where a student or non-outreach login could ever reach the table (they cannot reach it at all: no policy exists for them).

## 6. Phases

Each ends with "done when"; one session per phase; start in plan mode.

### Phase 0: decisions and plumbing (about 1 hour of clicking plus one conversation)

Checklist in section 3. **Done when:** Nick says yes, a branch exists, a staging database exists, outreach role and Gmail path are decided, the approved-facts questions are on Nick's list.

### Phase 1: foundation (0016)

Outreach role, layout gate, nav, settings, approved facts, audit widening, bootstrap migration for Jay and Nick as leads (same pattern as migration 0006; edit emails before running). Empty `/hub` page with the digest skeleton.

**Done when:** Jay and Nick land on `/hub`; a student session and a non-outreach admin session get redirected and cannot read any hub table (test with real JWTs via `auth.admin.generateLink` + `verifyOtp`, as Nick did for decisions); audit rows write.

### Phase 2: partners and contact log (0017)

Importer, partner list and profile, contact log, agreements (seeded from the 7 signed PDFs), school facts, obligations calendar, season stats, computed score and tier. Import (one-time script in `scripts/import/`, input from exports placed in the git-ignored `records/`): 2026-27 Partners, LiftOff Hub, and the old School Partners Database tabs. Dry run prints counts and a diff of what it would create; Jay reviews before the live run. Contact confidence and source columns come from the old Contact Lookup tab. Unparseable More Contacts, Verify, and Next Step text is imported into a `legacy_text` column and flagged for review, never guessed.

**Done when:** the hub shows 80 orgs and the same totals as the sheet's totals row (34 partners, 42 potential, 13 champions, 93 enrolled across cohorts, 380 students reached); the partner score and tier match the sheet's for every row; a Jay-approved spot check of 10 partners.

### Phase 3: slots, shifts, Who's Free (0018)

`calendar_days` and `slot_windows` seeded; slots imported from the live sheet (verified clean on 11/19: 424 grid rows plus history); read-only board first, then claim and release, then Who's Free. Availability bridge: until a direct Google Calendar integration is approved, the existing Apps Script (runs as the shared outreach account) pushes free/busy minutes per person per slot window to `/api/hub/bridge/availability` with a bearer token every 15 minutes (minutes only, never titles). Retire the push when a service account with domain-wide delegation exists. Shift sign-up form answers import into `staff_profiles`; the form itself is replaced by each person's `/hub/staff` profile page.

**Done when:** every slot's date, weekday, window, and status match the sheet; claim and release work with two people racing on the last position (one wins, one gets a clear message); Who's Free matches the Apps Script output for the next 42 days on a sample of 10 shifts; the sheet's Slot Inventory is set read-only and its nightly sort and Slot Backup jobs are switched off by Jay.

### Phase 4: activities and run of show (0019)

Visits and sessions as records, linked to slots and orgs; the intake questions from Session Intake as form fields with the same "still need to ask" computation; run-of-show templates; allowable-activity gate; headcount, attendance, feedback; per-school and per-touch-type reach report. Calendar: HOLD and confirmed events are created in the Outreach Google Calendar only by a human clicking "Add to calendar" (draft shown first). Event description keeps the existing fields (Contact, Greeting, Address, Staff, Notes) so the current reminders keep working until phase 7.

**Done when:** Jay can create a confirmed visit from a slot, see it on the Outreach calendar, and the morning-of email (still the Apps Script until phase 7) reads it correctly.

### Phase 5: templates and the lint (0020, part 1)

Template library import (28 templates, signature, attachments as Drive file ids), versioning, content hash, test gate, shared lint (dollar amounts, em dash, "college credit", hourly rate, EST/EDT/ET, "Eastern Time", subject prefix `Launchpad:` or `LiftOff:` case-insensitive: fixes known bug 6, banned phrases for voice), placeholder blockers. Templates read approved facts by key.

**Done when:** every imported template renders against 5 sample orgs with no unfilled token; the lint fails every banned phrase in the ported tests; the 14-day test gate blocks a changed template.

### Phase 6: sending, replies, bounces (0020, part 2)

DECISION-heavy: see 7.1 and 7.3. Segmenting, preview, test send to self, typed SEND confirmation, queue with 8 AM to 8 PM Philly send hours, batches of 40 about 10 minutes apart, first failure stops the batch, daily cap, dedupe by (contact, template) within 7 days, skip rules ported from the merge (status, verify flag, next-step wait words, already contacted, replied in last 30 days when flagged, no windows, over 30 CC). Gmail path per 7.1. Reply and bounce sync by sender address in chunks of 40 (not by subject), classification patterns ported with tests. Inbox triage page.

**Done when:** a test batch of 3 to Jay and Nick only sends from the shared outreach address with correct To, CC, BCC, Reply-To; a deliberate bounce and a reply both appear in the hub within 15 minutes; a re-run does not resend; Jay approves a 40-row live batch.

### Phase 7: jobs and cutover (0021)

Port, in this order, each with DRY_RUN on first: morning digest (all 10 sections, ghost definitions from research 04), team alerts, morning-of heads-up, weekly summary and Roam post, Sunday confirmation drafts, school reminders (DRY_RUN stays on until Jay says), snooze cycle, Jotform counts, weekly numbers history. Then the parity review (section 9), switch off each Apps Script trigger as its replacement goes live, archive the script, and set the Partner Database to read-only.

**Done when:** one week of the hub digest and the script digest match line for line (differences explained), then one week hub only; every row of the parity table is Done, Retired, or consciously Deferred.

### Phase 8: hardening and handoff

Accessibility pass, mobile pass of every page, security review ("can a student or non-outreach admin reach any hub data; can an outsider reach `/api/hub/*`"), real data wipe of test rows, runbook (`HUB.md`), backup and restore drill, training for Dannyelle, Iman, and Lauren on the shift pages.

## 7. Integrations (each needs a decision)

### 7.1 Email (school-facing, from the shared outreach address)

Today: Gmail drafts and queue sends from the shared outreach account through Apps Script. Options:

- **A (recommended eventually):** Gmail API with OAuth by the shared outreach account. The app stores a refresh token server-side (encrypted, in a secrets store, never in the repo or logs), creates drafts and sends from that mailbox, labels Outreach/Merge, reads replies and bounces by sender address. Needs Workspace admin to approve the OAuth app and scopes; the token is a strong credential, so rotate it and restrict who can see it.
- **B:** keep the Apps Script as the mailer. The hub writes approved messages to a queue table; the script (runs as outreach) polls `/api/hub/bridge/outbox`, sends, and posts results back. Lower risk, keeps clasp, slower to retire.
- **C:** SMTP from Nick's existing Workspace SMTP setup for send only (his app sends from a portal user). Cannot read replies or create drafts, so it does not replace the merge.

**Recommendation: B in phase 6 to ship safely, then A.** Nick's notification code already proves SMTP, but replies and bounces need mailbox access.

Rules that carry over: From and Reply-To are the shared outreach address; Jay and Nick BCC; school contacts CC (max 30); display name; HTML body in Arial size 4 with the real signature; plain-text fallback when flagged; no dollar amounts, em dashes, college credit, hourly rates, ET wording; student and parent mail never copied into org tables.

### 7.2 Calendar

Reads: free/busy for each signed-up person, the Outreach calendar, the shared PTO calendar for all-day "Name OOO" events. Writes: human-triggered creation of HOLD and confirmed events on the Outreach calendar only; the private travel calendar is never touched. Options: service account with domain-wide delegation (needs Workspace admin; free/busy only scope), per-user OAuth (each person grants once), or the Apps Script bridge in phase 3. **Recommendation: bridge now, delegation later.**

### 7.3 Texts (Twilio)

Nick's app already sends texts through Twilio with quiet hours (9 AM to 8 PM Philly), number normalization, per-recipient and global caps, and a notification log. The Communication App (Building 21's, Twilio credentials in its script) is NOT touched. DECISION: v1 hub does not send student texts. If it ever does, it uses the app's own Twilio sender and opt-out handling, not the Communication App. Tom (Building 21) must be asked before anything reads or replaces that sheet.

### 7.4 Jobs

Vercel Cron is once-a-day per path on the current plan. The queue needs a 10-minute cadence: either upgrade the plan, use a queue table drained by a cron every minute (plan-dependent), or run sends from a Supabase scheduled function. DECISION for Nick. Until decided, sends run in manual batches from a button with the same pacing rules.

### 7.5 Roam, Jotform, Short.io

Roam `chat.post` (Bearer key and group id in env, fallback to email to Jay) for alerts and the weekly post. Jotform submissions API for LiftOff application counts only (never store applicant data in the hub). Short.io: tracked links stay created by hand; the hub stores approved link keys in approved facts.

## 8. Approved facts (stop the conflicting numbers)

One record per fact, dated, with who approved it. Templates and the lint read it. Initial list with the current conflicts from the Drive:

| Fact | Conflict found | Owner |
|---|---|---|
| Apply link per program | deck and flyer `/apply`, LiftOff rack card `/careers` | Jay and Nick |
| Internship pay | $15 an hour, $1,500+ for six weeks, $20 an hour for 120 hours | Nick |
| Foundations, 101, LiftOff pay wording | "more than $1,200", "more than $3,000", "up to $1,000 a month"; 2026 manual says up to $1,320, $4,500, $12,000 | Nick |
| Certification names | PCEP or PCEP-30; PMI certification or CAPM | Nick |
| Schedule wording | "four afternoons", "1 to 4", "Mon, Wed, Thurs, Fri 1:30 to 4:30" | Nick |
| Deadlines | LiftOff Nov 1 to Jan 15; general enrollment Feb 15, 2027; waitlist close Jan 15 vs Jan 31 (old letter) | Jay |
| Foundations start date, laptop policy, "recent graduate" | placeholders | Nick |
| Referral threshold per school | 8 students or 5% vs 4 good-fit students | Jay |
| Required workshop before applying | in 2025 language, absent in 2026 | Jay |
| Lightspeed offered? | in 2025 language, retired in the application | Nick |
| LiftOff coding prerequisite | rack card "expected", notes "not required" | Nick |

## 9. Parity table: everything the Apps Script does (research 04), where it goes

| Script feature | Hub phase | Notes |
|---|---|---|
| `dailyRun` 7 AM and its 5 sub-jobs (Jotform counts, Type column, snoozes, Could cover, digest, morning-of, team alerts) | 7 (Type column and Could cover vanish: field and view) | weekend rules kept (morning-of has none today: fix) |
| `weeklySummary` Monday 8 AM | 7 | Roam post kept |
| `schoolReminders` noon, weekdays | 7 | stays DRY_RUN until Jay approves; message rules ported |
| `movePastSlotsToBottom`, Slot Backup, `Guard.js` runner guard | Retired in 3 | replaced by ordering queries, history table, one scheduler |
| `onShiftSignup`, Staff tab, dropdown sync | 3 | profile pages replace the form |
| Shift board (claim, release, 56 days, types, needs-2, noCore) | 3 | capacity 2 enforced in SQL |
| Who's Free (frames, free, part, busy, unknown, notice rule, OOO) | 3 | bridge for free/busy |
| Mail merge (segment, preview, test, drafts, queue, lint, windows, CC and BCC rules, hash gate, caps) | 5 and 6 | tests ported first |
| Reply and bounce sync | 6 | fix known duplicate-function bug by design |
| Ghosts, Last Contacted sync from Sent mail | 6 and 7 | computed views |
| WeeklyNumbers | 7 | view plus snapshot table |
| SundayConfirm | 7 | drafts only, checklist to Jay |
| LiftOff Hub builder (department letters A to K) | 2 | one-time import, then rows |
| Jotform counts | 7 | counts only |
| Health check, menu items, runner note | Retired or replaced by `/hub/settings` health page | |
| Communication App | Not replaced | bridge only if Tom agrees |

**Fix in the live script now, independent of the hub** (needs Jay's yes and a clasp push):

1. `MailMerge.js` defines `syncRepliesAndBounces` twice (lines 1075 and 1119); the winning copy references an undefined variable, so reply and bounce sync likely fails and explains reply counts of 0.
2. `Staffing.js` treats Slot Inventory column C as AM or PM (lines 166, 197, 493) but the 11/17 rebuild made it a time label, so Could cover and board order are wrong.
3. Three reads stop at row 200 (`Automations.js` 757 and 835, `WeeklyNumbers.js` 229) against 424 rows.
4. Also: `morningOf` has no weekend guard, the subject-prefix lint is case sensitive (`LiftOff:` vs `Liftoff:`), and the README says drafts-only while the menu sends for real.

## 10. Decisions (recommendation first)

| # | Decision | Recommendation |
|---|---|---|
| 1 | Hub in Nick's repo or a separate app sharing login | Nick's repo, own route group, own role |
| 2 | Outreach role separate from admin | Yes |
| 3 | Partner status list (section 5, 0017) | Adopt the 15-value lifecycle, map old values |
| 4 | Gmail path | B then A (7.1) |
| 5 | Calendar path | Bridge now, delegation later |
| 6 | Student and parent lists in v1 | No: counts only; revisit after phase 7 |
| 7 | Replace the Twilio Communication App | No |
| 8 | Job runner | Nick decides plan or queue approach (7.4) |
| 9 | 101 Internship Outreach list and the LiftOff employer pipeline | Employer orgs in `orgs` (type employer) now; the 2025 job-portal pipeline later |
| 10 | Referral threshold | Jay picks one number |
| 11 | Which activities need the allowable-activity gate | Every community event, flagged by Jay |
| 12 | Waitlist close date and the old required-workshop step | Jay confirms |
| 13 | Who owns "ongoing check-in" cadence per partner | Jay sets it (undefined everywhere); default 30 days in season, 60 off season (matches script `KEEP_WARM_DAYS` 60) |
| 14 | DRY_RUN for school reminders | Stay on until the phase 7 parity week passes |

## 11. Risks and mitigations

- **PII sprawl.** Student emails, attendance exports, and the LiftOff application sit in sheets next to partner data. Hub tables hold no student rows; counts only. Separate people table, leads only, behind its own decision.
- **Credentials in Drive and in the Communication App.** Two Drive docs hold logins; the Communication App script holds Twilio credentials. Rotate; never import; add a repo secret-scan to CI.
- **Double sources of truth.** Mitigated by module-by-module cutover and a read-only sheet after each cutover.
- **Import quality.** Free-text fields (Next Step, Verify, More Contacts) do not parse cleanly. Import to `legacy_text`, never guess; review queue for flagged rows.
- **Name matching.** The sheet joins on organization name. Import assigns ids once and records name aliases (including "Kensington HS", KCAPA, and KHSA: confirm they are three schools).
- **Sending mistakes.** Typed confirmation, test gate by content hash, 14-day expiry, daily cap, first-failure stop, dedupe, DRY_RUN default on, no auto-send to schools.
- **Time.** Hand-rolled DST math exists in three script files because Intl was not trusted: the app uses explicit-option Intl formatters and tests across the March and November changes.
- **Cron limits.** Section 7.4.
- **Bus factor.** `HUB.md` runbook; Dannyelle, Iman, and Lauren trained on shift pages; Nick reviews migrations.

## 12. First-week plan (if everything is a yes)

Day 1: Phase 0 decisions with Nick. Day 2: branch, Phase 1 (migration 0016, layout, bootstrap). Day 3 to 4: Phase 2 importer and partner pages. Day 5: Phase 2 acceptance against the sheet totals. Week 2: Phase 3. This is an estimate, not a commitment.

## 13. Kickoff prompts (paste one per session; each starts in plan mode)

**Phase 1:** "Read OUTREACH_HUB_PLAN.md sections 3 to 5 and CLAUDE.md. We are doing Phase 1 only: migration 0016 (outreach_users, helpers, audit policy, outreach_settings, approved_facts), the (hub) layout gate, nav, and a bootstrap migration for the two leads. Show your plan in plain English first. Do not build any other pages."

**Phase 2:** "Phase 2 only: migration 0017 and the partner pages and importer from section 6. Import input stays in git-ignored records/. Start with the dry-run report. Show the mapping of the sheet's status values to the lifecycle list before writing code."

**Phase 3:** "Phase 3 only: slots, shifts, Who's Free. Port the claim rules, the 7-day and 21-day windows logic, and the Who's Free availability states with their tests first (research file 04, sections 3.12 and 3.13). Availability comes from the bridge endpoint, minutes only."

**Phase 4 to 8:** same pattern, naming the section and the research file.

## 14. What I did not verify

Nothing here is built or tested. I have not run Nick's app, read every source file in his repo, or read the Communication App's live script (it holds credentials). The sheet totals quoted are from read-only reads on 11/19 and will drift. The Drive's partner folders are mostly 2022 to 2023 and are not a reliable signal of who is active now. Table and column names are proposals for Nick to change.

## 15. Overlap with what the app already has (review before Phase 1)

Added after a check against the repo. Each row is a place where the plan above would build a second copy of something that exists. Nothing here is decided; resolve in Phase 0.

| Plan item | Already in the app | Suggested resolution |
|---|---|---|
| `outreach_settings` (0016) | `cycle_settings` + `/admin/settings` (`SETTING_GROUPS`, audit-logged) | Reuse `cycle_settings` (or add a `scope` column) and add hub groups to `SETTING_GROUPS`. No new table. |
| `approved_facts` (0016) | Same: admin-editable cycle copy already lives in `cycle_settings` | Fold into settings with source/approved-by metadata only if that is truly needed. |
| `outreach_users` + `is_outreach()` | `admin_users` + `is_admin()` + `getAdminUser()` | Keep the separate role only if outreach staff must NOT read applicant PII (the stated reason). If not, add a role/scope column to `admin_users` instead. DECISION 2 depends on this. |
| `staff_profiles` | `admin_users` (names; interviewer picker already lists active staff) | Extend `admin_users` or one-to-one table keyed to it; do not create a parallel staff list. |
| `audit_log` widening | `audit_log` + `logAdminAction()` | Already planned as reuse; keep. |
| `messages`, `message_batches`, `templates`, `template_tests` | `notification_log`, `src/utils/notify/{send,templates,triggers,providers}.ts` (SMTP, caps, dry-run, quiet hours, `alreadySent` dedupe) | Reuse `providers.ts`, caps and dry-run. Hub templates are a different audience (schools) so separate tables are likely right, but share the send/caps/log code rather than re-porting it. |
| Wording lint, typed-confirm, dedupe-within-7-days | `duplicates.ts`, `alreadySent` | Reuse the dedupe pattern. Lint is new. |
| `job_runs`, `event_log`, `/api/cron/hub-daily` | `/api/cron/daily` (one cron, `CRON_SECRET`), `notification_log.trigger_event` | Add hub jobs as steps inside `/api/cron/daily` (Vercel Hobby allows one run/day per path anyway). Add `job_runs` only if needed for the digest. |
| `orgs` for schools; `school_id` fk | `schools` (82 + partner flag `is_partner`, admin-owned via SQL) | `orgs.school_id` links to it. Decide ONE owner of the partner flag; do not maintain `schools.is_partner` and `orgs.status` separately. |
| `partner_year_stats.applied/enrolled`, `funnel_counts` | `applications` joined to `schools` by school id | Compute from the applicant side by view; do not hand-enter counts that the app already has. Hand entry only for tabling/info-session reach. |
| `contact_log` | `admin_notes` (per-applicant staff notes) | Different subject (orgs vs applicants), keep separate, but mirror the pattern and UI. |
| `agreements.pdf_drive_id` | private `documents` bucket + signed-URL route | Store agreement PDFs in Supabase Storage via the same route instead of Drive ids, if Drive is being retired from this flow. |
| Bulk select/confirm UI, filters-in-URL, CSV export, `sortLinks()` | applicant table (`applicant-table.tsx`, `applicants.ts`) | Reuse the components/pattern for partner and slot lists. |
| `dbErrorMessage`, `SelectField`, `formatDateTime`, `RichText` | exist | Already referenced in section 2; use them, do not re-create. |

**Net effect if accepted:** migration 0016 shrinks to (maybe) the role decision plus settings groups; sending reuses `notify/`; cron reuses `/api/cron/daily`. The genuinely new work is partners/contacts/agreements, slots/shifts, activities, and the school-facing template and lint layer.

### 15.1 Decisions made (2026-11-19, Jay)

| # | Decision |
|---|---|
| 1 | **Reuse `admin_users`** for all hub staff. No separate `outreach_users` table. See the access-scope note below. |
| 2 | **Reuse settings** (`cycle_settings` + `/admin/settings`). No `outreach_settings` or `approved_facts` tables; hub copy and approved facts become new `SETTING_GROUPS`. |
| 3 | **`orgs` is the one source of truth for partner status.** `schools.is_partner` must not be edited separately; it becomes derived from `orgs` (or is retired) so the two can never disagree. |
| 4 | **Compute** applied and enrolled counts from `applications` by school id. **Typed by staff:** info session headcounts and tabling headcounts only. |
| 5 | **Hub jobs run inside the existing `/api/cron/daily`.** No `/api/cron/hub-daily`. |
| 6 | **Agreement PDFs stay in Google Drive** for now (`agreements.pdf_drive_id`). Revisit later. |

**Access scope (decided 2026-11-19, Jay): all active admins can use the hub.** No new scope columns, no change to `is_admin()`, no `outreach_users`/`is_outreach()`. Hub RLS simply uses `is_admin()` (writes that only leads may do can use `is_super_admin()`). Consequence: the old migration 0016 (roles, helpers, settings, approved facts, audit widening) is no longer needed. Settings and approved facts are code-only additions to `SETTING_GROUPS`; `audit_log` already accepts admin writes. **The first hub migration is therefore the partners schema (formerly 0017), renumbered 0016.** Later numbers shift down by one. Trade-off to remember: every admin, including any future outreach-only hire, can read applicant data.

**Still open:** the partner status list (DECISION 3 in section 10).

## 16. Partnership tracking values and the dashboard (2026-11-19)

Source: the live "2026-27 Partner Database" sheet (tab names, column headers, the Scoring tab, and aggregate Dashboard numbers only; no contact details were copied into the repo).

### 16.1 What the sheet tracks per organization (maps to 0016)

| Sheet column(s) | Hub home |
|---|---|
| Organization, Network, Status (partner / potential / not a good fit / no contact), Notes | `orgs` (status uses the 15-value lifecycle; old values mapped) |
| Launchpad Champion + Contact 1 to 5 (name, greeting, role, email), More Contacts, Verify | `org_contacts` (champion = `is_champion`; unparseable text to `legacy_text`) |
| Last Contacted, Next Step, Follow-up | `contact_log` + view; follow-up is computed from last touch and cadence |
| Tabling (done / scheduled), Tabling Headcount | `activities` (kind tabling) with typed headcount |
| Info Session (done / scheduled), Info Session #, Info Session Headcount | `activities` (kind info session) with typed headcount |
| Applied, Cohort 1 to 4, Total Enrolled, Completed Program, Retention % | **Computed** from `applications` by school id where available (decision 4); cohorts/completed typed until the app tracks them |
| Responsive (0-2), Access (0-2) | `org_evaluations` (see 16.2) |
| Students Reached | computed: sum of tabling + info session headcounts |
| Partner Score (0-10), Tier | computed view; thresholds in settings (Reach 2 pts at 40, Applied 2 at 5, Enrolled 2 at 5; Anchor 8+, Growing 5+, Developing 1-4, Not started) |
| Snooze Until | `orgs.snooze_until` |
| LiftOff Pipeline stages (Not started, Contacted, Meeting set, Referring, Hosting) | `orgs.pipeline` (separate from the partner lifecycle on purpose: two different relationships) |

### 16.2 Evaluations (the "eval of each school and contact")

Today Responsive and Access are a single gut-check number overwritten in a cell, so there is no history and no reason recorded. Proposal: `org_evaluations(id, org_id, cycle_id, evaluated_on, evaluated_by, responsive 0..2, access 0..2, access_note, notes)`. The latest row per org feeds the score, older rows are kept as history, and the profile shows a "re-evaluate" prompt after a visit or every N days (setting). For contacts, do not add a manual rating; derive responsiveness from the contact log (days to reply, replies vs sends) and show it on the contact. **Open question:** is a manual per-contact rating wanted anyway?

### 16.3 Interactive dashboard with prompts (`/hub`, mobile-first)

Replaces the sheet's Dashboard tab and adds things it cannot do:
- **Needs closeout (prompts):** any visit, tabling or info session whose start time has passed with no headcount recorded appears at the top as a card ("You were at King. How many students did you speak to?") with a large number field and Save, plus "not held" and "reschedule". A big "I'm at {school} now" card appears during a booked slot's window so it can be answered from a phone. Entries stay as prompts until completed; they are never silently dropped.
- **Other prompt types:** re-evaluate partner (16.2), follow-up due, hold waiting for confirmation, unverified contact, next step missing.
- **Numbers (same as the sheet):** partner schools, potential partners, students reached, applied, enrolled, retention; tabling and info sessions done; by-network table; tier counts; LiftOff stages; top 10 by score; slot counts by status; follow-up list oldest first; champions to contact first. Email-send stats arrive with the sending phase.
- **Interactive:** every number links to the filtered list behind it (same pattern as the applicant dashboard); filters live in the URL.
- **Data rule:** all counts come from tables, not hand-typed totals, except the typed headcounts above.

Implementation note: closeout prompts depend on `activities` existing, so the activities tables (formerly 0019) move up and ship with the partner tables, or the dashboard launches with the simple "record headcount on this org" form first and gains slot-aware prompts later. **Decision for Jay:** which of those two.

## 17. Hybrid partnership gauge (2026-11-19)

Goal: rate each partner using every signal we have, show WHY, and let a person override, instead of one hand-typed number.

### 17.1 What was read to design this (read-only)

- **Partner Database sheet:** Partners tab (org, network, status, notes, outreach and activity columns; contact columns deliberately skipped), LiftOff Pipeline, Session Intake, Action, Dashboard, Scoring. Not read: Student Emails (student data), Staff (home ZIPs), Templates, Send Queue, Merge Log, Slot Inventory.
- **Application database (live, aggregate counts per school only, no student rows):** applications and Step 1 completions by school.
- **Communication App:** NOT read. The plan (7.3) says Tom at Building 21 must be asked first, and its script holds credentials. Nothing in this design depends on it.

### 17.2 Findings that shape the design

1. **The sheet's "Applied" column is empty** (dashboard shows 0 applied) while the app already holds real applications by school (for example Furness 6, Multicultural 4, Lenfest 3, Central 3). Confirms decision 4: compute, never hand-enter.
2. **33 live applications have no school linked** (typed-in "Other" or unmatched). Any per-school count undercounts until those are matched. Needs the same matching pass as migration 0015.
3. **Names do not match.** Sheet says "Furness", "Mastery - Lenfest", "King"; the app's `schools` table says "Horace Furness High School", "Mastery Charter School - Lenfest Campus". Import must build an alias map to `schools.id` once and store it.
4. **Partner flag already disagrees across the two systems.** `schools.is_partner` is true for Franklin Learning Center and Central is false, while the sheet lists Franklin as a potential partner. Confirms decision 3: one owner (`orgs`), the school flag derived from it.
5. **The Notes column already holds a human gauge** as free text: "Strong Partner", "Low retention", "Low applications usually", "Poor communication", "No early release", "Early release inconsistent", "Strong Partner, but also Dual Enrollment", "tiny school". These become structured `org_tags`, imported by exact phrase, with unmatched notes kept as legacy text.
6. **Most schools have never been evaluated:** 60+ of 80 rows are "Not started" with no logged touch since 9/30. A gauge must show "no data" for them, not a low score.
7. **Notes contain operational state** (who we are waiting on, scheduled dates). That is `contact_log.next_step` plus `activities`, not part of the rating.

### 17.3 Signals, by source

| Signal | Source | How it is obtained |
|---|---|---|
| Reach (students spoken to) | tabling and info session headcounts | typed by staff, prompted by the dashboard closeout card |
| Applications started and Step 1 complete | app database by `school_id` | computed view |
| Applications per student reached (conversion) | the two above | computed |
| Enrolled, cohorts, retention | typed until the app tracks them | typed |
| Follow-through | scheduled vs held vs cancelled activities | computed from `activities` |
| Responsiveness | reply speed, thread count, recent touches | derived from connected Google accounts (17.5) and the contact log |
| Access | early release, class time, room | `org_school_facts` plus evaluation |
| Human judgement | tags (strong partner, poor communication, low retention) and the latest evaluation | typed, dated, with who and why |

### 17.4 How the gauge is built (explainable, not a black box)

- **Keep the existing 0-10 score and tiers** for continuity (thresholds stay in settings). Components that now compute: Reach, Applied. Responsive and Access become the latest evaluation, pre-filled with a suggestion from the signals that a person confirms or changes.
- **Show the reasons** next to every score ("Reach 75 students, 6 applications, Responsive 2 because replied in under 2 days, Access 1 because early release is inconsistent").
- **Show data completeness** beside the tier (for example "3 of 6 signals"), and show "No data" instead of zero when signals are missing. Silence is not a bad rating.
- **Overrides** (a person pins a tier) require a reason and are audit-logged; the computed value stays visible.
- **Trend** is stored per season so a partner can be compared with itself.

### 17.5 Google accounts: pull and push, separate per account (privacy)

- **Each staff member connects their own Google account** (OAuth). Nobody's mailbox or calendar is read through someone else's account. The shared outreach mailbox is its own connection, owned by a lead.
- **Read first, write later.** Phase one asks only for read access (Gmail metadata or read-only, Calendar free/busy and events). Sending, drafts and creating calendar events are a separate, explicit grant per account and still require a human click.
- **Message content is not stored.** Per account we store only derived facts: matched org, direction, timestamp, thread id, reply latency. Matching is by the address or domain of known `org_contacts`; everything else is ignored.
- **Per-account privacy in the database:** raw derived rows live in a `mail_signals` table whose row-level security lets only the owning user read them. Org-level views show aggregates only (counts, last-touch date, median reply time, who last touched it) through a security-definer view, never subjects, bodies or another person's individual threads. Note this is stronger than the rest of the hub, where all admins can read everything (decision: all admins use the hub).
- **Control:** each person can see what is connected, disconnect, and purge everything derived from their account. Tokens are encrypted, per user, server-side only, never in the repo or logs.
- **Needs a decision and Workspace admin action:** an internal (domain-only) Google OAuth app avoids Google's public verification for sensitive mail scopes; someone with Workspace admin rights must approve it. Until then the Apps Script bridge (7.2) is the interim path.

### 17.6 Build order for this feature

1. Partner tables, tags, evaluations, aliases to `schools.id` (migration 0016, tested on the `outreach-hub` branch).
2. Computed views: reach, applications by school, conversion, follow-through, gauge with reasons and completeness.
3. Dashboard with closeout prompts (16.3).
4. Google connections, read-only, one account at a time, starting with a single test account.
5. Write scopes (calendar events, drafts, sends) later, each human-triggered.

**Decisions needed:** (a) internal Google OAuth app vs Apps Script bridge for step 4, (b) whether each person's derived email facts may feed the org score or only inform a suggestion, (c) permission from Tom before anything touches the Communication App.

### 17.7 Decision recorded (2026-11-19, Jay): interim Apps Script bridge, internal Google app later

- **Now:** the existing Apps Script, running as the shared outreach account, is the bridge. It pushes to token-guarded `/api/hub/bridge/*` endpoints (availability minutes, and derived mail facts for the shared mailbox) and, in phase 6, can poll an outbox for approved sends (7.1 option B). No Google OAuth app is built yet.
- **Later:** an internal (domain-only) Google OAuth app, approved by a Workspace admin, replaces the bridge so each person connects their own account (17.5).
- **Consequence for the gauge:** until the internal app exists, email-derived signals come only from the shared outreach mailbox (and calendar free/busy). Individual staff mailboxes are NOT read at all, which fits the per-account privacy rule. Responsiveness is therefore partly blind for threads that live only in a personal inbox; the gauge shows that as lower data completeness, not a low score, and staff can log those touches by hand in the contact log.
- **Bridge rules:** bearer token in env (rotatable, never in the repo), endpoints accept only the fields they define (no raw message bodies), every call is logged to the audit log, and the bridge can be switched off from settings.
- **Communication App (read 2026-11-19 from the credentials-redacted Drive backup):** stays out of scope. Findings to pass to Tom: hardcoded Twilio credentials in the live script, text-reply pull capped at the latest 100 with no pagination, fragile email-reply matching, no quiet hours/opt-out/cap/dedupe on sends, three unreviewed external libraries.
- **Still needed to read the Outreach scripts:** a credentials-redacted text backup in Drive (or pasted files); clasp cannot be run from this environment.

## 18. Foundational tech carried over from the scripts (2026-11-19)

Source: the Partner Database script (13 files, about 4,700 lines) and the Communication App script, pulled read-only with clasp into a private scratchpad outside the repo. Read: file headers, function lists, and the spots that matter. A full line-by-line parity read is still to do. No credentials, contact data, calendar ids, or staff emails are copied here.

### 18.1 Why this matters

The scripts are already split into **pure logic** (no Apps Script calls, unit tested in node) and a thin **Apps Script layer** (sheets, mail, triggers). The pure parts port to TypeScript almost one for one, and their existing tests become the acceptance tests. That is the safest way to move the business rules: port the tests first, watch them fail, then port the code.

### 18.2 Foundation modules (each becomes a file in `src/utils/hub/` with tests)

| Script module | What it gives the hub | Hub home | Port notes |
|---|---|---|---|
| `MailMerge.js` (about 1,200 lines) | segment, one-template-per-batch, To/CC/BCC rules, test-gate (14 days, keyed to template text), typed `SEND`, preview vs drafts, skip rules (verify flag, status, "Await" next steps, already contacted, no windows), unfilled-token blocker, dedupe, send pacing | `mail/merge.ts`, `mail/skip-rules.ts`, `mail/test-gate.ts` | Highest value and highest risk. Port rules and tests before any sending code. |
| `mmLint` plus the Sunday list (`SC_BANNED_`) | wording lint: dollar amounts, em dash, "college credit", hourly rate, ET/EST/EDT, "Eastern Time", subject prefix, and voice phrases ("so glad", "so excited", ...) | `mail/lint.ts` | The two files keep **different lists**. Merge into one shared function; make the prefix check case-insensitive (known bug). |
| `Ghosts.js` | `gtNormOrg` (org-name normalisation so "Frankford HS" and "Frankford High School" match), touches, ghost vs reply status, ranking, digest lines; Last Contacted only moves forward | `partners/ghosts.ts`, `partners/org-name.ts` | `gtNormOrg` is the seed for the school-alias map (17.2 finding 3). |
| `WhosFree.js` | the four shift frames (7-10, 10-1, 1-4, 4-7), free / partly free / busy / unknown, 42-day window, notice rule per person, out-of-office all-day events, free/busy only (never titles) | `shifts/availability.ts` | Notice rules and exclusions become `staff_profiles` fields, not constants. |
| `Staffing.js` | sign-up form, Staff tab, "Could cover", live shift board, claim/release | `shifts/*`, board page | Fix: column C is a time label now, not AM/PM (known bug); capacity 2 enforced in SQL. |
| `WeeklyNumbers.js` | Monday to Sunday weeks, counts, history tab | `reports/weekly.ts`, view | Replace the hand-rolled DST math with explicit-option `Intl` and test across the March and November changes. |
| `SundayConfirm.js` | draft-only Sunday confirmations to schools and staff, one checklist email to Jay | `jobs/sunday-confirm.ts` | Stays drafts-only. |
| `LiftoffHub.js` | one-time builder merging three tabs, department letters A to K, held contacts | `scripts/import/` | One-time import, not a runtime feature. |
| `Automations.js` (926 lines) | daily run: digest, team alerts, morning-of heads-up, snoozes, Jotform counts, Roam posts, health check, `CONFIG` | `jobs/*` inside `/api/cron/daily` | Secrets already live in Script Properties, not the file: mirror that with env vars. |
| `Guard.js` | one runner account runs scheduled jobs; pure `runnerDecision_` | replaced by one Vercel cron plus `event_log` unique keys | Idempotency idea survives: a job must not run twice for the same key. |
| `Move To Top.js`, Slot Backup | nightly sort, backup tabs | retired | Ordering is a query; history is a trigger table. |

### 18.3 Foundation patterns worth keeping from both projects

1. **Draft, don't act.** Merge makes drafts or previews; Sunday only drafts; the Replies sidebar saves HOLD rows and sends only after a person confirms the exact list. Hub rule: every outbound action has a draft state and a human confirm.
2. **No double sends by construction.** After a send, the Communication App's sidebar flips every row back to HOLD so a re-run cannot text anyone twice. Hub equivalent: unique `(contact, template)` dedupe window plus a message state machine (`queued` to `sent`), never re-selectable once sent.
3. **STOP handling.** `rpIsStop` recognises stop, stopall, unsubscribe, cancel, end, quit and blocks replies to that person. Reuse the pattern, applied by the app's own notify code (decision: v1 hub sends no student texts).
4. **Phone normalisation.** `rpDigits10` (strip to 10 digits, drop a leading 1) is already covered by the app's `toE164`; reuse that, do not re-port it.
5. **Pure core, thin shell.** Keep the same split in TypeScript: pure functions in `src/utils/hub/**` tested with plain node, thin server actions around them.
6. **Prefix names to avoid collisions** (`gt`, `sc`, `wn`, `rp`) becomes ordinary module scope.
7. **Philly time everywhere**, but with `Intl` explicit options, not hand-rolled DST.

### 18.4 What is NOT carried over

The Communication App's send menu (no quiet hours, no cap, credentials hardcoded in the live script), its 100-message reply window, and its student/parent data tabs. It remains Tom's and out of scope; only the draft-then-confirm and STOP ideas are borrowed.

### 18.5 Gaps to close before porting

- **The node tests (`test/*.test.js`) were not in the pull.** They live in the repo that holds the script source, which this session cannot reach. They are the acceptance tests; Jay needs to make them available (a branch of this repo, or pasted files).
- **A full parity read** of `MailMerge.js`, `Automations.js`, `Staffing.js`, and `SundayConfirm.js` against section 9 is still owed; this section is based on headers and function lists.
- The live script differs from the plan's line numbers if it has been edited since (the plan cites `MailMerge.js:1075/1119`; confirmed in the current pull).

### 18.6 Effect on build order

Phase 0 gains one step: **bring the script tests into the repo** (`src/utils/hub/__tests__`). Phase 5 (templates and lint) and Phase 6 (sending) start from the ported merge, lint, and skip-rule modules rather than from scratch. Phase 3 starts from `availability.ts`. The partner migration (0016) is unaffected.
