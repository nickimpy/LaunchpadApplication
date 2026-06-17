# Launchpad Application System -- PRD

> Source of truth: Notion page "Launchpad Application System -- PRD" (last synced June 10, 2026). This local copy exists so Claude Code can read the full spec. If the two drift, Notion wins.

## Overview

The Launchpad Application System is a full-stack web application that centralizes the entire applicant journey for the Launchpad program, from initial account creation through final admissions decisions. It replaces a fragmented mix of Google Forms, spreadsheets, and third-party scheduling tools with a single, unified platform.

**Tech Stack:** Next.js frontend hosted on Vercel, with Supabase for database, auth, and file storage (~200 transcripts max per cycle in Supabase Storage). The Launchpad dev team integrates with the existing data warehouse post-MVP. Transactional email via Resend; SMS via the existing Twilio account.

**Source of truth:** This system runs the full admissions cycle end to end. Data is pushed to the SIS at the end of the cycle; no live SIS integration during the cycle.

## Users & Stakeholders

**Applicants:** ages 16-24 in the Philadelphia area, primarily 11th/12th graders plus recent HS graduates. Need a simple, mobile-first experience with clear progress indicators.

**Launchpad Staff (Admins):** super admin (Nick, nick@launchpadphilly.org) adds and manages all other admin accounts; all other staff share a uniform admin access level. Full CRUD on student accounts. Manage the pipeline, enter external data (transcripts, interview scores, counselor sign-offs), make final decisions. Need filtering, bulk editing, dashboards.

**Parents/Guardians:** complete a required form with no account or login. Receive the form link automatically by email/SMS when the student finishes Step 1; the student can also copy their unique link; staff can re-send it. Can monitor progress via the student's public status link (status only, no PII).

**School Partners** (stretch, not MVP): read-only visibility via the shareable public link per student.

## Cycles & Programs

- Annual cycles, one active cycle at a time
- Lightspeed and Foundations applications run concurrently within a cycle
- No hard deadline enforcement in v1 (deadline locking can be built later)
- At cycle close, an archive feature exports all cycle data to Google Drive

## Application Process -- 7 Steps

| Step | Name | Who Completes | Notes |
|---|---|---|---|
| 1 | Student Information | Applicant | Extended profile info; triggers parent form email/SMS |
| 2 | Parent / Guardian Form | Parent or Guardian | No login required; sent via email/SMS or shareable link |
| 3 | Short Answer Questions | Applicant | Essay-style; separate step for funnel tracking |
| 4 | Interview | Applicant + Admin | School-based or Launchpad-based; admin records outcome |
| 5 | C2LPHL Application | Applicant (external) | Student self-reports; staff verifies |
| 6 | C2LPHL Required Documents | Applicant (external) | Student self-reports; staff verifies |
| 7 | Admissions Decision | Admin | Hidden from student until decision email is manually triggered |

Steps 2-6 can overlap in order. Sidebar keeps numbered steps but greys out any step that depends on an earlier incomplete step.

**Step progression rules:**

- Students can re-open and edit any step after submitting it
- Steps are independent where logical (interview can complete with incomplete essays)
- Only staff progress Step 4 and Steps 5-6 verification; admins cannot manually mark student-owned steps (1, 3) complete

## Account Creation

- Single public signup link; open signups allowed (no invites)
- Students arrive after an interest form (Google Form) that displays "This is not the application"
- Required at signup: email, date of birth, first name, last name, phone number
- Email verification required before proceeding
- Duplicate email: show "An account with that email already exists, click here to reset your password"; send reset to the original email
- Auth: email/password, with magic link as an additional sign-in option
- Notification preference: email only, SMS only, or both; no full opt-out. SMS opt-in confirmed via "reply Y" flow (Twilio)
- Unique identifier per account; students can update profile throughout; full CRUD on student profiles

## Student Portal

- Two-panel layout: left sidebar with all numbered steps + status (completed / in progress / not started, dependent steps greyed out); main content area shows the active step
- Each step shows its deadline; completing a step triggers a visual progress update
- Mobile-first, strong desktop too
- Visual design per Building 21 Style Guide (see Brand & Design)

## Step 1: Student Information

Uses the existing 2026 application form verbatim, minus essays (moved to Step 3).

**Personal Information:** Full Legal Name (First, Last) req; Preferred Name opt; Email req; Phone req; Address (Street, Street 2, City, State, Zip) req.

**Academic Information:** School name (dropdown, "Other" reveals free text) req; GPA (cumulative, weighted) req; Graduation Year (Before 2025 / 2025 / 2026 / 2027 / 2028) req — show an inline eligibility note (students graduating in 2029 or later are not currently eligible to apply); How did you hear about Launchpad? (referral name) opt.

