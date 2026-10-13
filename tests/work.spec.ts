import { test, expect, type Page } from "@playwright/test";
import { teacherPreview } from "./preview-fixture";
test.beforeEach(teacherPreview);
import { seed, review, studentTotal, type Submission } from "../src/model";
import {
  availability,
  deadline,
  fromThaiInput,
  returnWork,
  saveAssignment,
  saveAssignmentGroup,
  submitWork,
} from "../src/work/model";
import { radar } from "../src/growth/model";
import {
  assignmentGroupId,
  assignmentGroups,
  withRoomAssignments,
} from "../src/work/rooms";

const now = Date.parse("2026-09-26T08:00:00Z");
const input = (assignmentId: string): Submission => ({
  id: "ignored",
  assignmentId,
  studentId: "s1",
  response: "ฉบับแรก",
  submittedAt: "invalid-client-time",
  status: "pending",
  score: null,
  feedback: "",
});

test("Thai schedule boundaries and submission rules are enforced in the mutation", () => {
  const original = seed();
  const task = {
    ...original.assignments[1],
    opensAt: "2026-09-26T08:00:00Z",
    closesAt: "2026-09-26T09:00:00Z",
    allowLate: false,
  };
  const state = saveAssignment(original, task);
  expect(fromThaiInput("2026-09-26T15:00")).toBe("2026-09-26T08:00:00.000Z");
  expect(() => fromThaiInput("2026-02-30T15:00")).toThrow();
  expect(availability(task, now - 1).allowed).toBe(false);
  expect(availability(task, now).allowed).toBe(true);
  expect(availability(task, now + 3600000).allowed).toBe(true);
  expect(availability(task, now + 3600001).allowed).toBe(false);
  expect(() => submitWork(state, input("a2"), now - 1)).toThrow("เปิดรับ");
  expect(() => submitWork(state, input("a2"), now + 3600001)).toThrow("ปิดรับ");
  const submitted = submitWork(state, input("a2"), now);
  expect(submitted.submissions.at(-1)?.submittedAt).toBe(
    new Date(now).toISOString(),
  );
  expect(() => submitWork(submitted, input("a2"), now)).toThrow("รอตรวจ");
  expect(() =>
    submitWork(state, { ...input("a2"), studentId: "s5" }, now),
  ).toThrow("ไม่มีสิทธิ์");
  expect(() =>
    submitWork(
      state,
      { ...input("a2"), response: "", link: "javascript:alert(1)" },
      now,
    ),
  ).toThrow("ลิงก์");
  expect(() =>
    submitWork(state, { ...input("a2"), response: "" }, now),
  ).toThrow("ใส่คำตอบ");
  const late = saveAssignment(state, { ...task, allowLate: true });
  expect(
    submitWork(late, input("a2"), now + 3600001).submissions.at(-1)?.deadlineAt,
  ).toBe(task.closesAt);
});

test("assignment edit requires score confirmation and protects rooms, scores and original deadlines", () => {
  const original = seed();
  const a = original.assignments[0];
  expect(() => saveAssignment(original, { ...a, finalMax: 20 })).toThrow(
    "ยืนยัน",
  );
  const next = saveAssignment(
    original,
    { ...a, finalMax: 20, closesAt: "2026-10-10T10:00:00Z", due: "2026-10-10" },
    true,
  );
  expect(next.submissions.find((s) => s.id === "r3")?.score).toBe(9);
  expect(next.submissions.find((s) => s.id === "r3")?.deadlineAt).toBe(
    deadline(a),
  );
  expect(studentTotal(next, next.students[2]).earned).toBe(18);
  expect(next.assignments[0].edits?.[0].before.finalMax).toBe(10);
  expect(() => saveAssignment(next, { ...a, rawMax: 8 }, true)).toThrow(
    "ต่ำกว่า",
  );
  expect(() => saveAssignment(original, { ...a, rooms: ["ม.6/2"] })).toThrow(
    "เอาห้อง",
  );
  expect(() =>
    saveAssignment(original, { ...a, opensAt: "2027-01-01T00:00:00Z" }),
  ).toThrow("เวลาปิดรับ");
  expect(original.assignments[0].finalMax).toBe(10);
});

