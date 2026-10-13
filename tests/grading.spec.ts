import { test, expect, type Page } from "@playwright/test";
import { teacherPreview } from "./preview-fixture";
import { seed, review, studentTotal, type State } from "../src/model";
import {
  getGrade,
  gradePoints,
  withGradeLedger,
  writeGrade,
} from "../src/grading/model";
import {
  availability,
  saveAssignment,
  returnWork,
  snapshot,
  submitWork,
} from "../src/work/model";
import { saveStudent } from "../src/roster/model";
import { radar } from "../src/growth/model";
test.beforeEach(teacherPreview);

const KEY = "grits.flip7.prototype.v1";
function manual(state: State, studentId = "s1", assignmentId = "a2", raw = 20) {
  return writeGrade(state, {
    studentId,
    assignmentId,
    raw,
    source: "manual",
    note: "บันทึกคะแนนจากกิจกรรมในห้อง",
    expectedRevision: getGrade(state, studentId, assignmentId)?.revision ?? 0,
  });
}
async function openGrade(
  page: Page,
  name = "อิงฟ้า ใจดี",
  assignment = "ออกแบบเมืองที่เราอยากอยู่",
) {
  await page.getByRole("button", { name: "ความก้าวหน้า", exact: true }).click();
  await page
    .getByRole("button", {
      name: `แก้คะแนน ${name} · ${assignment}`,
      exact: true,
    })
    .click();
}
async function fillGrade(page: Page, raw: string) {
  await page.getByLabel("คะแนนดิบ", { exact: true }).fill(raw);
  await page.getByLabel("เหตุผลการบันทึกคะแนน").fill("คะแนนกิจกรรมในห้องเรียน");
  await page.getByRole("button", { name: "บันทึกคะแนน", exact: true }).click();
}

test("legacy grades migrate once including genuine zero and returned work", () => {
  const legacy = seed();
  delete legacy.grades;
  delete legacy.gradeEvents;
  legacy.submissions = legacy.submissions.map((s) =>
    s.id === "r1" ? { ...s, score: 0, status: "returned" } : s,
  );
  const migrated = withGradeLedger(legacy);
  expect(migrated.grades).toHaveLength(3);
  expect(getGrade(migrated, "s1", "a3")?.raw).toBe(0);
  expect(studentTotal(migrated, migrated.students[0])).toEqual({
    earned: 12,
    max: 40,
  });
  expect(withGradeLedger(migrated).grades).toEqual(migrated.grades);
  expect(migrated.gradeEvents).toEqual([]);
  expect(
    studentTotal({ ...migrated, submissions: [] }, migrated.students[0]).earned,
  ).toBe(12);
  expect(
    studentTotal({ ...legacy, grades: [] }, legacy.students[0]).earned,
  ).toBe(0);
  expect(legacy.grades).toBeUndefined();
});

test("manual grades are independent, auditable, zero-safe, and leave submission/growth records unchanged", () => {
  const original = seed();
  const next = manual(original);
  expect(studentTotal(next, next.students[0]).earned).toBe(26);
  expect(next.submissions).toBe(original.submissions);
  expect(next.growth).toBe(original.growth);
  expect(next.gradeEvents).toHaveLength(1);
  expect(next.gradeEvents![0]).toMatchObject({
    before: null,
    after: 20,
    rawMax: 20,
    finalMax: 10,
    source: "manual",
  });
  expect(
    next.submissions.find(
      (s) => s.studentId === "s1" && s.assignmentId === "a2",
    ),
  ).toBeUndefined();
  const zero = manual(next, "s1", "a2", 0);
  expect(getGrade(zero, "s1", "a2")).toMatchObject({ raw: 0, revision: 2 });
  expect(zero.gradeEvents![1]).toMatchObject({ before: 20, after: 0 });
  expect(studentTotal(zero, zero.students[0]).earned).toBe(16);
  expect(getGrade(next, "s1", "a2")?.raw).toBe(20);
  expect(
    gradePoints({ raw: 1 }, { ...next.assignments[0], rawMax: 2, finalMax: 1 }),
  ).toBe(1);
});

