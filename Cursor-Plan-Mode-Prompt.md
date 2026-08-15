You are in Plan Mode. Do not write or edit any code yet. Your job right now is to produce a complete, actionable implementation plan.

I've attached `RLE-Quotation-App-Build-Plan.md` — a full product/technical spec for a quotation-management web app for RAISE Lab Equipment. Read it fully before responding.

## What I need you to build (summary)
A Next.js + Supabase (Postgres, Auth, Storage, Edge Functions) app, deployed on Vercel, installable as a PWA on mobile. Three roles (Salesperson, Admin, Super Admin) with strict row-level scoping — salespeople only ever see their own quotations, only Super Admin sees company-wide data. Super Admin creates products (with pricing, specs, features, a single image placed either center or right-aligned), categories, dealers, and user accounts. Any role can create reusable add-ons (checkbox or radio/included-not-included type). Quotations combine multiple products, dealer linkage (optional), currency selection (INR or USD with a locked FX rate), add-ons, and generate a pixel-accurate PDF matching our existing letterhead. Quotations have an auto-incrementing number set by Super Admin, and edits create versioned sub-numbers (RLE-300 → RLE-300-1). Status tracking (Submitted/Processing/Ongoing/Sale Completed/Sale Cancelled) plus follow-up-date reminders sent via Zoho Mail API.

Full schema, RLS rules, page flows, and phase breakdown are already specified in the attached file — treat that as the source of truth, not a starting point to redesign.

## What I want from you in this planning pass

1. **Confirm you've parsed the spec correctly.** Summarize back, in your own words, the 3 roles and what each can/cannot do, and the quotation versioning logic — so I can catch any misreading before code gets written.

2. **Propose the concrete project structure**: folder layout (Next.js app router vs pages router — pick one and justify it), where Supabase client/server logic lives, how server-side PDF generation is isolated, where Edge Functions live, how the PWA manifest/service worker fits in.

3. **Turn the "Build Sequence" (Phase 1–6) in the spec into a granular task list** — break each phase into individual, checkable implementation steps (e.g. Phase 1 → "create Supabase project," "write schema.sql from spec §2," "write RLS policies," "seed super_admin row," "scaffold Next.js + Tailwind," "wire Supabase Auth + middleware route guards," etc.). I want something I can execute step by step and check off.

4. **Flag any technical decisions the spec leaves open**, and give me your recommendation for each rather than leaving it ambiguous — for example:
   - Exact library for server-side HTML→PDF rendering on Vercel (Puppeteer-core + @sparticuz/chromium vs. an alternative), given Vercel serverless function constraints (cold starts, execution time limits, bundle size)
   - Whether the atomic quotation-number increment should be a Postgres function/trigger or handled via a `select for update` pattern
   - State management approach for the multi-product quotation builder form (React Hook Form, Zustand, or plain state — pick based on the form's complexity)
   - How to structure the FX-rate fetch so it fails gracefully if the free currency API is down (fallback behavior for a live quotation in progress)

5. **Call out risks or gaps** in the spec that could cause rework later — anything underspecified about RLS edge cases, image storage/CDN handling, PDF template fidelity, or the versioning/edit flow that you think needs a decision before Phase 3 starts.

6. **List exactly what you still need from me** before implementation can begin (I already know I owe the team the letterhead .docx, logo file, and layout reference images for Phase 4 — tell me if anything else is missing for Phases 1–3 and 5–6 to start immediately).

Do not start implementing. Output the plan as a structured document with clear phase/task breakdown so I can review and approve it before you write any code.
