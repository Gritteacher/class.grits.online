begin;
select set_config('wheel_test.room',(select m.classroom_id::text from public.classroom_members m join public.profiles p on p.id=m.student_id where p.role='student' and coalesce(p.status,'active')='active' group by m.classroom_id having count(distinct m.student_id)>=2 limit 1),true);
select set_config('wheel_test.teacher',(select teacher_id::text from public.classrooms where id=current_setting('wheel_test.room')::uuid),true);
select set_config('wheel_test.students',(select array_agg(id)::text from (select distinct p.id from public.classroom_members m join public.profiles p on p.id=m.student_id where m.classroom_id=current_setting('wheel_test.room')::uuid and p.role='student' and coalesce(p.status,'active')='active' order by p.id limit 2) s),true);
select set_config('wheel_test.round',gen_random_uuid()::text,true);
select set_config('wheel_test.draw',gen_random_uuid()::text,true);
select set_config('request.jwt.claim.sub',current_setting('wheel_test.teacher'),true);
set local role authenticated;
select public.start_classroom_wheel_round(current_setting('wheel_test.round')::uuid,current_setting('wheel_test.room')::uuid,current_setting('wheel_test.students')::uuid[],false);
select public.start_classroom_wheel_round(current_setting('wheel_test.round')::uuid,current_setting('wheel_test.room')::uuid,current_setting('wheel_test.students')::uuid[],false);
select set_config('wheel_test.winner',(public.spin_classroom_wheel(current_setting('wheel_test.round')::uuid,current_setting('wheel_test.draw')::uuid)->>'student_id'),true);
do $$ declare replay jsonb; next_draw jsonb; exhausted boolean:=false; denied boolean:=false; begin
  replay:=public.spin_classroom_wheel(current_setting('wheel_test.round')::uuid,current_setting('wheel_test.draw')::uuid);
  if replay->>'student_id'<>current_setting('wheel_test.winner') then raise exception 'Replay changed winner'; end if;
  next_draw:=public.spin_classroom_wheel(current_setting('wheel_test.round')::uuid,gen_random_uuid());
  if next_draw->>'student_id'=current_setting('wheel_test.winner') then raise exception 'No-repeat failed'; end if;
  perform set_config('wheel_test.peer',next_draw->>'student_id',true);
  begin perform public.spin_classroom_wheel(current_setting('wheel_test.round')::uuid,gen_random_uuid()); exception when raise_exception then exhausted:=position('ครบทุกคน' in sqlerrm)>0; end;
  if not exhausted then raise exception 'Exhausted round accepted another draw'; end if;
  begin perform public.award_classroom_reinforcement(current_setting('wheel_test.draw')::uuid,gen_random_uuid(),101,'Invalid points'); exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'Invalid points accepted'; end if;
end $$;
select set_config('wheel_test.before',(public.student_reinforcement_summary(current_setting('wheel_test.winner')::uuid)->>'total'),true);
select set_config('wheel_test.entry',(public.award_classroom_reinforcement(current_setting('wheel_test.draw')::uuid,gen_random_uuid(),3,'Rollback-only reinforcement security test')->>'id'),true);
do $$ declare replay jsonb; denied boolean:=false; begin
  replay:=public.award_classroom_reinforcement(current_setting('wheel_test.draw')::uuid,gen_random_uuid(),5,'Duplicate retry');
  if replay->>'id'<>current_setting('wheel_test.entry') or (replay->>'points')::int<>3 then raise exception 'Duplicate award was not idempotent'; end if;
  if (public.student_reinforcement_summary(current_setting('wheel_test.winner')::uuid)->>'total')::bigint<>current_setting('wheel_test.before')::bigint+3 then raise exception 'Balance increment wrong'; end if;
  begin update public.student_reinforcement_entries set points=100 where id=current_setting('wheel_test.entry')::uuid; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct ledger mutation allowed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('wheel_test.winner'),true);
set local role authenticated;
do $$ declare denied boolean:=false; begin
  if not exists(select 1 from public.student_reinforcement_entries where id=current_setting('wheel_test.entry')::uuid) then raise exception 'Student cannot read own points'; end if;
  begin perform public.spin_classroom_wheel(current_setting('wheel_test.round')::uuid,gen_random_uuid()); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Student can spin teacher wheel'; end if;
  denied:=false;
  begin perform public.student_reinforcement_summary(current_setting('wheel_test.peer')::uuid); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Peer balance exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('wheel_test.peer'),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.student_reinforcement_entries where id=current_setting('wheel_test.entry')::uuid) then raise exception 'Peer ledger exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('wheel_test.teacher'),true);
set local role authenticated;
select public.reverse_classroom_reinforcement(current_setting('wheel_test.entry')::uuid,'Rollback-only correction');
select public.reverse_classroom_reinforcement(current_setting('wheel_test.entry')::uuid,'Idempotent correction retry');
do $$ begin
  if (public.student_reinforcement_summary(current_setting('wheel_test.winner')::uuid)->>'total')::bigint<>current_setting('wheel_test.before')::bigint then raise exception 'Reversal balance wrong'; end if;
  if (select count(*) from public.student_reinforcement_entries where reverses_id=current_setting('wheel_test.entry')::uuid)<>1 then raise exception 'Duplicate correction accepted'; end if;
end $$;
reset role;
set local role anon;
do $$ declare denied boolean:=false; begin
  begin perform public.student_reinforcement_summary(current_setting('wheel_test.winner')::uuid); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous points access allowed'; end if;
end $$;
reset role;
rollback;
select 'PASS: server random draw, no-repeat, retry idempotency, points validation, own/peer/anon permissions, immutable ledger and reversal; ALL test data rolled back' as result;
