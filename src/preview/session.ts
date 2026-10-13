import type { State } from "../model";

// Local preview selection only. This is not authentication or authorization.
export type PreviewSession =
  { role: "teacher" } | { role: "student"; studentId: string };
export const SESSION_KEY = "grits.flip7.preview-session.v1";
export function validSession(
  state: State,
  value: unknown,
): value is PreviewSession {
  if (!value || typeof value !== "object") return false;
  const session = value as PreviewSession;
  return (
    session.role === "teacher" ||
    (session.role === "student" &&
      state.students.some(
        (s) => s.id === session.studentId && s.status === "active",
      ))
  );
}
export function readSession(state: State): PreviewSession | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(SESSION_KEY) || "null",
    );
    return validSession(state, value) ? value : null;
  } catch {
    return null;
  }
}
export function writeSession(session: PreviewSession | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* A storage-restricted browser can still preview in memory. */
  }
}
export function studentSession(state: State, code: string): PreviewSession {
  const normalized = code.trim();
  if (!normalized) throw new Error("กรอกรหัสนักเรียนก่อน");
  const student = state.students.find((s) => s.code === normalized);
  if (!student) throw new Error("ไม่พบรหัสนี้ในรายชื่อนักเรียนจำลอง");
  if (student.status !== "active")
    throw new Error("รายชื่อนี้ถูกพักไว้ กรุณาให้ครูคืนรายชื่อก่อน");
  return { role: "student", studentId: student.id };
}
