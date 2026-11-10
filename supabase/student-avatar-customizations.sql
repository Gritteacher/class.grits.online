create table if not exists public.student_avatar_customizations (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  face smallint not null default 0 check (face between 0 and 3),
  skin smallint not null default 2 check (skin between 0 and 7),
  hair smallint not null default 0 check (hair between -1 and 7),
  hair_color smallint not null default 0 check (hair_color between 0 and 4),
  outfit smallint not null default 4 check (outfit between 0 and 11),
  accessory smallint not null default -1 check (accessory between -1 and 3),
  backdrop smallint not null default 0 check (backdrop between 0 and 5),
  nickname text not null default '' check (char_length(nickname) <= 24),
  motto text not null default '' check (char_length(motto) <= 80),
  updated_at timestamptz not null default now()
);
alter table public.student_avatar_customizations enable row level security;
revoke all on public.student_avatar_customizations from anon, authenticated;
grant select, insert, update on public.student_avatar_customizations to authenticated;
grant all on public.student_avatar_customizations to service_role;
drop policy if exists avatar_customization_read on public.student_avatar_customizations;
create policy avatar_customization_read on public.student_avatar_customizations for select to authenticated
using (student_id = (select auth.uid()) or exists (
  select 1 from public.classroom_members cm join public.classrooms c on c.id = cm.classroom_id
  where cm.student_id = student_avatar_customizations.student_id and c.teacher_id = (select auth.uid())
));
drop policy if exists avatar_customization_insert on public.student_avatar_customizations;
create policy avatar_customization_insert on public.student_avatar_customizations for insert to authenticated
with check (student_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('student', 'teacher')));
drop policy if exists avatar_customization_update on public.student_avatar_customizations;
create policy avatar_customization_update on public.student_avatar_customizations for update to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('student', 'teacher')));
notify pgrst, 'reload schema';
