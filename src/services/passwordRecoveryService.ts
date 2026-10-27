export async function requestStudentPasswordReset(studentCode: string, email: string) {
  const response = await fetch("/api/request-student-password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentCode, email }),
  });
  const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!response.ok) throw new Error(result.error ?? "ขอรีเซ็ตรหัสผ่านไม่สำเร็จ");
  return result.message ?? "ส่งคำแนะนำไปยังอีเมลแล้ว";
}

export async function completeStudentPasswordReset(token: string, password: string) {
  const response = await fetch("/api/complete-student-password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
}
