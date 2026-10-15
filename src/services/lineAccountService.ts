import { getLineIdToken } from "../lib/lineEntry";
import { supabase } from "../lib/supabase";

type LineResponse = { error?: string; tokenHash?: string; linked?: boolean };

export class LineAccountNotLinkedError extends Error {
  code = "LINE_ACCOUNT_NOT_LINKED";
}

async function callLineAccount(action: "login" | "link") {
  const idToken = getLineIdToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (action === "link") {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("กรุณาเข้าสู่ระบบนักเรียนก่อนเชื่อมบัญชี LINE");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch("/.netlify/functions/line-account", {
    method: "POST",
    headers,
    body: JSON.stringify({ action, idToken }),
  });
  let result: LineResponse = {};
  try {
    result = (await response.json()) as LineResponse;
  } catch {
    throw new Error("ระบบเชื่อมต่อ LINE ตอบกลับไม่ถูกต้อง");
  }
  if (!response.ok) {
    if (result.error === "LINE_ACCOUNT_NOT_LINKED") {
      throw new LineAccountNotLinkedError("ยังไม่ได้เชื่อมบัญชี LINE");
    }
    throw new Error(result.error || "เชื่อมบัญชี LINE ไม่สำเร็จ");
  }
  return result;
}

export async function loginWithLine() {
  const result = await callLineAccount("login");
  if (!result.tokenHash) throw new Error("ระบบ LINE ไม่ได้รับ token สำหรับเข้าสู่ระบบ");
  const { error } = await supabase.auth.verifyOtp({
    token_hash: result.tokenHash,
    type: "magiclink",
  });
  if (error) throw new Error("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่");
}

export async function linkCurrentStudentToLine() {
  await callLineAccount("link");
}
