# RAISE Lab Equipment — Quotation Maker App
## Full Technical Build Plan (Cursor-ready)

**Stack:** Supabase (Postgres + Auth + Storage + Edge Functions) + Next.js on Vercel + PWA
**Scale assumption:** ~5–6 internal users, low-to-moderate quotation volume. Schema is intentionally simple, not over-engineered.

---

## 1. Roles & Permissions

| Capability | Salesperson | Admin | Super Admin |
|---|---|---|---|
| Create/edit/download own quotations | ✅ | ✅ | ✅ |
| View own quotations only | ✅ | ✅ | — |
| View **company-wide** quotations/dashboard | ❌ | ❌ | ✅ |
| Create products (name, pricing, specs, image) | ❌ | ❌ | ✅ |
| Create product categories | ❌ | ✅ (on the fly) | ✅ |
| Create reusable add-ons (installation, IQ/OQ, etc.) | ✅ | ✅ | ✅ |
| Register dealers | ❌ | ❌ | ✅ |
| Create user profiles (salesperson/admin accounts) | ❌ | ❌ | ✅ |
| Reset own password | ✅ | ✅ | ✅ |
| Reset **another user's** password | ❌ | ❌ | ✅ |
| Set quotation number starting sequence | ❌ | ❌ | ✅ |
| See dealer/base/dealer/selling price on products | ✅ (view only) | ✅ (view only) | ✅ (view + edit) |

Key point confirmed: **Base price, Dealer price, Selling price are visible to everyone**, but only Super Admin can set/edit them at product-creation time. Salesperson picks which price tier to quote at, per line item, when building a quotation.

**Auth:** Supabase Auth, email + password. No self-serve signup — accounts only created by Super Admin. Password reset: self-service "change password" while logged in, OR Super Admin resets from the admin panel and shares the temp password directly (no forgot-password email flow needed for a 5-person tool — simpler and one less thing to break).

---

## 2. Database Schema (Postgres / Supabase)

```sql
-- USERS (extends Supabase auth.users via profile table)
profiles (
  id uuid primary key references auth.users(id),
  full_name text,
  role text check (role in ('salesperson','admin','super_admin')),
  phone text,
  created_at timestamptz default now(),
  is_active boolean default true
)

-- PRODUCT CATEGORIES
categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)

-- PRODUCTS
products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model_no text,
  category_id uuid references categories(id),
  description text,
  features text[],           -- bullet list
  specifications jsonb,       -- key-value pairs e.g. {"Display":"20x4 LCD", "Power":"230V AC"}
  base_price numeric not null,      -- stored INR only
  dealer_price numeric not null,
  selling_price numeric not null,
  image_url text,
  image_layout text check (image_layout in ('center','right')) default 'right',
  created_by uuid references profiles(id),  -- always super_admin
  created_at timestamptz default now(),
  is_active boolean default true
)

-- REUSABLE ADD-ONS (installation, IQ/OQ, freight, etc.)
addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- e.g. "Installation & Qualification"
  type text check (type in ('checkbox','radio')) not null,
  -- for radio type, options are stored as a pair, e.g. "Included" / "Not Included"
  options jsonb,                    -- null for checkbox; ["Included","Not Included"] for radio
  default_price numeric,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)

-- DEALERS (registered only by Super Admin)
dealers (
  id uuid primary key default gen_random_uuid(),
  dealer_reg_no text unique not null,
  dealer_name text not null,
  company_name text,
  gst_no text,
  address text,
  contact_person text,
  phone text,
  email text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)

-- QUOTATIONS
quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text unique not null,   -- e.g. RLE-300 or RLE-300-1 for edits
  parent_quotation_id uuid references quotations(id), -- null if original, else points to root
  version int default 0,                   -- 0 = original, 1,2,3... = edits
  status text check (status in ('submitted','processing','ongoing','sale_completed','sale_cancelled')) default 'submitted',
  currency text check (currency in ('INR','USD')) default 'INR',
  fx_rate_used numeric,           -- locked at creation time if USD
  client_name text,
  client_company text,
  is_dealer_sale boolean default false,
  dealer_id uuid references dealers(id),   -- required if is_dealer_sale = true
  created_by uuid references profiles(id), -- the salesperson (or admin) who owns this quote
  follow_up_date date,
  reminder_sent boolean default false,
  total_amount numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

-- LINE ITEMS (products included in a quotation, each with its own image side choice)
quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references quotations(id) on delete cascade,
  product_id uuid references products(id),
  price_tier text check (price_tier in ('base','dealer','selling')),  -- which price used
  unit_price numeric,          -- snapshot at time of quoting (don't rely on live product price)
  quantity int default 1,
  image_layout_override text check (image_layout_override in ('center','right')), -- per-quote override if needed
  sort_order int
)

-- ADD-ONS ATTACHED TO A QUOTATION
quotation_addons (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references quotations(id) on delete cascade,
  addon_id uuid references addons(id),
  selected_option text,        -- for radio type: "Included"/"Not Included"; for checkbox: "checked"
  price numeric
)
```

