# RLE Quotation Maker

Next.js (App Router) + Supabase quotation app for RAISE Lab Equipment.

## Prerequisites

1. Create a **new** Supabase project (do not reuse unrelated projects).
2. Node.js 20+.
3. Chrome/Chromium installed locally for PDF generation in development.

## Setup

```bash
cd web
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install
```

### Database

In the Supabase SQL Editor, run in order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_storage.sql`

Then:

1. Authentication → Users → Add user (email/password) for Super Admin.
2. Insert a `profiles` row with `role = 'super_admin'` (see `supabase/seed_super_admin.sql`).
3. Confirm `sequence_settings.next_number` (default `300`).

### Run locally

```bash
npm run dev
```

Open http://localhost:3000 — you will be redirected to `/login`.

Optional for local PDF:

```
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

### Deploy (Vercel)

- Import the `web` folder as the project root.
- Set the same env vars.
- PDF uses `@sparticuz/chromium` on Vercel Node runtimes.

### Follow-up emails (Phase 5)

```bash
supabase functions deploy send-followup-reminders --project-ref <ref>
supabase secrets set ZOHO_CLIENT_ID=... ZOHO_CLIENT_SECRET=... ZOHO_REFRESH_TOKEN=... ZOHO_FROM_ADDRESS=... ZOHO_ACCOUNT_ID=... APP_URL=https://your-app.vercel.app CRON_SECRET=...
```

Schedule the function daily in the Supabase dashboard (Authorization: `Bearer <CRON_SECRET>`).

## Roles

| Role | Scope |
|------|--------|
| Salesperson | Own quotations + add-ons |
| Admin | Own quotations + categories + add-ons |
| Super Admin | Company-wide + products, dealers, users, sequence |

## FX

USD quotes lock an **INR-per-USD** rate (`fx_rate_used`). Display: `USD = INR / rate`. Manual rate allowed if Frankfurter is down.
