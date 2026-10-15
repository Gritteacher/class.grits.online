import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { escapeHtml, sendResendEmail } from "./_shared/resend.js";

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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return json(500, { error: "ระบบยังไม่ได้ตั้งค่า Supabase ฝั่งเซิร์ฟเวอร์" });
  let input;
  try { input = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "ข้อมูลไม่ถูกต้อง" }); }
  const studentCode = String(input.studentCode || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const generic = { ok: true, message: "ถ้าข้อมูลตรงกัน ระบบจะส่งลิงก์ตั้งรหัสผ่านไปยังอีเมลที่ลงทะเบียนไว้" };
  if (!/^\d{1,20}$/.test(studentCode) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(200, generic);

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, recovery_email, role, status")
    .eq("student_code", studentCode)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (!profile || profile.recovery_email?.toLowerCase() !== email) return json(200, generic);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await admin.from("student_password_resets").update({ used_at: new Date().toISOString() }).eq("student_id", profile.id).is("used_at", null);
  const { error } = await admin.from("student_password_resets").insert({
    student_id: profile.id,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (error) return json(200, generic);
  const resetUrl = `https://class.grits.online/?reset=${rawToken}`;
  const result = await sendResendEmail({
    to: profile.recovery_email,
    subject: "ตั้งรหัสผ่านใหม่ | ห้องเรียนสังคมครูไต๋",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#173d38"><h2>ตั้งรหัสผ่านใหม่</h2><p>สวัสดี ${escapeHtml(profile.display_name)}</p><p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้ใช้ได้ภายใน 30 นาทีและใช้ได้ครั้งเดียว</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#f3c83b;color:#173d38;text-decoration:none;border-radius:8px">ตั้งรหัสผ่านใหม่</a></p><p style="color:#687b77;font-size:13px">หากไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลฉบับนี้ได้</p></div>`,
  });
  if (!result.sent) console.error("Resend reset email was not sent", result.reason);
  return json(200, generic);
}
