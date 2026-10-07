# Launchpad Application System -- PRD

> Source of truth: Notion page "Launchpad Application System -- PRD" (last synced June 10, 2026). This local copy exists so Claude Code can read the full spec. If the two drift, Notion wins.
>
> **Revised October 6, 2026 for the 2027-28 cohort** (this copy is AHEAD of Notion until the Notion page is updated): Foundations is the only program; applicants must be 22 or younger at program start; Step 1 loses the program selector and career-interest question and gains pathway info; applicants 18+ can sign their own records release; the parent form, Step 3 questions, Step 4-7 copy and all deadlines are updated. See "2027-28 changes" at the end for the full list.

## Overview

The Launchpad Application System is a full-stack web application that centralizes the entire applicant journey for the Launchpad program, from initial account creation through final admissions decisions. It replaces a fragmented mix of Google Forms, spreadsheets, and third-party scheduling tools with a single, unified platform.

**Tech Stack:** Next.js frontend hosted on Vercel, with Supabase for database, auth, and file storage (~200 transcripts max per cycle in Supabase Storage). The Launchpad dev team integrates with the existing data warehouse post-MVP. Transactional email via Resend; SMS via the existing Twilio account.

**Source of truth:** This system runs the full admissions cycle end to end. Data is pushed to the SIS at the end of the cycle; no live SIS integration during the cycle.

## Users & Stakeholders

**Applicants:** ages 16-22 in the Philadelphia area (must be 22 or younger at program start, July 2027), primarily 11th/12th graders plus recent HS graduates. Some are legal adults (18+); see "Applicants 18+". Need a simple, mobile-first experience with clear progress indicators.

**Launchpad Staff (Admins):** super admin (Nick, nick@launchpadphilly.org) adds and manages all other admin accounts; all other staff share a uniform admin access level. Full CRUD on student accounts. Manage the pipeline, enter external data (transcripts, interview scores, counselor sign-offs), make final decisions. Need filtering, bulk editing, dashboards.

**Parents/Guardians:** complete a required form with no account or login (for applicants under 18, or 18+ applicants who choose a parent to sign). Receive the form link automatically by email/SMS when the student finishes Step 1; the student can also copy their unique link; staff can re-send it. Can monitor progress via the student's public status link (status only, no PII).

**School Partners** (stretch, not MVP): read-only visibility via the shareable public link per student.

## Cycles & Programs

- Annual cycles, one active cycle at a time
- **Launchpad Foundations is the only program** applicants apply to (Lightspeed has been retired from the application; there is no program selector and no Lightspeed copy anywhere in the portal or admin)
- The application cycle (e.g. `2026-2027`) is internal; applicants see the **cohort label** (`cohort_label` setting, currently "2027-28"): "This is your application for Launchpad's 2027-28 cohort." Foundations starts July 6, 2027
- No hard deadline enforcement in v1 (deadline locking can be built later)
- At cycle close, an archive feature exports all cycle data to Google Drive

## Application Process -- 7 Steps

| Step | Name | Who Completes | Notes |
|---|---|---|---|
| 1 | Student Information | Applicant | Extended profile info; triggers parent form email/SMS |
| 2 | Parent / Guardian Form (Records Release Form for 18+ self-signers) | Parent or Guardian (or the applicant, if 18+ and they choose to sign their own) | No login required; sent via email/SMS or shareable link |
| 3 | Short Answer Questions | Applicant | Essay-style; separate step for funnel tracking |
| 4 | Interview | Applicant + Admin | A Launchpad staff member reaches out to schedule; admin records outcome |
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
- **Age eligibility:** the applicant must be 22 or younger on the program start date (July 6, 2027; `program_start_date` and `max_enrollment_age` settings). An older date of birth blocks signup (and profile edits) with: "Launchpad 101 is only eligible for learners 22 or younger upon enrollment. If you are 23 or 24 and interested in training, consider applying for LiftOff at www.launchpadphilly.org/careers. If you are older than 24 and seeking training resources, reach out to info@launchpadphilly.org." (links live in the signup version)
- Email verification required before proceeding. Verification links open a **confirm page with a button** (the click does the verifying), so email scanners that pre-open links can't use up the one-time token and strand the applicant on "This link didn't work"; a link that can't finish signing in on this device sends them to log in with "Your email is confirmed" instead
- Duplicate email: show "An account with that email already exists, click here to reset your password"; send reset to the original email
- Auth: email/password, with magic link as an additional sign-in option
- Notification preference: email only, SMS only, or both (**defaults to both**); no full opt-out. SMS opt-in confirmed via "reply Y" flow (Twilio)
- Unique identifier per account; students can update profile throughout; full CRUD on student profiles

