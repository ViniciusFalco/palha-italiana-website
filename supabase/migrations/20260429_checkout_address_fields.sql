-- Structured checkout delivery data for public orders.

alter table public.orders
  add column if not exists customer_address text,
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists address_neighborhood text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_cep text,
  add column if not exists address_latitude double precision,
  add column if not exists address_longitude double precision,
  add column if not exists address_source text;