test("legacy multi-room work migrates once and preserves every score and submission", () => {
  const split = seed();
  const groups = assignmentGroups(split.assignments);
  const idToGroup = new Map(
    split.assignments.map((a) => [a.id, assignmentGroupId(a)]),
  );
  const legacy = {
    ...split,
    assignments: groups.map((group) => {
      const { groupId: _groupId, revision: _revision, ...first } = group[0];
      return { ...first, rooms: group.map((a) => a.rooms[0]) };
    }),
    submissions: split.submissions.map((s) => ({
      ...s,
      assignmentId: idToGroup.get(s.assignmentId)!,
      history: s.history?.map((h) => ({
        ...h,
        assignmentId: idToGroup.get(h.assignmentId)!,
      })),
    })),
    grades: split.grades!.map((g) => ({
      ...g,
      assignmentId: idToGroup.get(g.assignmentId)!,
    })),
    gradeEvents: split.gradeEvents!.map((g) => ({
      ...g,
      assignmentId: idToGroup.get(g.assignmentId)!,
    })),
  };
  const before = legacy.students.map((student) =>
    studentTotal(legacy, student),
  );
  const migrated = withRoomAssignments(legacy);
  expect(migrated.assignments).toHaveLength(9);
  expect(migrated.assignments.every((a) => a.rooms.length === 1)).toBe(true);
  expect(
    migrated.students.map((student) => studentTotal(migrated, student)),
  ).toEqual(before);
  expect(
    migrated.assignments.find(
      (a) =>
        a.id === migrated.submissions.find((s) => s.id === "p2")!.assignmentId,
    )?.rooms,
  ).toEqual(["ม.6/2"]);
  expect(withRoomAssignments(migrated)).toEqual(migrated);
});

test("a grouped edit changes only selected rooms and fails atomically", () => {
  const state = seed();
  const source = state.assignments.find(
    (a) => a.groupId === "a1" && a.rooms.includes("ม.6/1"),
  )!;
  const roomTwo = state.assignments.find(
    (a) => a.groupId === "a1" && a.rooms.includes("ม.6/2"),
  )!;
  const revisions = Object.fromEntries(
    state.assignments
      .filter((a) => a.groupId === "a1")
      .map((a) => [a.id, a.revision ?? 0]),
  );
  const next = saveAssignmentGroup(
    state,
    {
      ...source,
      rooms: ["ม.6/2"],
      finalMax: 12,
      due: "2026-10-15",
      closesAt: "2026-10-15T10:00:00Z",
    },
    true,
    revisions,
  );
  expect(next.assignments.find((a) => a.id === source.id)).toMatchObject({
    finalMax: 10,
    due: "2026-09-25",
  });
  expect(next.assignments.find((a) => a.id === roomTwo.id)).toMatchObject({
    finalMax: 12,
    due: "2026-10-15",
    revision: 1,
  });
  expect(next.submissions.find((s) => s.id === "p2")?.deadlineAt).toBe(
    deadline(roomTwo),
  );
  expect(studentTotal(next, next.students[0]).max).toBe(40);
  expect(studentTotal(next, next.students[4]).max).toBe(32);
  expect(() =>
    saveAssignmentGroup(
      next,
      { ...source, rooms: ["ม.6/2"], finalMax: 14 },
      true,
      revisions,
    ),
  ).toThrow("เปลี่ยนระหว่างแก้ไข");
  expect(() =>
    saveAssignmentGroup(
      state,
      { ...source, rooms: ["ม.6/1", "ม.6/2"], rawMax: 8 },
      true,
      revisions,
    ),
  ).toThrow("ต่ำกว่า");
  expect(state.assignments.find((a) => a.id === roomTwo.id)?.rawMax).toBe(10);
});

