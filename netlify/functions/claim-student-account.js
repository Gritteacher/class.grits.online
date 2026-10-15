import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://class.grits.online",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง)\s*/u, "")
    .replace(/[\s._-]+/g, "");
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "ระบบยังไม่ได้ตั้งค่า Supabase ฝั่งเซิร์ฟเวอร์" });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "ข้อมูลสมัครใช้งานไม่ถูกต้อง" });
  }
  const studentCode = String(input.studentCode || "").trim();
  const firstName = String(input.firstName || "").trim();
  const lastName = String(input.lastName || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  if (!/^\d{1,20}$/.test(studentCode)) return json(400, { field: "studentCode", error: "รหัสนักเรียนต้องเป็นตัวเลข 1–20 หลัก" });
  if (!firstName || firstName.length > 80) return json(400, { field: "firstName", error: "กรอกชื่อให้ถูกต้อง และไม่ต้องใส่คำนำหน้า" });
  if (!lastName || lastName.length > 80) return json(400, { field: "lastName", error: "กรอกนามสกุลให้ถูกต้อง และไม่ต้องใส่คำนำหน้า" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    return json(400, { field: "email", error: "กรอกอีเมลให้ถูกต้อง" });
  }
  if (password.length < 6) return json(400, { field: "password", error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, display_name, status, recovery_email, student_claimed_at")
    .eq("student_code", studentCode)
    .maybeSingle();
  const genericError = "ข้อมูลนักเรียนไม่ตรงกับรายชื่อที่ครูเตรียมไว้ หรือบัญชีนี้สมัครใช้งานแล้ว";
  if (profileError || !profile || profile.role !== "student" || profile.status !== "active") {
    return json(400, { field: "studentCode", error: "ไม่พบรหัสนักเรียนนี้ในรายชื่อที่ครูเตรียมไว้" });
  }
  if (profile.student_claimed_at || profile.recovery_email) return json(400, { field: "studentCode", error: "บัญชีนี้สมัครใช้งานแล้ว ให้เข้าสู่ระบบแทน" });
  if (normalizeName(profile.display_name) !== normalizeName(`${firstName}${lastName}`)) {
    return json(400, { field: "name", error: "ชื่อหรือนามสกุลไม่ตรงกับรายชื่อ กรุณาตรวจตัวสะกดอีกครั้ง และไม่ต้องใส่คำนำหน้า" });
  }

  const { data: emailOwner } = await admin
    .from("profiles")
    .select("id")
    .eq("recovery_email", email)
    .maybeSingle();
  if (emailOwner && emailOwner.id !== profile.id) return json(409, { field: "email", error: "อีเมลนี้ถูกใช้กับบัญชีนักเรียนอื่นแล้ว" });
  const { error: authError } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (authError) return json(400, { error: "ตั้งค่าบัญชีนักเรียนไม่สำเร็จ กรุณาลองใหม่" });

  const { data: claimed, error: updateError } = await admin
    .from("profiles")
    .update({ recovery_email: email, student_claimed_at: new Date().toISOString() })
    .eq("id", profile.id)
    .is("student_claimed_at", null)
    .is("recovery_email", null)
    .select("id")
    .maybeSingle();
  if (updateError) return json(400, { error: "บันทึกข้อมูลสมัครใช้งานไม่สำเร็จ กรุณาลองใหม่" });
  if (!updateError && !claimed) return json(400, { error: genericError });
  return json(200, { studentCode, claimed: true });
}
