import { supabase } from "../lib/supabase";
import {
  attendanceLabels,
  bangkokToday,
  validDate,
  validateLeave,
  type AttendanceRecord,
  type AttendanceStatus,
  type LeaveRequest,
} from "./model";

export type AttendanceRoom = { id: string; name: string; room: string };
export async function loadAttendanceRooms() {
  const { data, error } = await supabase
    .from("classrooms")
    .select("id, name, room")
    .order("name")
    .abortSignal(AbortSignal.timeout(20000));
  if (error) throw new Error("โหลดห้องเรียนไม่สำเร็จ");
  return (data ?? []) as AttendanceRoom[];
}
export async function loadAttendance(classroomId: string, month: string) {
  if (!/^\d{4}-\d{2}$/.test(month) || !validDate(`${month}-01`))
    throw new Error("เลือกเดือนให้ถูกต้อง");
  const start = `${month}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const records: AttendanceRecord[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data, error } = await supabase
      .from("attendance_records")
      .select(
        "id, classroom_id, student_id, attendance_date, period, status, note",
      )
      .eq("classroom_id", classroomId)
      .gte("attendance_date", start)
      .lt("attendance_date", next.toISOString().slice(0, 10))
      .order("attendance_date", { ascending: false })
      .order("period", { ascending: false })
      .order("id")
      .range(offset, offset + 999)
      .abortSignal(AbortSignal.timeout(20000));
    if (error) throw new Error("โหลดประวัติเช็คชื่อไม่สำเร็จ กรุณาลองใหม่");
    records.push(...((data ?? []) as AttendanceRecord[]));
    if (!data || data.length < 1000) return records;
  }
  throw new Error("ข้อมูลเดือนนี้มีจำนวนมากเกินไป กรุณาติดต่อครูผู้ดูแล");
}
export async function loadLeaves(classroomId: string) {
  const { data, error } = await supabase
    .from("student_leave_requests")
    .select(
      "id, classroom_id, student_id, starts_on, ends_on, reason, status, review_note, created_at",
    )
    .eq("classroom_id", classroomId)
    .order("created_at", { ascending: false })
    .limit(1000)
    .abortSignal(AbortSignal.timeout(20000));
  if (error) throw new Error("โหลดคำขอลาไม่สำเร็จ กรุณาลองใหม่");
  if (data?.length === 1000)
    throw new Error("มีคำขอลาจำนวนมากเกินไป กรุณาติดต่อผู้ดูแล");
  return (data ?? []) as LeaveRequest[];
}
export async function saveAttendance(
  classroomId: string,
  day: string,
  period: number,
  marks: { studentId: string; status: AttendanceStatus; note: string }[],
) {
  if (
    !validDate(day) ||
    day > bangkokToday() ||
    !Number.isInteger(period) ||
    period < 1 ||
    period > 20
  )
    throw new Error(
      "เลือกวันและคาบเรียนให้ถูกต้อง ไม่สามารถเช็คชื่อล่วงหน้าได้",
    );
  if (
    !marks.length ||
    new Set(marks.map((item) => item.studentId)).size !== marks.length ||
    marks.some(
      (item) => !(item.status in attendanceLabels) || item.note.length > 500,
    )
  )
    throw new Error("ตรวจสอบสถานะของนักเรียนให้ครบทุกคน");
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  const { data, error } = await supabase
    .from("attendance_records")
    .upsert(
      marks.map((item) => ({
        classroom_id: classroomId,
        student_id: item.studentId,
        attendance_date: day,
        period,
        status: item.status,
        note: item.note.trim(),
        recorded_by: user.user.id,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "classroom_id,attendance_date,period,student_id" },
    )
    .select("id");
  if (error || data?.length !== marks.length)
    throw new Error("บันทึกเช็คชื่อไม่สำเร็จ กรุณาลองใหม่");
}
export async function requestLeave(
  classroomId: string,
  startsOn: string,
  endsOn: string,
  reason: string,
) {
  validateLeave(startsOn, endsOn, reason);
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  const { data: overlaps, error: overlapError } = await supabase
    .from("student_leave_requests")
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("student_id", user.user.id)
    .in("status", ["pending", "approved"])
    .lte("starts_on", endsOn)
    .gte("ends_on", startsOn)
    .limit(1);
  if (overlapError) throw new Error("ตรวจสอบคำขอลาเดิมไม่สำเร็จ");
  if (overlaps?.length)
    throw new Error("มีคำขอลาที่รอพิจารณาหรืออนุมัติแล้วในช่วงวันนี้");
  const { data, error } = await supabase
    .from("student_leave_requests")
    .insert({
      classroom_id: classroomId,
      student_id: user.user.id,
      starts_on: startsOn,
      ends_on: endsOn,
      reason: reason.trim(),
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(
      error?.code === "23505"
        ? "มีคำขอลาช่วงวันนี้แล้ว"
        : "ส่งคำขอลาไม่สำเร็จ กรุณาลองใหม่",
    );
}
export async function reviewLeave(
  id: string,
  status: "approved" | "rejected",
  note: string,
) {
  if (note.trim().length > 500)
    throw new Error("ข้อความตอบกลับไม่เกิน 500 ตัวอักษร");
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  const { data, error } = await supabase
    .from("student_leave_requests")
    .update({
      status,
      review_note: note.trim(),
      reviewed_by: user.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "บันทึกผลการลาไม่สำเร็จ หรือคำขอนี้ถูกพิจารณาไปแล้ว กรุณาโหลดใหม่",
    );
}
