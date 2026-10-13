-- Phase 5 follow-up: allow real student file submissions and persist returns.
-- Run this after supabase/schema.sql in the new Supabase project.

alter table public.submissions
  add column if not exists returned_at timestamptz,
  add column if not exists resubmit_until timestamptz,
  add column if not exists revision_note text not null default '';

drop policy if exists classroom_files_student_insert on storage.objects;
create policy classroom_files_student_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'classroom-files'
  and name like 'submissions/' || (select auth.uid())::text || '/%'
);

drop policy if exists classroom_files_student_delete on storage.objects;
create policy classroom_files_student_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'classroom-files'
  and name like 'submissions/' || (select auth.uid())::text || '/%'
);

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
