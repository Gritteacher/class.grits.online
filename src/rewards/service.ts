import { supabase } from "../lib/supabase";
import { validDate } from "../attendance/model";
import { validatePoints, type WheelDraw, type WheelRoom, type WheelRound, type RewardEntry, type RewardSummary } from "./model";

function fail(error: { message?: string; code?: string } | null, fallback: string) {
  if (!error) return;
  if (error.code?.startsWith("PGRST") || error.code === "42P01") throw Error("ระบบวงล้อและแต้มยังไม่พร้อม กรุณาติดต่อครูผู้ดูแล");
  throw Error(error.code === "P0001" || error.code === "42501" ? error.message || fallback : fallback);
}
async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, params).abortSignal(AbortSignal.timeout(20000));
  fail(error, "ติดต่อระบบไม่สำเร็จ กรุณาลองใหม่");
  if (!data) throw Error("ระบบไม่ได้ยืนยันผล กรุณาลองใหม่");
  return data as T;
}
export async function loadWheelRooms(teacher: string) {
  const { data, error } = await supabase.from("classrooms").select("id,name,room,level,subject,academic_year")
    .eq("teacher_id", teacher).order("level").order("room").abortSignal(AbortSignal.timeout(20000));
  fail(error, "โหลดห้องเรียนไม่สำเร็จ กรุณาลองใหม่");
  return (data ?? []) as WheelRoom[];
}
export async function loadPresentStudents(room: string, day: string, period: number) {
  if (!validDate(day) || !Number.isInteger(period) || period < 1 || period > 20) throw Error("เลือกวันและคาบเรียนให้ถูกต้อง");
  const { data, error } = await supabase.from("attendance_records").select("student_id")
    .eq("classroom_id", room).eq("attendance_date", day).eq("period", period).in("status", ["present", "late"])
    .order("student_id").limit(1000).abortSignal(AbortSignal.timeout(20000));
  fail(error, "โหลดการเช็คชื่อไม่สำเร็จ กรุณาลองใหม่");
  return (data ?? []).map(row => String(row.student_id));
}
export async function loadWheelRound(room: string) {
  const { data, error } = await supabase.from("classroom_wheel_rounds").select("*")
    .eq("classroom_id", room).is("closed_at", null).abortSignal(AbortSignal.timeout(20000)).maybeSingle<WheelRound>();
  fail(error, "โหลดรอบสุ่มไม่สำเร็จ กรุณาลองใหม่");
  if (!data) return { round: null, draws: [] as WheelDraw[] };
  const { data: draws, error: drawError } = await supabase.from("classroom_wheel_draws").select("*")
    .eq("round_id", data.id).order("created_at", { ascending: false }).order("id").limit(1000).abortSignal(AbortSignal.timeout(20000));
  fail(drawError, "โหลดประวัติสุ่มไม่สำเร็จ");
  return { round: data, draws: (draws ?? []) as WheelDraw[] };
}
export function startRound(id: string, room: string, students: string[], repeat: boolean, day: string | null, period: number | null) {
  return rpc<WheelRound>("start_classroom_wheel_round", { p_id: id, p_classroom: room, p_students: students, p_repeat: repeat, p_date: day, p_period: period });
}
export function spinRound(round: string, id: string) {
  return rpc<WheelDraw>("spin_classroom_wheel", { p_round: round, p_id: id });
}
export function awardPoints(draw: string, id: string, points: number, reason: string) {
  validatePoints(points, reason);
  return rpc<RewardEntry>("award_classroom_reinforcement", { p_draw: draw, p_id: id, p_points: points, p_reason: reason.trim() });
}
export function reversePoints(entry: string, reason: string) {
  if (!reason.trim() || reason.trim().length > 500) throw Error("ระบุเหตุผลการยกเลิกไม่เกิน 500 ตัวอักษร");
  return rpc<RewardEntry>("reverse_classroom_reinforcement", { p_entry: entry, p_reason: reason.trim() });
}
export function loadSummary(student: string) {
  return rpc<RewardSummary>("student_reinforcement_summary", { p_student: student }).then(summary => {
    if (!Number.isFinite(summary.total)) throw Error("โหลดแต้มไม่สำเร็จ กรุณาลองใหม่");
    return summary;
  });
}
export async function loadDrawAward(draw: string) {
  const { data, error } = await supabase.from("student_reinforcement_entries").select("*").eq("draw_id", draw)
    .abortSignal(AbortSignal.timeout(20000)).maybeSingle<RewardEntry>();
  fail(error, "ตรวจสอบแต้มของผลสุ่มไม่สำเร็จ");
  if (!data) return null;
  const { data: reversal, error: reversalError } = await supabase.from("student_reinforcement_entries").select("id")
    .eq("reverses_id", data.id).abortSignal(AbortSignal.timeout(20000)).maybeSingle();
  fail(reversalError, "ตรวจสอบการยกเลิกแต้มไม่สำเร็จ");
  return { ...data, reversed: Boolean(reversal) };
}
export async function loadEntries(input: { room?: string; student?: string; day?: string; page?: number }) {
  let query = supabase.from("student_reinforcement_entries").select("*");
  if (input.room) query = query.eq("classroom_id", input.room);
  if (input.student) query = query.eq("student_id", input.student);
  if (input.day) {
    const start = new Date(`${input.day}T00:00:00+07:00`);
    if (!Number.isFinite(start.getTime())) throw Error("เลือกวันที่ให้ถูกต้อง");
    query = query.gte("created_at", start.toISOString()).lt("created_at", new Date(start.getTime() + 86400000).toISOString());
  }
  const offset = (input.page ?? 0) * 50;
  const { data, error } = await query.order("created_at", { ascending: false }).order("id").range(offset, offset + 49).abortSignal(AbortSignal.timeout(20000));
  fail(error, "โหลดประวัติแต้มไม่สำเร็จ");
  const entries = (data ?? []) as RewardEntry[];
  const positiveIds = entries.filter(entry => entry.points > 0).map(entry => entry.id);
  const reversed = new Set(entries.flatMap(entry => entry.reverses_id ? [entry.reverses_id] : []));
  if (positiveIds.length) {
    const { data: reversals, error: reversalError } = await supabase.from("student_reinforcement_entries").select("reverses_id")
      .in("reverses_id", positiveIds).abortSignal(AbortSignal.timeout(20000));
    fail(reversalError, "ตรวจสอบรายการยกเลิกไม่สำเร็จ");
    for (const row of reversals ?? []) reversed.add(row.reverses_id);
  }
  return entries.map(entry => ({ ...entry, reversed: reversed.has(entry.id) }));
}
export async function loadDrawHistory(room: string, page = 0, student?: string, day?: string) {
  let query = supabase.from("classroom_wheel_draws").select("*").eq("classroom_id", room);
  if (student) query = query.eq("student_id", student);
  if (day) {
    const start = new Date(`${day}T00:00:00+07:00`);
    if (!Number.isFinite(start.getTime())) throw Error("เลือกวันที่ให้ถูกต้อง");
    query = query.gte("created_at", start.toISOString()).lt("created_at", new Date(start.getTime() + 86400000).toISOString());
  }
  const { data, error } = await query
    .order("created_at", { ascending: false }).order("id").range(page * 50, page * 50 + 49).abortSignal(AbortSignal.timeout(20000));
  fail(error, "โหลดประวัติการสุ่มไม่สำเร็จ");
  return (data ?? []) as WheelDraw[];
}
