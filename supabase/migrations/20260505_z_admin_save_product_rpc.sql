-- Atomic product save for the admin catalog.
-- Keeps product, quantity prices, custom fields, and custom options in one DB transaction.

create or replace function public.admin_save_product(
  product_input jsonb,
  quantity_prices_input jsonb default '[]'::jsonb,
  detail_fields_input jsonb default '[]'::jsonb
)
returns table(product_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_id uuid;
  v_input_product_id uuid;
  v_existing_product_id uuid;
  v_category_id uuid;
  v_category_slug text;
  v_sku text;
  v_name text;
  v_description text;
  v_image_url text;
  v_base_price_cents integer;
  v_min_quantity integer;
  v_is_active boolean;
  v_quantity jsonb;
  v_quantity_min integer;
  v_quantity_max integer;
  v_quantity_unit_price integer;
  v_quantity_mins integer[] := array[]::integer[];
  v_field jsonb;
  v_field_id uuid;
  v_field_key text;
  v_field_label text;
  v_field_input_type text;
  v_field_help_text text;
  v_field_is_required boolean;
  v_field_is_active boolean;
  v_field_sort_order integer;
  v_field_ids uuid[] := array[]::uuid[];
  v_field_keys text[] := array[]::text[];
  v_options jsonb;
  v_option jsonb;
  v_option_id uuid;
  v_option_label text;
  v_option_value text;
  v_option_extra_price_cents integer;
  v_option_sort_order integer;
  v_option_ids uuid[] := array[]::uuid[];
  v_option_values text[] := array[]::text[];
begin
  if not public.is_admin_profile() then
    raise exception 'Apenas administradores ativos podem salvar produtos.'
      using errcode = '42501';
  end if;

  if product_input is null or jsonb_typeof(product_input) <> 'object' then
    raise exception 'Dados do produto inválidos.';
  end if;

  quantity_prices_input := coalesce(quantity_prices_input, '[]'::jsonb);
  detail_fields_input := coalesce(detail_fields_input, '[]'::jsonb);

  if jsonb_typeof(quantity_prices_input) <> 'array' then
    raise exception 'Faixas de preço inválidas.';
  end if;

  if jsonb_typeof(detail_fields_input) <> 'array' then
    raise exception 'Customizações inválidas.';
  end if;

  v_input_product_id := nullif(product_input->>'id', '')::uuid;
  v_sku := nullif(btrim(product_input->>'sku'), '');
  v_name := nullif(btrim(product_input->>'name'), '');
  v_description := nullif(btrim(coalesce(product_input->>'description', '')), '');
  v_image_url := nullif(btrim(coalesce(product_input->>'image_url', '')), '');
  v_category_id := nullif(product_input->>'category_id', '')::uuid;
  v_base_price_cents := (product_input->>'base_price_cents')::integer;
  v_min_quantity := nullif(product_input->>'min_quantity', '')::integer;
  v_is_active := coalesce((product_input->>'is_active')::boolean, true);

  if v_sku is null then
    raise exception 'Informe um SKU.';
  end if;

  if v_name is null then
    raise exception 'Informe um nome para o produto.';
  end if;

  if v_category_id is null then
    raise exception 'Selecione uma categoria.';
  end if;

  if v_base_price_cents is null or v_base_price_cents < 0 then
    raise exception 'Informe um preço base válido.';
  end if;

  if v_min_quantity is not null and v_min_quantity < 0 then
    raise exception 'Quantidade mínima inválida.';
  end if;

  select c.slug
  into v_category_slug
  from public.categories c
  where c.id = v_category_id;

  if v_category_slug is null then
    raise exception 'Categoria selecionada não existe.';
  end if;

  select p.id
  into v_existing_product_id
  from public.products p
  where p.sku = v_sku
    and (v_input_product_id is null or p.id <> v_input_product_id)
  limit 1;

  if v_existing_product_id is not null then
    raise exception 'SKU já está em uso. Escolha outro valor.'
      using errcode = '23505';
  end if;

  if v_input_product_id is null then
    insert into public.products (
      sku,
      name,
      description,
      category,
      category_id,
      base_price_cents,
      min_quantity,
      is_active,
      image_url
    )
    values (
      v_sku,
      v_name,
      v_description,
      v_category_slug,
      v_category_id,
      v_base_price_cents,
      v_min_quantity,
      v_is_active,
      v_image_url
    )
    returning id into v_product_id;
  else
    update public.products
    set
      sku = v_sku,
      name = v_name,
      description = v_description,
      category = v_category_slug,
      category_id = v_category_id,
      base_price_cents = v_base_price_cents,
      min_quantity = v_min_quantity,
      is_active = v_is_active,
      image_url = v_image_url
    where public.products.id = v_input_product_id
    returning id into v_product_id;

    if v_product_id is null then
      raise exception 'Produto não encontrado.';
    end if;
  end if;

  delete from public.product_quantity_prices
  where public.product_quantity_prices.product_id = v_product_id;

  for v_quantity in
    select value from jsonb_array_elements(quantity_prices_input)
  loop
    if jsonb_typeof(v_quantity) <> 'object' then
      raise exception 'Faixa de preço inválida.';
    end if;

    v_quantity_min := nullif(v_quantity->>'min_quantity', '')::integer;
    v_quantity_max := nullif(v_quantity->>'max_quantity', '')::integer;
    v_quantity_unit_price := nullif(v_quantity->>'unit_price_cents', '')::integer;

    if v_quantity_min is null or v_quantity_min < 1 then
      raise exception 'Mínimo da faixa deve ser 1 ou mais.';
    end if;

    if v_quantity_max is not null and v_quantity_max < v_quantity_min then
      raise exception 'Máximo da faixa deve ser maior ou igual ao mínimo.';
    end if;

    if v_quantity_unit_price is null or v_quantity_unit_price <= 0 then
      raise exception 'Preço da faixa deve ser maior que 0.';
    end if;

    if v_quantity_min = any(v_quantity_mins) then
      raise exception 'Mínimo repetido nas faixas de preço.';
    end if;

    v_quantity_mins := array_append(v_quantity_mins, v_quantity_min);

    insert into public.product_quantity_prices (
      product_id,
      min_quantity,
      max_quantity,
      unit_price_cents,
      currency
    )
    values (
      v_product_id,
      v_quantity_min,
      v_quantity_max,
      v_quantity_unit_price,
      'BRL'
    );
  end loop;

  for v_field in
    select value from jsonb_array_elements(detail_fields_input)
  loop
    if jsonb_typeof(v_field) <> 'object' then
      raise exception 'Customização inválida.';
    end if;

    v_field_id := nullif(v_field->>'id', '')::uuid;
    v_field_key := nullif(btrim(v_field->>'field_key'), '');
    v_field_label := nullif(btrim(v_field->>'label'), '');
    v_field_input_type := nullif(btrim(v_field->>'input_type'), '');
    v_field_help_text := nullif(btrim(coalesce(v_field->>'help_text', '')), '');
    v_field_is_required := coalesce((v_field->>'is_required')::boolean, false);
    v_field_is_active := coalesce((v_field->>'is_active')::boolean, true);
    v_field_sort_order := coalesce(nullif(v_field->>'sort_order', '')::integer, 0);
    v_options := coalesce(v_field->'options', '[]'::jsonb);
    v_option_ids := array[]::uuid[];
    v_option_values := array[]::text[];

    if v_field_label is null or v_field_key is null then
      raise exception 'Preencha o nome de todas as perguntas.';
    end if;

    if v_field_input_type is null or v_field_input_type not in ('text', 'textarea', 'select', 'multi_select') then
      raise exception 'Tipo de pergunta inválido.';
    end if;

    if lower(v_field_key) = any(v_field_keys) then
      raise exception 'Duas perguntas estão com o mesmo identificador.';
    end if;

    v_field_keys := array_append(v_field_keys, lower(v_field_key));

    if jsonb_typeof(v_options) <> 'array' then
      raise exception 'Opções da pergunta "%": formato inválido.', v_field_label;
    end if;

    if v_field_input_type in ('select', 'multi_select') and jsonb_array_length(v_options) = 0 then
      raise exception 'Adicione pelo menos uma opção para a pergunta "%".', v_field_label;
    end if;

    if v_field_id is null then
      insert into public.product_detail_fields (
        product_id,
        field_key,
        label,
        input_type,
        help_text,
        is_required,
        sort_order,
        is_active
      )
      values (
        v_product_id,
        v_field_key,
        v_field_label,
        v_field_input_type,
        v_field_help_text,
        v_field_is_required,
        v_field_sort_order,
        v_field_is_active
      )
      returning id into v_field_id;
    else
      update public.product_detail_fields
      set
        field_key = v_field_key,
        label = v_field_label,
        input_type = v_field_input_type,
        help_text = v_field_help_text,
        is_required = v_field_is_required,
        sort_order = v_field_sort_order,
        is_active = v_field_is_active
      where public.product_detail_fields.id = v_field_id
        and public.product_detail_fields.product_id = v_product_id;

      if not found then
        insert into public.product_detail_fields (
          id,
          product_id,
          field_key,
          label,
          input_type,
          help_text,
          is_required,
          sort_order,
          is_active
        )
        values (
          v_field_id,
          v_product_id,
          v_field_key,
          v_field_label,
          v_field_input_type,
          v_field_help_text,
          v_field_is_required,
          v_field_sort_order,
          v_field_is_active
        );
      end if;
    end if;

    v_field_ids := array_append(v_field_ids, v_field_id);

    if v_field_input_type in ('select', 'multi_select') then
      for v_option in
        select value from jsonb_array_elements(v_options)
      loop
        if jsonb_typeof(v_option) <> 'object' then
          raise exception 'Opção inválida na pergunta "%".', v_field_label;
        end if;

        v_option_id := coalesce(nullif(v_option->>'id', '')::uuid, gen_random_uuid());
        v_option_label := nullif(btrim(v_option->>'label'), '');
        v_option_value := nullif(btrim(v_option->>'value'), '');
        v_option_extra_price_cents := coalesce(nullif(v_option->>'extra_price_delta_cents', '')::integer, 0);
        v_option_sort_order := coalesce(nullif(v_option->>'sort_order', '')::integer, 0);

        if v_option_label is null or v_option_value is null then
          raise exception 'Preencha o nome de todas as opções da pergunta "%".', v_field_label;
        end if;

        if lower(v_option_value) = any(v_option_values) then
          raise exception 'As opções da pergunta "%" precisam ter nomes diferentes.', v_field_label;
        end if;

        v_option_values := array_append(v_option_values, lower(v_option_value));

        update public.product_detail_options
        set
          field_id = v_field_id,
          label = v_option_label,
          value = v_option_value,
          extra_price_delta_cents = v_option_extra_price_cents,
          sort_order = v_option_sort_order
        where public.product_detail_options.id = v_option_id
          and public.product_detail_options.field_id = v_field_id;

        if not found then
          insert into public.product_detail_options (
            id,
            field_id,
            label,
            value,
            extra_price_delta_cents,
            sort_order
          )
          values (
            v_option_id,
            v_field_id,
            v_option_label,
            v_option_value,
            v_option_extra_price_cents,
            v_option_sort_order
          );
        end if;

        v_option_ids := array_append(v_option_ids, v_option_id);
      end loop;
    end if;

    delete from public.product_detail_options
    where public.product_detail_options.field_id = v_field_id
      and not (public.product_detail_options.id = any(v_option_ids));
  end loop;

  delete from public.product_detail_options
  where public.product_detail_options.field_id in (
    select f.id
    from public.product_detail_fields f
    where f.product_id = v_product_id
      and not (f.id = any(v_field_ids))
  );

  delete from public.product_detail_fields
  where public.product_detail_fields.product_id = v_product_id
    and not (public.product_detail_fields.id = any(v_field_ids));

  return query select v_product_id as product_id;
end;
$$;

revoke all on function public.admin_save_product(jsonb, jsonb, jsonb) from public;
grant execute on function public.admin_save_product(jsonb, jsonb, jsonb) to authenticated;
