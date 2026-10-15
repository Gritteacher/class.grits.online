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

const studentEmail = (code) => `${code.trim()}@students.class.grits.online`;

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return json(500, { error: "ระบบยังไม่ได้ตั้งค่า Supabase ฝั่งเซิร์ฟเวอร์" });
  }
  const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "ไม่พบสิทธิ์ผู้ใช้งาน" });

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "ข้อมูลคำขอไม่ถูกต้อง" });
  }
  const code = String(input.studentCode || "").trim();
  const displayName = String(input.displayName || "").trim();
  const classroomId = String(input.classroomId || "").trim();
  // The teacher no longer needs to handle a shared starter password. A random
  // internal password keeps the Auth user creatable until the student claims it.
  const password = String(input.password || `${crypto.randomUUID()}-${crypto.randomUUID()}`);
  const studentNumber = Number(input.studentNumber);
  if (!/^\d{1,20}$/.test(code)) return json(400, { error: "รหัสนักเรียนไม่ถูกต้อง" });
  if (!displayName || displayName.length > 120) return json(400, { error: "ชื่อ–สกุลไม่ถูกต้อง" });
  if (!classroomId || !Number.isInteger(studentNumber) || studentNumber < 1) {
    return json(400, { error: "ข้อมูลห้องเรียนหรือเลขที่ไม่ถูกต้อง" });
  }
  if (password.length < 6) return json(400, { error: "ไม่สามารถสร้างรหัสผ่านภายในได้" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) {
    return json(401, {
      error: "ตรวจสอบ session ครูไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่",
    });
  }

  const { data: teacher } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", caller.user.id)
    .maybeSingle();
  if (!teacher || teacher.role !== "teacher") return json(403, { error: "เฉพาะครูเท่านั้นที่สร้างบัญชีนักเรียนได้" });

  const { data: classroom } = await admin
    .from("classrooms")
    .select("id")
    .eq("id", classroomId)
    .eq("teacher_id", caller.user.id)
    .maybeSingle();
  if (!classroom) return json(403, { error: "ครูไม่มีสิทธิ์จัดการห้องเรียนนี้" });

  const { data: existing } = await admin
    .from("profiles")
    .select("id, display_name, role, status")
    .eq("student_code", code)
    .maybeSingle();
  if (existing) {
    if (existing.role !== "student") return json(409, { error: "รหัสนี้ถูกใช้กับบัญชีครูแล้ว" });
    const { data: membership, error: membershipError } = await admin
      .from("classroom_members")
      .select("classroom_id")
      .eq("classroom_id", classroomId)
      .eq("student_id", existing.id)
      .maybeSingle();
    if (membershipError) return json(500, { error: "ตรวจสอบห้องของนักเรียนไม่สำเร็จ" });
    if (membership) return json(409, { error: "นักเรียนคนนี้อยู่ในห้องเรียนนี้แล้ว" });

    // Repair a partially-created account: the Auth user/profile exists but
    // the classroom membership insert did not finish. Keep the old password.
    const { error: attachError } = await admin.from("classroom_members").insert({
      classroom_id: classroomId,
      student_id: existing.id,
      student_number: studentNumber,
    });
    if (attachError) return json(400, { error: "ผูกนักเรียนเข้าห้องเรียนไม่สำเร็จ" });
    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({ display_name: displayName, status: "active" })
      .eq("id", existing.id);
    if (profileUpdateError) return json(400, { error: "ผูกห้องสำเร็จ แต่ปรับข้อมูลนักเรียนไม่สำเร็จ" });
    return json(200, {
      id: existing.id,
      studentCode: code,
      displayName,
      repaired: true,
    });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: studentEmail(code),
    password,
    email_confirm: true,
  });
  if (createError || !created.user) return json(400, { error: "สร้างบัญชีนักเรียนไม่สำเร็จ" });

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "student",
    display_name: displayName,
    student_code: code,
  });
  const { error: memberError } = profileError
    ? { error: profileError }
    : await admin.from("classroom_members").insert({
        classroom_id: classroomId,
        student_id: created.user.id,
        student_number: studentNumber,
      });
  if (profileError || memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json(400, { error: "บันทึกข้อมูลนักเรียนไม่สำเร็จ บัญชีถูกยกเลิกแล้ว" });
  }
  return json(200, { id: created.user.id, studentCode: code, displayName });
}
