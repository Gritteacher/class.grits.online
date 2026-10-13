-- Production safeguards for the new classroom project.
-- Run after schema.sql. Safe to run more than once.

create or replace function private.validate_score_entry()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  max_raw numeric;
  max_final numeric;
begin
  select raw_max, final_max into max_raw, max_final
  from public.assignments where id = new.assignment_id;
  if max_raw is null then raise exception 'ไม่พบงานคะแนน'; end if;
  if new.raw_score is not null and (new.raw_score < 0 or new.raw_score > max_raw) then
    raise exception 'คะแนนดิบต้องอยู่ระหว่าง 0 ถึง %', max_raw;
  end if;
  if new.final_score is not null and (new.final_score < 0 or new.final_score > max_final) then
    raise exception 'คะแนนปลายทางต้องอยู่ระหว่าง 0 ถึง %', max_final;
  end if;
  return new;
end;
$$;

drop trigger if exists score_entries_validate on public.score_entries;
create trigger score_entries_validate
before insert or update on public.score_entries
for each row execute function private.validate_score_entry();

grant execute on function private.validate_score_entry() to authenticated;
