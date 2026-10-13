import type {
  Assignment,
  State,
  Submission,
  SubmissionSnapshot,
} from "../model";
import { gradeEntries, withGradeLedger } from "../grading/model";
import {
  assignmentPatch,
  siblingAssignments,
  withRoomAssignments,
} from "./rooms";

export const deadline = (a: Assignment) =>
  a.closesAt ?? `${a.due}T23:59:59.999+07:00`;
export const thaiInput = (iso: string) =>
  new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16);
export function fromThaiInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("ระบุวันและเวลาให้ครบ");
  const iso = new Date(`${value}:00+07:00`).toISOString();
  if (thaiInput(iso) !== value) throw new Error("วันและเวลาไม่ถูกต้อง");
  return iso;
}
export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));

export function availability(a: Assignment, now = Date.now(), s?: Submission) {
  if (a.submissionRequired === false)
    return { allowed: false, label: "ครูบันทึกคะแนน ไม่ต้องส่งงานบนเว็บ" };
  if (s && s.status !== "returned")
    return {
      allowed: false,
      label: s.status === "reviewed" ? "ตรวจแล้ว" : "รอตรวจ",
    };
  if (s?.status === "returned") {
    const allowed = !!s.resubmitUntil && now <= Date.parse(s.resubmitUntil);
    return {
      allowed,
      label: allowed
        ? `แก้ไขได้ถึง ${dateTime(s.resubmitUntil!)}`
        : "หมดเวลาแก้ไข กรุณาติดต่อครู",
    };
  }
  if (a.opensAt && now < Date.parse(a.opensAt))
    return { allowed: false, label: `เปิดรับ ${dateTime(a.opensAt)}` };
  if (now > Date.parse(deadline(a)))
    return {
      allowed: a.allowLate ?? true,
      label: (a.allowLate ?? true) ? "รับงานล่าช้า" : "ปิดรับงานแล้ว",
    };
  return { allowed: true, label: "เปิดรับงาน" };
}

export function snapshot(
  s: Submission,
  a: Assignment,
  action: SubmissionSnapshot["action"],
  now = Date.now(),
): SubmissionSnapshot {
  const { history: _history, ...entry } = s;
  return {
    ...entry,
    revision: s.revision ?? 1,
    deadlineAt: s.deadlineAt ?? deadline(a),
    action,
    at: new Date(now).toISOString(),
    assignmentTitle: a.title,
    rawMax: s.reviewScale?.rawMax ?? a.rawMax,
    finalMax: s.reviewScale?.finalMax ?? a.finalMax,
  };
}

