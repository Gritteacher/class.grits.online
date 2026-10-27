import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://class.gritspace.cc",
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
  const token = String(input.token || "");
  const password = String(input.password || "");
  if (!/^[a-f0-9]{64}$/.test(token)) return json(400, { error: "ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุ" });
  if (password.length < 6) return json(400, { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: reset } = await admin.from("student_password_resets").select("id, student_id").eq("token_hash", tokenHash).is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!reset) return json(400, { error: "ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุ" });
  const { error: authError } = await admin.auth.admin.updateUserById(reset.student_id, { password });
  if (authError) return json(400, { error: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่" });
  const { error: usedError } = await admin.from("student_password_resets").update({ used_at: new Date().toISOString() }).eq("id", reset.id).is("used_at", null);
  if (usedError) return json(400, { error: "ยืนยันการตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่" });
  return json(200, { ok: true });
}
