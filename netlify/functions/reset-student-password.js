import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://class.grits.online",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return json(500, { error: "ระบบยังไม่ได้ตั้งค่า Supabase ฝั่งเซิร์ฟเวอร์" });
  const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "ไม่พบสิทธิ์ผู้ใช้งาน" });
  let input;
  try { input = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "ข้อมูลคำขอไม่ถูกต้อง" }); }
  const studentId = String(input.studentId || "").trim();
  const password = String(input.password || "");
  if (!studentId || password.length < 6) return json(400, { error: "ข้อมูลรหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง" });

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return json(401, { error: "ตรวจสอบ session ครูไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่" });
  const { data: teacher } = await admin.from("profiles").select("id, role").eq("id", caller.user.id).maybeSingle();
  if (!teacher || teacher.role !== "teacher") return json(403, { error: "เฉพาะครูเท่านั้นที่ตั้งรหัสผ่านนักเรียนได้" });
  const { data: classrooms, error: classroomError } = await admin.from("classrooms").select("id").eq("teacher_id", caller.user.id);
  if (classroomError || !classrooms?.length) return json(403, { error: "ไม่พบห้องเรียนของครู" });
  const { data: membership, error: membershipError } = await admin.from("classroom_members").select("student_id").eq("student_id", studentId).in("classroom_id", classrooms.map((item) => item.id)).limit(1).maybeSingle();
  if (membershipError || !membership) return json(403, { error: "ครูไม่มีสิทธิ์จัดการนักเรียนคนนี้" });
  const { data: student } = await admin.from("profiles").select("id, role").eq("id", studentId).maybeSingle();
  if (!student || student.role !== "student") return json(404, { error: "ไม่พบบัญชีนักเรียน" });
  const { error } = await admin.auth.admin.updateUserById(studentId, { password });
  if (error) return json(400, { error: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ" });
  return json(200, { ok: true });
}
