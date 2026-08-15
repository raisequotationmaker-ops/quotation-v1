-- RLE Quotation Maker — initial schema, RLS, RPCs
-- Apply to a DEDICATED Supabase project (do not use unrelated existing projects).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('salesperson', 'admin', 'super_admin')),
  phone text,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table public.sequence_settings (
  id int primary key default 1 check (id = 1),
  prefix text not null default 'RLE',
  next_number int not null default 300,
  updated_at timestamptz not null default now()
);

insert into public.sequence_settings (id, prefix, next_number)
values (1, 'RLE', 300)
on conflict (id) do nothing;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model_no text,
  category_id uuid references public.categories(id),
  description text,
  features text[] not null default '{}',
  specifications jsonb not null default '{}'::jsonb,
  standard_accessories text[] not null default '{}',
  base_price numeric not null,
  dealer_price numeric not null,
  selling_price numeric not null,
  image_url text,
  image_layout text not null default 'right' check (image_layout in ('center', 'right')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table public.addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('checkbox', 'radio')),
  options jsonb,
  default_price numeric,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.dealers (
  id uuid primary key default gen_random_uuid(),
  dealer_reg_no text unique not null,
  dealer_name text not null,
  company_name text,
  gst_no text,
  address text,
  contact_person text,
  phone text,
  email text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text unique not null,
  parent_quotation_id uuid references public.quotations(id),
  version int not null default 0,
  status text not null default 'submitted'
    check (status in ('submitted', 'processing', 'ongoing', 'sale_completed', 'sale_cancelled')),
  currency text not null default 'INR' check (currency in ('INR', 'USD')),
  fx_rate_used numeric,
  client_name text,
  client_company text,
  is_dealer_sale boolean not null default false,
  dealer_id uuid references public.dealers(id),
  created_by uuid not null references public.profiles(id),
  follow_up_date date,
  reminder_sent boolean not null default false,
  validity_date date,
  terms_snapshot text,
  prepared_by_name text,
  prepared_by_phone text,
  total_amount numeric,
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid references public.products(id),
  price_tier text not null check (price_tier in ('base', 'dealer', 'selling')),
  unit_price numeric not null,
  quantity int not null default 1,
  image_layout_override text check (image_layout_override in ('center', 'right')),
  sort_order int not null default 0,
  product_name text,
  model_no text,
  description text,
  features text[] default '{}',
  specifications jsonb default '{}'::jsonb,
  image_url text,
  standard_accessories text[] default '{}'
);

create table public.quotation_addons (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  addon_id uuid references public.addons(id),
  selected_option text,
  price numeric,
  addon_name text
);

create table public.terms_templates (
  id int primary key default 1 check (id = 1),
  body text not null,
  updated_at timestamptz not null default now()
);

insert into public.terms_templates (id, body) values (
  1,
  E'Taxes: 18% GST extra applicable\nPackaging & Forwarding: Extra As Applicable\nFreight: To Pay / Extra as applicable\nDELIVERY: We deliver the order in 3-4 Weeks from the date of receipt of purchase order\nINSTALLATION: Fees extra as applicable\nPAYMENT: 100% payment at the time of proforma invoice prior to dispatch.\nWARRANTY: One year warranty from the date of dispatch\nGOVERNING LAW: These Terms and Conditions and any action related hereto shall be governed, controlled, interpreted and defined by and under the laws of the State of Telangana\nMODIFICATION: Any modification of these Terms and Conditions shall be valid only if it is in writing and signed by the authorized representatives of both Supplier and Customer.'
) on conflict (id) do nothing;

create index quotations_created_by_idx on public.quotations (created_by);
create index quotations_parent_idx on public.quotations (parent_quotation_id);
create index quotations_follow_up_idx on public.quotations (follow_up_date) where reminder_sent = false;
create index quotations_status_idx on public.quotations (status);
create index quotation_items_quotation_idx on public.quotation_items (quotation_id);
create index quotation_addons_quotation_idx on public.quotation_addons (quotation_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true and role = 'super_admin'
  );
$$;

create or replace function public.is_admin_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger quotations_updated_at
before update on public.quotations
for each row execute function public.set_updated_at();

-- Auto-create profile stub is NOT used; Super Admin creates profiles explicitly.
-- Keep a safeguard: if a profile is missing, deny access via RLS.

-- ---------------------------------------------------------------------------
-- RPCs: numbering + versioning
-- ---------------------------------------------------------------------------

create or replace function public.allocate_quotation_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_num int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select prefix, next_number
    into v_prefix, v_num
  from public.sequence_settings
  where id = 1
  for update;

  if not found then
    raise exception 'sequence_settings row missing';
  end if;

  update public.sequence_settings
  set next_number = v_num + 1, updated_at = now()
  where id = 1;

  return v_prefix || '-' || v_num::text;
end;
$$;

