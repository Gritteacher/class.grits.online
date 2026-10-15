import { createClient } from "@supabase/supabase-js";

const LIFF_CHANNEL_ID = "2012019762";

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

async function verifyLineIdToken(idToken, channelId) {
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!response.ok) return null;
  const claims = await response.json();
  return claims.sub && claims.aud === channelId ? claims : null;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const channelId = process.env.LINE_CHANNEL_ID || LIFF_CHANNEL_ID;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "ระบบยังไม่ได้ตั้งค่า Supabase ฝั่งเซิร์ฟเวอร์" });
  }
  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "ข้อมูลคำขอไม่ถูกต้อง" });
  }
  const action = input.action === "link" ? "link" : input.action === "login" ? "login" : "";
  const idToken = String(input.idToken || "");
  if (!action || idToken.length < 20 || idToken.length > 10000) return json(400, { error: "ข้อมูล LINE ไม่ถูกต้อง" });

  const claims = await verifyLineIdToken(idToken, channelId);
  if (!claims) return json(401, { error: "ตรวจสอบบัญชี LINE ไม่สำเร็จ" });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const lineUserId = claims.sub;

  if (action === "link") {
    const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "ไม่พบ session นักเรียน" });
    const { data: caller, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !caller.user) return json(401, { error: "session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
    const { data: profile } = await admin.from("profiles").select("id, role, status").eq("id", caller.user.id).maybeSingle();
    if (!profile || profile.role !== "student" || profile.status !== "active") return json(403, { error: "บัญชีนี้ไม่ใช่บัญชีนักเรียนที่ใช้งานได้" });
    const { data: lineLink, error: lineLinkError } = await admin.from("line_account_links").select("student_id").eq("line_user_id", lineUserId).maybeSingle();
    if (lineLinkError) return json(500, { error: "ตรวจสอบบัญชี LINE ไม่สำเร็จ" });
    if (lineLink && lineLink.student_id !== caller.user.id) return json(409, { error: "LINE นี้เชื่อมกับบัญชีนักเรียนอื่นแล้ว" });
    const { data: studentLink, error: studentLinkError } = await admin.from("line_account_links").select("line_user_id").eq("student_id", caller.user.id).maybeSingle();
    if (studentLinkError) return json(500, { error: "ตรวจสอบการเชื่อมบัญชีไม่สำเร็จ" });
    if (studentLink && studentLink.line_user_id !== lineUserId) return json(409, { error: "บัญชีนักเรียนนี้เชื่อมกับ LINE อื่นอยู่แล้ว" });
    if (!lineLink) {
      const { error } = await admin.from("line_account_links").insert({ line_user_id: lineUserId, student_id: caller.user.id });
      if (error) return json(409, { error: "เชื่อมบัญชี LINE ไม่สำเร็จ อาจมีการเชื่อมไว้แล้ว" });
    }
    return json(200, { linked: true });
  }

  const { data: lineLink, error: lineLinkError } = await admin.from("line_account_links").select("student_id").eq("line_user_id", lineUserId).maybeSingle();
  if (lineLinkError) return json(500, { error: "ค้นหาบัญชีนักเรียนไม่สำเร็จ" });
  if (!lineLink) return json(404, { error: "LINE_ACCOUNT_NOT_LINKED" });
  const { data: profile } = await admin.from("profiles").select("id, role, status").eq("id", lineLink.student_id).maybeSingle();
  if (!profile || profile.role !== "student" || profile.status !== "active") return json(403, { error: "บัญชีนักเรียนนี้ไม่พร้อมใช้งาน" });
  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(profile.id);
  const email = authUser?.user?.email;
  if (authUserError || !email) return json(500, { error: "ไม่พบข้อมูลบัญชีนักเรียน" });
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return json(500, { error: "สร้าง session LINE ไม่สำเร็จ" });
  return json(200, { tokenHash });
}
