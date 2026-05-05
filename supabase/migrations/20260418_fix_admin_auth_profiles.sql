create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  alter column role set default 'staff',
  alter column role set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default timezone('utc', now()),
  alter column created_at set not null,
  alter column updated_at set default timezone('utc', now()),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'staff'));
  end if;
end
$$;

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.sync_profile_from_auth_user(p_user_id uuid, p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy_role text;
  legacy_is_active boolean;
  result_profile public.profiles;
begin
  select u.role, u.is_active
    into legacy_role, legacy_is_active
  from public.users u
  where lower(u.email) = lower(coalesce(p_email, ''))
  order by u.created_at asc nulls last
  limit 1;

  insert into public.profiles (
    id,
    email,
    role,
    is_active,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_email,
    coalesce(legacy_role, 'staff'),
    coalesce(legacy_is_active, true),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
    set email = excluded.email,
        role = coalesce(public.profiles.role, excluded.role),
        is_active = coalesce(public.profiles.is_active, excluded.is_active),
        updated_at = timezone('utc', now())
  returning * into result_profile;

  return result_profile;
end;
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_profile_from_auth_user(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

insert into public.profiles (
  id,
  email,
  role,
  is_active,
  created_at,
  updated_at
)
select
  au.id,
  au.email,
  coalesce(legacy.role, 'staff'),
  coalesce(legacy.is_active, true),
  coalesce(au.created_at, timezone('utc', now())),
  timezone('utc', now())
from auth.users au
left join public.profiles p
  on p.id = au.id
left join lateral (
  select u.role, u.is_active
  from public.users u
  where lower(u.email) = lower(coalesce(au.email, ''))
  order by u.created_at asc nulls last
  limit 1
) legacy on true
where p.id is null;

alter table public.profiles enable row level security;

grant select on table public.profiles to authenticated;
grant update on table public.profiles to authenticated;

create or replace function public.is_admin_profile(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = coalesce(p_user_id, auth.uid())
      and role = 'admin'
      and is_active = true
  );
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using (public.is_admin_profile());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.is_admin_profile())
with check (public.is_admin_profile());
