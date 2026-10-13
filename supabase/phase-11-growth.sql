-- Growth persistence for the new classroom project.
-- This file is also included in schema.sql for fresh projects.

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
  skin text not null, hair text not null, shirt text not null, backdrop text not null,
  accessory text not null default 'none', automatic boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.assignments add column if not exists submission_mode text not null default 'individual';
alter table public.assignments add column if not exists group_size integer not null default 1;
alter table public.submissions add column if not exists group_id uuid;
alter table public.submissions add column if not exists group_member_ids uuid[] not null default '{}';
alter table public.growth_events enable row level security;
alter table public.growth_observations enable row level security;
alter table public.student_avatars enable row level security;
drop policy if exists growth_events_teacher_all on public.growth_events;
create policy growth_events_teacher_all on public.growth_events for all to authenticated using ((select private.is_teacher_student(student_id))) with check ((select private.is_teacher_student(student_id)) and actor_id = (select auth.uid()));
drop policy if exists growth_events_student_read on public.growth_events;
create policy growth_events_student_read on public.growth_events for select to authenticated using (student_id = (select auth.uid()));
drop policy if exists growth_observations_teacher_all on public.growth_observations;
create policy growth_observations_teacher_all on public.growth_observations for all to authenticated using ((select private.is_teacher_student(student_id))) with check ((select private.is_teacher_student(student_id)) and actor_id = (select auth.uid()));
drop policy if exists growth_observations_student_read on public.growth_observations;
create policy growth_observations_student_read on public.growth_observations for select to authenticated using (student_id = (select auth.uid()));
drop policy if exists student_avatars_teacher_all on public.student_avatars;
create policy student_avatars_teacher_all on public.student_avatars for all to authenticated using ((select private.is_teacher_student(student_id))) with check ((select private.is_teacher_student(student_id)));
drop policy if exists student_avatars_student_own on public.student_avatars;
create policy student_avatars_student_own on public.student_avatars for select to authenticated using (student_id = (select auth.uid()));
