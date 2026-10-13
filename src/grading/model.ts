import type { Assignment, State } from "../model";

export type GradeEntry = {
  id: string;
  studentId: string;
  assignmentId: string;
  raw: number;
  source: "review" | "manual";
  revision: number;
  updatedAt: string;
  note: string;
  submissionId?: string;
};
export type GradeEvent = {
  id: string;
  studentId: string;
  assignmentId: string;
  before: number | null;
  after: number;
  source: GradeEntry["source"];
  at: string;
  note: string;
  rawMax: number;
  finalMax: number;
};

// Only saves without a grade ledger migrate. An existing empty ledger is authoritative.
export function gradeEntries(state: State): GradeEntry[] {
  if (state.grades !== undefined) return state.grades;
  return state.submissions
    .filter((s) => s.score !== null)
    .map((s) => ({
      id: `grade:${s.assignmentId}:${s.studentId}`,
      studentId: s.studentId,
      assignmentId: s.assignmentId,
      raw: s.score!,
      source: "review",
      revision: 1,
      updatedAt: s.reviewedAt ?? s.submittedAt,
      note: s.feedback,
      submissionId: s.id,
    }));
}
export function withGradeLedger(state: State): State {
  return {
    ...state,
    grades: gradeEntries(state),
    gradeEvents: state.gradeEvents ?? [],
    submissions: state.submissions.map((s) => {
      if (s.score === null || s.reviewScale) return s;
      const a = state.assignments.find((a) => a.id === s.assignmentId);
      return a
        ? { ...s, reviewScale: { rawMax: a.rawMax, finalMax: a.finalMax } }
        : s;
    }),
  };
}
export function getGrade(
  state: State,
  studentId: string,
  assignmentId: string,
) {
  return gradeEntries(state).find(
    (g) => g.studentId === studentId && g.assignmentId === assignmentId,
  );
}
export function gradePoints(
  entry: Pick<GradeEntry, "raw"> | undefined,
  assignment: Assignment,
) {
  return entry
    ? Math.round((entry.raw / assignment.rawMax) * assignment.finalMax)
    : 0;
}
export function writeGrade(
  state: State,
  input: {
    studentId: string;
    assignmentId: string;
    raw: number;
    note: string;
    source: GradeEntry["source"];
    expectedRevision: number;
    submissionId?: string;
  },
): State {
  const student = state.students.find((s) => s.id === input.studentId);
  const assignment = state.assignments.find((a) => a.id === input.assignmentId);
  if (!student || !assignment || !assignment.rooms.includes(student.room))
    throw new Error("ไม่พบรายชื่อนักเรียนในห้องที่ได้รับงานนี้");
  if (input.source === "manual" && student.status !== "active")
    throw new Error("คืนรายชื่อให้ใช้งานก่อนแก้คะแนน");
  if (
    !Number.isFinite(input.raw) ||
    input.raw < 0 ||
    input.raw > assignment.rawMax
  )
    throw new Error(`กรอกคะแนนระหว่าง 0 ถึง ${assignment.rawMax}`);
  if (
    input.note.length > 2000 ||
    (input.source === "manual" && !input.note.trim())
  )
    throw new Error("ระบุเหตุผลการบันทึกคะแนน ไม่เกิน 2,000 ตัวอักษร");
  if (
    input.source === "review" &&
    !state.submissions.some(
      (s) =>
        s.id === input.submissionId &&
        s.studentId === input.studentId &&
        s.assignmentId === input.assignmentId,
    )
  )
    throw new Error("ไม่พบงานส่งที่ตรงกับคะแนนนี้");
  const entries = gradeEntries(state);
  const existing = getGrade(state, input.studentId, input.assignmentId);
  if ((existing?.revision ?? 0) !== input.expectedRevision)
    throw new Error("คะแนนเปลี่ยนระหว่างแก้ไข กรุณาปิดแล้วเปิดช่องคะแนนใหม่");
  const at = new Date().toISOString();
  const entry: GradeEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    studentId: input.studentId,
    assignmentId: input.assignmentId,
    raw: input.raw,
    source: input.source,
    revision: (existing?.revision ?? 0) + 1,
    updatedAt: at,
    note: input.note.trim(),
    submissionId: input.source === "review" ? input.submissionId : undefined,
  };
  const event: GradeEvent = {
    id: crypto.randomUUID(),
    studentId: entry.studentId,
    assignmentId: entry.assignmentId,
    before: existing?.raw ?? null,
    after: entry.raw,
    source: entry.source,
    at,
    note: entry.note,
    rawMax: assignment.rawMax,
    finalMax: assignment.finalMax,
  };
  return {
    ...state,
    grades: existing
      ? entries.map((g) => (g.id === existing.id ? entry : g))
      : [...entries, entry],
    gradeEvents: [...(state.gradeEvents ?? []), event],
  };
}
