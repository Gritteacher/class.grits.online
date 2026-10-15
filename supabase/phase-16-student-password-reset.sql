create table if not exists public.student_password_resets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists student_password_resets_student_idx
  on public.student_password_resets (student_id, created_at desc);

alter table public.student_password_resets enable row level security;
revoke all on public.student_password_resets from anon, authenticated;