export function saveAssignment(
  state: State,
  assignment: Assignment,
  confirmed = false,
): State {
  state = withGradeLedger(state);
  const a = {
    ...assignment,
    title: assignment.title.trim(),
    description: assignment.description.trim(),
    rooms: [...new Set(assignment.rooms)],
  };
  if (
    !a.title ||
    a.title.length > 120 ||
    !a.description ||
    a.description.length > 2000
  )
    throw new Error("กรอกชื่องานและรายละเอียดให้ครบตามจำนวนตัวอักษรที่กำหนด");
  if (!a.rooms.length || a.rooms.some((r) => !state.rooms.includes(r)))
    throw new Error("เลือกห้องเรียนอย่างน้อย 1 ห้อง");
  if (
    !Number.isFinite(a.rawMax) ||
    a.rawMax < 0.5 ||
    a.rawMax > 1000 ||
    (a.rawMax * 2) % 1 !== 0 ||
    !Number.isInteger(a.finalMax) ||
    a.finalMax < 1 ||
    a.finalMax > 1000
  )
    throw new Error(
      "คะแนนดิบต้องเพิ่มทีละ 0.5 และคะแนนเก็บเป็นจำนวนเต็ม ระหว่าง 1–1000",
    );
  const end = Date.parse(deadline(a));
  if (
    !Number.isFinite(end) ||
    (a.opensAt &&
      (!Number.isFinite(Date.parse(a.opensAt)) || Date.parse(a.opensAt) >= end))
  )
    throw new Error("เวลาปิดรับต้องอยู่หลังเวลาเปิดรับ");
  const old = state.assignments.find((item) => item.id === a.id);
  if (!old)
    return withRoomAssignments({
      ...state,
      assignments: [...state.assignments, { ...a, groupId: a.id, revision: 0 }],
    });
  const submissions = state.submissions.filter((s) => s.assignmentId === a.id);
  if (a.submissionRequired === false && submissions.length)
    throw new Error("มีงานส่งแล้ว จึงเปลี่ยนเป็นบันทึกคะแนนอย่างเดียวไม่ได้");
  if (
    submissions.some(
      (s) =>
        !a.rooms.includes(
          state.students.find((st) => st.id === s.studentId)!.room,
        ),
    )
  )
    throw new Error(
      "เอาห้องที่มีงานส่งแล้วออกไม่ได้ เพื่อรักษางานและคะแนนเดิม",
    );
  const grades = gradeEntries(state).filter((g) => g.assignmentId === a.id);
  if (
    grades.some(
      (g) =>
        !a.rooms.includes(
          state.students.find((s) => s.id === g.studentId)!.room,
        ),
    )
  )
    throw new Error("เอาห้องที่มีคะแนนแล้วออกไม่ได้ เพื่อรักษาคะแนนเดิม");
  if (grades.some((g) => g.raw > a.rawMax))
    throw new Error(
      "คะแนนดิบเต็มใหม่ต่ำกว่าคะแนนที่ครูให้ไปแล้ว กรุณาตรวจคะแนนก่อน",
    );
  const changedScale = old.rawMax !== a.rawMax || old.finalMax !== a.finalMax;
  if (changedScale && grades.length > 0 && !confirmed)
    throw new Error("ยืนยันผลกระทบต่อคะแนนก่อนบันทึก");
  if (old.groupId && (a.rooms.length !== 1 || a.rooms[0] !== old.rooms[0]))
    throw new Error(
      "เปลี่ยนห้องของงานเดิมไม่ได้ กรุณาเลือกห้องที่จะปรับในกลุ่มงาน",
    );
  const { edits: _edits, ...before } = old;
  return {
    ...state,
    assignments: state.assignments.map((item) =>
      item.id === a.id
        ? {
            ...a,
            groupId: old.groupId,
            revision: (old.revision ?? 0) + 1,
            edits: [
              ...(old.edits ?? []),
              { at: new Date().toISOString(), before },
            ],
          }
        : item,
    ),
    // Preserve the due date in effect when existing work was submitted.
    submissions: state.submissions.map((s) =>
      s.assignmentId === a.id
        ? { ...s, deadlineAt: s.deadlineAt ?? deadline(old) }
        : s,
    ),
  };
}

export function saveAssignmentGroup(
  state: State,
  draft: Assignment,
  confirmed = false,
  expectedRevisions?: Record<string, number>,
): State {
  const source = state.assignments.find((a) => a.id === draft.id);
  if (!source) {
    if (expectedRevisions) throw new Error("ไม่พบงานเดิม กรุณาปิดแล้วเปิดใหม่");
    return saveAssignment(state, draft, confirmed);
  }
  const siblings = siblingAssignments(state, source);
  const targets = [...new Set(draft.rooms)];
  if (
    !targets.length ||
    targets.some((room) => !siblings.some((a) => a.rooms.includes(room)))
  )
    throw new Error("เลือกห้องที่ได้รับงานนี้อย่างน้อย 1 ห้อง");
  const selected = siblings.filter((a) => targets.includes(a.rooms[0]));
  if (
    !expectedRevisions ||
    [source, ...selected].some(
      (a) => expectedRevisions[a.id] !== (a.revision ?? 0),
    )
  )
    throw new Error("งานเปลี่ยนระหว่างแก้ไข กรุณาปิดแล้วเปิดใหม่");
  // Build the entire result first. The caller persists only if every room validates.
  const patch = assignmentPatch(source, draft);
  if (!Object.keys(patch).length) return state;
  return selected.reduce((next, a) => {
    const updated = { ...a, ...patch };
    return Object.keys(assignmentPatch(a, updated)).length
      ? saveAssignment(next, updated, confirmed)
      : next;
  }, state);
}

