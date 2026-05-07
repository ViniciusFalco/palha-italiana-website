-- Products now use public.categories through category_id.
-- The legacy products.category column must stay compatible, but it cannot be
-- limited by the old hard-coded check constraint.

alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  alter column category drop not null;

update public.products p
set category = c.slug
from public.categories c
where p.category_id = c.id
  and p.category is distinct from c.slug;

create or replace function public.sync_product_category_from_category_id()
returns trigger
language plpgsql
as $$
begin
  if new.category_id is null then
    new.category := null;
    return new;
  end if;

  select c.slug
  into new.category
  from public.categories c
  where c.id = new.category_id;

  return new;
end;
$$;

drop trigger if exists sync_product_category_from_category_id on public.products;
create trigger sync_product_category_from_category_id
before insert or update of category_id on public.products
for each row
execute function public.sync_product_category_from_category_id();