test("return and resubmit preserve every file, last published grade and first-submission radar evidence", () => {
  const original = seed();
  const state = {
    ...original,
    submissions: original.submissions.map((s) =>
      s.id === "p0"
        ? {
            ...s,
            file: {
              name: "first.png",
              type: "image/png",
              data: "data:image/png;base64,YQ==",
            },
          }
        : s,
    ),
  };
  const graded = review(state, ["p0"], { p0: "7" }, "ผลตรวจครั้งแรก");
  const until = "2026-09-28T08:00:00Z";
  const returned = returnWork(graded, "p0", "เพิ่มตัวอย่าง", until, now);
  expect(studentTotal(returned, returned.students[0]).earned).toBe(23);
  expect(() => returnWork(graded, "p0", "", until, now)).toThrow();
  expect(() =>
    returnWork(graded, "p0", "แก้ไข", new Date(now).toISOString(), now),
  ).toThrow("อนาคต");
  expect(() =>
    submitWork(returned, input("a1"), Date.parse(until) + 1),
  ).toThrow("หมดเวลาแก้ไข");
  const resubmitted = submitWork(
    returned,
    { ...input("a1"), response: "ฉบับสอง", link: "https://example.org/new" },
    now + 1000,
  );
  const current = resubmitted.submissions.find((s) => s.id === "p0")!;
  expect(current).toMatchObject({
    status: "pending",
    revision: 2,
    score: 7,
    feedback: "ผลตรวจครั้งแรก",
    response: "ฉบับสอง",
  });
  expect(current.file).toBeUndefined();
  expect(
    current.history?.find((s) => s.action === "resubmitted")?.file?.name,
  ).toBe("first.png");
  expect(studentTotal(resubmitted, resubmitted.students[0]).earned).toBe(23);
  const afterReview = review(resubmitted, ["p0"], { p0: "10" }, "แก้ไขครบแล้ว");
  expect(studentTotal(afterReview, afterReview.students[0]).earned).toBe(26);
  expect(
    afterReview.submissions.find((s) => s.id === "p0")?.history,
  ).toHaveLength(4);
  const beforeRadar = radar(
    graded,
    graded.growth!,
    graded.students[0],
    now + 2000,
  ).slice(0, 2);
  const afterRadar = radar(
    afterReview,
    afterReview.growth!,
    afterReview.students[0],
    now + 2000,
  ).slice(0, 2);
  expect(afterRadar).toEqual(beforeRadar);
  expect(state.submissions[0].history).toBeUndefined();
  const zero = review(state, ["p0"], { p0: "0" }, "");
  expect(
    studentTotal(
      returnWork(zero, "p0", "แก้อีกครั้ง", until, now),
      state.students[0],
    ).earned,
  ).toBe(16);
});

async function role(page: Page, role: "teacher" | "student") {
  await page
    .getByRole("button", {
      name: role === "teacher" ? "มุมครู" : "มุมนักเรียน",
      exact: true,
    })
    .click();
}
async function openTask(page: Page, title: string) {
  await page.locator(".assignment-card").filter({ hasText: title }).click();
}
async function createTask(page: Page, title: string) {
  await page.getByRole("button", { name: "มอบหมายงาน", exact: true }).click();
  await page.getByLabel("ชื่องาน", { exact: true }).fill(title);
  await page
    .getByLabel("โจทย์หรือรายละเอียด")
    .fill("ยกตัวอย่างการออมในชีวิตประจำวัน");
  await page.getByLabel("ม.6/1", { exact: true }).check();
  await page.getByLabel("ส่งภายใน", { exact: true }).fill("2026-09-26");
  await page.getByLabel("เวลาปิดรับ", { exact: true }).fill("16:00");
  await page.getByLabel("คะแนนดิบเต็ม").fill("10");
  await page.getByLabel("คะแนนเก็บเต็ม").fill("5");
}

