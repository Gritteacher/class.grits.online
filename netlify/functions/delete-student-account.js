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
  if (!studentId) return json(400, { error: "ไม่พบรหัสบัญชีนักเรียน" });

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return json(401, { error: "session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
  const { data: teacher } = await admin.from("profiles").select("id, role").eq("id", caller.user.id).maybeSingle();
  if (!teacher || teacher.role !== "teacher") return json(403, { error: "เฉพาะครูเท่านั้นที่ลบบัญชีนักเรียนได้" });
  const { data: classrooms, error: classroomError } = await admin.from("classrooms").select("id").eq("teacher_id", caller.user.id);
  if (classroomError || !classrooms?.length) return json(403, { error: "ไม่พบห้องเรียนของครู" });
  const { data: membership, error: membershipError } = await admin
    .from("classroom_members")
    .select("student_id")
    .eq("student_id", studentId)
    .in("classroom_id", classrooms.map((item) => item.id))
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) return json(403, { error: "ครูไม่มีสิทธิ์ลบนักเรียนคนนี้" });
  const { data: student } = await admin.from("profiles").select("id, role").eq("id", studentId).maybeSingle();
  if (!student || student.role !== "student") return json(404, { error: "ไม่พบบัญชีนักเรียน" });
  const { error: deleteError } = await admin.auth.admin.deleteUser(studentId);
  if (deleteError && !deleteError.message?.toLowerCase().includes("not found")) {
    return json(400, { error: "ลบบัญชีนักเรียนไม่สำเร็จ" });
  }
  // Auth normally cascades to profiles, but clean it explicitly so a partial
  // delete cannot block adding the same student code again.
  const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", studentId);
  if (profileDeleteError) return json(400, { error: "ลบบัญชีนักเรียนไม่ครบ กรุณาลองใหม่" });
  return json(200, { deleted: true, studentId });
}
