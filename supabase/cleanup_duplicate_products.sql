-- Manual maintenance script.
-- Run the PREVIEW first. Only run the UPDATE after reviewing the rows.
-- It disables recent duplicate active products by lower(trim(name)) + category_id.
-- It keeps the oldest product that has customization; if none has customization,
-- it keeps the oldest product.

-- PREVIEW: rows with action = 'disable_duplicate' are the ones the UPDATE targets.
with enriched as (
  select
    p.id,
    p.sku,
    p.name,
    p.category_id,
    p.created_at,
    lower(btrim(p.name)) as normalized_name,
    exists (
      select 1
      from public.product_detail_fields f
      where f.product_id = p.id
    ) as has_customization,
    exists (
      select 1
      from public.order_items oi
      where oi.product_id::text = p.id::text
    ) as has_orders
  from public.products p
  where p.is_active = true
    and p.created_at >= now() - interval '14 days'
),
ranked as (
  select
    *,
    count(*) over (partition by normalized_name, category_id) as duplicate_count,
    row_number() over (
      partition by normalized_name, category_id
      order by has_customization desc, created_at asc, id asc
    ) as keep_rank
  from enriched
)
select
  case
    when keep_rank = 1 then 'keep'
    when has_orders then 'review_has_orders'
    else 'disable_duplicate'
  end as action,
  duplicate_count,
  keep_rank,
  id,
  sku,
  name,
  category_id,
  has_customization,
  has_orders,
  created_at
from ranked
where duplicate_count > 1
order by normalized_name, category_id nulls first, keep_rank;

-- UPDATE: disables only duplicates that have no linked order_items.
-- Uncomment and run after the preview looks correct.
/*
with enriched as (
  select
    p.id,
    p.sku,
    p.name,
    p.category_id,
    p.created_at,
    lower(btrim(p.name)) as normalized_name,
    exists (
      select 1
      from public.product_detail_fields f
      where f.product_id = p.id
    ) as has_customization,
    exists (
      select 1
      from public.order_items oi
      where oi.product_id::text = p.id::text
    ) as has_orders
  from public.products p
  where p.is_active = true
    and p.created_at >= now() - interval '14 days'
),
ranked as (
  select
    *,
    count(*) over (partition by normalized_name, category_id) as duplicate_count,
    row_number() over (
      partition by normalized_name, category_id
      order by has_customization desc, created_at asc, id asc
    ) as keep_rank
  from enriched
),
candidates as (
  select id
  from ranked
  where duplicate_count > 1
    and keep_rank > 1
    and has_orders = false
)
update public.products p
set is_active = false
from candidates c
where p.id = c.id
returning p.id, p.sku, p.name, p.category_id, p.created_at;
*/
