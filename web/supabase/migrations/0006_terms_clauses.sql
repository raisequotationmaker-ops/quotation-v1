-- Individual reusable terms clauses (checkboxable on each quotation)

create table public.terms_clauses (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index terms_clauses_active_sort_idx
  on public.terms_clauses (is_active, sort_order);

-- Seed from the existing singleton template (one row per line)
insert into public.terms_clauses (body, sort_order)
select trim(s.line), s.ord
from (
  select
    unnest(string_to_array(t.body, E'\n')) as line,
    generate_subscripts(string_to_array(t.body, E'\n'), 1) as ord
  from public.terms_templates t
  where t.id = 1
) s
where trim(s.line) <> '';

-- Fallback seed if the template was empty
insert into public.terms_clauses (body, sort_order)
select v.body, v.sort_order
from (
  values
    ('Taxes: 18% GST extra applicable', 1),
    ('Packaging & Forwarding: Extra As Applicable', 2),
    ('Freight: To Pay / Extra as applicable', 3),
    ('DELIVERY: We deliver the order in 3-4 Weeks from the date of receipt of purchase order', 4),
    ('INSTALLATION: Fees extra as applicable', 5),
    ('PAYMENT: 100% payment at the time of proforma invoice prior to dispatch.', 6),
    ('WARRANTY: One year warranty from the date of dispatch', 7),
    ('GOVERNING LAW: These Terms and Conditions and any action related hereto shall be governed, controlled, interpreted and defined by and under the laws of the State of Telangana', 8),
    ('MODIFICATION: Any modification of these Terms and Conditions shall be valid only if it is in writing and signed by the authorized representatives of both Supplier and Customer.', 9)
) as v(body, sort_order)
where not exists (select 1 from public.terms_clauses);

alter table public.terms_clauses enable row level security;

create policy terms_clauses_select on public.terms_clauses
  for select to authenticated
  using (is_active = true or public.is_admin_or_above());

create policy terms_clauses_insert on public.terms_clauses
  for insert to authenticated
  with check (created_by = auth.uid());

create policy terms_clauses_update on public.terms_clauses
  for update to authenticated
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());
