begin;

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  period smallint not null check (period between 1 and 20),
  status text not null check (status in ('present', 'late', 'absent', 'leave')),
  note text not null default '' check (length(note) <= 500),
  recorded_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (classroom_id, attendance_date, period, student_id)
);
create index attendance_student_date_idx on public.attendance_records(student_id, attendance_date desc);

create table public.student_leave_requests (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text not null check (length(trim(reason)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '' check (length(review_note) <= 500),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 30),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null and review_note = '')
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null))
);
create index leave_classroom_status_idx on public.student_leave_requests(classroom_id, status, starts_on);
create index leave_student_idx on public.student_leave_requests(student_id, created_at desc);
create unique index leave_active_dates_unique on public.student_leave_requests(classroom_id, student_id, starts_on, ends_on)
  where status in ('pending', 'approved');

alter table public.attendance_records enable row level security;
alter table public.student_leave_requests enable row level security;
revoke all on public.attendance_records, public.student_leave_requests from anon, authenticated;
grant select, insert, update on public.attendance_records to authenticated;
grant select, insert, update on public.student_leave_requests to authenticated;
grant all on public.attendance_records, public.student_leave_requests to service_role;

create policy attendance_read on public.attendance_records for select to authenticated using (
  student_id = (select auth.uid()) or exists (
    select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid())
  )
);
create policy attendance_insert on public.attendance_records for insert to authenticated with check (
  recorded_by = (select auth.uid()) and exists (
    select 1 from public.classrooms c join public.classroom_members m on m.classroom_id = c.id
    where c.id = attendance_records.classroom_id and c.teacher_id = (select auth.uid()) and m.student_id = attendance_records.student_id
  )
);
create policy attendance_update on public.attendance_records for update to authenticated using (
  exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid()))
) with check (
  recorded_by = (select auth.uid()) and exists (
    select 1 from public.classrooms c join public.classroom_members m on m.classroom_id = c.id
    where c.id = attendance_records.classroom_id and c.teacher_id = (select auth.uid()) and m.student_id = attendance_records.student_id
  )
);
create policy leave_read on public.student_leave_requests for select to authenticated using (
  student_id = (select auth.uid()) or exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid()))
);
create policy leave_insert on public.student_leave_requests for insert to authenticated with check (
  student_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null and review_note = ''
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student' and p.status = 'active')
  and exists (select 1 from public.classroom_members m where m.classroom_id = student_leave_requests.classroom_id and m.student_id = (select auth.uid()))
);
create policy leave_review on public.student_leave_requests for update to authenticated using (
  status = 'pending' and exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid()))
) with check (
  status in ('approved', 'rejected') and reviewed_by = (select auth.uid()) and reviewed_at is not null
  and exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid()))
);

commit;
