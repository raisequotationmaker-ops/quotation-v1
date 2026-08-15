-- Run AFTER creating the Super Admin Auth user in Supabase Dashboard
-- (Authentication → Users → Add user), then replace the UUID and details below.

-- Example:
-- insert into public.profiles (id, full_name, role, phone, is_active)
-- values (
--   '00000000-0000-0000-0000-000000000000',
--   'Super Admin',
--   'super_admin',
--   '9177770516',
--   true
-- );

-- Optional: set starting quotation number (must be > any existing root)
-- select public.set_sequence_next_number(300);