**Row Level Security (RLS):** enforce at DB level, not just app level — critical for the "salesperson sees only their own" rule:
- `quotations`: salesperson/admin can `SELECT`/`UPDATE` only rows where `created_by = auth.uid()`. Super admin has an RLS bypass policy (`role = 'super_admin'`).
- `products`, `categories`, `dealers`: readable by everyone, writable only by super_admin (categories writable by admin+super_admin).
- `addons`: readable/writable by all three roles.

---

## 3. Quotation Numbering & Versioning

- Super Admin sets the starting string once, e.g. `RLE-300`. Store this as a single row in a `sequence_settings` table with a `next_number` integer counter (`300`).
- New quotation → Postgres function atomically does `next_number += 1`, returns `RLE-<n>`. Use a DB function/trigger (not app-side increment) to avoid race conditions if two salespeople hit "create" simultaneously.
- Edit an existing quotation → new row created with `parent_quotation_id` pointing to the root, `version` incremented, `quotation_number` = `RLE-300-1`, then `RLE-300-2`, etc.
- The original and every version stay in the DB — nothing is overwritten. Dashboard groups by root quotation and shows version history as a thread; PDF download always reflects the specific version opened.

---

## 4. Product Creation Flow (Super Admin only)

1. **Basic Info:** Name, Model No., Category (dropdown + "add new" inline), Description
2. **Pricing:** Base price, Dealer price, Selling price — INR only, USD auto-derived at quote time
3. **Specifications:** dynamic key-value rows (like the "Display / Operation / Parameter / Power" table in your RLE-193 sample)
4. **Features:** bullet-point list, add/remove rows
5. **Media:** single image upload → Super Admin picks **Center** or **Right-aligned** layout manually (no auto-detection — you were right to make this a manual call, aspect-ratio heuristics are unreliable and this matches how your two sample quotes are actually laid out)
6. **Save** → product becomes available for salespeople to add to quotations

---

## 5. Quotation Creation Flow (Salesperson/Admin/Super Admin)

1. **Header:** Client name, company, currency (INR/USD toggle) — if USD, fetch live rate and lock it (`fx_rate_used`) into the quotation record immediately, so reopening the quote later never silently changes the number
2. **Dealer sale?** toggle — if yes, search/select an existing dealer by reg number (registered dealers only; no ad-hoc dealer creation here, that stays Super-Admin-only)
3. **Add Products:** search/select from product catalog, pick price tier (base/dealer/selling) per line item, set quantity, choose image layout (defaults to product's saved layout, but overridable per quote — since you said each product's image placement is decided per quote too)
4. **Add-ons:** checklist at bottom of the form — checkboxes for multi-select add-ons (e.g. IQ/OQ documents), radio buttons for included/not-included toggles (e.g. Freight: To Pay / Extra). Reusable list, salesperson or admin can create new add-ons here too.
5. **Follow-up reminder:** optional date picker — triggers the notification/email flow (see §8)
6. **Save/Generate PDF** → status defaults to "Submitted"

---

## 6. PDF Generation

