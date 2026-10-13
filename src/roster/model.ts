import type { State, Student } from "../model";
import { defaultAvatar } from "../growth/model";
import { gradeEntries } from "../grading/model";

export function orderedRooms(rooms: string[]) {
  return [...rooms].sort((a, b) => a.localeCompare(b, "th", { numeric: true }));
}

export function addRoom(
  state: State,
  grade: number,
  number: number,
  subject = "สังคมศึกษา",
): State {
  if (
    !Number.isInteger(grade) ||
    grade < 1 ||
    grade > 6 ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > 999
  ) {
    throw new Error("เลือกระดับชั้น ม.1–6 และเลขห้อง 1–999");
  }
  const room = `ม.${grade}/${number}`;
  if (state.rooms.includes(room)) throw new Error("มีห้องเรียนนี้แล้ว");
  return {
    ...state,
    rooms: orderedRooms([...state.rooms, room]),
    roomSubjects: {
      ...(state.roomSubjects ?? {}),
      [room]: subject.trim() || "สังคมศึกษา",
    },
  };
}

export function removeRoom(state: State, room: string): State {
  if (!state.rooms.includes(room)) throw new Error("ไม่พบห้องเรียนนี้");
  if (
    state.students.some((s) => s.room === room) ||
    state.assignments.some((a) => a.rooms.includes(room))
  ) {
    throw new Error(
      "ลบได้เฉพาะห้องว่างที่ไม่มีรายชื่อ รวมถึงรายชื่อที่พักไว้ และไม่มีงานที่มอบหมาย",
    );
  }
  const roomSubjects = { ...(state.roomSubjects ?? {}) };
  delete roomSubjects[room];
  return {
    ...state,
    rooms: state.rooms.filter((r) => r !== room),
    roomSubjects,
  };
}

export type StudentInput = Pick<Student, "name" | "code" | "room" | "number">;
export function validateStudentInput(
  state: State,
  input: StudentInput,
  id?: string,
) {
  const values = {
    ...input,
    name: input.name.trim().replace(/\s+/g, " "),
    code: input.code.trim(),
  };
  if (!/^\d{1,20}$/.test(values.code))
    throw new Error("รหัสนักเรียนต้องเป็นตัวเลข 1–20 หลัก");
  if (!values.name || values.name.length > 120)
    throw new Error("กรอกชื่อ–สกุลไม่เกิน 120 ตัวอักษร");
  if (!state.rooms.includes(values.room))
    throw new Error("เลือกห้องเรียนที่มีอยู่");
  if (
    !Number.isInteger(values.number) ||
    values.number < 1 ||
    values.number > 999
  ) {
    throw new Error("เลขที่ต้องเป็นจำนวนเต็มระหว่าง 1–999");
  }
  const existing = id ? state.students.find((s) => s.id === id) : undefined;
  if (id && !existing) throw new Error("ไม่พบรายชื่อนักเรียนนี้");
  if (state.students.some((s) => s.id !== id && s.code === values.code)) {
    throw new Error("รหัสนักเรียนนี้มีอยู่แล้ว รวมถึงในรายชื่อที่พักไว้");
  }
  if (
    existing?.status !== "archived" &&
    state.students.some(
      (s) =>
        s.id !== id &&
        s.status === "active" &&
        s.room === values.room &&
        s.number === values.number,
    )
  ) {
    throw new Error("เลขที่นี้มีผู้ใช้อยู่ในห้องแล้ว");
  }
  if (
    existing &&
    existing.room !== values.room &&
    (state.submissions.some((s) => s.studentId === id) ||
      gradeEntries(state).some((g) => g.studentId === id))
  ) {
    throw new Error(
      "ยังย้ายห้องไม่ได้ เพราะมีงานหรือคะแนนเดิม ต้องรองรับประวัติการย้ายห้องก่อน",
    );
  }
  return { values, existing };
}

export function saveStudent(
  state: State,
  input: StudentInput,
  id?: string,
): State {
  const { values, existing } = validateStudentInput(state, input, id);
  const student: Student = {
    id: id ?? crypto.randomUUID(),
    status: existing?.status ?? "active",
    ...values,
  };
  return {
    ...state,
    students: existing
      ? state.students.map((s) => (s.id === id ? student : s))
      : [...state.students, student],
    growth:
      !existing && state.growth
        ? {
            ...state.growth,
            avatars: { ...state.growth.avatars, [student.id]: defaultAvatar() },
          }
        : state.growth,
  };
}

export function setRosterStatus(
  state: State,
  ids: string[],
  status: Student["status"],
): State {
  const unique = [...new Set(ids)];
  if (
    !unique.length ||
    unique.some((id) => !state.students.some((s) => s.id === id))
  ) {
    throw new Error("เลือกรายชื่อที่มีอยู่ก่อน");
  }
  const students = state.students.map((s) =>
    unique.includes(s.id) ? { ...s, status } : s,
  );
  const slots = new Set<string>();
  for (const student of students.filter((s) => s.status === "active")) {
    const slot = `${student.room}:${student.number}`;
    if (slots.has(slot))
      throw new Error(
        "คืนรายชื่อไม่ได้ เพราะเลขที่ซ้ำกับคนที่ใช้งานอยู่ กรุณาแก้เลขที่ก่อน",
      );
    slots.add(slot);
  }
  return { ...state, students };
}
