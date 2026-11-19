begin;
create schema if not exists classroom_rewards_private;
revoke all on schema classroom_rewards_private from public;
grant usage on schema classroom_rewards_private to authenticated;

create table public.classroom_wheel_rounds (
  id uuid primary key,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  participant_ids uuid[] not null check (cardinality(participant_ids) between 1 and 1000),
  allow_repeat boolean not null default false,
  attendance_date date,
  attendance_period smallint check (attendance_period between 1 and 20),
  created_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  check ((attendance_date is null) = (attendance_period is null))
);
create unique index wheel_one_active_round on public.classroom_wheel_rounds(teacher_id,classroom_id) where closed_at is null;
create index wheel_round_classroom on public.classroom_wheel_rounds(classroom_id,created_at desc);
create table public.classroom_wheel_draws (
  id uuid primary key,
  round_id uuid not null references public.classroom_wheel_rounds(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp()
);
create index wheel_draw_round on public.classroom_wheel_draws(round_id,created_at desc);
create index wheel_draw_student on public.classroom_wheel_draws(student_id);
create index wheel_draw_classroom on public.classroom_wheel_draws(classroom_id,created_at desc);
create index wheel_draw_teacher on public.classroom_wheel_draws(teacher_id);
create table public.student_reinforcement_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  draw_id uuid unique references public.classroom_wheel_draws(id) on delete cascade,
  reverses_id uuid unique references public.student_reinforcement_entries(id) on delete cascade,
  points smallint not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  teacher_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  check ((points between 1 and 100 and draw_id is not null and reverses_id is null)
    or (points between -100 and -1 and draw_id is null and reverses_id is not null))
);
create index reinforcement_student_history on public.student_reinforcement_entries(student_id,created_at desc,id);
create index reinforcement_classroom_history on public.student_reinforcement_entries(classroom_id,created_at desc,id);
create index reinforcement_teacher on public.student_reinforcement_entries(teacher_id);

alter table public.classroom_wheel_rounds enable row level security;
alter table public.classroom_wheel_draws enable row level security;
alter table public.student_reinforcement_entries enable row level security;
revoke all on public.classroom_wheel_rounds,public.classroom_wheel_draws,public.student_reinforcement_entries from public,anon,authenticated;
grant select on public.classroom_wheel_rounds,public.classroom_wheel_draws,public.student_reinforcement_entries to authenticated;
grant all on public.classroom_wheel_rounds,public.classroom_wheel_draws,public.student_reinforcement_entries to service_role;
create policy wheel_round_read on public.classroom_wheel_rounds for select to authenticated using
  (teacher_id=(select auth.uid()) and exists(select 1 from public.classrooms c where c.id=classroom_id and c.teacher_id=(select auth.uid())));
create policy wheel_draw_read on public.classroom_wheel_draws for select to authenticated using
  (teacher_id=(select auth.uid()) and exists(select 1 from public.classrooms c where c.id=classroom_id and c.teacher_id=(select auth.uid())));
create policy reinforcement_read on public.student_reinforcement_entries for select to authenticated using
  (student_id=(select auth.uid()) or (teacher_id=(select auth.uid()) and exists(select 1 from public.classrooms c where c.id=classroom_id and c.teacher_id=(select auth.uid()))));