test("bounds, membership, notes and stale revisions cannot change grades", () => {
  const state = seed();
  for (const raw of [-1, NaN, Infinity, 21])
    expect(() => manual(state, "s1", "a2", raw)).toThrow();
  expect(() => manual(state, "s5", "a2")).toThrow("ไม่พบรายชื่อนักเรียน");
  const next = manual(state);
  expect(() =>
    writeGrade(next, {
      studentId: "s1",
      assignmentId: "a2",
      raw: 5,
      source: "manual",
      note: "แก้ไข",
      expectedRevision: 0,
    }),
  ).toThrow("คะแนนเปลี่ยน");
  expect(() =>
    writeGrade(state, {
      studentId: "s1",
      assignmentId: "a2",
      raw: 5,
      source: "manual",
      note: " ",
      expectedRevision: 0,
    }),
  ).toThrow("เหตุผล");
  expect(state.grades).toHaveLength(3);
  const roomThreeTask = state.assignments.find(
    (a) => a.groupId === "a2" && a.rooms.includes("ม.6/3"),
  )!;
  const onlyManual = manual(state, "s12", roomThreeTask.id, 10);
  expect(() =>
    saveStudent(
      onlyManual,
      { ...onlyManual.students[11], room: "ม.6/1", number: 9 },
      "s12",
    ),
  ).toThrow("ยังย้ายห้องไม่ได้");
});

test("review batches confirm manual overrides and publish grades and review state together", () => {
  const state = manual(seed(), "s1", "a1", 3);
  expect(() =>
    review(state, ["p0", "p1"], { p0: "10", p1: "10" }, "ตรวจแล้ว"),
  ).toThrow("ยืนยัน");
  const options = { confirmManual: true, expectedRevisions: { p0: 1, p1: 0 } };
  expect(() =>
    review(state, ["p0", "p1"], { p0: "10", p1: "11" }, "", options),
  ).toThrow();
  expect(state.submissions[0].status).toBe("pending");
  expect(getGrade(state, "s2", "a1")).toBeUndefined();
  const next = review(
    state,
    ["p0", "p1"],
    { p0: "10", p1: "10" },
    "ตรวจแล้ว",
    options,
  );
  expect(
    next.submissions.slice(0, 2).every((s) => s.status === "reviewed"),
  ).toBe(true);
  expect(getGrade(next, "s1", "a1")).toMatchObject({
    raw: 10,
    source: "review",
    revision: 2,
  });
  expect(next.gradeEvents!.at(-2)).toMatchObject({ before: 3, after: 10 });
  expect(() =>
    review(manual(state, "s1", "a1", 4), ["p0"], { p0: "10" }, "", options),
  ).toThrow("คะแนนเปลี่ยน");
});

test("score-only work is not missing homework and cannot accept submissions", () => {
  const state = seed();
  const exam = {
    ...state.assignments[0],
    id: "exam",
    title: "สอบกลางภาค",
    submissionRequired: false,
  };
  const next = saveAssignment(state, exam);
  expect(availability(exam).allowed).toBe(false);
  expect(() =>
    submitWork(next, { ...state.submissions[0], assignmentId: "exam" }),
  ).toThrow("ไม่ต้องส่งงาน");
  const now = Date.parse("2026-09-26T12:00:00Z");
  expect(radar(next, next.growth!, next.students[0], now)).toEqual(
    radar(state, state.growth!, state.students[0], now),
  );
  expect(() =>
    saveAssignment(state, {
      ...state.assignments[0],
      submissionRequired: false,
    }),
  ).toThrow("มีงานส่งแล้ว");
});

test("rescaling protects direct grades and preserves the original review scale in history", () => {
  const state = manual(seed(), "s3", "a1", 5);
  const assignment = state.assignments[0];
  expect(() =>
    saveAssignment(state, { ...assignment, rawMax: 4 }, true),
  ).toThrow("ต่ำกว่า");
  expect(() => saveAssignment(state, { ...assignment, rawMax: 5 })).toThrow(
    "ยืนยัน",
  );
  const changed = saveAssignment(state, { ...assignment, rawMax: 5 }, true);
  const returned = returnWork(
    changed,
    "r3",
    "เพิ่มเติม",
    "2027-01-01T00:00:00Z",
  );
  const work = returned.submissions.find((s) => s.id === "r3")!;
  expect(work.history!.at(-1)).toMatchObject({
    score: 9,
    rawMax: 10,
    finalMax: 10,
  });
  expect(studentTotal(returned, returned.students[2]).earned).toBe(10);
  expect(snapshot(work, changed.assignments[0], "returned").rawMax).toBe(10);
});

