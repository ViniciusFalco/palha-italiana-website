-- Admin RLS policies for orders domain
-- Fixes "new row violates row-level security policy for table orders"
-- when authenticated admin users create/manage orders in admin panel.

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_details enable row level security;

drop policy if exists "orders_admin_manage" on public.orders;
create policy "orders_admin_manage"
on public.orders
for all
to authenticated
using (public.is_admin_profile())
with check (public.is_admin_profile());

drop policy if exists "order_items_admin_manage" on public.order_items;
create policy "order_items_admin_manage"
on public.order_items
for all
to authenticated
using (public.is_admin_profile())
with check (public.is_admin_profile());

drop policy if exists "order_item_details_admin_manage" on public.order_item_details;
create policy "order_item_details_admin_manage"
on public.order_item_details
for all
to authenticated
using (public.is_admin_profile())
with check (public.is_admin_profile());
