import { supabase } from "../lib/supabase";
import type { State } from "../model";
import { getGrade, gradePoints } from "../grading/model";

function scoreRow(
  state: State,
  studentId: string,
  assignmentId: string,
  teacherId: string,
) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  const grade = getGrade(state, studentId, assignmentId);
  if (!assignment || !grade) throw new Error("ไม่พบข้อมูลคะแนนที่ต้องการบันทึก");
  return {
    assignment_id: assignmentId,
    student_id: studentId,
    raw_score: grade.raw,
    final_score: gradePoints(grade, assignment),
    status: "graded",
    note: grade.note,
    updated_by: teacherId,
    updated_at: grade.updatedAt,
  };
}

export async function saveGradeToSupabase(
  teacherId: string,
  state: State,
  studentId: string,
  assignmentId: string,
) {
  const { error } = await supabase
    .from("score_entries")
    .upsert(scoreRow(state, studentId, assignmentId, teacherId), {
      onConflict: "assignment_id,student_id",
    });
  if (error) throw new Error("บันทึกคะแนนลง Supabase ไม่สำเร็จ กรุณาลองใหม่");
}

export async function saveReviewToSupabase(
  teacherId: string,
  state: State,
  submissionIds: string[],
) {
  const submissions = state.submissions.filter((submission) =>
    submissionIds.includes(submission.id),
  );
  if (!submissions.length) return;

  const scoreRows = submissions.map((submission) =>
    scoreRow(state, submission.studentId, submission.assignmentId, teacherId),
  );
  const { error: scoreError } = await supabase
    .from("score_entries")
    .upsert(scoreRows, { onConflict: "assignment_id,student_id" });
  if (scoreError) throw new Error("บันทึกคะแนนที่ตรวจแล้วไม่สำเร็จ กรุณาลองใหม่");

  const results = await Promise.all(
    submissions.map((submission) =>
      supabase
        .from("submissions")
        .update({
          status: submission.status,
          feedback: submission.feedback,
          reviewed_at: submission.reviewedAt ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission.id),
    ),
  );
  if (results.some((result) => result.error)) {
    throw new Error("บันทึกสถานะงานที่ตรวจแล้วไม่สำเร็จ กรุณารีเฟรชเพื่อตรวจสอบ");
  }
}
