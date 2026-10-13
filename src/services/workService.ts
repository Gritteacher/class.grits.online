import { supabase } from "../lib/supabase";
import type { Assignment, State, Submission } from "../model";
import type { GradeEntry } from "../grading/model";

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  raw_max: number;
  final_max: number;
  due_at: string | null;
  opens_at: string | null;
  closes_at: string | null;
  submission_required: boolean;
  submission_mode: "individual" | "group";
  group_size: number;
};
type LinkRow = { assignment_id: string; classroom_id: string };
type ClassroomRow = { id: string; room: string; name: string };
type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  response: string;
  link: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  status: Submission["status"];
  feedback: string;
  submitted_at: string;
  reviewed_at: string | null;
  returned_at: string | null;
  resubmit_until: string | null;
  revision_note: string;
  group_id: string | null;
  group_member_ids: string[];
};
type ScoreRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  raw_score: number | null;
  status: string;
  note: string;
  updated_at: string;
};

export type WorkData = {
  assignments: Assignment[];
  submissions: Submission[];
  grades: GradeEntry[];
};

export async function loadWork(userId: string, role: "teacher" | "student"): Promise<WorkData> {
  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("assignments")
    .select("id, title, description, category, raw_max, final_max, due_at, opens_at, closes_at, submission_required, submission_mode, group_size")
    .order("created_at", { ascending: true });
  if (assignmentError) throw new Error("โหลดงานไม่สำเร็จ กรุณาลองใหม่");
  const assignmentsFromDb = (assignmentRows ?? []) as AssignmentRow[];
  if (!assignmentsFromDb.length) return { assignments: [], submissions: [], grades: [] };

  const assignmentIds = assignmentsFromDb.map((assignment) => assignment.id);
  const { data: linkRows, error: linkError } = await supabase
    .from("assignment_classrooms")
    .select("assignment_id, classroom_id")
    .in("assignment_id", assignmentIds);
  if (linkError) throw new Error("โหลดห้องของงานไม่สำเร็จ กรุณาลองใหม่");
  const links = (linkRows ?? []) as LinkRow[];
  const classroomIds = [...new Set(links.map((link) => link.classroom_id))];
  const { data: classroomRows, error: classroomError } = classroomIds.length
    ? await supabase.from("classrooms").select("id, room, name").in("id", classroomIds)
    : { data: [], error: null };
  if (classroomError) throw new Error("โหลดห้องของงานไม่สำเร็จ กรุณาลองใหม่");
  const roomById = new Map(
    ((classroomRows ?? []) as ClassroomRow[]).map((classroom) => [
      classroom.id,
      classroom.room || classroom.name,
    ]),
  );
  const roomsByAssignment = new Map<string, string[]>();
  for (const link of links) {
    const room = roomById.get(link.classroom_id);
    if (room) roomsByAssignment.set(link.assignment_id, [...(roomsByAssignment.get(link.assignment_id) ?? []), room]);
  }
  const assignments: Assignment[] = assignmentsFromDb.map((row, index) => ({
    id: row.id,
    groupId: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    rooms: [...new Set(roomsByAssignment.get(row.id) ?? [])],
    rawMax: Number(row.raw_max),
    finalMax: Number(row.final_max),
    submissionRequired: row.submission_required,
    submissionMode: row.submission_mode,
    groupSize: Number(row.group_size ?? 1),
    due: row.due_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    opensAt: row.opens_at ?? undefined,
    closesAt: row.closes_at ?? undefined,
    allowLate: true,
    color: (["teal", "gold", "coral", "sky"] as const)[index % 4],
  }));

  let submissionQuery = supabase
    .from("submissions")
    .select("id, assignment_id, student_id, response, link, file_path, file_name, file_type, status, feedback, submitted_at, reviewed_at, returned_at, resubmit_until, revision_note, group_id, group_member_ids")
    .in("assignment_id", assignmentIds);
  if (role === "student") submissionQuery = submissionQuery.eq("student_id", userId);
  const { data: submissionRows, error: submissionError } = await submissionQuery;
  if (submissionError) throw new Error("โหลดงานส่งไม่สำเร็จ กรุณาลองใหม่");
  const submissions: Submission[] = await Promise.all(((submissionRows ?? []) as SubmissionRow[]).map(async (row) => {
    let fileData = row.file_path;
    if (row.file_path) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("classroom-files")
        .createSignedUrl(row.file_path, 60 * 60);
      if (!signedError && signed?.signedUrl) fileData = signed.signedUrl;
    }
    return {
        id: row.id,
        assignmentId: row.assignment_id,
        studentId: row.student_id,
        groupId: row.group_id ?? undefined,
        groupMemberIds: row.group_member_ids ?? [],
        response: row.response,
        submittedAt: row.submitted_at,
        status: row.status,
        score: null,
        feedback: row.feedback,
        reviewedAt: row.reviewed_at ?? undefined,
        returnedAt: row.returned_at ?? undefined,
        resubmitUntil: row.resubmit_until ?? undefined,
        revisionNote: row.revision_note || undefined,
        link: row.link ?? undefined,
        file: fileData ? { name: row.file_name ?? "ไฟล์ส่งงาน", data: fileData, type: row.file_type ?? "application/octet-stream" } : undefined,
      };
  }));

  let scoreQuery = supabase
    .from("score_entries")
    .select("id, assignment_id, student_id, raw_score, status, note, updated_at")
    .in("assignment_id", assignmentIds);
  if (role === "student") scoreQuery = scoreQuery.eq("student_id", userId);
  const { data: scoreRows, error: scoreError } = await scoreQuery;
  if (scoreError) throw new Error("โหลดคะแนนไม่สำเร็จ กรุณาลองใหม่");
  const grades: GradeEntry[] = ((scoreRows ?? []) as ScoreRow[])
        .filter((row) => row.raw_score !== null)
        .map((row) => ({
          id: row.id,
          studentId: row.student_id,
          assignmentId: row.assignment_id,
          raw: Number(row.raw_score),
          source: "manual",
          revision: 1,
          updatedAt: row.updated_at,
          note: row.note,
        }));
  return { assignments, submissions, grades };
}

export function applyWorkData(state: State, work: WorkData): State {
  return {
    ...state,
    assignments: work.assignments,
    submissions: work.submissions,
    grades: work.grades,
    gradeEvents: state.gradeEvents ?? [],
  };
}
