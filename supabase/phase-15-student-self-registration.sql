alter table public.profiles
  add column if not exists student_claimed_at timestamptz;

create index if not exists profiles_student_claimed_at_idx
  on public.profiles (student_claimed_at)
  where student_claimed_at is not null;
