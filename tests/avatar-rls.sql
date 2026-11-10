begin;
select set_config('avatar_test.student', (select cm.student_id::text from public.classroom_members cm join public.profiles p on p.id=cm.student_id where p.role='student' limit 1),true);
select set_config('avatar_test.other', (select id::text from public.profiles where role='student' and id::text<>current_setting('avatar_test.student') limit 1),true);
select set_config('avatar_test.teacher', (select c.teacher_id::text from public.classroom_members cm join public.classrooms c on c.id=cm.classroom_id where cm.student_id::text=current_setting('avatar_test.student') limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('avatar_test.student'),true);
set local role authenticated;
insert into public.student_avatar_customizations(student_id,nickname,outfit) values(auth.uid(),'Avatar test',7) on conflict(student_id) do update set nickname=excluded.nickname,outfit=excluded.outfit;
do $$ begin
  if not exists(select 1 from public.student_avatar_customizations where student_id=auth.uid() and outfit=7) then raise exception 'Own avatar save failed'; end if;
  begin update public.student_avatar_customizations set face=99 where student_id=auth.uid(); raise exception 'Invalid option accepted'; exception when check_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('avatar_test.other'),true);
set local role authenticated;
do $$ declare changed integer; begin
  if exists(select 1 from public.student_avatar_customizations where student_id::text=current_setting('avatar_test.student')) then raise exception 'Peer read allowed'; end if;
  update public.student_avatar_customizations set outfit=0 where student_id::text=current_setting('avatar_test.student');
  get diagnostics changed = row_count;
  if changed<>0 then raise exception 'Peer edit allowed'; end if;
  begin insert into public.student_avatar_customizations(student_id) values(current_setting('avatar_test.student')::uuid); raise exception 'Peer insert allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('avatar_test.teacher'),true);
set local role authenticated;
do $$ declare changed integer; begin
  if not exists(select 1 from public.student_avatar_customizations where student_id::text=current_setting('avatar_test.student')) then raise exception 'Class teacher read denied'; end if;
  update public.student_avatar_customizations set outfit=0 where student_id::text=current_setting('avatar_test.student');
  get diagnostics changed = row_count;
  if changed<>0 then raise exception 'Teacher edited student customization'; end if;
end $$;
rollback;
select 'PASS: own save, option validation, peer isolation, teacher read only; all test data rolled back' as result;
