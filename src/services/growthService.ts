import { supabase } from "../lib/supabase";
import { defaultAvatar, type Appearance, type GrowthEvent, type GrowthState, type Observation } from "../growth/model";

type EventRow = { id: string; student_id: string; kind: GrowthEvent["kind"]; delta: number; reason: string; actor_id: string; at: string; reversal_of: string | null };
type ObservationRow = { id: string; student_id: string; axis: Observation["axis"]; rating: number; note: string; actor_id: string; at: string };
type AvatarRow = { student_id: string; skin: string; hair: Appearance["hair"]; shirt: string; backdrop: string; accessory: Appearance["accessory"]; automatic: boolean };

export async function loadGrowth(studentIds: string[]): Promise<GrowthState> {
  const ids = [...new Set(studentIds)].filter(Boolean);
  const [eventsResult, observationsResult, avatarsResult] = await Promise.all([
    ids.length ? supabase.from("growth_events").select("id, student_id, kind, delta, reason, actor_id, at, reversal_of").in("student_id", ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from("growth_observations").select("id, student_id, axis, rating, note, actor_id, at").in("student_id", ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from("student_avatars").select("student_id, skin, hair, shirt, backdrop, accessory, automatic").in("student_id", ids) : Promise.resolve({ data: [], error: null }),
  ]);
  if (eventsResult.error || observationsResult.error || avatarsResult.error) throw new Error("โหลดข้อมูลการเติบโตไม่สำเร็จ กรุณารัน schema ล่าสุดใน Supabase");
  const avatars = Object.fromEntries(ids.map((id, index) => [id, defaultAvatar(index)]));
  for (const row of (avatarsResult.data ?? []) as AvatarRow[]) avatars[row.student_id] = { skin: row.skin, hair: row.hair, shirt: row.shirt, backdrop: row.backdrop, accessory: row.accessory, automatic: row.automatic };
  return {
    version: 1,
    events: ((eventsResult.data ?? []) as EventRow[]).map((row) => ({ id: row.id, studentId: row.student_id, kind: row.kind, delta: row.delta, reason: row.reason, actor: row.actor_id, at: row.at, reversalOf: row.reversal_of ?? undefined })),
    observations: ((observationsResult.data ?? []) as ObservationRow[]).map((row) => ({ id: row.id, studentId: row.student_id, axis: row.axis, rating: row.rating, note: row.note, actor: row.actor_id, at: row.at })),
    avatars,
  };
}

export async function saveGrowth(teacherId: string, growth: GrowthState) {
  const events = growth.events.filter((event) => !event.id.startsWith("seed-") && !event.id.startsWith("prior-"));
  const observations = growth.observations.filter((observation) => !observation.id.startsWith("obs-") && !observation.id.startsWith("prior-"));
  if (events.length) {
    const { error } = await supabase.from("growth_events").upsert(events.map((event) => ({ id: event.id, student_id: event.studentId, kind: event.kind, delta: event.delta, reason: event.reason, actor_id: teacherId, at: event.at, reversal_of: event.reversalOf ?? null })));
    if (error) throw new Error("บันทึกคะแนนแรงเสริมไม่สำเร็จ");
  }
  if (observations.length) {
    const { error } = await supabase.from("growth_observations").upsert(observations.map((observation) => ({ id: observation.id, student_id: observation.studentId, axis: observation.axis, rating: observation.rating, note: observation.note, actor_id: teacherId, at: observation.at })));
    if (error) throw new Error("บันทึกหลักฐานการเติบโตไม่สำเร็จ");
  }
  const avatars = Object.entries(growth.avatars).map(([studentId, avatar]) => ({ student_id: studentId, skin: avatar.skin, hair: avatar.hair, shirt: avatar.shirt, backdrop: avatar.backdrop, accessory: avatar.accessory, automatic: avatar.automatic, updated_at: new Date().toISOString() }));
  if (avatars.length) {
    const { error } = await supabase.from("student_avatars").upsert(avatars);
    if (error) throw new Error("บันทึกอวตาร์ไม่สำเร็จ");
  }
}
