import { restoreGrowth, seedGrowth, type GrowthState } from "./growth/model";
import { snapshot } from "./work/model";
import { withRoomAssignments } from "./work/rooms";
import {
  getGrade,
  gradePoints,
  withGradeLedger,
  writeGrade,
  type GradeEntry,
  type GradeEvent,
} from "./grading/model";

export type Room = string;
export type Material = {
  id: string;
  title: string;
  description: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  rooms: Room[];
  createdAt: string;
};
export type Announcement = {
  id: string;
  classroomId: string;
  room: Room;
  title: string;
  body: string;
  publishedAt: string;
};
export type MaterialDownloadLog = {
  id: string;
  materialId: string;
  materialTitle: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  room: Room;
  downloadedAt: string;
};
export type Student = {
  id: string;
  code: string;
  name: string;
  room: Room;
  number: number;
  status: "active" | "archived";
  subject?: string;
};
export type Assignment = {
  id: string;
  groupId?: string;
  revision?: number;
  title: string;
  description: string;
  category: string;
  rooms: Room[];
  rawMax: number;
  finalMax: number;
  submissionRequired?: boolean;
  submissionMode?: "individual" | "group";
  groupSize?: number;
  due: string;
  opensAt?: string;
  closesAt?: string;
  allowLate?: boolean;
  edits?: { at: string; before: Omit<Assignment, "edits"> }[];
  color: "teal" | "gold" | "coral" | "sky";
};
export type Submission = {
  id: string;
  assignmentId: string;
  studentId: string;
  groupId?: string;
  groupMemberIds?: string[];
  response: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "returned";
  // Last review result, retained for historical snapshots. Current grades live in State.grades.
  score: number | null;
  feedback: string;
  reviewedAt?: string;
  reviewScale?: { rawMax: number; finalMax: number };
  link?: string;
  file?: { name: string; data: string; type: string };
  revision?: number;
  revisionNote?: string;
  returnedAt?: string;
  resubmitUntil?: string;
  deadlineAt?: string;
  history?: SubmissionSnapshot[];
};
export type SubmissionSnapshot = Omit<Submission, "history"> & {
  action: "returned" | "resubmitted" | "reviewed";
  at: string;
  assignmentTitle: string;
  rawMax: number;
  finalMax: number;
};
export type State = {
  version: 1;
  rooms: Room[];
  roomSubjects?: Record<Room, string>;
  students: Student[];
  assignments: Assignment[];
  submissions: Submission[];
  growth?: GrowthState;
  grades?: GradeEntry[];
  gradeEvents?: GradeEvent[];
  materials?: Material[];
  announcements?: Announcement[];
  downloadLogs?: MaterialDownloadLog[];
};
export const rooms: Room[] = ["ม.6/1", "ม.6/2", "ม.6/3"];
export const students: Student[] = [
  { id: "s1", name: "อิงฟ้า ใจดี", room: "ม.6/1", number: 1 },
  { id: "s2", name: "ต้นกล้า เรียนรู้", room: "ม.6/1", number: 2 },
  { id: "s3", name: "พิมพ์ดาว ตั้งใจ", room: "ม.6/1", number: 3 },
  { id: "s4", name: "ภูผา มุ่งมั่น", room: "ม.6/1", number: 4 },
  { id: "s5", name: "น้ำใส ใฝ่รู้", room: "ม.6/2", number: 1 },
  { id: "s6", name: "ตะวัน แสนดี", room: "ม.6/2", number: 2 },
  { id: "s7", name: "ใบข้าว สุขใจ", room: "ม.6/2", number: 3 },
  { id: "s8", name: "เมฆา ก้าวหน้า", room: "ม.6/2", number: 4 },
  { id: "s9", name: "ขวัญข้าว สดใส", room: "ม.6/3", number: 1 },
  { id: "s10", name: "ธีร์ ภูมิใจ", room: "ม.6/3", number: 2 },
  { id: "s11", name: "แพรวา มีหวัง", room: "ม.6/3", number: 3 },
  { id: "s12", name: "นที ร่วมใจ", room: "ม.6/3", number: 4 },
].map((student, i) => ({
  ...student,
  code: String(20001 + i),
  status: "active",
}));
export const demoStudent = students[0];
export const mockAnswer =
  "สหกรณ์ช่วยให้สมาชิกมีอำนาจต่อรองมากขึ้น เพราะรวมกันซื้อหรือขายสินค้า และแบ่งผลประโยชน์ตามการมีส่วนร่วม ต่างจากบริษัทที่แบ่งตามจำนวนหุ้น ตัวอย่างเช่น สหกรณ์การเกษตรที่รับซื้อผลผลิตของสมาชิก ทำให้เกษตรกรไม่ต้องต่อรองราคาเพียงลำพัง";