test("browser migrates old local saves, direct grades reach the student, and survive reload", async ({
  page,
}) => {
  const legacy = seed();
  delete legacy.grades;
  delete legacy.gradeEvents;
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(state));
    },
    { key: KEY, state: legacy },
  );
  await page.goto("/");
  await openGrade(page);
  await fillGrade(page, "20");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved: State = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(saved.grades).toHaveLength(4);
  expect(saved.submissions).toHaveLength(legacy.submissions.length);
  await page.reload();
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 26 จาก 40" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ความก้าวหน้า", exact: true }).click();
  await expect(
    page.locator(".score-list-row").filter({ hasText: "ออกแบบเมือง" }),
  ).toContainText("กรอกโดยครู");
  await page.getByRole("button", { name: "มุมครู", exact: true }).click();
  await openGrade(page);
  await page.getByText("ประวัติคะแนน 1 รายการ", { exact: true }).click();
  await expect(page.locator(".grade-history")).toContainText("ยังไม่กรอก → 20");
  await fillGrade(page, "0");
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 16 จาก 40" }),
  ).toBeVisible();
});

test("manual-score review confirmation supports cancel and publishes on confirm only", async ({
  page,
}) => {
  await page.goto("/");
  await openGrade(page, "อิงฟ้า ใจดี", "สหกรณ์ใกล้ตัวเรา");
  await fillGrade(page, "3");
  await page.getByRole("button", { name: "พื้นที่งาน", exact: true }).click();
  await page.getByLabel("คะแนน อิงฟ้า ใจดี", { exact: true }).fill("10");
  await page.getByRole("button", { name: "บันทึกและส่งคะแนน 1 คน" }).click();
  await expect(
    page.getByRole("dialog", { name: "แทนคะแนนที่ครูกรอกไว้?" }),
  ).toContainText("3 → 10");
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).submissions[0].status,
      KEY,
    ),
  ).toBe("pending");
  await page.getByRole("button", { name: "บันทึกและส่งคะแนน 1 คน" }).click();
  await page
    .getByRole("button", { name: "ยืนยันแทนคะแนน", exact: true })
    .click();
  await expect(
    page.getByLabel("คะแนน อิงฟ้า ใจดี", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 26 จาก 40" }),
  ).toBeVisible();
});

test("teachers create score-only exams and students receive grades without fake submissions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "มอบหมายงาน", exact: true }).click();
  await page.getByLabel("ชื่องาน", { exact: true }).fill("สอบในห้องเรียน");
  await page.getByLabel("โจทย์หรือรายละเอียด").fill("สอบข้อเขียนในห้องเรียน");
  await page.getByLabel("ม.6/1", { exact: true }).check();
  await page.getByLabel("ประเภทงาน").selectOption("สอบ");
  await page
    .getByLabel("เวลาเปิดรับ (เว้นว่าง = เปิดทันที)")
    .fill("2030-12-31T12:00");
  await page.getByLabel("เวลาปิดรับ", { exact: true }).fill("");
  await page.getByLabel("วิธีรับคะแนน").selectOption("manual");
  await page.getByLabel("วันที่กิจกรรม", { exact: true }).fill("2026-09-28");
  await page.getByLabel("คะแนนดิบเต็ม").fill("20");
  await page.getByLabel("คะแนนเก็บเต็ม").fill("10");
  await page.getByRole("button", { name: "มอบหมายให้ 1 ห้อง" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "โต๊ะทำงาน", exact: true }).click();
  await page
    .locator(".assignment-card")
    .filter({ hasText: "สอบในห้องเรียน" })
    .click();
  await expect(page.locator(".score-only-callout")).toContainText(
    "ไม่รับงานส่งบนเว็บ",
  );
  await page.getByRole("button", { name: "ไปกรอกคะแนน", exact: true }).click();
  await page
    .getByRole("button", {
      name: "แก้คะแนน อิงฟ้า ใจดี · สอบในห้องเรียน",
      exact: true,
    })
    .click();
  await fillGrade(page, "20");
  const saved: State = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  const exam = saved.assignments.find((a) => a.title === "สอบในห้องเรียน")!;
  expect(exam.opensAt).toBeUndefined();
  expect(saved.submissions.some((s) => s.assignmentId === exam.id)).toBe(false);
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 26 จาก 50" }),
  ).toBeVisible();
  const task = page
    .locator(".student-task")
    .filter({ hasText: "สอบในห้องเรียน" });
  await expect(task).toContainText("ครูบันทึกคะแนน");
  await expect(
    task.getByRole("button", { name: "ส่งงาน", exact: true }),
  ).toHaveCount(0);
});

