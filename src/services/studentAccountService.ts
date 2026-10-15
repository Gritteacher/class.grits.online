import { supabase } from "../lib/supabase";

export async function createStudentAccount(input: {
  studentCode: string;
  displayName: string;
  classroomId: string;
  studentNumber: number;
  password: string;
}) {
  const code = input.studentCode.trim();
  if (!code) throw new Error("กรอกรหัสนักเรียนก่อน");
  if (input.password.length < 6) throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");

  // Force Supabase to validate/refresh the current session before sending it
  // to the server function. getSession() alone can return an expired cached JWT.
  let { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    const refreshed = await supabase.auth.refreshSession();
    userData = refreshed.data.user ? { user: refreshed.data.user } : { user: null };
    userError = refreshed.error;
  }
  if (userError || !userData.user) throw new Error("session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบครูก่อน");
  const response = await fetch("/.netlify/functions/create-student-account", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...input, studentCode: code }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("session ของครูไม่ตรงกับระบบ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่");
    }
    throw new Error(payload.error || "สร้างบัญชีนักเรียนไม่สำเร็จ");
  }
  return payload;
}

export async function resetStudentPassword(studentId: string, password: string) {
  if (password.length < 6) throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
  const response = await fetch("/.netlify/functions/reset-student-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, password }),
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
}
