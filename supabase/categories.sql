-- Categorias de produtos (Sweet Child)

-- 1) Tabela de categorias
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  image_url text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2) Relacionamento: products -> categories
alter table public.products
  add column if not exists category_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_category_id_fkey'
  ) then
    alter table public.products
      add constraint products_category_id_fkey
      foreign key (category_id) references public.categories(id)
      on delete set null;
  end if;
end $$;

-- 3) Migração opcional do legacy (products.category -> categories.slug)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'category'
  ) then
    insert into public.categories (slug, name, sort_order, is_active)
    select distinct p.category,
      initcap(replace(p.category, '-', ' ')),
      0,
      true
    from public.products p
    where p.category is not null
    on conflict (slug) do nothing;

    update public.products p
    set category_id = c.id
    from public.categories c
    where p.category_id is null
      and p.category = c.slug;
  end if;
end $$;

-- 4) View com categoria acoplada (mantém a view original intacta)
create or replace view public.catalog_effective_prices_with_category_v as
select
  v.*,
  c.id as category_id,
  c.slug as category_slug,
  c.name as category_name
from public.catalog_effective_prices_v v
left join public.categories c
  on c.slug = v.category;

-- 5) RLS
alter table public.categories enable row level security;

drop policy if exists "Categories are viewable by everyone" on public.categories;
create policy "Categories are viewable by everyone"
  on public.categories
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Categories managed by admin" on public.categories;
create policy "Categories managed by admin"
  on public.categories
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.is_active = true
    )
  );