create or replace function public.create_quotation_version(p_source_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.quotations%rowtype;
  v_root_id uuid;
  v_root_number text;
  v_next_version int;
  v_new_id uuid;
  v_new_number text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_source from public.quotations where id = p_source_id;
  if not found then
    raise exception 'Quotation not found';
  end if;

  if not public.is_super_admin() and v_source.created_by <> auth.uid() then
    raise exception 'Not allowed to version this quotation';
  end if;

  v_root_id := coalesce(v_source.parent_quotation_id, v_source.id);

  select quotation_number into v_root_number
  from public.quotations where id = v_root_id;

  -- Lock root row to serialize version allocation
  perform 1 from public.quotations where id = v_root_id for update;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.quotations
  where id = v_root_id or parent_quotation_id = v_root_id;

  v_new_number := v_root_number || '-' || v_next_version::text;
  v_new_id := gen_random_uuid();

  insert into public.quotations (
    id, quotation_number, parent_quotation_id, version, status, currency, fx_rate_used,
    client_name, client_company, is_dealer_sale, dealer_id, created_by,
    follow_up_date, reminder_sent, validity_date, terms_snapshot,
    prepared_by_name, prepared_by_phone, total_amount
  ) values (
    v_new_id, v_new_number, v_root_id, v_next_version, 'submitted',
    v_source.currency, v_source.fx_rate_used,
    v_source.client_name, v_source.client_company, v_source.is_dealer_sale, v_source.dealer_id,
    v_source.created_by, -- preserve original owner
    v_source.follow_up_date, false, v_source.validity_date, v_source.terms_snapshot,
    v_source.prepared_by_name, v_source.prepared_by_phone, v_source.total_amount
  );

  insert into public.quotation_items (
    quotation_id, product_id, price_tier, unit_price, quantity, image_layout_override,
    sort_order, product_name, model_no, description, features, specifications,
    image_url, standard_accessories
  )
  select
    v_new_id, product_id, price_tier, unit_price, quantity, image_layout_override,
    sort_order, product_name, model_no, description, features, specifications,
    image_url, standard_accessories
  from public.quotation_items where quotation_id = p_source_id;

  insert into public.quotation_addons (
    quotation_id, addon_id, selected_option, price, addon_name
  )
  select v_new_id, addon_id, selected_option, price, addon_name
  from public.quotation_addons where quotation_id = p_source_id;

  return v_new_id;
end;
$$;

create or replace function public.set_sequence_next_number(p_next int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_prefix text;
begin
  if not public.is_super_admin() then
    raise exception 'Only super_admin can change sequence';
  end if;
  if p_next < 1 then
    raise exception 'next_number must be >= 1';
  end if;

  select prefix into v_prefix from public.sequence_settings where id = 1;

  select coalesce(max(
    nullif(regexp_replace(quotation_number, '^' || v_prefix || '-([0-9]+).*$', '\1'), '')::int
  ), 0)
  into v_max
  from public.quotations
  where parent_quotation_id is null
    and quotation_number ~ ('^' || v_prefix || '-[0-9]+$');

  if p_next <= v_max then
    raise exception 'next_number must be greater than highest existing root number (%)', v_max;
  end if;

  update public.sequence_settings
  set next_number = p_next, updated_at = now()
  where id = 1;
end;
$$;

grant execute on function public.allocate_quotation_number() to authenticated;
grant execute on function public.create_quotation_version(uuid) to authenticated;
grant execute on function public.set_sequence_next_number(int) to authenticated;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_admin_or_above() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.sequence_settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.addons enable row level security;
alter table public.dealers enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_addons enable row level security;
alter table public.terms_templates enable row level security;

-- profiles
create policy profiles_select_own_or_sa on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_sa_all on public.profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- sequence_settings
create policy sequence_select_auth on public.sequence_settings
  for select to authenticated using (true);

create policy sequence_sa_update on public.sequence_settings
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- categories
create policy categories_select on public.categories
  for select to authenticated using (true);

create policy categories_insert_admin on public.categories
  for insert to authenticated
  with check (public.is_admin_or_above());

create policy categories_update_admin on public.categories
  for update to authenticated
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

create policy categories_delete_sa on public.categories
  for delete to authenticated
  using (public.is_super_admin());

-- products
create policy products_select on public.products
  for select to authenticated using (true);

create policy products_write_sa on public.products
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- addons
create policy addons_select on public.addons
  for select to authenticated using (true);

create policy addons_write on public.addons
  for all to authenticated
  using (public.auth_role() in ('salesperson', 'admin', 'super_admin'))
  with check (public.auth_role() in ('salesperson', 'admin', 'super_admin'));

-- dealers
create policy dealers_select on public.dealers
  for select to authenticated using (true);

create policy dealers_write_sa on public.dealers
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- quotations
create policy quotations_select on public.quotations
  for select to authenticated
  using (created_by = auth.uid() or public.is_super_admin());

create policy quotations_insert on public.quotations
  for insert to authenticated
  with check (created_by = auth.uid() or public.is_super_admin());

create policy quotations_update on public.quotations
  for update to authenticated
  using (created_by = auth.uid() or public.is_super_admin())
  with check (created_by = auth.uid() or public.is_super_admin());

create policy quotations_delete_sa on public.quotations
  for delete to authenticated
  using (public.is_super_admin());

-- quotation_items via parent ownership
create policy quotation_items_select on public.quotation_items
  for select to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (q.created_by = auth.uid() or public.is_super_admin())
    )
  );

create policy quotation_items_write on public.quotation_items
  for all to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (q.created_by = auth.uid() or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (q.created_by = auth.uid() or public.is_super_admin())
    )
  );

create policy quotation_addons_select on public.quotation_addons
  for select to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (q.created_by = auth.uid() or public.is_super_admin())
    )
  );

create policy quotation_addons_write on public.quotation_addons
  for all to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (q.created_by = auth.uid() or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (q.created_by = auth.uid() or public.is_super_admin())
    )
  );

-- terms
create policy terms_select on public.terms_templates
  for select to authenticated using (true);

create policy terms_sa_update on public.terms_templates
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
