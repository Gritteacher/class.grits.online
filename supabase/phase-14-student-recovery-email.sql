-- Add a separate recovery email without changing the internal student login alias.
alter table public.profiles
  add column if not exists recovery_email text;

create index if not exists profiles_recovery_email_idx
  on public.profiles (lower(recovery_email))
  where recovery_email is not null;
