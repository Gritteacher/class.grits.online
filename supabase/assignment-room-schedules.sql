-- Optional classroom-specific schedules. Existing assignments keep their defaults.
alter table public.assignments add column if not exists room_schedules jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.assignments'::regclass and conname = 'assignments_room_schedules_object') then
    alter table public.assignments add constraint assignments_room_schedules_object check (jsonb_typeof(room_schedules) = 'object');
  end if;
end $$;
notify pgrst, 'reload schema';
