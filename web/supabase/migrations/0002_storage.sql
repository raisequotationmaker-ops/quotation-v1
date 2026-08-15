-- Storage buckets + policies for RLE Quotation Maker

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'quotation-pdfs',
    'quotation-pdfs',
    false,
    20971520,
    array['application/pdf']
  )
on conflict (id) do nothing;

-- Product images: authenticated read; super_admin write
create policy product_images_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

create policy product_images_sa_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_super_admin()
  );

create policy product_images_sa_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_super_admin())
  with check (bucket_id = 'product-images' and public.is_super_admin());

create policy product_images_sa_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_super_admin());

-- Quotation PDFs: owner or super_admin
create policy quotation_pdfs_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'quotation-pdfs'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.quotations q
        where q.id::text = split_part(name, '/', 1)
          and q.created_by = auth.uid()
      )
    )
  );

create policy quotation_pdfs_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'quotation-pdfs'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.quotations q
        where q.id::text = split_part(name, '/', 1)
          and q.created_by = auth.uid()
      )
    )
  );

create policy quotation_pdfs_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'quotation-pdfs'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.quotations q
        where q.id::text = split_part(name, '/', 1)
          and q.created_by = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'quotation-pdfs'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.quotations q
        where q.id::text = split_part(name, '/', 1)
          and q.created_by = auth.uid()
      )
    )
  );
