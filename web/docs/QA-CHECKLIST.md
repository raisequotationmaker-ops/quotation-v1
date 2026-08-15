# QA checklist — Phase 6

## Auth & roles
- [ ] Salesperson A cannot open `/quotations/{id}` owned by Salesperson B (404/empty via RLS)
- [ ] Salesperson redirected from `/products`, `/dealers`, `/users`, `/settings/sequence`
- [ ] Admin can create categories; cannot create products
- [ ] Super Admin sees company-wide quotation list + dashboard monthly INR total
- [ ] Inactive user cannot sign in (`is_active = false`)

## Quotations
- [ ] Create quote → number is `RLE-{n}` and sequence increments
- [ ] Edit quote → new row `RLE-{n}-1` with preserved `created_by`
- [ ] USD quote locks FX; reopen does not re-fetch rate
- [ ] USD save blocked without rate; manual rate works when `/api/fx` fails
- [ ] Dealer sale requires dealer selection
- [ ] Status changes persist; version thread lists all versions

## PDF
- [ ] Download matches letterhead (C-6 address, logo, border, page x of y)
- [ ] Center vs right image layout respects override
- [ ] Second download serves Storage copy (`pdf_storage_path` set)
- [ ] Visual compare vs `RLE-295_Quotation.pdf` and `RLE - 193.3.pdf`

## PWA / mobile
- [ ] Manifest + icons load; Add to Home Screen on Android Chrome
- [ ] iOS Safari Add to Home Screen uses apple web app metadata
- [ ] Nav scrolls horizontally on narrow screens; forms usable on phone

## Reminders
- [ ] Edge Function dry-run with `follow_up_date = today` sends Zoho mail (requires secrets)
- [ ] `reminder_sent` flips to true after send
