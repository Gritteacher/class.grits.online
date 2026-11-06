-- Run in SQL Editor. All writes are transaction-only and rolled back.
begin;
create temporary table attendance_test_context as
select c.id as classroom_id, c.teacher_id, array_agg(m.student_id order by m.student_id) as students
from public.classrooms c join public.classroom_members m on m.classroom_id=c.id
join public.profiles p on p.id=m.student_id and p.role='student' and p.status='active'
group by c.id,c.teacher_id having count(*)>=2 limit 1;
alter table attendance_test_context enable row level security;
create policy test_context_read on attendance_test_context for select to authenticated using (true);
grant select on attendance_test_context to authenticated;
select set_config('request.jwt.claim.sub',(select teacher_id::text from attendance_test_context),true);
set local role authenticated;
insert into public.attendance_records(classroom_id,student_id,attendance_date,period,status,recorded_by)
select classroom_id,unnest(students[1:2]),'2000-01-01',20,'present',teacher_id from attendance_test_context;
do $$ begin
  if (select count(*) from public.attendance_records where attendance_date='2000-01-01' and period=20)<>2 then raise exception 'teacher read failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select students[1]::text from attendance_test_context),true);
do $$ declare n integer; begin
  if (select count(*) from public.attendance_records where attendance_date='2000-01-01' and period=20)<>1 then raise exception 'student isolation failed'; end if;
  update public.attendance_records set status='absent' where attendance_date='2000-01-01' and period=20;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'student altered attendance'; end if;
  begin
    insert into public.attendance_records(classroom_id,student_id,attendance_date,period,status,recorded_by)
    select classroom_id,students[1],'2000-01-02',20,'present',students[1] from attendance_test_context;
    raise exception 'student forged attendance';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.student_leave_requests(classroom_id,student_id,starts_on,ends_on,reason)
select classroom_id,students[1],'2000-01-01','2000-01-01','transaction-only test' from attendance_test_context;
do $$ declare n integer; begin
  update public.student_leave_requests set status='approved', reviewed_by=(select teacher_id from attendance_test_context),reviewed_at=now() where reason='transaction-only test';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'student self-approved'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select students[2]::text from attendance_test_context),true);
do $$ begin
  if exists(select 1 from public.student_leave_requests where reason='transaction-only test') then raise exception 'peer leave leaked'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select teacher_id::text from attendance_test_context),true);
update public.student_leave_requests set status='approved',reviewed_by=(select teacher_id from attendance_test_context),reviewed_at=now() where reason='transaction-only test';
do $$ begin
  if not exists(select 1 from public.student_leave_requests where reason='transaction-only test' and status='approved') then raise exception 'teacher approval failed'; end if;
end $$;
reset role;
rollback;
select 'PASS: permissions tested; all test data rolled back' as result;
