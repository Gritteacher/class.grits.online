export type WheelRoom = { id: string; name: string; room: string; level?: string; subject?: string; academic_year?: string };
export type WheelRound = {
  id: string; classroom_id: string; teacher_id: string; participant_ids: string[];
  allow_repeat: boolean; attendance_date: string | null; attendance_period: number | null;
  created_at: string; closed_at: string | null;
};
export type WheelDraw = { id: string; round_id: string; classroom_id: string; teacher_id: string; student_id: string; created_at: string };
export type RewardEntry = {
  id: string; student_id: string; teacher_id: string; classroom_id: string;
  draw_id: string | null; reverses_id: string | null; points: number; reason: string;
  teacher_name: string; created_at: string; reversed?: boolean;
};
export type RewardSummary = { total: number; latest_id: string | null; latest_points: number; latest_at: string | null };
export const rewardReasons = ["ร่วมตอบคำถาม", "กล้าแสดงออก", "พยายามเรียนรู้", "ช่วยเพื่อน"];
export function validatePoints(points: number, reason: string) {
  if (!Number.isInteger(points) || points < 1 || points > 100) throw Error("ระบุแต้มจำนวนเต็ม 1–100 แต้ม");
  if (!reason.trim() || reason.trim().length > 500) throw Error("ระบุเหตุผลไม่เกิน 500 ตัวอักษร");
}
export function remainingIds(round: WheelRound, draws: WheelDraw[]) {
  const drawn = new Set(draws.filter(draw => draw.round_id === round.id).map(draw => draw.student_id));
  return round.participant_ids.filter(id => round.allow_repeat || !drawn.has(id));
}
export function winningRotation(current: number, index: number, count: number) {
  if (!Number.isInteger(index) || index < 0 || index >= count) throw Error("ไม่พบตำแหน่งบนวงล้อ");
  const target = (360 - (index + 0.5) * 360 / count) % 360;
  return current + 5 * 360 + ((target - current % 360 + 360) % 360);
}
export function rewardsDate(value: string) {
  return new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
}
