-- Align product customization input types with the application.
-- The admin modal and customer catalog use these canonical values:
-- text, textarea, select, multi_select.

alter table public.product_detail_fields
  drop constraint if exists product_detail_fields_input_type_check;

update public.product_detail_fields
set input_type = case lower(btrim(input_type))
  when 'text' then 'text'
  when 'short_text' then 'text'
  when 'short-text' then 'text'
  when 'shorttext' then 'text'
  when 'string' then 'text'
  when 'input' then 'text'
  when 'textarea' then 'textarea'
  when 'long_text' then 'textarea'
  when 'long-text' then 'textarea'
  when 'longtext' then 'textarea'
  when 'select' then 'select'
  when 'single_choice' then 'select'
  when 'single-choice' then 'select'
  when 'single_select' then 'select'
  when 'single-select' then 'select'
  when 'select_one' then 'select'
  when 'select-one' then 'select'
  when 'choice' then 'select'
  when 'radio' then 'select'
  when 'dropdown' then 'select'
  when 'multi_select' then 'multi_select'
  when 'multi-select' then 'multi_select'
  when 'multiple_choice' then 'multi_select'
  when 'multiple-choice' then 'multi_select'
  when 'multi_choice' then 'multi_select'
  when 'multi-choice' then 'multi_select'
  when 'select_many' then 'multi_select'
  when 'select-many' then 'multi_select'
  when 'checkbox' then 'multi_select'
  when 'checkboxes' then 'multi_select'
  else input_type
end
where input_type is not null;

do $$
declare
  v_invalid_types text;
begin
  select string_agg(distinct input_type, ', ' order by input_type)
  into v_invalid_types
  from public.product_detail_fields
  where input_type is not null
    and input_type not in ('text', 'textarea', 'select', 'multi_select');

  if v_invalid_types is not null then
    raise exception 'Unsupported product_detail_fields.input_type values: %', v_invalid_types;
  end if;
end;
$$;

alter table public.product_detail_fields
  add constraint product_detail_fields_input_type_check
  check (
    input_type in ('text', 'textarea', 'select', 'multi_select')
  );