create function classroom_rewards_private.require_teacher(p_room uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
  if who is null or not exists(select 1 from public.profiles where id=who and role='teacher')
    or not exists(select 1 from public.classrooms where id=p_room and teacher_id=who) then
    raise exception 'ไม่มีสิทธิ์จัดการวงล้อของห้องนี้' using errcode='42501';
  end if;
  return who;
end $$;

create function classroom_rewards_private.start_round(p_id uuid,p_classroom uuid,p_students uuid[],p_repeat boolean,p_date date,p_period integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid; ids uuid[]; saved public.classroom_wheel_rounds;
begin
  who:=classroom_rewards_private.require_teacher(p_classroom);
  perform 1 from public.classrooms where id=p_classroom for update;
  if p_id is null or p_repeat is null or p_students is null or cardinality(p_students) not between 1 and 1000 then raise exception 'เลือกผู้เข้าร่วมก่อนเริ่มรอบ'; end if;
  if (p_date is null) <> (p_period is null) or (p_period is not null and p_period not between 1 and 20) then raise exception 'เลือกวันและคาบให้ถูกต้อง'; end if;
  select array_agg(distinct s.id order by s.id) into ids from public.profiles s
    join public.classroom_members m on m.student_id=s.id
    where m.classroom_id=p_classroom and s.role='student' and coalesce(s.status,'active')='active' and s.id=any(p_students)
    and (p_date is null or exists(select 1 from public.attendance_records a where a.classroom_id=p_classroom and a.student_id=s.id and a.attendance_date=p_date and a.period=p_period and a.status in ('present','late')));
  if ids is null or cardinality(ids)<>cardinality(p_students) then raise exception 'รายชื่อผู้เข้าร่วมเปลี่ยนไป กรุณาตรวจสอบห้องและการเช็คชื่ออีกครั้ง'; end if;
  select * into saved from public.classroom_wheel_rounds where id=p_id;
  if found then
    if saved.teacher_id<>who or saved.classroom_id<>p_classroom then raise exception 'รหัสรอบไม่ถูกต้อง'; end if;
    return to_jsonb(saved);
  end if;
  update public.classroom_wheel_rounds set closed_at=clock_timestamp() where classroom_id=p_classroom and teacher_id=who and closed_at is null;
  insert into public.classroom_wheel_rounds(id,classroom_id,teacher_id,participant_ids,allow_repeat,attendance_date,attendance_period)
    values(p_id,p_classroom,who,ids,p_repeat,p_date,p_period) returning * into saved;
  return to_jsonb(saved);
end $$;

create function classroom_rewards_private.spin(p_round uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.classroom_wheel_rounds; d public.classroom_wheel_draws; candidates uuid[]; winner uuid;
begin
  select * into r from public.classroom_wheel_rounds where id=p_round for update;
  if not found then raise exception 'ไม่พบรอบสุ่ม กรุณาเริ่มรอบใหม่'; end if;
  perform classroom_rewards_private.require_teacher(r.classroom_id);
  if r.teacher_id<>auth.uid() then raise exception 'ไม่มีสิทธิ์สุ่มรอบนี้' using errcode='42501'; end if;
  if p_id is null then raise exception 'ไม่พบรหัสการสุ่ม'; end if;
  select * into d from public.classroom_wheel_draws where id=p_id;
  if found then
    if d.round_id<>r.id or d.teacher_id<>auth.uid() then raise exception 'รหัสการสุ่มไม่ถูกต้อง'; end if;
    return to_jsonb(d);
  end if;
  if r.closed_at is not null then raise exception 'รอบนี้ปิดแล้ว กรุณาโหลดรอบปัจจุบัน'; end if;
  select array_agg(distinct s.id order by s.id) into candidates from public.profiles s
    join public.classroom_members m on m.student_id=s.id
    where m.classroom_id=r.classroom_id and s.id=any(r.participant_ids) and s.role='student' and coalesce(s.status,'active')='active'
    and (r.allow_repeat or not exists(select 1 from public.classroom_wheel_draws x where x.round_id=r.id and x.student_id=s.id))
    and (r.attendance_date is null or exists(select 1 from public.attendance_records a where a.classroom_id=r.classroom_id and a.student_id=s.id and a.attendance_date=r.attendance_date and a.period=r.attendance_period and a.status in ('present','late')));
  if candidates is null then raise exception 'ครบทุกคนในรอบแล้ว หรือไม่มีผู้เข้าร่วมที่พร้อมสุ่ม'; end if;
  winner:=candidates[1+floor(random()*cardinality(candidates))::integer];
  insert into public.classroom_wheel_draws(id,round_id,classroom_id,teacher_id,student_id)
    values(p_id,r.id,r.classroom_id,r.teacher_id,winner) returning * into d;
  return to_jsonb(d);
end $$;

create function classroom_rewards_private.award(p_draw uuid,p_id uuid,p_points integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.classroom_wheel_draws; e public.student_reinforcement_entries; teacher_name text;
begin
  select * into d from public.classroom_wheel_draws where id=p_draw for update;
  if not found then raise exception 'ไม่พบผลสุ่ม'; end if;
  perform classroom_rewards_private.require_teacher(d.classroom_id);
  if d.teacher_id<>auth.uid() then raise exception 'ไม่มีสิทธิ์ให้แต้มจากผลสุ่มนี้' using errcode='42501'; end if;
  select * into e from public.student_reinforcement_entries where draw_id=p_draw;
  if found then return to_jsonb(e); end if;
  if p_id is null or p_points is null or p_points not between 1 and 100 or p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then raise exception 'ให้แต้มจำนวนเต็ม 1–100 และระบุเหตุผลไม่เกิน 500 ตัวอักษร'; end if;
  if not exists(select 1 from public.classroom_members m join public.profiles s on s.id=m.student_id where m.classroom_id=d.classroom_id and m.student_id=d.student_id and s.role='student' and coalesce(s.status,'active')='active') then raise exception 'นักเรียนไม่ได้อยู่ในห้องหรือถูกพักรายชื่อแล้ว'; end if;
  select display_name into teacher_name from public.profiles where id=auth.uid();
  insert into public.student_reinforcement_entries(id,student_id,teacher_id,classroom_id,draw_id,points,reason,teacher_name)
    values(p_id,d.student_id,d.teacher_id,d.classroom_id,d.id,p_points,btrim(p_reason),coalesce(teacher_name,'ครูผู้สอน')) returning * into e;
  return to_jsonb(e);
end $$;

create function classroom_rewards_private.reverse_award(p_entry uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare original public.student_reinforcement_entries; reversal public.student_reinforcement_entries;
begin
  select * into original from public.student_reinforcement_entries where id=p_entry for update;
  if not found or original.points<=0 then raise exception 'ไม่พบรายการให้แต้ม'; end if;
  perform classroom_rewards_private.require_teacher(original.classroom_id);
  if original.teacher_id<>auth.uid() then raise exception 'ยกเลิกได้เฉพาะแต้มที่คุณให้ไว้' using errcode='42501'; end if;
  select * into reversal from public.student_reinforcement_entries where reverses_id=p_entry;
  if found then return to_jsonb(reversal); end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then raise exception 'ระบุเหตุผลการยกเลิกไม่เกิน 500 ตัวอักษร'; end if;
  insert into public.student_reinforcement_entries(student_id,teacher_id,classroom_id,reverses_id,points,reason,teacher_name)
    values(original.student_id,original.teacher_id,original.classroom_id,original.id,-original.points,btrim(p_reason),original.teacher_name) returning * into reversal;
  return to_jsonb(reversal);
end $$;

create function classroom_rewards_private.summary(p_student uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare latest public.student_reinforcement_entries; total bigint;
begin
  if auth.uid() is null or not (auth.uid()=p_student or exists(select 1 from public.classroom_members m join public.classrooms c on c.id=m.classroom_id join public.profiles t on t.id=c.teacher_id where m.student_id=p_student and c.teacher_id=auth.uid() and t.role='teacher')) then raise exception 'ไม่มีสิทธิ์อ่านแต้มของนักเรียนคนนี้' using errcode='42501'; end if;
  select coalesce(sum(points),0) into total from public.student_reinforcement_entries where student_id=p_student;
  select * into latest from public.student_reinforcement_entries where student_id=p_student order by created_at desc,id desc limit 1;
  return jsonb_build_object('total',total,'latest_id',latest.id,'latest_points',coalesce(latest.points,0),'latest_at',latest.created_at);
end $$;

-- Participant arrays must not retain a deleted student's account ID.
create function classroom_rewards_private.remove_participant() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from public.classroom_wheel_rounds where participant_ids=array[old.id];
  update public.classroom_wheel_rounds set participant_ids=array_remove(participant_ids,old.id) where old.id=any(participant_ids);
  return old;
end $$;
create trigger wheel_student_deleted before delete on public.profiles for each row execute function classroom_rewards_private.remove_participant();

create function public.start_classroom_wheel_round(p_id uuid,p_classroom uuid,p_students uuid[],p_repeat boolean default false,p_date date default null,p_period integer default null) returns jsonb
language sql security invoker set search_path='' as $$ select classroom_rewards_private.start_round(p_id,p_classroom,p_students,p_repeat,p_date,p_period) $$;
create function public.spin_classroom_wheel(p_round uuid,p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select classroom_rewards_private.spin(p_round,p_id) $$;
create function public.award_classroom_reinforcement(p_draw uuid,p_id uuid,p_points integer,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$ select classroom_rewards_private.award(p_draw,p_id,p_points,p_reason) $$;
create function public.reverse_classroom_reinforcement(p_entry uuid,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$ select classroom_rewards_private.reverse_award(p_entry,p_reason) $$;
create function public.student_reinforcement_summary(p_student uuid) returns jsonb
language sql security invoker set search_path='' as $$ select classroom_rewards_private.summary(p_student) $$;

revoke all on all functions in schema classroom_rewards_private from public,anon,authenticated;
grant execute on function classroom_rewards_private.start_round(uuid,uuid,uuid[],boolean,date,integer),classroom_rewards_private.spin(uuid,uuid),classroom_rewards_private.award(uuid,uuid,integer,text),classroom_rewards_private.reverse_award(uuid,text),classroom_rewards_private.summary(uuid) to authenticated;
revoke all on function public.start_classroom_wheel_round(uuid,uuid,uuid[],boolean,date,integer),public.spin_classroom_wheel(uuid,uuid),public.award_classroom_reinforcement(uuid,uuid,integer,text),public.reverse_classroom_reinforcement(uuid,text),public.student_reinforcement_summary(uuid) from public,anon;
grant execute on function public.start_classroom_wheel_round(uuid,uuid,uuid[],boolean,date,integer),public.spin_classroom_wheel(uuid,uuid),public.award_classroom_reinforcement(uuid,uuid,integer,text),public.reverse_classroom_reinforcement(uuid,text),public.student_reinforcement_summary(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
