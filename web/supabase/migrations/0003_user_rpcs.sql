-- User provisioning RPCs

create or replace function public.create_app_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_hash text;
  v_email text := lower(trim(p_email));
begin
  if not public.is_super_admin() then
    raise exception 'Only super_admin can create users';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Email is required';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Full name is required';
  end if;
  if p_role not in ('salesperson', 'admin', 'super_admin') then
    raise exception 'Invalid role';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'A user with this email already exists';
  end if;

  begin
    v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
  exception when others then
    v_hash := crypt(p_password, gen_salt('bf'));
  end;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', trim(p_full_name)),
    now(), now(), '', '', '', '', false, false
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_id::text,
    now(), now(), now()
  );

  insert into public.profiles (id, full_name, role, phone, is_active)
  values (v_id, trim(p_full_name), p_role, nullif(trim(coalesce(p_phone, '')), ''), true);

  return v_id;
end;
$$;

grant execute on function public.create_app_user(text, text, text, text, text) to authenticated;
