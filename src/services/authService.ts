import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type UserRole = "teacher" | "student";

export type Profile = {
  id: string;
  role: UserRole;
  display_name: string;
  student_code: string | null;
};

export type AuthIdentity = {
  session: Session;
  profile: Profile;
};

// Student accounts use their student code as a stable internal email alias.
// The alias never appears in the UI and keeps Supabase Auth's email/password
// flow while allowing students to log in with the code their teacher gives them.
export function studentAuthEmail(code: string) {
  const normalized = code.trim();
  if (!normalized) throw new Error("กรอกรหัสนักเรียนก่อน");
  return `${normalized}@students.class.grits.online`;
}

export async function signIn(
  role: UserRole,
  identifier: string,
  password: string,
): Promise<AuthIdentity> {
  const value = identifier.trim();
  if (!value) throw new Error(role === "teacher" ? "กรอกอีเมลครู" : "กรอกรหัสนักเรียน");
  if (password.length < 6) throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: role === "teacher" ? value : studentAuthEmail(value),
    password,
  });
  if (error || !data.session) {
    throw new Error("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจรหัสผู้ใช้และรหัสผ่าน");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, display_name, student_code")
    .eq("id", data.session.user.id)
    .maybeSingle<Profile>();

  if (profileError) throw new Error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ กรุณาลองใหม่");
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error("บัญชีนี้ยังไม่มีโปรไฟล์ในระบบ กรุณาให้ผู้ดูแลตั้งค่าบัญชีก่อน");
  }
  if (profile.role !== role) {
    await supabase.auth.signOut();
    throw new Error("บทบาทของบัญชีไม่ตรงกับตัวเลือกที่เลือก");
  }
  return { session: data.session, profile };
}

export async function getCurrentIdentity(
  session: Session,
): Promise<AuthIdentity | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, student_code")
    .eq("id", session.user.id)
    .maybeSingle<Profile>();
  if (error || !profile) return null;
  return { session, profile };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่");
}
