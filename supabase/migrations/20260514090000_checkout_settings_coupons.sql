-- Checkout settings and discount coupons.

alter table public.orders
  add column if not exists subtotal_cents integer,
  add column if not exists shipping_cents integer,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists coupon_id uuid,
  add column if not exists coupon_code text;

create table if not exists public.checkout_settings (
  id boolean primary key default true,
  order_minimum_cents integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint checkout_settings_singleton check (id = true),
  constraint checkout_settings_order_minimum_non_negative check (order_minimum_cents >= 0)
);

insert into public.checkout_settings (id, order_minimum_cents)
values (true, 0)
on conflict (id) do nothing;

create table if not exists public.discount_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null,
  discount_percent numeric(5, 2),
  discount_cents integer,
  valid_until date,
  is_active boolean not null default true,
  is_cumulative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_coupons_code_format check (
    code = upper(btrim(code))
    and char_length(code) between 3 and 40
  ),
  constraint discount_coupons_type_check check (discount_type in ('percent', 'fixed')),
  constraint discount_coupons_value_check check (
    (
      discount_type = 'percent'
      and discount_percent > 0
      and discount_percent <= 100
      and discount_cents is null
    )
    or (
      discount_type = 'fixed'
      and discount_cents > 0
      and discount_percent is null
    )
  )
);

alter table public.orders
  add constraint orders_coupon_id_fkey
  foreign key (coupon_id)
  references public.discount_coupons(id)
  on delete set null;

create or replace function public.set_checkout_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_checkout_settings_updated_at on public.checkout_settings;
create trigger set_checkout_settings_updated_at
before update on public.checkout_settings
for each row execute procedure public.set_checkout_settings_updated_at();

create or replace function public.set_discount_coupons_updated_at()
returns trigger as $$
begin
  new.code = upper(btrim(new.code));
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_discount_coupons_updated_at on public.discount_coupons;
create trigger set_discount_coupons_updated_at
before insert or update on public.discount_coupons
for each row execute procedure public.set_discount_coupons_updated_at();

alter table public.checkout_settings enable row level security;
alter table public.discount_coupons enable row level security;

grant select on table public.checkout_settings to anon, authenticated;
grant select, insert, update, delete on table public.discount_coupons to authenticated;
grant insert, update on table public.checkout_settings to authenticated;

drop policy if exists "checkout_settings_public_read" on public.checkout_settings;
create policy "checkout_settings_public_read"
on public.checkout_settings
for select
to anon, authenticated
using (true);

drop policy if exists "checkout_settings_admin_manage" on public.checkout_settings;
create policy "checkout_settings_admin_manage"
on public.checkout_settings
for all
to authenticated
using (public.is_admin_profile())
with check (public.is_admin_profile());

drop policy if exists "discount_coupons_admin_manage" on public.discount_coupons;
create policy "discount_coupons_admin_manage"
on public.discount_coupons
for all
to authenticated
using (public.is_admin_profile())
with check (public.is_admin_profile());

create or replace function public.validate_discount_coupon(
  p_code text,
  p_subtotal_cents integer
)
returns table (
  id uuid,
  code text,
  discount_type text,
  discount_percent numeric,
  discount_cents integer,
  discount_cents_applied integer,
  is_cumulative boolean,
  valid_until date
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coupon public.discount_coupons%rowtype;
  v_subtotal integer := greatest(coalesce(p_subtotal_cents, 0), 0);
  v_discount integer := 0;
begin
  select *
  into v_coupon
  from public.discount_coupons dc
  where dc.code = upper(btrim(coalesce(p_code, '')))
    and dc.is_active = true
    and (
      dc.valid_until is null
      or dc.valid_until >= (now() at time zone 'America/Sao_Paulo')::date
    )
  limit 1;

  if not found or v_subtotal <= 0 then
    return;
  end if;

  if v_coupon.discount_type = 'percent' then
    v_discount := floor(v_subtotal * coalesce(v_coupon.discount_percent, 0) / 100)::integer;
  else
    v_discount := coalesce(v_coupon.discount_cents, 0);
  end if;

  v_discount := least(greatest(v_discount, 0), v_subtotal);

  if v_discount <= 0 then
    return;
  end if;

  return query
  select
    v_coupon.id,
    v_coupon.code,
    v_coupon.discount_type,
    v_coupon.discount_percent,
    v_coupon.discount_cents,
    v_discount,
    v_coupon.is_cumulative,
    v_coupon.valid_until;
end;
$$;

revoke all on function public.validate_discount_coupon(text, integer) from public;
grant execute on function public.validate_discount_coupon(text, integer) to anon, authenticated;