**Demographic Information** (funder reporting only; does not affect application status): Gender identity (Male / Female / Non-Binary / Prefer not to say / Other) req; Preferred pronouns (he/him / she/her / they/them / Prefer not to say / Other) req; Race/ethnicity multi-select req (American Indian or Alaska Native / Asian / Black or African American / Hispanic, Latino, or Spanish Origin / Middle Eastern or North African / Native Hawaiian or Pacific Islander / White / Prefer not to say / Other); Combined household income req (Less than $25,000 / $25,000 - $49,999 / $50,000 - $74,999 / $75,000 - $99,999 / $100,000 - $149,999 / $150,000 - $199,999 / $200,000 and above / Prefer not to say); Number in household req; Did either parent attend or complete college? (Both / One / Neither / Don't know / Prefer not to say) req.

**Program selection & program-specific questions** (verbatim from the 2026 application PDF):

Program: Launchpad Lightspeed or Launchpad Foundations.

*Lightspeed questions* (shown only to seniors/graduates who pick Lightspeed):

- "Which of the following best describes you?" (graduation status): I am currently a High School Senior on track to graduate in Spring 2026 / I have already graduated high school or obtained my GED
- "Which of the following best describes you?" (work authorization): I currently have legal work authorization to work in the US / I have applied for legal work authorization to work in the US / I do not have legal work authorization to work in the US
- "Which of the following skills do you have experience with? (check all that apply)": Python / HTML, CSS / Javascript / Git/GitHub / SQL/databases / API usage and integration / Figma or other wireframing software / ChatGPT or other LLMs / React / None of the above
- "Which of the following have you done before? (check all that apply)": Taken a technology course in school / Taken a coding course in school / Taken AP Computer Science / Taken a college coding course / Completed an online coding course / Participated in a technology training program / Participated in a workforce development program / Worked part-time / Worked full-time / None of the above
- "Please share the specific courses/experiences you've completed including dates and outcomes (certifications earned, AP exam scores, credits received, etc.)" [open text]
- "Which of the following best describes your plans for the 2025-2026 academic year?": I will have no other commitments / I will be working part-time / I will be working full-time / I will be attending college part-time / I will be attending college full-time / I will be both attending college and working

*Foundations questions* (shown to Foundations applicants, including all juniors):

- "Currently, what pathway are you most interested in?": Entrepreneurial Leadership Only - no interest in tech/coding / Leaning entrepreneurial leadership, but open to tech / I'm open to either pathway! / Leading tech/coding but open to entrepreneurial leadership / Tech/Coding Only - no interest in entrepreneurial leadership
- "How interested are you in pursuing a career in tech?": 1 (no interest) through 5 (only want to pursue a career in tech)
- "What are your current plans for after high school?": I want to get a good job and work right after high school / I want to take time off after high school but then get a degree / I want to attend CCP/2-year college in Philly right after high school / I want to attend a 4 year college in Philly right after high school / I want to attend college NOT in Philly right after high school

**Parent/Guardian Information:** Guardian 1 first name, last name, email, phone, relationship (free text), all required. Optional second guardian (Yes/No) revealing the same fields.

**Conditional logic (replicate JotForm exactly):**

| Rule | Condition | Action |
|---|---|---|
| 1 | Program = Launchpad Foundations | Hide Lightspeed questions |
| 2 | Program = Lightspeed | Hide Foundations questions |
| 3 | Graduation Year = 2028 | Hide Lightspeed program info/selection |
| 4 | Graduation Year = 2028 | Hide Lightspeed questions |
| 5 | Second guardian = Yes | Show Guardian #2 fields |
| 6 | School name = Other | Show free-text "What high school do you attend?" |

Juniors (class of 2028 only) never see Lightspeed and go straight to Foundations questions. Class of 2027 are rising seniors and choose between programs normally. Seniors/graduates (2026 and earlier) also choose between programs.

**College compatibility warning:** if a student selects "I want to attend college NOT in Philly right after high school" (the last option of the Foundations "What are your current plans for after high school?" question), show an inline warning (not a hard block): Launchpad is full-time in Philadelphia; contact info@launchpadphilly.org with questions. Student may continue (application flagged for staff review) or stop.

**Preferred vs. legal name:** communications use preferred name; official forms/documents use legal name.

**Save behavior:** students can save mid-step and return later.

**Completing Step 1 triggers:** automated email (and SMS if opted in) to each guardian with the parent form link, plus a shareable link the student can copy.

## Step 2: Parent / Guardian Form

No parent account. Auto-fills student name, DOB, and high school (read-only). Accessible via automated email/SMS, student-shared link, or admin re-send. Both student and admins can update guardian contact and trigger a resend. Completion marks Step 2 complete.

**Fields (from the 2026 Parent Application JotForm source):**

- Intro: "Do you want to learn a bit more about Launchpad?" (Yes, please! / No thanks). Yes shows a program info page (cycle-specific copy, admin-editable)
- Student info: name, DOB, high school (auto-filled, read-only)
- "Is your student available to attend Launchpad for 6 weeks this summer at 801 Market St?" (Yes / No / Not Sure) req. Same question for both programs. Location/dates admin-configurable per cycle
- Conditional: No or Not Sure shows textarea "Please share what conflicts/concerns you have with the summer schedule"
- "Does your student have an IEP?" (Yes / No / Prefer not to disclose) opt
- "Anything you want us to know?" opt textarea
- Parent contact: full name (First, Last), relationship (free text), best email, best phone, all req
- Records release consent + required e-signature

**Consent language:** see Notion PRD for current verbatim text and the proposed expanded draft (covers consent to apply, data storage/use, funder reporting, email/SMS contact). Draft pending review; build the form so the consent copy is editable.

**E-signature:** build natively with a canvas signature pad (signature_pad library). Store signature image + typed name + timestamp + IP with the submission. No third-party e-sign provider.

## Step 3: Short Answer Questions

Separate from Step 1 for funnel tracking. Parallel with Step 2, either order.

The 2026 application uses two long personal-statement prompts (verbatim source below). **We are NOT reusing these two prompts as-is** — they will be broken into smaller, directed sub-questions (essay scaffolding) so applicants answer focused chunks rather than two 300–500 word essays. The final scaffolded sub-question list is TBD; build Step 3 so prompts are admin-editable data (not code) and the scaffolded set can replace the placeholder later without a code change. Beta placeholder: single prompt "Why do you want to join Launchpad?"

Source prompts (to be decomposed, not used directly):

- Prompt 1: "In 300-500 words, describe a time where you solved a problem. How did you identify the problem, how did you plan your solution, was your solution effective, and what did you learn from the experience?"
- Prompt 2: "In 300-500 words, tell us why you are interested in Launchpad and how you think Launchpad can help you reach your passions and career goals."
- Video option (carry forward when scaffolding): applicants may send a video to nick@launchpadphilly.org and zay@launchpadphilly.org, then write "I sent a video" in the field.

## Step 4: Interview

**Track A (school-based):** partner-school students interview at school; no student scheduling; admin records outcome.
**Track B (Launchpad-based):** everyone else (incl. graduates) books at Launchpad.
**Track assignment:** school in partner list → A; otherwise or graduated → B.

**Scheduling:** JotForm / Life Scheduling fallback for v1; native is a fast-follow. If native: central admin creates slots, capacity can exceed 1, batches released ~1 week ahead (simple slot list UI, not a calendar), students reschedule/cancel anytime, blast email to unbooked Track B students on batch release (any admin can send). Support a "no-show" state on a booked slot.

**Rubric:** 7 criteria, each 0-3 (Unaligned / Minimally / Mostly / Completely Aligned), optional note per criterion:

1. Passion (tech/entrepreneurship as career pathway)
2. Purpose (post-secondary plan aligned with program model)
3. Persistence (goal + persisted through challenge)
4. Collaboration (group work, valuing others' perspectives)
5. Prior Knowledge (exposure to AI/tech/entrepreneurship)
6. External Support (support network; top scores require submitted parent app, so surface Step 2 status to the interviewer)
7. Communication (written + verbal; includes essay rating, so link the student's Step 3 responses)

**Also captured:** Pathway Preference (5-point: Entrepreneurial Leadership Only / Leaning EL / Open to either / Leaning tech / Tech-Coding Only); schedule conflicts; college plans; interview date; interviewer(s); overall notes; committee's agreed final rating. Recording an outcome marks Step 4 complete.

**Partner schools (31), admin-editable, match by school ID:** see partner_schools_track_a in school-dropdown-options.json.

## Steps 5 & 6: C2LPHL Application & Required Documents

- Step 5: apply to C2LPHL (external), mark Launchpad top choice
- Step 6: upload required docs in the C2L system
- Each: student self-reports in portal; staff verify (toggle per step, informed by C2L reports)
- Name + DOB must match across systems for reconciliation
- No hardcoded open/close dates (C2L deadlines arrive late)
- Mass email blast when C2L applications open
- Automated C2L report ingestion is a stretch goal

## Step 7: Admissions Decision

- Statuses: Offer Extended, Waitlisted, Denied, Withdrew, Acceptance Rescinded, Offer Accepted, Offer Not Accepted, Ineligible
- Decision hidden from student until an admin manually triggers the decision email; email links to portal (decision not in body); after trigger, student sees it in portal

## Automated Emails & Notifications

Sender: "Launchpad Philly" <apply@launchpadphilly.org> (mailbox to be created). Email via Resend, SMS via Twilio, per student preference (email/SMS/both, no full opt-out). Confirmations include realistic expected timeline + named contact point. After major submissions, send confirmation requiring click/reply to verify receipt.

| Trigger | Recipient | Timing | Message |
|---|---|---|---|
| Account created | Student | Immediately | Email verification link (required) |
| Account created, no app started | Student | 7 days after signup | Reminder to begin |
| Step 1 done, Step 3 not | Student | 2-5 days after Step 1 | Short answers reminder + link |
| Step 1 done, Step 2 not | Student | 2-5 days after Step 1 | Parent form reminder + link |
| Step 1 complete | Parent | Immediately | Parent form link (auto-filled) |
| Parent form not submitted | Parent | 7 days after Step 1 | Follow-up reminder |
| Any step completes | Student | Immediately | Confirmation + click-to-verify + timeline |
| Track B slots released | Unbooked Track B students | On batch release | Blast with slots |
| C2LPHL opens | All applicants | When announced | Complete C2L app |
| Decision email | Student | Manually triggered | Link to portal |

## Admin Dashboard

**Access:** super admin (nick@launchpadphilly.org) creates/manages admin accounts; no Google domain SSO (domain accounts shared with students); admin accounts invite-only email/password via Supabase Auth; all other admins uniform access. Full CRUD on student accounts. Admins cannot complete student-owned steps (1, 3).

**Audit trail (who/what/when):** edits to student info (name, phone, email); interview completion and status updates; any admissions decision (recording, changing, triggering email).

**Applicant table:** filter/sort by school, step/status, track, program, etc.; inline editing (e.g., bulk counselor sign-off by school); on-demand CSV export.

**Student profile:** view all submissions; upload docs (transcript, attendance, IEP/504); log interviews; verify Steps 5-6; copy/re-send parent link; update guardian contact; general notes; record decision + trigger decision email.

**Pipeline dashboard:** funnel counts by step, completed vs. outstanding.

## Public / Shareable Student Link

Unique non-login URL per student, never expires. Shows: name, steps complete/outstanding, current step. Hides all application content and PII. For decisions, show "Decision pending" until released (proposed).

## Brand & Design (Building 21 Style Guide)

**Colors** (proposed mapping: teal = primary/active, green = completed/success, orange = warnings/flags, greys = text/surfaces):

| Role | Base | Tints | Dark |
|---|---|---|---|
| Teal (primary) | #0faec9 | #4bc2d7, #87d6e4, #c3ebf1 | #0a8196 |
| Orange (accent) | #f27e34 | #f59e67, #f8be99, #fcdfcc | #b45e23 |
| Green (accent) | #8eb651 | #aac87d, #c6daa8, #e3edd3 | #658639 |
| Grey (text/UI) | #67686a | #b6b7ba, #d9d9da, #e8e8e9, #f7f7f7 | - |

**Typography:** Arial (system sans-serif stack) for web per the guide. Headings Arial Bold, body Arial Regular, captions Arial Italic. Font sizes in multiples of 3 (body 15px; headings 18/24/30/36/42). 1.3 line height. Never underline non-links.

**Logo:** brand/launchpad-logo-main-color.svg (rocket-trail mark + "Launchpad" wordmark). Never stretch, recolor, rotate, or modify.

## Data, Security & Compliance

- Supabase for DB/auth/storage; data warehouse integration post-MVP; SIS push at end of cycle
- Archive: export all cycle data to Google Drive at cycle close
- Parental consent handled via parent form consent + e-signature
- Strive for maximum WCAG compliance on public-facing surfaces

## Out of Scope (MVP)

School partner dashboard; automated C2LPHL report ingestion; native interview scheduling (fallback OK for v1); parent accounts; hard deadline enforcement; live data warehouse and SIS integration.

## Open Items (resolvable during build)

- Full short answer questions + scaffolding (beta uses single prompt)
- Admin spreadsheet columns to inform table design
- Step deadlines: who sets, per-program, admin-configurable?
- Portal domain (e.g., apply.launchpadphilly.org) + DNS, Resend SPF/DKIM
- Twilio A2P 10DLC registration check + exact "reply Y" flow
- Create apply@launchpadphilly.org mailbox
- Confirm step dependency map (proposed: Step 1 unlocks 2-6; 2-6 parallel; 7 admin-only)
- Decision email trigger UX (per-student, bulk, or both)
- Edit-after-submit status behavior
- Whether editing guardian info auto re-triggers the parent email
- Consent language review before launch
