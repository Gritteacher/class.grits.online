export function submissionError(stage: "upload" | "save", error: { message?: string; code?: string; statusCode?: string | number; status?: number }) {
  const message = error.message ?? "";
  const code = String(error.code ?? error.statusCode ?? error.status ?? "");
  const prefix = stage === "upload" ? "อัปโหลดไฟล์ไม่สำเร็จ" : "บันทึกงานไม่สำเร็จ";
  if (/jwt|token.*expired|invalid.*token/i.test(message) || code === "401")
    return new Error(`${prefix}: การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่ ไฟล์ที่เลือกยังอยู่`);
  if (code === "413" || /maximum.*size|too large|size.*exceed/i.test(message))
    return new Error(`${prefix}: ไฟล์เกินขนาดที่ระบบรับได้ กรุณาเลือกไฟล์ไม่เกิน 2 MB`);
  if (/row.level|permission|not authorized|access denied/i.test(message) || ["42501", "403"].includes(code))
    return new Error(`${prefix}: บัญชีนี้ไม่มีสิทธิ์ส่งงานในห้องนี้ กรุณาแจ้งครูตรวจสอบสมาชิกห้องเรียน`);
  if (/quota|storage.*limit|disk.*full/i.test(message))
    return new Error(`${prefix}: พื้นที่จัดเก็บบนระบบเต็ม กรุณาแจ้งครู`);
  if (/fetch|network|connection|timeout/i.test(message))
    return new Error(`${prefix}: การเชื่อมต่อขัดข้อง กรุณาลองใหม่ ไฟล์ที่เลือกยังอยู่`);
  return new Error(`${prefix} กรุณาลองใหม่${/^[a-zA-Z0-9_-]{1,30}$/.test(code) ? ` (รหัส ${code})` : ""} ไฟล์ที่เลือกยังอยู่`);
}
