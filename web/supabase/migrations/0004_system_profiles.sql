-- Hide bootstrap/creator accounts from the application

alter table public.profiles
  add column if not exists is_system boolean not null default false;

comment on column public.profiles.is_system is
  'True for secret bootstrap/creator accounts; never listed in Users UI or profile pickers.';

-- Flag known creator account(s)
update public.profiles p
set is_system = true
from auth.users u
where p.id = u.id
  and lower(u.email) = 'superadmin@raiselabequip.com';

-- SELECT: own row always; super_admins see non-system profiles only
drop policy if exists profiles_select_own_or_sa on public.profiles;
create policy profiles_select_own_or_sa on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (public.is_super_admin() and is_system = false)
  );

-- SA all mutations exclude system profiles (creator can still update own via profiles_update_own)
drop policy if exists profiles_sa_all on public.profiles;
create policy profiles_sa_all on public.profiles
  for all to authenticated
  using (public.is_super_admin() and is_system = false)
  with check (public.is_super_admin() and is_system = false);

-- Trigger: block client DELETE/sensitive UPDATE on system profiles
create or replace function public.protect_system_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'System profiles cannot be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.is_system then
      if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
        return new;
      end if;
      if new.is_system is distinct from old.is_system
         or new.role is distinct from old.role
         or new.is_active is distinct from old.is_active
         or new.id is distinct from old.id then
        raise exception 'System profiles cannot be modified this way';
      end if;
      if auth.uid() is distinct from old.id then
        raise exception 'System profiles cannot be modified';
      end if;
      return new;
    end if;

    if new.is_system is true and old.is_system is distinct from true then
      if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
        raise exception 'Cannot flag profiles as system';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_system_profiles_trg on public.profiles;
create trigger protect_system_profiles_trg
before update or delete on public.profiles
for each row execute function public.protect_system_profiles();

-- Refuse password resets against system accounts
create or replace function public.reset_app_user_password(p_user_id uuid, p_password text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_hash text;
begin
  if not public.is_super_admin() then
    raise exception 'Only super_admin can reset passwords';
  end if;
  if exists (
    select 1 from public.profiles
    where id = p_user_id and is_system = true
  ) then
    raise exception 'System profiles cannot be reset';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User not found';
  end if;

  begin
    v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
  exception when others then
    v_hash := crypt(p_password, gen_salt('bf'));
  end;

  update auth.users
  set encrypted_password = v_hash, updated_at = now()
  where id = p_user_id;

  return p_password;
end;
$$;
