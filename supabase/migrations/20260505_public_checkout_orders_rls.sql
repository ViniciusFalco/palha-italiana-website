-- Public checkout needs to create orders with the anon key.
-- Keep reads and admin management behind the existing admin policies.

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_details enable row level security;

grant usage on schema public to anon;
grant insert on table public.orders to anon;
grant insert on table public.order_items to anon;
grant insert on table public.order_item_details to anon;

drop policy if exists "orders_public_checkout_insert" on public.orders;
create policy "orders_public_checkout_insert"
on public.orders
for insert
to anon
with check (
  status = 'pending'
  and total_cents between 1 and 100000000
  and char_length(btrim(coalesce(customer_name, ''))) between 2 and 160
  and char_length(btrim(coalesce(customer_phone, ''))) between 8 and 30
  and char_length(coalesce(customer_email, '')) <= 320
  and char_length(coalesce(note, '')) <= 4000
  and coalesce(payment_method, 'pix') in ('pix', 'credit', 'debit')
  and coalesce(payment_status, 'pending') = 'pending'
  and coalesce(payment_due, true) = true
);

drop policy if exists "order_items_public_checkout_insert" on public.order_items;
create policy "order_items_public_checkout_insert"
on public.order_items
for insert
to anon
with check (
  order_id is not null
  and quantity between 1 and 999
  and unit_price_cents between 0 and 100000000
  and subtotal_cents = unit_price_cents * quantity
);

drop policy if exists "order_item_details_public_checkout_insert" on public.order_item_details;
create policy "order_item_details_public_checkout_insert"
on public.order_item_details
for insert
to anon
with check (
  order_item_id is not null
  and field_id is not null
  and char_length(btrim(coalesce(value, ''))) between 1 and 500
);