export function returnWork(
  state: State,
  id: string,
  note: string,
  until: string,
  now = Date.now(),
): State {
  const s = state.submissions.find((item) => item.id === id);
  const a = state.assignments.find((item) => item.id === s?.assignmentId);
  if (!s || !a) throw new Error("ไม่พบงานที่ต้องการส่งกลับ");
  if (!note.trim() || note.trim().length > 2000)
    throw new Error("ระบุสิ่งที่ต้องแก้ไขไม่เกิน 2,000 ตัวอักษร");
  if (!Number.isFinite(Date.parse(until)) || Date.parse(until) <= now)
    throw new Error("กำหนดส่งฉบับแก้ไขต้องอยู่ในอนาคต");
  return {
    ...state,
    submissions: state.submissions.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "returned",
            revisionNote: note.trim(),
            returnedAt: new Date(now).toISOString(),
            resubmitUntil: until,
            history: [
              ...(item.history ?? []),
              snapshot(item, a, "returned", now),
            ],
          }
        : item,
    ),
  };
}

export function submitWork(
  state: State,
  input: Submission,
  now = Date.now(),
): State {
  const a = state.assignments.find((item) => item.id === input.assignmentId);
  const student = state.students.find((s) => s.id === input.studentId);
  if (
    !a ||
    !student ||
    student.status !== "active" ||
    !a.rooms.includes(student.room)
  )
    throw new Error("นักเรียนนี้ไม่มีสิทธิ์ส่งงานที่เลือก");
  const previous = state.submissions.find(
    (s) => s.assignmentId === a.id && s.studentId === student.id,
  );
  const window = availability(a, now, previous);
  if (!window.allowed) throw new Error(window.label);
  if (
    (!input.response.trim() && !input.link && !input.file) ||
    input.response.length > 5000
  )
    throw new Error(
      "ใส่คำตอบ ลิงก์ หรือไฟล์ก่อนส่งงาน และข้อความไม่เกิน 5,000 ตัวอักษร",
    );
  if (input.link) {
    let valid = false;
    try {
      valid = ["https:", "http:"].includes(new URL(input.link).protocol);
    } catch {
      /* Validate before mutation. */
    }
    if (!valid) throw new Error("ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://");
  }
  if (
    input.file &&
    (!["application/pdf", "image/png", "image/jpeg"].includes(
      input.file.type,
    ) ||
      !input.file.data.startsWith(`data:${input.file.type};base64,`) ||
      input.file.data.length > 2800000)
  )
    throw new Error("ไฟล์ต้องเป็น PDF, PNG หรือ JPG ขนาดไม่เกิน 2 MB");
  const next: Submission = {
    id: previous?.id ?? crypto.randomUUID(),
    assignmentId: a.id,
    studentId: student.id,
    response: input.response.trim(),
    link: input.link,
    file: input.file,
    submittedAt: new Date(now).toISOString(),
    status: "pending",
    score: previous?.score ?? null,
    feedback: previous?.feedback ?? "",
    reviewedAt: previous?.reviewedAt,
    reviewScale: previous?.reviewScale,
    revision: previous ? (previous.revision ?? 1) + 1 : 1,
    deadlineAt: previous?.resubmitUntil ?? deadline(a),
    history: previous
      ? [...(previous.history ?? []), snapshot(previous, a, "resubmitted", now)]
      : [],
  };
  return {
    ...state,
    submissions: previous
      ? state.submissions.map((s) => (s.id === previous.id ? next : s))
      : [...state.submissions, next],
  };
}

export function submitGroupWork(
  state: State,
  input: Submission,
  now = Date.now(),
): State {
  const members = [...new Set(input.groupMemberIds ?? [input.studentId])];
  if (members.length < 2) throw new Error("เลือกสมาชิกกลุ่มอย่างน้อย 2 คน");
  const groupId = input.groupId ?? crypto.randomUUID();
  let next = state;
  for (const studentId of members) {
    next = submitWork(next, { ...input, id: crypto.randomUUID(), studentId, groupId, groupMemberIds: members }, now);
  }
  return next;
}
