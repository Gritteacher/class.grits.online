export const attendanceLabels = {
  present: "มาเรียน",
  late: "สาย",
  absent: "ขาด",
  leave: "ลา",
} as const;
export type AttendanceStatus = keyof typeof attendanceLabels;
export type AttendanceRecord = {
  id: string;
  classroom_id: string;
  student_id: string;
  attendance_date: string;
  period: number;
  status: AttendanceStatus;
  note: string;
};
export type LeaveRequest = {
  id: string;
  classroom_id: string;
  student_id: string;
  starts_on: string;
  ends_on: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  review_note: string;
  created_at: string;
};
export const leaveLabels = {
  pending: "รอพิจารณา",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
};
export const bangkokToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function validateLeave(start: string, end: string, reason: string) {
  if (!validDate(start) || !validDate(end) || end < start)
    throw new Error("เลือกวันเริ่มและวันสิ้นสุดการลาให้ถูกต้อง");
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 30)
    throw new Error("ยื่นลาครั้งละไม่เกิน 31 วัน");
  if (!reason.trim() || reason.trim().length > 1000)
    throw new Error("กรอกเหตุผลการลาไม่เกิน 1,000 ตัวอักษร");
}
export const approvedLeaveOn = (
  leaves: LeaveRequest[],
  studentId: string,
  day: string,
) =>
  leaves.some(
    (item) =>
      item.student_id === studentId &&
      item.status === "approved" &&
      item.starts_on <= day &&
      item.ends_on >= day,
  );
export const attendanceDate = (day: string) =>
  new Date(`${day}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
