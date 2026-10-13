-- Phase 12: security and workflow hardening.
-- Run after schema.sql and earlier phase files. Safe to run repeatedly.

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

revoke all on function private.is_assignment_student(uuid, uuid) from public;
grant execute on function private.is_assignment_student(uuid, uuid) to authenticated;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_teacher_student(id)))
with check (
  (id = (select auth.uid()) and role = (select private.current_role()))
  or ((select private.is_teacher_student(id)) and role = 'student')
);

drop policy if exists classroom_members_teacher_all on public.classroom_members;
create policy classroom_members_teacher_all on public.classroom_members for all to authenticated
using (exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid())))
with check (
  exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student')
);

drop policy if exists announcements_teacher_all on public.announcements;
create policy announcements_teacher_all on public.announcements for all to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = (select auth.uid()))
);

drop policy if exists submissions_student_own on public.submissions;
create policy submissions_student_own on public.submissions for all to authenticated
using (student_id = (select auth.uid()) and (select private.is_assignment_student(assignment_id, (select auth.uid()))))
with check (student_id = (select auth.uid()) and (select private.is_assignment_student(assignment_id, (select auth.uid()))));

drop policy if exists submissions_teacher_related on public.submissions;
create policy submissions_teacher_related on public.submissions for all to authenticated
using (exists (
  select 1 from public.assignments a
  join public.assignment_classrooms ac on ac.assignment_id = a.id
  join public.classrooms c on c.id = ac.classroom_id
  join public.classroom_members cm on cm.classroom_id = c.id and cm.student_id = submissions.student_id
  where a.id = assignment_id and c.teacher_id = (select auth.uid())
))
with check (exists (
  select 1 from public.assignments a
  join public.assignment_classrooms ac on ac.assignment_id = a.id
  join public.classrooms c on c.id = ac.classroom_id
  join public.classroom_members cm on cm.classroom_id = c.id and cm.student_id = submissions.student_id
  where a.id = assignment_id and c.teacher_id = (select auth.uid())
));

drop policy if exists scores_teacher_all on public.score_entries;
create policy scores_teacher_all on public.score_entries for all to authenticated
using (
  exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid()))
  and (select private.is_assignment_student(assignment_id, student_id))
)
with check (
  exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid()))
  and (select private.is_assignment_student(assignment_id, student_id))
  and (raw_score is null or raw_score >= 0)
  and (final_score is null or final_score >= 0)
);

drop policy if exists downloads_student_own on public.material_download_logs;
create policy downloads_student_own on public.material_download_logs for insert to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.material_classrooms mc
    where mc.material_id = material_id and (select private.is_classroom_member(mc.classroom_id))
  )
);

drop policy if exists rewards_teacher_all on public.student_rewards;
create policy rewards_teacher_all on public.student_rewards for all to authenticated
using (teacher_id = (select auth.uid()) and (select private.is_teacher_student(student_id)))
with check (teacher_id = (select auth.uid()) and (select private.is_teacher_student(student_id)));
