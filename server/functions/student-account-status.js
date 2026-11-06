import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "กรุณาเข้าสู่ระบบครูใหม่" });
  let input;
  try { input = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "ข้อมูลคำขอไม่ถูกต้อง" }); }
  const classroomId = String(input.classroomId || "");
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(classroomId)) return json(400, { error: "ห้องเรียนไม่ถูกต้อง" });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(500, { error: "ระบบยังไม่ได้ตั้งค่าฝั่งเซิร์ฟเวอร์" });
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return json(401, { error: "กรุณาเข้าสู่ระบบครูใหม่" });
  const { data: teacher, error: teacherError } = await admin.from("profiles").select("role").eq("id", caller.user.id).maybeSingle();
  if (teacherError) return json(500, { error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (teacher?.role !== "teacher") return json(403, { error: "เฉพาะครูเท่านั้น" });
  const { data: classroom, error: classroomError } = await admin.from("classrooms").select("id").eq("id", classroomId).eq("teacher_id", caller.user.id).maybeSingle();
  if (classroomError) return json(500, { error: "ตรวจสอบห้องเรียนไม่สำเร็จ" });
  if (!classroom) return json(403, { error: "ไม่มีสิทธิ์ดูห้องเรียนนี้" });
  const { data: members, error: memberError } = await admin.from("classroom_members").select("student_id").eq("classroom_id", classroomId);
  if (memberError) return json(500, { error: "โหลดสมาชิกห้องเรียนไม่สำเร็จ" });
  const ids = [...new Set((members || []).map(row => row.student_id))];
  if (!ids.length) return json(200, { students: [] });
  const { data: profiles, error: profileError } = await admin.from("profiles").select("id, student_claimed_at").eq("role", "student").in("id", ids);
  if (profileError || !profiles || profiles.length !== ids.length) return json(500, { error: "โหลดสถานะลงทะเบียนไม่ครบ กรุณาลองใหม่" });
  const students = [];
  // Bound concurrent Auth requests; do not enumerate users outside this classroom.
  for (let offset = 0; offset < profiles.length; offset += 6) {
    students.push(...await Promise.all(profiles.slice(offset, offset + 6).map(async profile => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(profile.id);
        return { id: profile.id, registeredAt: profile.student_claimed_at, lastSignInAt: data?.user?.last_sign_in_at ?? null, loginStatusKnown: !error && !!data?.user };
      } catch {
        return { id: profile.id, registeredAt: profile.student_claimed_at, lastSignInAt: null, loginStatusKnown: false };
      }
    })));
  }
  return json(200, { students });
}
