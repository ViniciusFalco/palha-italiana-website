-- Hard delete catalog entities from the admin panel.

create or replace function public.admin_delete_product(p_product_id uuid)
returns table(deleted_product_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin_profile() then
    raise exception 'Apenas administradores ativos podem excluir produtos.'
      using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'Produto inválido.';
  end if;

  delete from public.products p
  where p.id = p_product_id
  returning p.id into deleted_product_id;

  if deleted_product_id is null then
    raise exception 'Produto não encontrado.';
  end if;

  return next;
end;
$$;

create or replace function public.admin_delete_category(p_category_id uuid)
returns table(deleted_category_id uuid, deleted_products_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin_profile() then
    raise exception 'Apenas administradores ativos podem excluir categorias.'
      using errcode = '42501';
  end if;

  if p_category_id is null then
    raise exception 'Categoria inválida.';
  end if;

  select count(*)::integer
  into deleted_products_count
  from public.products p
  where p.category_id = p_category_id;

  delete from public.categories c
  where c.id = p_category_id
  returning c.id into deleted_category_id;

  if deleted_category_id is null then
    raise exception 'Categoria não encontrada.';
  end if;

  return next;
end;
$$;

revoke all on function public.admin_delete_product(uuid) from public;
revoke all on function public.admin_delete_product(uuid) from anon;
grant execute on function public.admin_delete_product(uuid) to authenticated;

revoke all on function public.admin_delete_category(uuid) from public;
revoke all on function public.admin_delete_category(uuid) from anon;
grant execute on function public.admin_delete_category(uuid) to authenticated;
