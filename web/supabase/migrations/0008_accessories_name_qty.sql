-- Standard accessories become {name, qty} jsonb (no price).
-- Applied remotely on kamwbhwioivuosumzrkv via staging columns.

alter table public.products add column if not exists standard_accessories_v2 jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'standard_accessories'
      and udt_name = '_text'
  ) then
    update public.products p
    set standard_accessories_v2 = coalesce((
      select jsonb_agg(jsonb_build_object('name', elem, 'qty', 1) order by ordinality)
      from unnest(p.standard_accessories) with ordinality as t(elem, ordinality)
      where elem is not null and btrim(elem) <> ''
    ), '[]'::jsonb);
    alter table public.products drop column standard_accessories;
    alter table public.products rename column standard_accessories_v2 to standard_accessories;
  else
    alter table public.products drop column if exists standard_accessories_v2;
  end if;
end $$;

alter table public.quotation_items add column if not exists standard_accessories_v2 jsonb default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quotation_items'
      and column_name = 'standard_accessories'
      and udt_name = '_text'
  ) then
    update public.quotation_items qi
    set standard_accessories_v2 = coalesce((
      select jsonb_agg(jsonb_build_object('name', elem, 'qty', 1) order by ordinality)
      from unnest(qi.standard_accessories) with ordinality as t(elem, ordinality)
      where elem is not null and btrim(elem) <> ''
    ), '[]'::jsonb);
    alter table public.quotation_items drop column standard_accessories;
    alter table public.quotation_items rename column standard_accessories_v2 to standard_accessories;
  else
    alter table public.quotation_items drop column if exists standard_accessories_v2;
  end if;
end $$;
