import { supabase } from "../lib/supabase";
import { trackedFetch as fetch } from "../lib/activity";
import type { Assignment, Submission } from "../model";

function isoOrNull(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}

export async function saveAssignmentToSupabase(
  teacherId: string,
  assignment: Assignment,
  roomNames: string[],
  existingId?: string,
) {
  const { data: classrooms, error: classroomError } = await supabase
    .from("classrooms")
    .select("id, room, name")
    .eq("teacher_id", teacherId);
  if (classroomError || !classrooms?.length)
    throw new Error("ไม่พบห้องเรียนจริงที่เลือก");
  const requestedRooms = new Set(roomNames.map((room) => room.trim()).filter(Boolean));
  const matchedClassrooms = classrooms.filter((classroom) =>
    requestedRooms.has(classroom.name || classroom.room),
  );
  if (matchedClassrooms.length !== requestedRooms.size)
    throw new Error("ไม่พบห้องเรียนจริงที่เลือกครบทุกห้อง");
  const classroomIds = matchedClassrooms.map((room) => room.id);
  const roomSchedules = Object.fromEntries(matchedClassrooms.flatMap((room) => {
    const schedule = assignment.roomSchedules?.[room.id] ?? assignment.roomSchedules?.[room.name || room.room];
    if (!schedule) return [];
    if (!isoOrNull(schedule.closesAt) || (schedule.opensAt && (!isoOrNull(schedule.opensAt) || Date.parse(schedule.opensAt) >= Date.parse(schedule.closesAt))))
      throw new Error(`${room.name || room.room}: วันและเวลาไม่ถูกต้อง`);
    return [[room.id, schedule]];
  }));
  let existingClassroomIds: string[] = [];
  if (existingId) {
    const { data: links, error } = await supabase.from("assignment_classrooms")
      .select("classroom_id").eq("assignment_id", existingId);
    if (error) throw new Error("ตรวจสอบห้องเดิมของงานไม่สำเร็จ");
    existingClassroomIds = (links ?? []).map((link) => link.classroom_id as string);
    if (existingClassroomIds.some((id) => !classroomIds.includes(id))) {
      throw new Error("ต้องคงห้องเดิมที่ได้รับงานไว้ เพื่อรักษางานส่งและคะแนน");
    }
  }
  const payload = {
    title: assignment.title.trim(),
    description: assignment.description.trim(),
    category: assignment.category,
    raw_max: assignment.rawMax,
    final_max: assignment.finalMax,
    due_at: isoOrNull(assignment.closesAt ?? `${assignment.due}T23:59:00+07:00`),
    opens_at: isoOrNull(assignment.opensAt),
    closes_at: isoOrNull(assignment.closesAt),
    submission_required: assignment.submissionRequired !== false,
    submission_mode: assignment.submissionMode ?? "individual",
    group_size: assignment.groupSize ?? 1,
    teacher_id: teacherId,
    room_schedules: roomSchedules,
  };
  const existing = existingId ?? null;
  const { data: saved, error: assignmentError } = existing
    ? await supabase.from("assignments").update(payload).eq("id", existing).eq("teacher_id", teacherId).select("id").maybeSingle<{ id: string }>()
    : await supabase.from("assignments").insert(payload).select("id").single<{ id: string }>();
  if (assignmentError || !saved) throw new Error("บันทึกงานไม่สำเร็จ กรุณาลองใหม่");
  const addedIds = classroomIds.filter((id) => !existingClassroomIds.includes(id));
  if (addedIds.length) {
    const { error: linkError } = await supabase.from("assignment_classrooms").insert(
      addedIds.map((classroomId) => ({ assignment_id: saved.id, classroom_id: classroomId })),
    );
    if (linkError) throw new Error("ผูกงานกับห้องเรียนไม่สำเร็จ");
  }
  return saved.id;
}

export async function submitWorkToSupabase(
  studentId: string,
  assignment: Assignment,
  submission: Submission,
) {
  let filePath: string | null = null;
  if (submission.file) {
    const safeName = submission.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "submission";
    filePath = `submissions/${studentId}/${assignment.id}/${crypto.randomUUID()}-${safeName}`;
    const blob = await fetch(submission.file.data).then((response) => response.blob());
    const { error } = await supabase.storage.from("classroom-files").upload(filePath, blob, {
      contentType: submission.file.type,
      upsert: false,
    });
    if (error) throw new Error("อัปโหลดไฟล์ส่งงานไม่สำเร็จ กรุณาลองใหม่");
  }
  const { data: previous } = await supabase
    .from("submissions")
    .select("file_path")
    .eq("assignment_id", assignment.id)
    .eq("student_id", studentId)
    .maybeSingle<{ file_path: string | null }>();
  const { error } = await supabase.from("submissions").upsert(
    {
      assignment_id: assignment.id,
      student_id: studentId,
      group_id: submission.groupId ?? null,
      group_member_ids: submission.groupMemberIds ?? [studentId],
      response: submission.response.trim(),
      link: submission.link ?? null,
      file_path: filePath,
      file_name: submission.file?.name ?? null,
      file_type: submission.file?.type ?? null,
      status: "pending",
      feedback: "",
      submitted_at: submission.submittedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,student_id" },
  );
  if (error) {
    if (filePath) await supabase.storage.from("classroom-files").remove([filePath]);
    throw new Error("บันทึกการส่งงานไม่สำเร็จ กรุณาลองใหม่");
  }
  if (previous?.file_path && previous.file_path !== filePath) {
    await supabase.storage.from("classroom-files").remove([previous.file_path]);
  }
}

export async function submitGroupWorkToSupabase(studentId: string, assignment: Assignment, submission: Submission) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบนักเรียนก่อน");
  let filePath: string | null = null;
  if (submission.file) {
    const safeName = submission.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "submission";
    filePath = `submissions/${studentId}/${assignment.id}/${crypto.randomUUID()}-${safeName}`;
    const blob = await fetch(submission.file.data).then((response) => response.blob());
    const { error } = await supabase.storage.from("classroom-files").upload(filePath, blob, { contentType: submission.file.type, upsert: false });
    if (error) throw new Error("อัปโหลดไฟล์ส่งงานไม่สำเร็จ กรุณาลองใหม่");
  }
  const response = await fetch("/api/create-group-submission", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId: assignment.id, memberIds: submission.groupMemberIds, groupId: submission.groupId, response: submission.response, link: submission.link, filePath, fileName: submission.file?.name, fileType: submission.file?.type, submittedAt: submission.submittedAt }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (filePath) await supabase.storage.from("classroom-files").remove([filePath]);
    throw new Error(payload.error || "ส่งงานกลุ่มไม่สำเร็จ");
  }
}
