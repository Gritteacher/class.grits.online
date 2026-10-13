-- Phase 2: หลังสร้างบัญชีครูใน Supabase Dashboard > Authentication > Users
-- ให้นำ UUID ของบัญชีครูมาแทนค่าในคำสั่งด้านล่าง แล้วรันใน SQL Editor
-- ห้ามใส่รหัสผ่านลงไฟล์นี้ และห้ามใช้ service role key ใน frontend

insert into public.profiles (id, role, display_name)
values (
  'PUT-AUTH-USER-UUID-HERE'::uuid,
  'teacher',
  'ครูผู้สอน'
)
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name,
    updated_at = now();

-- ตรวจสอบว่าโปรไฟล์เป็นครูจริง
select id, role, display_name
from public.profiles
where id = 'PUT-AUTH-USER-UUID-HERE'::uuid;