test("failed review replacement keeps confirmation and previous score", async ({
  page,
}) => {
  await page.goto("/");
  await openGrade(page, "อิงฟ้า ใจดี", "สหกรณ์ใกล้ตัวเรา");
  await fillGrade(page, "3");
  await page.getByRole("button", { name: "พื้นที่งาน", exact: true }).click();
  await page.getByLabel("คะแนน อิงฟ้า ใจดี", { exact: true }).fill("10");
  await page.getByRole("button", { name: "บันทึกและส่งคะแนน 1 คน" }).click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "ยืนยันแทนคะแนน", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "คะแนนเดิมยังอยู่",
  );
  const saved: State = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(getGrade(saved, "s1", "a1")?.raw).toBe(3);
  expect(saved.submissions[0].status).toBe("pending");
});

test("failed direct-grade save retains draft and all previous records", async ({
  page,
}) => {
  await page.goto("/");
  await openGrade(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await fillGrade(page, "20");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "คะแนนเดิมยังอยู่",
  );
  await expect(page.getByLabel("คะแนนดิบ", { exact: true })).toHaveValue("20");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 16 จาก 40" }),
  ).toBeVisible();
});

test("bottom dock supports both roles on small and landscape screens", async ({
  page,
}) => {
  await page.goto("/");
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 740, height: 420 },
  ]) {
    await page.setViewportSize(viewport);
    for (const role of ["มุมครู", "มุมนักเรียน"]) {
      await page.getByRole("button", { name: role, exact: true }).click();
      const buttons = page
        .getByRole("navigation", { name: "เมนูหลัก" })
        .getByRole("button");
      for (let i = 0; i < (await buttons.count()); i++) {
        await buttons.nth(i).click();
        await expect(buttons.nth(i)).toHaveAttribute("aria-current", "page");
        const bounds = await buttons.nth(i).boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
});

for (const width of [360, 768, 1024, 1440])
  test(`glass navigation and grade editing fit ${width}px in both themes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    const dock = page.getByRole("complementary", { name: "แถบนำทางด้านล่าง" });
    const before = await dock.boundingBox();
    expect(before!.y).toBeGreaterThan(850);
    expect(before!.x).toBeGreaterThanOrEqual(8);
    expect(before!.x + before!.width).toBeLessThanOrEqual(width - 8);
    await page.locator(".page-footer").scrollIntoViewIfNeeded();
    const footer = await page.locator(".page-footer").boundingBox();
    const after = await dock.boundingBox();
    expect(after!.y).toBeCloseTo(before!.y, 0);
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(after!.y);
    for (const dark of [false, true]) {
      if (dark) await page.getByLabel("ใช้โหมดมืด", { exact: true }).click();
      await openGrade(page);
      await page.getByLabel("คะแนนดิบ", { exact: true }).fill("20");
      await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
        "คะแนนเก็บ 10 / 10",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/grade-${width}-${dark ? "dark" : "light"}.png`,
      });
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "โต๊ะทำงาน", exact: true })
        .click();
      await page.screenshot({
        path: `test-results/glass-${width}-${dark ? "dark" : "light"}.png`,
      });
    }
  });
