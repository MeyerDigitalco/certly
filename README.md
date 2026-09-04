# Certly

Multi-tenant HR compliance portal for South African businesses.
Next.js 16 (App Router) + Supabase + Tailwind.

## Getting running from this zip

1. Extract this folder to `C:\src\certly`.
2. Install the toolchain if the machine is fresh (elevated PowerShell):
   ```powershell
   winget install -e --id OpenJS.NodeJS.LTS
   winget install -e --id Git.Git
   ```
   Open a new terminal, then confirm: `node -v` (needs 20.9+), `npm -v`.
3. Install dependencies:
   ```powershell
   cd C:\src\certly
   npm install
   ```
4. Create `.env.local` (copy `.env.example`) and fill in the values from your
   Supabase project under Project Settings -> API:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   Your database and its data still live in Supabase (the cloud), so once these
   keys are in, the app reconnects to the same schema and rows as before.
5. If this is a brand new Supabase project, apply the schema in
   `supabase/migrations/0001_certly_schema.sql` (Supabase SQL editor, or the
   Supabase CLI). Skip this if the project already has the tables.
6. Run it:
   ```powershell
   npm run dev
   ```
   Open http://localhost:3000 , create a workspace at `/signup`, and you land
   in `/{your-slug}/hr`.

## What is in here

- `supabase/migrations/0001_certly_schema.sql` — full multi-tenant schema
  (organisations, org_members, employees, training_types, certifications,
  extraction_drafts, audit_log), RLS on every table, storage bucket, and the
  `provision_organisation` sign-up RPC.
- Auth (password only): `/login`, `/signup`, `/set-password`, `/logout`,
  session refresh in `src/proxy.ts`.
- Tenant routing: `src/lib/tenant.ts` (`requireTenant`, `requireRole`); pages
  live under `src/app/[org]/hr/...`.
- Phase 2 so far: employees CRUD (`/[org]/hr/employees`) and the register
  dashboard (`/[org]/hr`) with KPI cards, filters, and URL-driven sort. Data
  layer in `src/lib/hr/queries.ts` and `src/lib/hr/mutations.ts`.

## Reconstructed vs restored

This project was rebuilt after the original working copy was lost. These files
were restored exactly as they were this session: the schema, all of `src/lib`
(except `supabase/middleware.ts`), the `[org]` settings and Phase 2 slices,
`globals.css`, and the config files.

These files were re-authored from the schema and the app's conventions, so give
them a closer look and adjust anything that differed from your original: the
auth flow (`login`, `signup`, `set-password`, `logout`), `src/proxy.ts`,
`src/lib/supabase/middleware.ts`, and the landing page (`src/app/page.tsx`).

Still to build (Phase 2 remainder): employee detail + certification CRUD with
file attachments, renewals view, per-site dashboard, and the training-types
manager in settings.

Verified: `tsc --noEmit` and `next build` both pass clean.
