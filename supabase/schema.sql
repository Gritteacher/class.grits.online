-- New classroom foundation schema for class.grits.online.
-- Run once in the new Supabase project. This schema intentionally starts empty.

create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('teacher', 'student')),
  display_name text not null default '',
  student_code text unique,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists status text not null default 'active';
do $$ begin
  alter table public.profiles add constraint profiles_status_check check (status in ('active', 'archived'));
exception when duplicate_object then null;
end $$;

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_year text not null default '2569',
  level text not null default '',
  room text not null default '',
  subject text not null default 'สังคมศึกษา',
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_number integer,
  joined_at timestamptz not null default now(),
  primary key (classroom_id, student_id)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  file_path text not null,
  mime_type text not null default 'application/octet-stream',
  file_size bigint not null default 0 check (file_size >= 0),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.material_classrooms (
  material_id uuid not null references public.materials(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  primary key (material_id, classroom_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  title text not null,
  body text not null default '',
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'ใบงาน',
  raw_max numeric(8,2) not null default 10 check (raw_max >= 0),
  final_max numeric(8,2) not null default 10 check (final_max >= 0),
  due_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  submission_required boolean not null default true,
  submission_mode text not null default 'individual' check (submission_mode in ('individual', 'group')),
  group_size integer not null default 1 check (group_size between 1 and 50),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (final_max >= 0 and raw_max >= 0)
);

create table if not exists public.assignment_classrooms (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  primary key (assignment_id, classroom_id)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid,
  group_member_ids uuid[] not null default '{}',
  response text not null default '',
  link text,
  file_path text,
  file_name text,
  file_type text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'returned')),
  feedback text not null default '',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  returned_at timestamptz,
  resubmit_until timestamptz,
  revision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

alter table public.submissions
  add column if not exists returned_at timestamptz,
  add column if not exists resubmit_until timestamptz,
  add column if not exists revision_note text not null default '';

create table if not exists public.score_entries (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  raw_score numeric(8,2) check (raw_score is null or raw_score >= 0),
  final_score numeric(8,2) check (final_score is null or final_score >= 0),
  status text not null default 'not_graded' check (status in ('not_graded', 'graded', 'late', 'missing', 'excused')),
  note text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists public.material_download_logs (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

create table if not exists public.student_rewards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null default 0,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.growth_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('award', 'deduct', 'reverse')),
  delta integer not null,
  reason text not null default '',
  actor_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now(),
  reversal_of uuid references public.growth_events(id) on delete set null
);

create table if not exists public.growth_observations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  axis text not null check (axis in ('participation', 'persistence', 'cooperation', 'reflection')),
  rating integer not null check (rating between 0 and 4),
  note text not null default '',
  actor_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now()
);

create table if not exists public.student_avatars (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  skin text not null,
  hair text not null check (hair in ('short', 'bob', 'curly')),
  shirt text not null,
  backdrop text not null,
  accessory text not null default 'none' check (accessory in ('none', 'glasses', 'star')),
  automatic boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists classroom_members_student_idx on public.classroom_members(student_id);
create index if not exists assignment_classrooms_classroom_idx on public.assignment_classrooms(classroom_id);
create index if not exists submissions_student_idx on public.submissions(student_id);
create index if not exists score_entries_student_idx on public.score_entries(student_id);

create or replace function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'teacher'
  );
$$;

create or replace function private.is_classroom_member(target_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classroom_members m
    where m.classroom_id = target_classroom and m.student_id = (select auth.uid())
  );
$$;

create or replace function private.is_teacher_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classroom_members m
    join public.classrooms c on c.id = m.classroom_id
    where m.student_id = target_student and c.teacher_id = (select auth.uid())
  );
$$;

create or replace function private.is_assignment_student(target_assignment uuid, target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignment_classrooms ac
    join public.classroom_members cm on cm.classroom_id = ac.classroom_id
    where ac.assignment_id = target_assignment
      and cm.student_id = target_student
  );
$$;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

revoke all on schema private from public;
revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_teacher() to authenticated;
grant execute on function private.is_classroom_member(uuid) to authenticated;
grant execute on function private.is_teacher_student(uuid) to authenticated;
grant execute on function private.is_assignment_student(uuid, uuid) to authenticated;
grant execute on function private.current_role() to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'classrooms', 'classroom_members', 'materials',
    'material_classrooms', 'announcements', 'assignments',
    'assignment_classrooms', 'submissions', 'score_entries',
    'material_download_logs', 'student_rewards', 'growth_events',
    'growth_observations', 'student_avatars'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_teacher_student(id)));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'student');
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_teacher_student(id)))
with check (
  (id = (select auth.uid()) and role = (select private.current_role()))
  or ((select private.is_teacher_student(id)) and role = 'student')
);

