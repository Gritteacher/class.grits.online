import { supabase } from "../lib/supabase";
import type { Submission } from "../model";

export async function saveSubmissionStatusToSupabase(
  teacherId: string,
  submission: Submission,
) {
  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", submission.assignmentId)
    .eq("teacher_id", teacherId)
    .maybeSingle<{ id: string }>();
  if (assignmentError || !assignment) {
    throw new Error("ครูไม่มีสิทธิ์แก้ไขงานส่งรายการนี้");
  }
  const { error } = await supabase
    .from("submissions")
    .update({
      status: submission.status,
      feedback: submission.feedback,
      reviewed_at: submission.reviewedAt ?? null,
      returned_at: submission.returnedAt ?? null,
      resubmit_until: submission.resubmitUntil ?? null,
      revision_note: submission.revisionNote ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", submission.id);
  if (error) throw new Error("บันทึกสถานะงานส่งไม่สำเร็จ กรุณาลองใหม่");
}

export async function deleteAssignmentFromSupabase(
  teacherId: string,
  assignmentId: string,
) {
  const { data: submissions, error: submissionError } = await supabase
    .from("submissions")
    .select("file_path")
    .eq("assignment_id", assignmentId);
  if (submissionError) throw new Error("ค้นหาไฟล์งานส่งไม่สำเร็จ");
  const paths = (submissions ?? [])
    .map((row) => row.file_path as string | null)
    .filter((path): path is string => Boolean(path));
  if (paths.length) {
    const { error: storageError } = await supabase.storage
      .from("classroom-files")
      .remove(paths);
    if (storageError) throw new Error("ลบไฟล์งานส่งไม่สำเร็จ งานยังไม่ถูกลบ");
  }
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("teacher_id", teacherId);
  if (error) throw new Error("ลบงานไม่สำเร็จ กรุณาลองใหม่");
}
