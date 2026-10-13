import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(500, { error: "ระบบยังไม่ได้ตั้งค่า Supabase ฝั่งเซิร์ฟเวอร์" });
  const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "ไม่พบสิทธิ์ผู้ใช้งาน" });
  let input;
  try { input = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "ข้อมูลคำขอไม่ถูกต้อง" }); }
  const assignmentId = String(input.assignmentId || "").trim();
  const memberIds = [...new Set(Array.isArray(input.memberIds) ? input.memberIds.map(String) : [])];
  if (!assignmentId || memberIds.length < 2 || memberIds.length > 50) return json(400, { error: "สมาชิกกลุ่มไม่ถูกต้อง" });
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: user, error: userError } = await admin.auth.getUser(token);
  if (userError || !user.user || !memberIds.includes(user.user.id)) return json(401, { error: "session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
  const { data: assignment } = await admin.from("assignments").select("id, group_size, submission_mode").eq("id", assignmentId).maybeSingle();
  if (!assignment || assignment.submission_mode !== "group" || memberIds.length > assignment.group_size) return json(400, { error: "งานนี้ไม่รองรับกลุ่มหรือจำนวนสมาชิกเกินกำหนด" });
  const { data: links } = await admin.from("assignment_classrooms").select("classroom_id").eq("assignment_id", assignmentId);
  const classroomIds = (links ?? []).map((row) => row.classroom_id);
  const { data: memberships } = await admin.from("classroom_members").select("student_id, classroom_id").in("student_id", memberIds).in("classroom_id", classroomIds);
  if (!memberships || new Set(memberships.map((row) => row.student_id)).size !== memberIds.length) return json(403, { error: "สมาชิกกลุ่มต้องอยู่ในห้องเดียวกับงาน" });
  const rows = memberIds.map((studentId) => ({ assignment_id: assignmentId, student_id: studentId, response: String(input.response || "").trim(), link: input.link || null, file_path: input.filePath || null, file_name: input.fileName || null, file_type: input.fileType || null, group_id: input.groupId || crypto.randomUUID(), group_member_ids: memberIds, status: "pending", feedback: "", submitted_at: input.submittedAt || new Date().toISOString(), updated_at: new Date().toISOString() }));
  const { error } = await admin.from("submissions").upsert(rows, { onConflict: "assignment_id,student_id" });
  if (error) return json(400, { error: "บันทึกงานกลุ่มไม่สำเร็จ" });
  return json(200, { submitted: memberIds.length });
}
