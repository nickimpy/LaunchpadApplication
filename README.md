# Launchpad Application Portal

Admissions portal for Launchpad Philly (a Building 21 program). Students apply
through a 7-step process; staff manage the pipeline through an admin dashboard.
See `PRD.md` for the product spec and `BUILD_PLAN.md` for the build sequence.

## Stack

Next.js (App Router, TypeScript, Tailwind) on Vercel · Supabase (Postgres,
Auth, Storage) · Resend (email) · Twilio (SMS)

## Local development

```bash
cp .env.example .env.local   # fill in from Supabase dashboard (Settings > API)
npm install
npm run dev
```

## Database

Schema and seed data live in `supabase/migrations/`. Apply them in filename
order via the Supabase SQL editor, or with psql:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260610000000_initial_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/20260610000001_seed.sql
```

The seed is idempotent (safe to re-run). The schools list is generated from
`school-dropdown-options.json` — edit schools in the database (or that file +
regenerate), never by hand in two places.
