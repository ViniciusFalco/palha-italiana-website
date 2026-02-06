-- Adiciona coluna para snapshot do recibo (campos editaveis no modal)
alter table public.receipts
  add column if not exists receipt_payload jsonb;
