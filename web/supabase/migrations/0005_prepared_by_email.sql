-- Snapshot creator email on quotations for PDF letterhead
alter table public.quotations
  add column if not exists prepared_by_email text;

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
    id, quotation_number, parent_quotation_id, version, status, currency, fx_rate_used,
    client_name, client_company, is_dealer_sale, dealer_id, created_by,
    follow_up_date, reminder_sent, validity_date, terms_snapshot,
    prepared_by_name, prepared_by_phone, prepared_by_email, total_amount
  ) values (
    v_new_id, v_new_number, v_root_id, v_next_version, 'submitted',
    v_source.currency, v_source.fx_rate_used,
    v_source.client_name, v_source.client_company, v_source.is_dealer_sale, v_source.dealer_id,
    v_source.created_by,
    v_source.follow_up_date, false, v_source.validity_date, v_source.terms_snapshot,
    v_source.prepared_by_name, v_source.prepared_by_phone, v_source.prepared_by_email, v_source.total_amount
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