drop policy if exists classrooms_teacher_all on public.classrooms;
create policy classrooms_teacher_all on public.classrooms for all to authenticated
using (teacher_id = (select auth.uid()))
with check (teacher_id = (select auth.uid()));
drop policy if exists classrooms_student_read on public.classrooms;
create policy classrooms_student_read on public.classrooms for select to authenticated
using ((select private.is_classroom_member(id)));

drop policy if exists classroom_members_teacher_all on public.classroom_members;
create policy classroom_members_teacher_all on public.classroom_members for all to authenticated
using (exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid())))
with check (
  exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student')
);
drop policy if exists classroom_members_student_read on public.classroom_members;
create policy classroom_members_student_read on public.classroom_members for select to authenticated
using (student_id = (select auth.uid()));

drop policy if exists materials_teacher_all on public.materials;
create policy materials_teacher_all on public.materials for all to authenticated
using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
drop policy if exists materials_student_read on public.materials;
create policy materials_student_read on public.materials for select to authenticated
using (exists (select 1 from public.material_classrooms mc where mc.material_id = id and (select private.is_classroom_member(mc.classroom_id))));

drop policy if exists material_classrooms_teacher_all on public.material_classrooms;
create policy material_classrooms_teacher_all on public.material_classrooms for all to authenticated
using (exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid())))
with check (exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid())));
drop policy if exists material_classrooms_student_read on public.material_classrooms;
create policy material_classrooms_student_read on public.material_classrooms for select to authenticated
using ((select private.is_classroom_member(classroom_id)));

drop policy if exists announcements_teacher_all on public.announcements;
create policy announcements_teacher_all on public.announcements for all to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid()))
);
drop policy if exists announcements_student_read on public.announcements;
create policy announcements_student_read on public.announcements for select to authenticated
using ((select private.is_classroom_member(classroom_id)));

drop policy if exists assignments_teacher_all on public.assignments;
create policy assignments_teacher_all on public.assignments for all to authenticated
using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
drop policy if exists assignments_student_read on public.assignments;
create policy assignments_student_read on public.assignments for select to authenticated
using (exists (select 1 from public.assignment_classrooms ac where ac.assignment_id = id and (select private.is_classroom_member(ac.classroom_id))));

drop policy if exists assignment_classrooms_teacher_all on public.assignment_classrooms;
create policy assignment_classrooms_teacher_all on public.assignment_classrooms for all to authenticated
using (exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid())))
with check (exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid())));
drop policy if exists assignment_classrooms_student_read on public.assignment_classrooms;
create policy assignment_classrooms_student_read on public.assignment_classrooms for select to authenticated
using ((select private.is_classroom_member(classroom_id)));

drop policy if exists submissions_student_own on public.submissions;
create policy submissions_student_own on public.submissions for all to authenticated
using (
  student_id = (select auth.uid())
  and (select private.is_assignment_student(assignment_id, (select auth.uid())))
)
with check (
  student_id = (select auth.uid())
  and (select private.is_assignment_student(assignment_id, (select auth.uid())))
);
drop policy if exists submissions_teacher_related on public.submissions;
create policy submissions_teacher_related on public.submissions for all to authenticated
using (
  exists (
    select 1 from public.assignments a
    join public.assignment_classrooms ac on ac.assignment_id = a.id
    join public.classrooms c on c.id = ac.classroom_id
    join public.classroom_members cm on cm.classroom_id = c.id and cm.student_id = submissions.student_id
    where a.id = assignment_id and c.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.assignments a
    join public.assignment_classrooms ac on ac.assignment_id = a.id
    join public.classrooms c on c.id = ac.classroom_id
    join public.classroom_members cm on cm.classroom_id = c.id and cm.student_id = submissions.student_id
    where a.id = assignment_id and c.teacher_id = (select auth.uid())
  )
);

drop policy if exists scores_teacher_all on public.score_entries;
create policy scores_teacher_all on public.score_entries for all to authenticated
using (exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid())) and (select private.is_assignment_student(assignment_id, student_id)))
with check (exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid())) and (select private.is_assignment_student(assignment_id, student_id)) and (raw_score is null or raw_score >= 0) and (final_score is null or final_score >= 0));
drop policy if exists scores_student_own on public.score_entries;
create policy scores_student_own on public.score_entries for select to authenticated
using (student_id = (select auth.uid()));

