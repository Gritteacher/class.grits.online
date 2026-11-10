-- Keep the existing table/column names so saved student avatars do not move.
-- student_id references profiles.id and serves as the avatar owner's account ID.
begin;
alter policy avatar_customization_insert on public.student_avatar_customizations
with check (student_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('student', 'teacher')));
alter policy avatar_customization_update on public.student_avatar_customizations
with check (student_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('student', 'teacher')));
commit;
