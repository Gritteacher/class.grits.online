create table if not exists public.line_account_links (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  linked_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists line_account_links_student_idx on public.line_account_links(student_id);
alter table public.line_account_links enable row level security;
revoke all on table public.line_account_links from anon, authenticated;
