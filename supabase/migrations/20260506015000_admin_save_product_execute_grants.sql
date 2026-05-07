-- Only authenticated users can call the admin product save RPC.
-- The function still validates public.is_admin_profile() internally.

revoke all on function public.admin_save_product(jsonb, jsonb, jsonb) from public;
revoke all on function public.admin_save_product(jsonb, jsonb, jsonb) from anon;
grant execute on function public.admin_save_product(jsonb, jsonb, jsonb) to authenticated;