- **Server-side rendering**, not client print-to-PDF (browser print dialogs render inconsistently across devices — bad for a document going to a customer).
- Approach: build the PDF template as an HTML/CSS layout matching your letterhead exactly (border, header, footer, logo position), then render to PDF server-side via a Vercel serverless function using a headless-Chromium-based renderer (Puppeteer/Playwright on a Node function, or a service like `react-pdf` if the layout is simple enough — given your letterhead has a bordered frame + fixed header/footer per page, headless-Chromium HTML→PDF will get you pixel-fidelity faster than react-pdf's box model).
- **Logo background removal:** once you send the letterhead .docx, I'll extract the logo image and clean the background (transparent PNG) so it doesn't show a white/colored box behind it in the PDF — this is a one-time asset prep step, not a runtime operation.
- On "Download," the PDF is generated and streamed to the browser for download **and** the raw PDF (or the HTML snapshot + a stored render) is saved to Supabase Storage against that quotation version, so historical quotes remain retrievable exactly as sent even if the template changes later.

---

## 7. Currency Conversion

- Free tier API (e.g. `exchangerate-api.com` or `frankfurter.app` — both work fine for low-volume internal use, no key hassle with Frankfurter).
- Fetched **once, at quotation creation/generation time**, and the rate is stored in `quotations.fx_rate_used`. Reopening or downloading later re-uses the stored rate — it does not re-fetch, so the customer-facing number never drifts.
- All product prices are stored in INR in the DB; USD is a derived display value only, computed as `inr_price * fx_rate_used` when currency = 'USD'.

---

## 8. Status Tracking & Notifications

**Status field on each quotation:** `Submitted → Processing → Ongoing → Sale Completed / Sale Cancelled` — settable by the quotation's owner (salesperson) or Super Admin.

**Follow-up reminders:**
- Salesperson sets a follow-up date when creating/editing a quote.
- A scheduled Supabase Edge Function (cron, e.g. daily) checks for quotations with `follow_up_date = today` and `reminder_sent = false`.
- Sends a notification via **email** — Zoho Mail API integration works well here since you already have it; the Edge Function calls Zoho's send-mail endpoint with the quotation number and a link back into the app.
- In-app notification badge as a lighter-weight companion to email (optional, easy add via a `notifications` table + realtime subscription — Supabase Realtime makes this close to free to add).

I'd recommend starting with email-only reminders (simpler, Zoho's already in your toolkit) and adding in-app push later if it's actually needed once people are using it daily.

---

## 9. Super Admin Dashboard

- **Company-wide quotation list**, filterable by: salesperson, status, date range, dealer vs. direct sale, currency
- Summary tiles: total quotations this month, by status, total quoted value (INR)
- Product management (create/edit/deactivate)
- Category management
- Add-on management
- Dealer registry (add/edit dealers)
- User management: create profiles, assign roles, reset passwords, deactivate accounts
- Quotation numbering sequence control

**Salesperson/Admin dashboard:** same shell, scoped by RLS to their own quotations only — no company-wide toggle visible to them at all (not just hidden in UI, actually inaccessible at the DB layer).

---

## 10. Mobile Access

Confirmed: **PWA**, not a native app. Next.js + a proper `manifest.json` + service worker gets you "Add to Home Screen" on both iOS Safari and Android Chrome, installable icon, full-screen app-like experience, no App Store/Play Store submission overhead. This is the right call for a 5–6 person internal tool — native would be weeks of extra work for zero real benefit here.

---

## 11. Build Sequence (for Cursor)

**Phase 1 — Foundation**
1. Supabase project: schema above, RLS policies, seed Super Admin account manually
2. Next.js app scaffold on Vercel, Supabase Auth integration, role-based route guards
3. Basic layout shell + PWA manifest/service worker

**Phase 2 — Admin Core**
4. Product CRUD (Super Admin) incl. image upload to Supabase Storage
5. Category management
6. Dealer registry
7. User management (create profiles, reset passwords)
8. Add-on management

**Phase 3 — Quotation Engine**
9. Quotation creation form (multi-product, add-ons, dealer linkage, currency)
10. Quotation numbering function (atomic increment) + versioning/edit logic
11. Dashboard views (scoped for salesperson/admin vs. super admin)
12. Status tracking UI

**Phase 4 — PDF & Letterhead**
13. Rebuild letterhead as HTML/CSS template (pixel match) — **needs your .docx**
14. Logo background cleanup — **needs your logo asset**
15. Server-side PDF render function, wired to "Download" + Storage save

**Phase 5 — Currency & Notifications**
16. FX rate fetch + lock-in logic
17. Zoho Mail API integration for follow-up reminders
18. Scheduled Edge Function for reminder checks

**Phase 6 — Polish**
19. Mobile responsive pass / PWA install testing on iOS + Android
20. Final QA against your two sample quotations (RLE-295, RLE-193) as visual regression baseline

---

## Still needed from you before Phase 4 can start
- The original letterhead **.docx** file
- The logo file (so I can clean the background — send the highest-res version you have, PNG or the original AI/EPS if available)
- The reference images you mentioned for vertical vs. horizontal image layout examples (helps confirm the exact spacing/margins Cursor should replicate)

Everything else above is buildable starting now.