function legacySeed(): State {
  const assignments: Assignment[] = [
    {
      id: "a1",
      title: "สหกรณ์ใกล้ตัวเรา",
      description:
        "ยกตัวอย่างสหกรณ์ในชีวิตประจำวัน 1 แห่ง อธิบายว่าสมาชิกได้รับประโยชน์อย่างไร และแตกต่างจากบริษัทเอกชนอย่างไร",
      category: "ใบงาน",
      rooms: ["ม.6/1", "ม.6/2"],
      rawMax: 10,
      finalMax: 10,
      due: "2026-09-25",
      color: "teal",
    },
    {
      id: "a2",
      title: "ออกแบบเมืองที่เราอยากอยู่",
      description:
        "เสนอแนวทางจัดการทรัพยากรของเมือง 3 ด้าน พร้อมเหตุผลประกอบ และอธิบายว่าชุมชนจะมีส่วนร่วมได้อย่างไร",
      category: "กิจกรรม",
      rooms: ["ม.6/1", "ม.6/3"],
      rawMax: 20,
      finalMax: 10,
      due: "2026-09-28",
      color: "gold",
    },
    {
      id: "a3",
      title: "บันทึกรายรับ–รายจ่าย",
      description:
        "สรุปรายรับรายจ่ายสมมติหนึ่งสัปดาห์ แยกความจำเป็นออกจากความต้องการ และเสนอวิธีออมเงินของตนเอง",
      category: "ใบงาน",
      rooms: [...rooms],
      rawMax: 10,
      finalMax: 5,
      due: "2026-09-30",
      color: "coral",
    },
    {
      id: "a4",
      title: "เศรษฐศาสตร์ในชีวิตจริง",
      description:
        "อธิบายต้นทุนค่าเสียโอกาสจากการตัดสินใจหนึ่งเรื่อง พร้อมยกตัวอย่างอุปสงค์และอุปทานในชีวิตประจำวัน",
      category: "แบบฝึกหัด",
      rooms: ["ม.6/1", "ม.6/2"],
      rawMax: 30,
      finalMax: 15,
      due: "2026-10-02",
      color: "sky",
    },
  ];
  const pending = [
    ["a1", "s1"],
    ["a1", "s2"],
    ["a1", "s5"],
    ["a1", "s6"],
    ["a2", "s9"],
    ["a3", "s3"],
    ["a4", "s7"],
  ];
  return withRoomAssignments({
    version: 1,
    rooms: [...rooms],
    students: students.map((s) => ({ ...s })),
    growth: seedGrowth(students.map((s) => s.id)),
    assignments,
    submissions: [
      ...pending.map(([assignmentId, studentId], i): Submission => ({
        id: `p${i}`,
        assignmentId,
        studentId,
        response: mockAnswer,
        submittedAt: `2026-09-24T0${i + 1}:20:00Z`,
        status: "pending",
        score: null,
        feedback: "",
      })),
      {
        id: "r1",
        assignmentId: "a3",
        studentId: "s1",
        response:
          "แบ่งรายจ่ายเป็นค่าอาหาร ค่าเดินทาง และเงินออม โดยลดการซื้อสิ่งที่ยังไม่จำเป็นเพื่อนำมาออมสัปดาห์ละ 50 บาท",
        submittedAt: "2026-09-22T04:00:00Z",
        status: "reviewed",
        score: 8,
        feedback:
          "แยกความจำเป็นกับความต้องการได้ดี ลองเพิ่มเป้าหมายการออมระยะยาวอีกนิดครับ",
        reviewedAt: "2026-09-23T03:00:00Z",
      },
      {
        id: "r2",
        assignmentId: "a4",
        studentId: "s1",
        response:
          "ถ้าเลือกอ่านหนังสือแทนทำงานพิเศษ ต้นทุนค่าเสียโอกาสคือรายได้ที่อาจได้รับจากการทำงานในช่วงเวลานั้น",
        submittedAt: "2026-09-23T04:00:00Z",
        status: "reviewed",
        score: 24,
        feedback: "ยกตัวอย่างได้ชัดเจนครับ",
        reviewedAt: "2026-09-23T05:00:00Z",
      },
      {
        id: "r3",
        assignmentId: "a1",
        studentId: "s3",
        response: mockAnswer,
        submittedAt: "2026-09-23T05:00:00Z",
        status: "reviewed",
        score: 9,
        feedback: "อธิบายประโยชน์ของสมาชิกได้ครบครับ",
        reviewedAt: "2026-09-24T03:00:00Z",
      },
    ],
  });
}

