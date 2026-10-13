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
  if (!response.ok) throw new Error(payload.error || "สร้างบัญชีนักเรียนไม่สำเร็จ");
  return payload;
}