drop policy if exists downloads_student_own on public.material_download_logs;
create policy downloads_student_own on public.material_download_logs for insert to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.material_classrooms mc
    where mc.material_id = material_id and (select private.is_classroom_member(mc.classroom_id))
  )
);
drop policy if exists downloads_student_read on public.material_download_logs;
create policy downloads_student_read on public.material_download_logs for select to authenticated
using (student_id = (select auth.uid()));
drop policy if exists downloads_teacher_read on public.material_download_logs;
create policy downloads_teacher_read on public.material_download_logs for select to authenticated
using (exists (
  select 1 from public.materials m
  where m.id = material_id and m.teacher_id = (select auth.uid())
));

drop policy if exists rewards_teacher_all on public.student_rewards;
create policy rewards_teacher_all on public.student_rewards for all to authenticated
using (teacher_id = (select auth.uid()) and (select private.is_teacher_student(student_id)))
with check (teacher_id = (select auth.uid()) and (select private.is_teacher_student(student_id)));
drop policy if exists rewards_student_read on public.student_rewards;
create policy rewards_student_read on public.student_rewards for select to authenticated
using (student_id = (select auth.uid()));

drop policy if exists growth_events_teacher_all on public.growth_events;
create policy growth_events_teacher_all on public.growth_events for all to authenticated
using ((select private.is_teacher_student(student_id)))
with check ((select private.is_teacher_student(student_id)) and actor_id = (select auth.uid()));
drop policy if exists growth_events_student_read on public.growth_events;
create policy growth_events_student_read on public.growth_events for select to authenticated
using (student_id = (select auth.uid()));

drop policy if exists growth_observations_teacher_all on public.growth_observations;
create policy growth_observations_teacher_all on public.growth_observations for all to authenticated
using ((select private.is_teacher_student(student_id)))
with check ((select private.is_teacher_student(student_id)) and actor_id = (select auth.uid()));
drop policy if exists growth_observations_student_read on public.growth_observations;
create policy growth_observations_student_read on public.growth_observations for select to authenticated
using (student_id = (select auth.uid()));

drop policy if exists student_avatars_teacher_all on public.student_avatars;
create policy student_avatars_teacher_all on public.student_avatars for all to authenticated
using ((select private.is_teacher_student(student_id)))
with check ((select private.is_teacher_student(student_id)));
drop policy if exists student_avatars_student_own on public.student_avatars;
create policy student_avatars_student_own on public.student_avatars for select to authenticated
using (student_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('classroom-files', 'classroom-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists classroom_files_read on storage.objects;
create policy classroom_files_read on storage.objects for select to authenticated
using (
  bucket_id = 'classroom-files'
  and (
    exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where a.teacher_id = (select auth.uid())
        and s.file_path = name
    )
    or exists (
      select 1
      from public.materials m
      where m.teacher_id = (select auth.uid()) and m.file_path = name
    )
    or exists (
      select 1 from public.submissions s
      where s.student_id = (select auth.uid()) and s.file_path = name
    )
    or exists (
      select 1
      from public.materials m
      join public.material_classrooms mc on mc.material_id = m.id
      where m.file_path = name and (select private.is_classroom_member(mc.classroom_id))
    )
  )
);
drop policy if exists classroom_files_teacher_insert on storage.objects;
create policy classroom_files_teacher_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'classroom-files'
  and name like 'materials/' || (select auth.uid())::text || '/%'
);
drop policy if exists classroom_files_student_insert on storage.objects;
create policy classroom_files_student_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'classroom-files'
  and name like 'submissions/' || (select auth.uid())::text || '/%'
);
drop policy if exists classroom_files_teacher_update on storage.objects;
create policy classroom_files_teacher_update on storage.objects for update to authenticated
using (bucket_id = 'classroom-files' and name like 'materials/' || (select auth.uid())::text || '/%')
with check (bucket_id = 'classroom-files' and name like 'materials/' || (select auth.uid())::text || '/%');
drop policy if exists classroom_files_teacher_delete on storage.objects;
create policy classroom_files_teacher_delete on storage.objects for delete to authenticated
using (bucket_id = 'classroom-files' and name like 'materials/' || (select auth.uid())::text || '/%');
drop policy if exists classroom_files_teacher_submission_delete on storage.objects;
create policy classroom_files_teacher_submission_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'classroom-files'
  and exists (
    select 1
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where a.teacher_id = (select auth.uid()) and s.file_path = name
  )
);
drop policy if exists classroom_files_student_delete on storage.objects;
create policy classroom_files_student_delete on storage.objects for delete to authenticated
using (bucket_id = 'classroom-files' and name like 'submissions/' || (select auth.uid())::text || '/%');
