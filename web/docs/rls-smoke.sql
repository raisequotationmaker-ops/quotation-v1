-- RLS smoke checks (run in SQL editor as postgres / service role)
-- Replace UUIDs with two real salesperson profile ids after seeding.

-- 1) Confirm helper
select public.auth_role(); -- null outside request context

-- 2) As salesperson A (set request.jwt.claim.sub via tests in app, or use
--    two browser sessions): salesperson A must only SELECT own quotations.
--    App-level check is preferred: sign in as A, open B's quotation URL → empty/404.

-- 3) Super admin can select all
-- select count(*) from quotations; -- while authenticated as super_admin

-- 4) Products writable only by super_admin (expect failure for salesperson):
-- insert into products (name, base_price, dealer_price, selling_price)
-- values ('RLS Test', 1, 1, 1);

-- 5) Categories writable by admin:
-- insert into categories (name) values ('RLS Cat ' || gen_random_uuid()::text);

select 'See docs/QA-CHECKLIST.md for browser-based RLS verification.' as note;
