-- Allow physical catalog deletes without breaking existing orders.
-- Orders keep quantity/prices and nullable references when a catalog item is removed.

alter table public.order_item_details
  drop constraint if exists order_item_details_field_id_fkey;

alter table public.order_item_details
  alter column field_id drop not null;

alter table public.order_item_details
  add constraint order_item_details_field_id_fkey
  foreign key (field_id)
  references public.product_detail_fields(id)
  on delete set null;

alter table public.order_items
  drop constraint if exists order_items_product_option_id_fkey;

alter table public.order_items
  add constraint order_items_product_option_id_fkey
  foreign key (product_option_id)
  references public.product_options(id)
  on delete set null;

alter table public.order_items
  drop constraint if exists order_items_product_id_fkey;

alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id)
  references public.products(id)
  on delete set null;

alter table public.products
  drop constraint if exists products_category_id_fkey;

alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id)
  references public.categories(id)
  on delete cascade;