// Production starts with an empty academic workspace. The legacy prototype
// records are kept out of the new app and are removed from old local saves in
// loadState below.
export function seed(): State {
  return withRoomAssignments({
    version: 1,
    rooms: [...rooms],
    students: students.map((student) => ({ ...student })),
    growth: seedGrowth(students.map((student) => student.id)),
    assignments: [],
    submissions: [],
    grades: [],
    gradeEvents: [],
  });
}

// The authenticated application starts with no local academic records. The
// signed-in user's classrooms, roster, work and resources are loaded from
// Supabase before they are shown. `seed()` remains available to pure model
// tests and migration tooling, but is never used as production UI state.
export function emptyState(): State {
  return withRoomAssignments({
    version: 1,
    rooms: [],
    roomSubjects: {},
    students: [],
    growth: seedGrowth([]),
    assignments: [],
    submissions: [],
    grades: [],
    gradeEvents: [],
    materials: [],
    announcements: [],
    downloadLogs: [],
  });
}
export function points(submission: Submission, assignment: Assignment) {
  return submission.score !== null
    ? Math.round((submission.score / assignment.rawMax) * assignment.finalMax)
    : 0;
}
export function studentTotal(state: State, student: Student) {
  const assigned = state.assignments.filter((a) =>
    a.rooms.includes(student.room),
  );
  return {
    earned: assigned.reduce((total, a) => {
      return total + gradePoints(getGrade(state, student.id, a.id), a);
    }, 0),
    max: assigned.reduce((sum, a) => sum + a.finalMax, 0),
  };
}
export function grade(earned: number, max: number) {
  if (!max) return "—";
  const percent = (earned / max) * 100;
  return percent >= 80
    ? "4"
    : percent >= 75
      ? "3.5"
      : percent >= 70
        ? "3"
        : percent >= 65
          ? "2.5"
          : percent >= 60
            ? "2"
            : percent >= 55
              ? "1.5"
              : percent >= 50
                ? "1"
                : "0";
}
export function review(
  state: State,
  ids: string[],
  scores: Record<string, string>,
  feedback: string,
  options: {
    confirmManual?: boolean;
    expectedRevisions?: Record<string, number>;
  } = {},
): State {
  if (!ids.length)
    throw new Error("เลือกรายการที่ต้องการตรวจอย่างน้อย 1 รายการ");
  const scoreById = new Map<string, number>();
  for (const id of ids) {
    const s = state.submissions.find((item) => item.id === id);
    const assignment = state.assignments.find((a) => a.id === s?.assignmentId);
    if (!s || !assignment || s.status !== "pending")
      throw new Error("รายการนี้ถูกตรวจแล้ว กรุณาเลือกรายการใหม่");
    const current = getGrade(state, s.studentId, s.assignmentId);
    if (current?.source === "manual" && !options.confirmManual)
      throw new Error("ยืนยันก่อนแทนคะแนนที่ครูกรอกโดยตรง");
    if (
      options.expectedRevisions &&
      options.expectedRevisions[id] !== (current?.revision ?? 0)
    ) {
      throw new Error("คะแนนเปลี่ยนแล้ว กรุณาตรวจสอบรายการใหม่ก่อนบันทึก");
    }
    const raw = scores[id]?.trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 0 || n > assignment.rawMax)
      throw new Error(
        `กรอกคะแนนระหว่าง 0 ถึง ${assignment.rawMax} ให้ครบทุกรายการที่เลือก`,
      );
    scoreById.set(id, n);
  }
  let next = withGradeLedger(state);
  for (const [id, raw] of scoreById) {
    const s = state.submissions.find((item) => item.id === id)!;
    next = writeGrade(next, {
      studentId: s.studentId,
      assignmentId: s.assignmentId,
      raw,
      note: feedback,
      source: "review",
      submissionId: id,
      expectedRevision:
        getGrade(next, s.studentId, s.assignmentId)?.revision ?? 0,
    });
  }
  return {
    ...next,
    submissions: state.submissions.map((s) =>
      scoreById.has(s.id)
        ? {
            ...s,
            status: "reviewed",
            score: scoreById.get(s.id)!,
            feedback: feedback.trim(),
            reviewedAt: new Date().toISOString(),
            reviewScale: {
              rawMax: state.assignments.find((a) => a.id === s.assignmentId)!
                .rawMax,
              finalMax: state.assignments.find((a) => a.id === s.assignmentId)!
                .finalMax,
            },
            revisionNote: undefined,
            resubmitUntil: undefined,
            history: [
              ...(s.history ?? []),
              snapshot(
                s,
                state.assignments.find((a) => a.id === s.assignmentId)!,
                "reviewed",
              ),
            ],
          }
        : s,
    ),
  };
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(date));
}
export function safeLink(value: string) {
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
const STORAGE_KEY = "grits.flip7.prototype.v1";
export function loadState(): State {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    // Saves from the original local prototype have no editable roster yet.
    const savedRooms: Room[] = parsed?.rooms ?? [...rooms];
    const savedStudents: Student[] =
      parsed?.students ?? students.map((s) => ({ ...s }));
    if (
      parsed?.version === 1 &&
      Array.isArray(savedRooms) &&
      savedRooms.every(
        (r) => typeof r === "string" && /^ม\.[1-6]\/\d+$/.test(r),
      ) &&
      Array.isArray(savedStudents) &&
      savedStudents.some((s) => s.id === demoStudent.id) &&
      savedStudents.every(
        (s) =>
          typeof s.id === "string" &&
          typeof s.code === "string" &&
          typeof s.name === "string" &&
          savedRooms.includes(s.room) &&
          Number.isInteger(s.number) &&
          s.number > 0 &&
          ["active", "archived"].includes(s.status),
      ) &&
      Array.isArray(parsed.assignments) &&
      Array.isArray(parsed.submissions) &&
      parsed.assignments.every(
        (a: Assignment) =>
          typeof a.id === "string" &&
          typeof a.title === "string" &&
          Array.isArray(a.rooms) &&
          a.rooms.every((r) => savedRooms.includes(r)) &&
          Number.isFinite(a.rawMax) &&
          a.rawMax > 0 &&
          Number.isFinite(a.finalMax) &&
          a.finalMax > 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(a.due),
      ) &&
      parsed.submissions.every(
        (s: Submission) =>
          typeof s.id === "string" &&
          typeof s.response === "string" &&
          savedStudents.some((x) => x.id === s.studentId) &&
          ["pending", "reviewed", "returned"].includes(s.status) &&
          parsed.assignments.some((a: Assignment) => a.id === s.assignmentId),
      )
    ) {
      const sampleAssignmentIds = new Set(["a1", "a2", "a3", "a4"]);
      const cleanedAssignments = parsed.assignments.filter(
        (assignment: Assignment) => !sampleAssignmentIds.has(assignment.id),
      );
      const cleanedAssignmentIds = new Set(cleanedAssignments.map((assignment: Assignment) => assignment.id));
      const cleanedSubmissions = parsed.submissions.filter((submission: Submission) =>
        cleanedAssignmentIds.has(submission.assignmentId),
      );
      return withRoomAssignments({
        ...parsed,
        assignments: cleanedAssignments,
        submissions: cleanedSubmissions,
        grades: (parsed.grades ?? []).filter((grade: GradeEntry) => cleanedAssignmentIds.has(grade.assignmentId)),
        gradeEvents: (parsed.gradeEvents ?? []).filter((event: GradeEvent) => cleanedAssignmentIds.has(event.assignmentId)),
        rooms: savedRooms.sort((a, b) =>
          a.localeCompare(b, "th", { numeric: true }),
        ),
        students: savedStudents,
        growth: restoreGrowth(
          parsed.growth,
          savedStudents.map((s) => s.id),
        ),
      });
    }
  } catch {
    /* A damaged or unavailable local cache must not prevent opening the prototype. */
  }
  return seed();
}
export function persist(state: State) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(withRoomAssignments(state)));
}