## Student Portal

- Two-panel layout: left sidebar with all numbered steps + status (completed / in progress / not started, dependent steps greyed out); main content area shows the active step
- Each step shows its deadline; completing a step triggers a visual progress update
- Mobile-first, strong desktop too
- The portal home opens with a **hero banner of student photos** (`src/utils/portal-hero.ts`; a plain brand-teal banner until photos are added) with the welcome heading over it
- Visual design per Building 21 Style Guide (see Brand & Design)

## Step 1: Student Information

Uses the existing 2026 application form verbatim, minus essays (moved to Step 3).

**Personal Information:** Full Legal Name (First, Last) req; Preferred Name opt; Email req; Phone req; Address (Street, Street 2, City, State, Zip) req. All "questions?" contact points use **apply@launchpadphilly.org** (`contact_email` setting).

**Academic Information:** School name (dropdown, "Other" reveals free text) req; GPA (cumulative, weighted) req — **must be a number from 0 to 8** (validated on save and submit); Graduation Year (Before 2025 / 2025 / 2026 / 2027 / 2028) req — show an inline eligibility note (students graduating in 2029 or later are not currently eligible to apply); How did you hear about Launchpad? (referral name) opt.

**Demographic Information** (funder reporting only; does not affect application status): Gender identity (Male / Female / Non-Binary / Prefer not to say / Other) req; Preferred pronouns (he/him / she/her / they/them / Prefer not to say / Other) req; Race/ethnicity multi-select req (American Indian or Alaska Native / Asian / Black or African American / Hispanic, Latino, or Spanish Origin / Middle Eastern or North African / Native Hawaiian or Pacific Islander / White / Prefer not to say / Other); Combined household income req (Less than $25,000 / $25,000 - $49,999 / $50,000 - $74,999 / $75,000 - $99,999 / $100,000 - $149,999 / $150,000 - $199,999 / $200,000 and above / Prefer not to say); Number in household req; Did either of your parents attend or complete college? (Both / One / Neither / Don't know / Prefer not to say) req.

**Pathway interest & plans** (Foundations is the only program; there is no program selector and no career-interest question):

Above the pathway question, two pathway cards explain the choice:

- **Software Engineering** — Develop and practice AI and Python coding skills. Explore AI-powered web, app, and product design. Earn the PCEP-30 Python Certification.
- **Entrepreneurial Leadership** — Build and launch your own business. Pitch solutions to business industry leaders. Get certified by the Project Management Institute.

Questions:

- "Currently, what pathway are you most interested in?": Entrepreneurial Leadership Only - no interest in tech/coding / Leaning entrepreneurial leadership, but open to tech / I'm open to either pathway! / Leading tech/coding but open to entrepreneurial leadership / Tech/Coding Only - no interest in entrepreneurial leadership
- "What are your current plans for after high school?": I want to get a good job and work right after high school / I want to take time off after high school but then get a degree / I want to attend CCP/2-year college in Philly right after high school / I want to attend a 4 year college in Philly right after high school / I want to attend college NOT in Philly right after high school / I want to attend trade school right after high school

(Retired: the Lightspeed question set, the Lightspeed/Foundations selector, and "How interested are you in pursuing a career in tech?" 1-5.)

**Parent/Guardian Information:** Guardian 1 first name, last name, email, phone, relationship (free text), all required. Optional second guardian (Yes/No) revealing the same fields. **Applicants 18+** see this section differently — see "Applicants 18+" below.

**Conditional logic:**

| Rule | Condition | Action |
|---|---|---|
| 1 | Second guardian = Yes | Show Guardian #2 fields |
| 2 | School name = Other | Show free-text "What high school do you attend?" |
| 3 | Applicant is 18+ | Show the records-release question; guardian section becomes optional if they sign their own (see below) |
| 4 | Class of 2027 or earlier AND post-HS plan = "4 year college in Philly" or "college NOT in Philly" | Show the college-schedule warning and flag the application |

(The old JotForm Lightspeed/Foundations rules no longer apply: there is one program.)

**College compatibility warning:** if an applicant graduating in 2027 or earlier selects "I want to attend a 4 year college in Philly right after high school" or "I want to attend college NOT in Philly right after high school", show an inline warning (not a hard block) and set `college_warning_flagged` for staff review: "A quick heads-up: Launchpad is a half-day program based in Center City Philadelphia. It does not fit with a full-time college schedule. You will be asked to report to 801 Market Street 4 days/week next school year. You can still continue — your application will be flagged so our team can talk it through with you. Questions? Email apply@launchpadphilly.org". Trade school does not trigger it. Class of 2028 never sees it.

### Applicants 18+

Age is measured today against the stored date of birth, server-side. For an applicant who is 18 or older:

- Step 1 asks "Who will sign your records release form?" — **My parent or guardian will sign it** (default) / **I will sign it myself**.
- **Parent signs:** unchanged — Guardian 1 required, second guardian optional, parent link generated.
- **Applicant signs (`applications.self_release = true`):** the parent/guardian section becomes an **optional emergency contact** (one contact; if any field is filled all must be); the second-guardian question is hidden. Step 2 becomes the applicant's own **Records Release Form** (same form, same record, rebranded) which they open from Step 2 and sign themselves; the consent text is the first-person `student_release_consent_text`; the signer is stored with relationship "Self (student)" and the PDF/admin views label it as signed by the student.
- Under-18 applicants never see the question and always use a parent.

**Preferred vs. legal name:** communications use preferred name; official forms/documents use legal name.

**Save behavior:** students can save mid-step and return later.

**Completing Step 1 triggers:** automated email (and SMS if opted in) to each guardian with the parent form link, plus a shareable link the student can copy. (For a self-signing 18+ applicant there is no guardian send; Step 2 shows a button to their own form instead.)

## Step 2: Parent / Guardian Form

No parent account. Auto-fills student name, DOB, and high school (read-only), with the note: "See something wrong here? Email apply@launchpadphilly.org and we'll get it fixed, or instruct your student to edit their application." Accessible via automated email/SMS, student-shared link, or admin re-send. Both student and admins can update guardian contact and trigger a resend. Completion marks Step 2 complete.

**Fields:**

- Intro: "Do you want to learn a bit more about Launchpad?" (Yes, please! / No thanks). Yes shows the program info (admin-editable `program_info_foundations`, light markup), currently:
  - **What is Launchpad?** Launchpad is a training program that seeks to connect high schoolers to high paying careers using AI. Students enter the program as 11th, 12th graders or recent HS grads and leave as accomplished young professionals, ready to enter the workforce or take on additional training.
  - **What is the time commitment?** Three phases, each with its own commitment: **Foundations (July 2027 → Aug 2027)** — a six week summer program, sessions 9am-3pm Mon, Tue, Wed, Thur. **101 - School Year (Sept 2027 → May 2028)** — 4 days/week in the afternoon; students who will be seniors must be eligible for Work Release. **101 - Internships (June 2028 → August 2028)** — paid internships with employer partners after earning certifications; schedules vary.
  - **What does my student earn?** $1,320 in Foundations and $4,500 in 101.
  - **What if I have more questions?** Visit launchpadphilly.org or email info@launchpadphilly.org.
- Student info: name, DOB, high school (auto-filled, read-only) + the "see something wrong" note above
- "As far as you know, is your student available to attend Launchpad for 6 weeks this summer (July 6, 2027 to August 12, 2027) at 801 Market St, Philadelphia, PA?" (Yes / No / Not Sure) req. Dates/location are admin-configurable (`summer_dates`, `summer_location`)
- Conditional: No or Not Sure shows textarea "Please share what conflicts/concerns you have with the summer schedule"
- "Does your student have an IEP?" (Yes / No / Prefer not to disclose) — **required** ("Prefer not to disclose" is the opt-out)
- "Anything you want us to know?" opt textarea
- Parent contact: full name (First, Last), relationship (free text), best email, best phone, all req
- Records release consent + required e-signature

**Consent language** (`parent_form_consent_text`, editable; snapshotted onto each submission):

> The Launchpad application requires submission of original transcripts, most recent standardized test scores, attendance information, disciplinary records, IEP, ELL and 504 plan if applicable. Launchpad will need continuous access to this information for the duration of a student's enrollment in the program, including, but not limited to, 12th grade report cards and final high school transcripts. In addition to records, Launchpad staff will conduct interviews and invite applicants to participate in an in person hackathon.
>
> By electronically signing this form, I give my permission for the above information to be released by the above High School to Launchpad at 801 Market St Philadelphia, PA 19107 and grant permission for Launchpad to work with my student throughout the applications process.

**Records Release Form (applicants 18+ signing for themselves):** the same page at the same tokenized link, titled "Records Release Form", worded for the applicant ("Are you available…", "Do you have an IEP?"), without the parent program-info intro, with name/email/phone prefilled from their account, and the first-person `student_release_consent_text` (a DRAFT adapted from the text above — review before launch). The server reads `self_release` from the database; the posted relationship is ignored.

**E-signature:** build natively with a canvas signature pad (signature_pad library). Store signature image + typed name + timestamp + IP with the submission. No third-party e-sign provider.

## Step 3: Short Answer Questions

Separate from Step 1 for funnel tracking. Parallel with Step 2, either order. Intro: "A few short written questions so we can get to know you. You can save your answers and come back anytime."

The questions are **hard-coded** (`STEP3_QUESTIONS` in `src/utils/step3-options.ts`) and mirrored into `essay_prompts` rows automatically (answers are stored against a prompt id; the beta placeholder prompt is deactivated, not deleted). Every answer must be **50 to 250 words**: the 250 ceiling is enforced on save and submit, the 50 floor on submit. A live count shows while typing.

1. What are you planning to do after completing Launchpad? How will Launchpad help you achieve that goal?
2. What's your prior experience with AI, coding, and/or entrepreneurship?
3. What is a problem in your community you'd like to solve with the help of technology?

(The old two 300-500 word prompts and the video-submission option are retired.)

## Step 4: Interview

**Student-facing copy:** "A Launchpad staff member will call you to complete your interview over the phone! Check back here to make sure your interview is marked "complete" once done." Due April 1, 2027.

**Format:** every applicant is interviewed **over the phone** by Launchpad staff. There are no interview tracks (the old Track A at-school / Track B at-Launchpad split and partner-school auto-assignment were retired October 2026), no student self-scheduling, and no slot booking: staff call the applicant and record the outcome.


**Rubric:** 7 criteria, each 0-3 (Unaligned / Minimally / Mostly / Completely Aligned), optional note per criterion:

1. Passion (tech/entrepreneurship as career pathway)
2. Purpose (post-secondary plan aligned with program model)
3. Persistence (goal + persisted through challenge)
4. Collaboration (group work, valuing others' perspectives)
5. Prior Knowledge (exposure to AI/tech/entrepreneurship)
6. External Support (support network; top scores require submitted parent app, so surface Step 2 status to the interviewer)
7. Communication (written + verbal; includes essay rating, so link the student's Step 3 responses)

**Also captured:** Pathway Preference (5-point: Entrepreneurial Leadership Only / Leaning EL / Open to either / Leaning tech / Tech-Coding Only); schedule conflicts; college plans; interview date; interviewer(s); overall notes; committee's agreed final rating. Recording an outcome marks Step 4 complete.

**Partner schools (31):** still flagged in the schools list (`is_partner`) and shown to staff as information only; they no longer drive any interview logic.

## Steps 5 & 6: C2LPHL Application & Required Documents

- Step 5: apply to C2LPHL (external) at **c2lphl.org** and mark Launchpad top choice. **Due March 30, 2027.** Instructions shown to the student: (1) Go to c2lphl.org; (2) Select "Apply" (or "Log In" if you've done C2L before); (3) Search "Launchpad" under the "Program Name" in the C2L-PHL program locator; (4) Select "Add to selection"; (5) Add two additional programs to your selection (but make sure Launchpad is your top choice); (6) Hit "Proceed to Application" and enter your information; (7) Use the same legal name and date of birth you gave us here — the two systems are matched on those, so a mismatch can hold up your application.
- Step 6: upload required docs in the C2L system. Copy adds: "If you do not have access to the required documents, reach out to apply@launchpadphilly.org ASAP so we can support you with enrolling in the program." and "Your name on your social security number must match your full legal name on your Launchpad Application and C2L-PHL application."
- The C2LPHL link is always shown (default https://c2lphl.org; `c2l_application_url` / `c2l_documents_url` can override); the old "we'll post the link" fallback is gone, as is the "C2LPHL sets these deadlines… we'll let you know" line
- Each: student self-reports in portal; staff verify (toggle per step, informed by C2L reports)
- Name + DOB must match across systems for reconciliation
- Mass email blast when C2L applications open
- Automated C2L report ingestion is a stretch goal

## Step 7: Admissions Decision

- Statuses: Offer Extended, Waitlisted, Denied, Withdrew, Acceptance Rescinded, Offer Accepted, Offer Not Accepted, Ineligible
- Decision hidden from student until an admin manually triggers the decision email; email links to portal (decision not in body); after trigger, student sees it in portal
- Before release the step tells the student: "You will receive your admission decision by May 1, 2027." (from the Step 7 deadline setting)

## Step Deadlines (2027-28 cycle)

Stored in `cycle_settings.step_deadlines` and shown on each step:

| Step | Due |
|---|---|
| 1 Student Information | February 15, 2027 |
| 2 Parent / Guardian Form | January 31, 2027 *(placeholder — confirm)* |
| 3 Short Answer Questions | January 31, 2027 *(placeholder — confirm)* |
| 4 Interview | April 1, 2027 |
| 5 C2LPHL Application | March 30, 2027 |
| 6 C2LPHL Required Documents | March 15, 2027 *(placeholder — confirm)* |
| 7 Admissions Decision | May 1, 2027 |

## Embedding in WordPress

The portal can't be pasted into WordPress as content (it is a separate app with logins). Options, in order of preference: (1) **link or button** from the WordPress page to the portal — simplest and fully reliable; (2) point a subdomain such as `apply.launchpadphilly.org` at the Vercel app so it feels first-party; (3) an **iframe** — works for display, but login cookies are third-party inside an iframe and Safari/Chrome increasingly block them, so signing in and saving can silently fail, and the app would need `frame-ancestors` headers allowing the WordPress domain. Use an iframe only for a non-authenticated piece (e.g. a signup call-to-action), never the logged-in portal.

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
| C2LPHL opens | All applicants | When announced | Complete C2L app |
| Decision email | Student | Manually triggered | Link to portal |

## Admin Dashboard

**Access:** super admin (nick@launchpadphilly.org) creates/manages admin accounts; no Google domain SSO (domain accounts shared with students); admin accounts invite-only email/password via Supabase Auth; all other admins uniform access. Full CRUD on student accounts. Admins cannot complete student-owned steps (1, 3).

**Audit trail (who/what/when):** edits to student info (name, phone, email); interview completion and status updates; any admissions decision (recording, changing, triggering email).

**Applicant table:** filter/sort by school, step/status, etc.; inline editing (e.g., bulk counselor sign-off by school); on-demand CSV export.

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
- Create apply@launchpadphilly.org mailbox (now the public contact address on every step)
- Review the draft first-person records-release consent (`student_release_consent_text`) before launch
- Confirm deadlines for Steps 2, 3, and 6 (still placeholders; Steps 2-3 currently fall before Step 1's Feb 15 due date)
- Confirm step dependency map (proposed: Step 1 unlocks 2-6; 2-6 parallel; 7 admin-only)
- Decision email trigger UX (per-student, bulk, or both)
- Edit-after-submit status behavior
- Whether editing guardian info auto re-triggers the parent email
- Consent language review before launch

## 2027-28 changes (October 6, 2026)

Foundations-only; 22-or-younger age rule at signup; notifications default to both; verification-link confirm page; portal hero banner and "2027-28 cohort" copy; Step 1 due Feb 15 and all-questions contact apply@launchpadphilly.org; GPA 0-8; Lightspeed language and career-interest question removed; pathway cards; trade school option and 4-year-in-Philly college flag with new heads-up copy; "Did either of your parents…"; applicants 18+ can sign their own records release (optional emergency contact); parent form content breakdown, "see something wrong" note, July 6 to August 12 2027 dates, required IEP, new consent language; hard-coded Step 3 questions (50-250 words); Step 4 due Apr 1 with staff-reaches-out copy; C2LPHL due Mar 30 with c2lphl.org and new instructions; Step 6 document-access and legal-name copy; decision due May 1.
