-- Public checkout support for cash payment and delivery date metadata.

alter table public.orders
  add column if not exists cash_change_for_cents integer;

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
  and coalesce(payment_method, 'pix') in ('pix', 'credit', 'debit', 'cash')
  and coalesce(payment_status, 'pending') = 'pending'
  and coalesce(payment_due, true) = true
  and (
    delivery_date is null
    or delivery_date >= ((now() at time zone 'America/Sao_Paulo')::date)
  )
  and (
    cash_change_for_cents is null
    or cash_change_for_cents between 0 and 100000000
  )
);
