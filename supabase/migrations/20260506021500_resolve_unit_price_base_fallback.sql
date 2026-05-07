-- Resolve quantity pricing with a base-price fallback.
-- This keeps cart quantity edits correct when the new quantity no longer matches a tier.

create or replace function public.resolve_unit_price_cents(p_product_id uuid, p_quantity integer)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select pqp.unit_price_cents
      from public.product_quantity_prices pqp
      where pqp.product_id = p_product_id
        and p_quantity >= pqp.min_quantity
        and (pqp.max_quantity is null or p_quantity <= pqp.max_quantity)
      order by pqp.min_quantity desc
      limit 1
    ),
    (
      select p.base_price_cents
      from public.products p
      where p.id = p_product_id
      limit 1
    )
  );
$$;

grant execute on function public.resolve_unit_price_cents(uuid, integer) to anon;
grant execute on function public.resolve_unit_price_cents(uuid, integer) to authenticated;
