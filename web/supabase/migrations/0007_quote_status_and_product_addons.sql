-- Status set + custom text, MOC, per-product addons

alter table public.quotations
  add column if not exists status_custom text;

alter table public.quotations drop constraint if exists quotations_status_check;

update public.quotations set status = 'pending' where status = 'ongoing';
update public.quotations set status = 'converted' where status = 'sale_completed';

alter table public.quotations
  add constraint quotations_status_check
  check (status in ('submitted', 'processing', 'pending', 'converted', 'sale_cancelled'));

alter table public.products
  add column if not exists material_of_construction text;

alter table public.quotation_items
  add column if not exists material_of_construction text;

create table if not exists public.product_addons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  type text not null default 'checkbox' check (type in ('checkbox', 'radio')),
  options jsonb,
  default_price numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_addons_product_idx
  on public.product_addons (product_id, sort_order);

alter table public.quotation_addons
  add column if not exists quotation_item_id uuid references public.quotation_items(id) on delete cascade;

alter table public.quotation_addons
  add column if not exists product_addon_id uuid references public.product_addons(id) on delete set null;

create index if not exists quotation_addons_item_idx
  on public.quotation_addons (quotation_item_id);

alter table public.product_addons enable row level security;

create policy product_addons_select on public.product_addons
  for select to authenticated using (true);

create policy product_addons_write on public.product_addons
  for all to authenticated
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

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

  perform 1 from public.quotations where id = v_root_id for update;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.quotations
  where id = v_root_id or parent_quotation_id = v_root_id;

  v_new_number := v_root_number || '-' || v_next_version::text;
  v_new_id := gen_random_uuid();

  insert into public.quotations (
    id, quotation_number, parent_quotation_id, version, status, status_custom,
    currency, fx_rate_used,
    client_name, client_company, is_dealer_sale, dealer_id, created_by,
    follow_up_date, reminder_sent, validity_date, terms_snapshot,
    prepared_by_name, prepared_by_phone, prepared_by_email, total_amount
  ) values (
    v_new_id, v_new_number, v_root_id, v_next_version, 'submitted', null,
    v_source.currency, v_source.fx_rate_used,
    v_source.client_name, v_source.client_company, v_source.is_dealer_sale, v_source.dealer_id,
    v_source.created_by,
    v_source.follow_up_date, false, v_source.validity_date, v_source.terms_snapshot,
    v_source.prepared_by_name, v_source.prepared_by_phone, v_source.prepared_by_email, v_source.total_amount
  );

  insert into public.quotation_items (
    quotation_id, product_id, price_tier, unit_price, quantity, image_layout_override,
    sort_order, product_name, model_no, description, features, specifications,
    image_url, standard_accessories, material_of_construction
  )
  select
    v_new_id, product_id, price_tier, unit_price, quantity, image_layout_override,
    sort_order, product_name, model_no, description, features, specifications,
    image_url, standard_accessories, material_of_construction
  from public.quotation_items where quotation_id = p_source_id;

  insert into public.quotation_addons (
    quotation_id, addon_id, product_addon_id, selected_option, price, addon_name, quotation_item_id
  )
  select
    v_new_id, qa.addon_id, qa.product_addon_id, qa.selected_option, qa.price, qa.addon_name, ni.id
  from public.quotation_addons qa
  left join public.quotation_items oi on oi.id = qa.quotation_item_id
  left join public.quotation_items ni
    on ni.quotation_id = v_new_id and ni.sort_order = oi.sort_order
  where qa.quotation_id = p_source_id;

  return v_new_id;
end;
$$;