test("teacher edits one room in a grouped assignment without changing another room", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator(".assignment-card").filter({ hasText: "สหกรณ์ใกล้ตัวเรา" }),
  ).toHaveCount(1);
  await openTask(page, "สหกรณ์ใกล้ตัวเรา");
  await page.getByRole("button", { name: "แก้ไขงาน", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "เปลี่ยน 1 ห้อง · คงเดิม 1 ห้อง",
  );
  await page.getByLabel("ม.6/1", { exact: true }).uncheck();
  await page.getByLabel("ม.6/2", { exact: true }).check();
  await page.getByLabel("ส่งภายใน", { exact: true }).fill("2026-10-15");
  await page.getByLabel("คะแนนเก็บเต็ม").fill("12");
  await expect(page.getByLabel("ห้องที่ได้รับผลกระทบ")).toContainText("ม.6/2");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".max-score")).toContainText("10");
  await page.getByLabel("ห้องเรียนในพื้นที่งาน").selectOption("ม.6/2");
  await expect(page.locator(".max-score")).toContainText("12");
  await expect(page.locator(".work-window")).toContainText("15 ต.ค.");
  await role(page, "student");
  await page.getByLabel("สลับนักเรียนจำลอง").selectOption("s5");
  await expect(page.getByRole("img", { name: "คะแนน 0 จาก 32" })).toBeVisible();
  await page.getByLabel("สลับนักเรียนจำลอง").selectOption("s1");
  await expect(
    page.getByRole("img", { name: "คะแนน 16 จาก 40" }),
  ).toBeVisible();
});

test("complete assignment, review, return, resubmit, grade and confirmed edit flow survives reload", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(now) });
  await page.goto("/");
  await createTask(page, "งานครบวงจร");
  await page.getByRole("button", { name: "มอบหมายให้ 1 ห้อง" }).click();
  await role(page, "student");
  const task = page.locator(".student-task").filter({ hasText: "งานครบวงจร" });
  await task.getByRole("button", { name: "ส่งงาน", exact: true }).click();
  await page.getByLabel("คำตอบของฉัน").fill("ออมเงินจากค่าขนมทุกวัน");
  await page.getByRole("button", { name: "ยืนยันส่งงาน" }).click();
  await role(page, "teacher");
  await openTask(page, "งานครบวงจร");
  await page.getByLabel("คะแนน อิงฟ้า ใจดี", { exact: true }).fill("6");
  await page.getByRole("button", { name: "บันทึกและส่งคะแนน 1 คน" }).click();
  await page.getByRole("tab", { name: "ตรวจแล้ว" }).click();
  await page.getByLabel("ส่งกลับแก้ไข อิงฟ้า ใจดี", { exact: true }).click();
  await page.getByLabel("สิ่งที่ต้องแก้ไข").fill("เพิ่มเป้าหมายการออม");
  await page.getByRole("button", { name: "ยืนยันส่งกลับ" }).click();
  await page.getByRole("tab", { name: "ส่งกลับแก้ไข" }).click();
  await expect(
    page.getByLabel("ดูงาน อิงฟ้า ใจดี", { exact: true }),
  ).toBeVisible();
  await role(page, "student");
  await expect(
    page.getByRole("img", { name: "คะแนน 19 จาก 45" }),
  ).toBeVisible();
  await task.getByRole("button", { name: "แก้ไขและส่งใหม่" }).click();
  await expect(page.getByLabel("คำตอบของฉัน")).toHaveValue(
    "ออมเงินจากค่าขนมทุกวัน",
  );
  await page
    .getByLabel("คำตอบของฉัน")
    .fill("ออมเงินเพื่อซื้อหนังสือเดือนละหนึ่งเล่ม");
  await page.getByRole("button", { name: "ยืนยันส่งงาน" }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 19 จาก 45" }),
  ).toBeVisible();
  await role(page, "teacher");
  await openTask(page, "งานครบวงจร");
  await page.getByLabel("ดูงาน อิงฟ้า ใจดี", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "ออมเงินเพื่อซื้อหนังสือ",
  );
  const history = page.getByRole("region", { name: "ประวัติงาน" });
  await history
    .locator("summary")
    .filter({ hasText: "ก่อนส่งฉบับใหม่" })
    .click();
  await expect(
    history.getByText("ออมเงินจากค่าขนมทุกวัน", { exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("คะแนน อิงฟ้า ใจดี", { exact: true }).fill("10");
  await page.getByRole("button", { name: "บันทึกและส่งคะแนน 1 คน" }).click();
  await page.getByRole("button", { name: "แก้ไขงาน", exact: true }).click();
  await page.getByLabel("คะแนนเก็บเต็ม").fill("10");
  await expect(
    page.getByRole("region", { name: "ผลกระทบต่อคะแนน" }),
  ).toContainText("5 → 10");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "ยืนยันผลกระทบ",
  );
  await page.getByLabel("ยืนยันปรับคะแนนเก็บของงานนี้").check();
  await page
    .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
    .click();
  await page.reload();
  await role(page, "student");
  await expect(
    page.getByRole("img", { name: "คะแนน 26 จาก 50" }),
  ).toBeVisible();
  await task.getByRole("button", { name: /ดูผลตรวจ/ }).click();
  await expect(page.getByRole("region", { name: "ประวัติงาน" })).toContainText(
    "ฉบับที่ 2",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("grits.flip7.prototype.v1")!),
  );
  const firstAxes = radar(
    saved,
    saved.growth,
    saved.students[0],
    now + 60000,
  ).slice(0, 2);
  expect(
    firstAxes.every((axis) =>
      axis.evidence.some((e) => e.label === "งานครบวงจร"),
    ),
  ).toBe(true);
});

