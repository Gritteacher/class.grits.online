import { supabase } from "../lib/supabase";
import { defaultAvatar, validateAvatar, type Avatar } from "./model";
const fields =
  "face, skin, hair, hair_color, outfit, accessory, backdrop, nickname, motto";
export async function loadAvatar(studentId: string): Promise<Avatar> {
  const { data, error } = await supabase
    .from("student_avatar_customizations")
    .select(fields)
    .eq("student_id", studentId)
    .abortSignal(AbortSignal.timeout(20000))
    .maybeSingle();
  if (error) throw Error("โหลดอวตาร์ไม่สำเร็จ กรุณาลองใหม่");
  return data
    ? validateAvatar({
        face: data.face,
        skin: data.skin,
        hair: data.hair,
        hairColor: data.hair_color,
        outfit: data.outfit,
        accessory: data.accessory,
        backdrop: data.backdrop,
        nickname: data.nickname,
        motto: data.motto,
      })
    : { ...defaultAvatar };
}
export async function saveAvatar(
  studentId: string,
  input: Avatar,
): Promise<Avatar> {
  const value = validateAvatar(input);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || auth.user?.id !== studentId)
    throw Error("กรุณาเข้าสู่ระบบบัญชีของคุณใหม่");
  const { data, error } = await supabase
    .from("student_avatar_customizations")
    .upsert(
      {
        student_id: studentId,
        face: value.face,
        skin: value.skin,
        hair: value.hair,
        hair_color: value.hairColor,
        outfit: value.outfit,
        accessory: value.accessory,
        backdrop: value.backdrop,
        nickname: value.nickname,
        motto: value.motto,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id" },
    )
    .select("student_id")
    .abortSignal(AbortSignal.timeout(20000))
    .single();
  if (error || !data) throw Error("บันทึกอวตาร์ไม่สำเร็จ กรุณาลองใหม่");
  return value;
}
