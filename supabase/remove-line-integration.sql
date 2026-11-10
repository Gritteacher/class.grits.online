-- Removes only the retired provider mapping. Auth accounts and profiles are preserved.
-- RESTRICT intentionally stops if an unexpected dependency exists; never use CASCADE.
begin;
do $$ begin
  if to_regclass('public.line_account_links') is not null then
    lock table public.line_account_links in access exclusive mode;
    if exists (select 1 from public.line_account_links) then
      raise exception 'Provider mappings are not empty; explicit data deletion approval is required';
    end if;
  end if;
end $$;
drop table if exists public.line_account_links restrict;
notify pgrst, 'reload schema';
commit;
