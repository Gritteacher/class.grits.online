import type { Assignment, State } from "../model";
import { withGradeLedger } from "../grading/model";

export const assignmentGroupId = (a: Assignment) => a.groupId ?? a.id;

// Group identity is explicit; identical titles must never merge unrelated work.
export function assignmentGroups(assignments: Assignment[]): Assignment[][] {
  const groups = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const id = assignmentGroupId(a);
    groups.set(id, [...(groups.get(id) ?? []), a]);
  }
  return [...groups.values()];
}

export function siblingAssignments(state: State, assignment: Assignment) {
  return state.assignments.filter(
    (a) => assignmentGroupId(a) === assignmentGroupId(assignment),
  );
}

export function assignmentPatch(
  before: Assignment,
  draft: Assignment,
): Partial<Assignment> {
  const patch: Partial<Assignment> = {};
  const fields = [
    "title",
    "description",
    "category",
    "rawMax",
    "finalMax",
    "submissionRequired",
    "due",
    "opensAt",
    "closesAt",
    "allowLate",
    "color",
  ] as const;
  for (const field of fields) {
    const effective = (a: Assignment) =>
      field === "closesAt"
        ? (a.closesAt ?? `${a.due}T23:59:59.999+07:00`)
        : field === "submissionRequired"
          ? (a.submissionRequired ?? true)
          : field === "allowLate"
            ? (a.allowLate ?? true)
            : a[field];
    if (effective(before) !== effective(draft))
      Object.assign(patch, { [field]: draft[field] });
  }
  return patch;
}

// Preserve each old ID for its first room and deterministically remap every reference.
// Running this again on a migrated save does not split or duplicate anything.
export function withRoomAssignments(input: State): State {
  const state = withGradeLedger(input);
  if (state.assignments.every((a) => a.groupId && a.rooms.length === 1))
    return state;
  const used = new Set(state.assignments.map((a) => a.id));
  const byRoom = new Map<string, Map<string, string>>();
  const extra: Assignment[] = [];
  const first = state.assignments.map((a) => {
    const targets = [...new Set(a.rooms)];
    if (!targets.length)
      throw new Error("งานเดิมไม่มีห้องเรียน กรุณาตรวจข้อมูลก่อนย้าย");
    const ids = new Map<string, string>();
    const copies = targets.map((room, i) => {
      let id = a.id;
      if (i > 0) {
        const base = `${a.id}::room:${encodeURIComponent(room)}`;
        id = base;
        let suffix = 1;
        while (used.has(id)) id = `${base}:${suffix++}`;
        used.add(id);
      }
      ids.set(room, id);
      return {
        ...a,
        id,
        groupId: assignmentGroupId(a),
        revision: a.revision ?? 0,
        rooms: [room],
      };
    });
    byRoom.set(a.id, ids);
    extra.push(...copies.slice(1));
    return copies[0];
  });
  function remap(assignmentId: string, studentId: string) {
    const student = state.students.find((s) => s.id === studentId);
    const id = student && byRoom.get(assignmentId)?.get(student.room);
    if (!id)
      throw new Error(
        "งานหรือคะแนนเดิมไม่ตรงกับห้องของนักเรียน กรุณาตรวจข้อมูลก่อนย้าย",
      );
    return id;
  }
  return {
    ...state,
    assignments: [...first, ...extra],
    submissions: state.submissions.map((s) => ({
      ...s,
      assignmentId: remap(s.assignmentId, s.studentId),
      history: s.history?.map((h) => ({
        ...h,
        assignmentId: remap(h.assignmentId, h.studentId),
      })),
    })),
    grades: state.grades!.map((g) => ({
      ...g,
      assignmentId: remap(g.assignmentId, g.studentId),
    })),
    gradeEvents: state.gradeEvents!.map((g) => ({
      ...g,
      assignmentId: remap(g.assignmentId, g.studentId),
    })),
  };
}
