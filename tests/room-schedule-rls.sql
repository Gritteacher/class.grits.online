-- Run against an existing classroom with an assignment and student membership.
-- All data changes are rolled back.
begin;
select set_config('request.jwt.claim.sub', (select teacher_id::text from public.assignments limit 1), true);
set local role authenticated;
do $$ declare target uuid; room uuid; changed integer; begin
  select a.id, ac.classroom_id into target, room
  from public.assignments a join public.assignment_classrooms ac on ac.assignment_id = a.id
  where a.teacher_id = auth.uid() limit 1;
  if target is null then raise exception 'No linked assignment available for test'; end if;
  update public.assignments set room_schedules = jsonb_set(room_schedules, array[room::text], '{"closesAt":"2026-12-05T08:00:00Z","allowLate":false}'::jsonb) where id = target;
  get diagnostics changed = row_count;
  if changed <> 1 or not exists (select 1 from public.assignments where id = target and room_schedules -> room::text ->> 'closesAt' = '2026-12-05T08:00:00Z') then
    raise exception 'Teacher schedule save failed';
  end if;
  begin
    update public.assignments set room_schedules = '[]'::jsonb where id = target;
    raise exception 'Invalid schedule accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select cm.student_id::text from public.classroom_members cm join public.assignment_classrooms ac on ac.classroom_id = cm.classroom_id limit 1), true);
set local role authenticated;
do $$ declare changed integer; begin
  update public.assignments set room_schedules = '{}'::jsonb;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Student schedule write was not denied'; end if;
end $$;
rollback;
select 'PASS: teacher can save schedules, malformed JSON rejected, student cannot edit; all test changes rolled back' as result;