test("open and close times change live, and submission checks the clock again while dialog is open", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(now) });
  await page.goto("/");
  await createTask(page, "งานตามเวลา");
  await page
    .getByLabel("เวลาเปิดรับ (เว้นว่าง = เปิดทันที)", { exact: true })
    .fill("2026-09-26T15:01");
  await page.getByLabel("เวลาปิดรับ", { exact: true }).fill("15:02");
  await page.getByRole("button", { name: "มอบหมายให้ 1 ห้อง" }).click();
  await role(page, "student");
  const task = page.locator(".student-task").filter({ hasText: "งานตามเวลา" });
  await expect(
    task.getByRole("button", { name: "ส่งงาน", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(61000);
  await expect(
    task.getByRole("button", { name: "ส่งงาน", exact: true }),
  ).toBeEnabled();
  await task.getByRole("button", { name: "ส่งงาน", exact: true }).click();
  await page.getByLabel("คำตอบของฉัน").fill("ฉันเปิดหน้าต่างไว้จนหมดเวลา");
  await page.clock.fastForward(61000);
  await page.getByRole("button", { name: "ยืนยันส่งงาน" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "ปิดรับงานแล้ว",
  );
  await expect(page.getByLabel("คำตอบของฉัน")).toHaveValue(
    "ฉันเปิดหน้าต่างไว้จนหมดเวลา",
  );
  await page.keyboard.press("Escape");
  await expect(
    task.getByRole("button", { name: "ส่งงาน", exact: true }),
  ).toBeDisabled();
  await role(page, "teacher");
  await openTask(page, "งานตามเวลา");
  await page.getByRole("button", { name: "แก้ไขงาน", exact: true }).click();
  await page.getByLabel("รับงานล่าช้าหลังเวลาปิดรับ").check();
  await page
    .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
    .click();
  await role(page, "student");
  await expect(task).toContainText("รับงานล่าช้า");
  await expect(
    task.getByRole("button", { name: "ส่งงาน", exact: true }),
  ).toBeEnabled();
});

test("failed edit and failed return preserve saved scores, history and form drafts", async ({
  page,
}) => {
  await page.goto("/");
  await openTask(page, "สหกรณ์ใกล้ตัวเรา");
  await page.getByRole("button", { name: "แก้ไขงาน", exact: true }).click();
  await page.getByLabel("ชื่องาน", { exact: true }).fill("ห้ามหาย");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "บันทึกในเครื่องไม่ได้",
  );
  await expect(page.getByLabel("ชื่องาน", { exact: true })).toHaveValue(
    "ห้ามหาย",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".detail-title")).toContainText("สหกรณ์ใกล้ตัวเรา");
  await page.getByLabel("ส่งกลับแก้ไข อิงฟ้า ใจดี", { exact: true }).click();
  await page.getByLabel("สิ่งที่ต้องแก้ไข").fill("เพิ่มตัวอย่าง");
  await page.getByRole("button", { name: "ยืนยันส่งกลับ" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "ยังไม่ได้ส่งกลับ",
  );
  await expect(page.getByLabel("สิ่งที่ต้องแก้ไข")).toHaveValue(
    "เพิ่มตัวอย่าง",
  );
});

test("failed resubmission keeps the prior revision and published grade intact", async ({
  page,
}) => {
  const graded = review(seed(), ["p0"], { p0: "7" }, "คะแนนเดิม");
  const returned = returnWork(
    graded,
    "p0",
    "เพิ่มตัวอย่าง",
    new Date(Date.now() + 86400000).toISOString(),
  );
  await page.addInitScript(
    (state) =>
      localStorage.setItem("grits.flip7.prototype.v1", JSON.stringify(state)),
    returned,
  );
  await page.goto("/");
  await role(page, "student");
  const task = page
    .locator(".student-task")
    .filter({ hasText: "สหกรณ์ใกล้ตัวเรา" });
  await task.getByRole("button", { name: "แก้ไขและส่งใหม่" }).click();
  await page.getByLabel("คำตอบของฉัน").fill("คำตอบฉบับแก้ไขที่ยังไม่ได้บันทึก");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "ยืนยันส่งงาน" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "ส่งงานไม่สำเร็จ",
  );
  await expect(page.getByLabel("คำตอบของฉัน")).toHaveValue(
    "คำตอบฉบับแก้ไขที่ยังไม่ได้บันทึก",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("grits.flip7.prototype.v1")!)
          .submissions,
    ),
  ).toEqual(returned.submissions);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("img", { name: "คะแนน 23 จาก 40" }),
  ).toBeVisible();
});

for (const width of [360, 768, 1280])
  test(`lifecycle controls and edit dialog fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await openTask(page, "สหกรณ์ใกล้ตัวเรา");
    await page.evaluate(() => document.fonts.ready);
    const fit = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    await expect(
      page.getByLabel("ดูงาน อิงฟ้า ใจดี", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("ส่งกลับแก้ไข อิงฟ้า ใจดี", { exact: true }),
    ).toBeVisible();
    await fit();
    await page.screenshot({
      path: `test-results/lifecycle-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "แก้ไขงาน", exact: true }).click();
    await page.getByLabel("คะแนนเก็บเต็ม").fill("20");
    await fit();
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-results/edit-work-${width}.png`,
      fullPage: true,
    });
    await page
      .getByLabel("ยืนยันปรับคะแนนเก็บของงานนี้")
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/edit-impact-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.getByLabel("ใช้โหมดมืด").click();
    await page.getByLabel("ส่งกลับแก้ไข อิงฟ้า ใจดี", { exact: true }).click();
    await fit();
    await page.screenshot({
      path: `test-results/return-work-${width}.png`,
      fullPage: true,
    });
  });
