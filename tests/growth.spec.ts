import { test, expect } from "@playwright/test";
import { teacherPreview } from "./preview-fixture";
test.beforeEach(teacherPreview);
import { demoStudent, seed, studentTotal, students } from "../src/model";
import {
  addObservation,
  addPoints,
  defaultAvatar,
  effectiveAvatar,
  growthMood,
  radar,
  restoreGrowth,
  reversePoints,
  saveAvatar,
  seedGrowth,
  wallet,
} from "../src/growth/model";

const fixedNow = Date.parse("2026-09-25T12:00:00+07:00");
const ids = students.map((s) => s.id);

test("ledger is immutable, deductions preserve XP and never change academic scores", () => {
  const state = seed();
  const original = seedGrowth(ids, fixedNow);
  const awarded = addPoints(
    original,
    "s1",
    "award",
    5,
    "ช่วยเพื่อนทบทวนบทเรียน",
  );
  expect(wallet(original, "s1")).toMatchObject({
    balance: 45,
    xp: 45,
    level: 1,
  });
  expect(wallet(awarded, "s1")).toMatchObject({
    balance: 50,
    xp: 50,
    level: 2,
  });
  const deducted = addPoints(
    awarded,
    "s1",
    "deduct",
    7,
    "ข้อตกลงที่ต้องปรับปรุง",
  );
  expect(wallet(deducted, "s1")).toMatchObject({
    balance: 43,
    xp: 50,
    level: 2,
  });
  expect(studentTotal({ ...state, growth: deducted }, demoStudent)).toEqual(
    studentTotal(state, demoStudent),
  );
  expect(() =>
    addPoints(deducted, "s1", "deduct", 44, "เกินคงเหลือ"),
  ).toThrow();
  for (const n of [0, -1, 1.5, 101, Infinity, NaN])
    expect(() => addPoints(original, "s1", "award", n, "ทดสอบ")).toThrow();
  expect(() => addPoints(original, "s1", "award", 1, "  ")).toThrow();
  expect(() => addPoints(original, "nobody", "award", 1, "ทดสอบ")).toThrow();
  const reversed = reversePoints(
    deducted,
    deducted.events.at(-1)!.id,
    "ลงผิดคน",
  );
  expect(wallet(reversed, "s1")).toMatchObject({ balance: 50, xp: 50 });
  expect(reversed.events).toHaveLength(deducted.events.length + 1);
  expect(() =>
    reversePoints(reversed, deducted.events.at(-1)!.id, "ย้อนซ้ำ"),
  ).toThrow();
  const corrected = reversePoints(
    awarded,
    awarded.events.at(-1)!.id,
    "รายการเพิ่มผิด",
  );
  expect(wallet(corrected, "s1")).toMatchObject({
    balance: 45,
    xp: 45,
    level: 1,
  });
});

test("radar uses evidence, missing is not zero, future missing work does not penalize and points do not alter radar", () => {
  const state = seed();
  const growth = seedGrowth(ids, fixedNow);
  const initial = radar(state, growth, demoStudent, fixedNow);
  expect(initial[0]).toMatchObject({ value: 100, count: 3 });
  expect(initial[1]).toMatchObject({ value: 100, count: 3 });
  const newGrowth = addPoints(
    growth,
    "s1",
    "deduct",
    10,
    "คะแนนเสริมแรงเท่านั้น",
  );
  expect(radar(state, newGrowth, demoStudent, fixedNow)).toEqual(initial);
  const empty = radar(state, growth, students.at(-1)!, fixedNow);
  expect(empty.every((a) => a.value === null)).toBeTruthy();
  expect(growthMood(empty, empty)).toBe("neutral");
  let observed = addObservation(
    growth,
    "s12",
    "reflection",
    0,
    "ได้รับโอกาสแต่ยังไม่สะท้อนสิ่งที่เรียนรู้",
  );
  const liveNow = Date.now() + 100;
  expect(radar(state, observed, students.at(-1)!, liveNow)[5].value).toBeNull();
  observed = addObservation(
    observed,
    "s12",
    "reflection",
    0,
    "บันทึกครั้งที่สอง",
  );
  observed = addObservation(
    observed,
    "s12",
    "reflection",
    0,
    "บันทึกครั้งที่สาม",
  );
  expect(
    radar(state, observed, students.at(-1)!, Date.now() + 100)[5].value,
  ).toBe(0);
  expect(() =>
    addObservation(growth, "s1", "reflection", 5, "เกินเกณฑ์"),
  ).toThrow();
});

test("adjacent windows do not duplicate boundary evidence and Thai end-of-day is inclusive", () => {
  const state = seed();
  const g = seedGrowth(ids, fixedNow);
  const boundary = new Date(fixedNow - 28 * 86_400_000).toISOString();
  g.observations = [
    {
      id: "boundary",
      studentId: "s1",
      axis: "reflection",
      rating: 3,
      note: "ขอบเขต",
      actor: "ครู",
      at: boundary,
    },
  ];
  expect(radar(state, g, demoStudent, fixedNow)[5].count).toBe(0);
  expect(radar(state, g, demoStudent, fixedNow, true)[5].count).toBe(1);
  state.submissions = [
    {
      id: "end-day",
      studentId: "s1",
      assignmentId: "a1",
      response: "งาน",
      status: "pending",
      score: null,
      feedback: "",
      submittedAt: "2026-09-25T23:59:59.900+07:00",
    },
  ];
  expect(
    radar(state, g, demoStudent, Date.parse("2026-09-26T00:01:00+07:00"))[1]
      .value,
  ).toBe(100);
});

test("five symbolic expressions and accessory locks follow explicit rules", () => {
  const state = seed();
  const growth = seedGrowth(ids, fixedNow);
  const base = radar(state, growth, demoStudent, fixedNow);
  const filled = (value: number) => base.map((a) => ({ ...a, value }));
  expect(growthMood(filled(90), filled(80))).toBe("celebrate");
  expect(growthMood(filled(75), filled(60))).toBe("confident");
  expect(growthMood(filled(60), filled(60))).toBe("focused");
  expect(growthMood(filled(25), filled(50))).toBe("thoughtful");
  expect(
    growthMood(
      base.map((a) => ({ ...a, value: null })),
      filled(80),
    ),
  ).toBe("neutral");
  expect(() =>
    saveAvatar(growth, "s1", { ...defaultAvatar(), accessory: "glasses" }),
  ).toThrow();
  const awarded = addPoints(growth, "s1", "award", 5, "ปลดล็อก");
  const dressed = saveAvatar(awarded, "s1", {
    ...defaultAvatar(),
    accessory: "glasses",
    automatic: false,
  });
  expect(effectiveAvatar(dressed, "s1")).toMatchObject({
    accessory: "glasses",
    automatic: false,
  });
  const corrected = reversePoints(
    dressed,
    awarded.events.at(-1)!.id,
    "รายการเพิ่มผิด",
  );
  expect(effectiveAvatar(corrected, "s1").accessory).toBe("none");
  expect(restoreGrowth(null, ids).avatars.s1).toBeDefined();
  expect(
    restoreGrowth({ version: 1, events: "bad" }, ids).avatars.s1,
  ).toBeDefined();
});

test("award, deduction confirmation, reversal, own-avatar edit and reload are connected", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  await expect(page.getByTestId("growth-balance")).toHaveText("45");
  await page.getByRole("button", { name: "เพิ่มคะแนน", exact: true }).click();
  await page.getByLabel("จำนวนคะแนน", { exact: true }).fill("5");
  await page.getByLabel("เหตุผลที่ชื่นชม").fill("ช่วยเพื่อนคิดวิธีแก้โจทย์");
  await page
    .getByRole("button", { name: "บันทึกเพิ่มคะแนน", exact: true })
    .click();
  await expect(page.getByTestId("growth-balance")).toHaveText("50");
  await expect(page.getByTestId("growth-xp")).toHaveText("50 XP");
  await page.getByRole("button", { name: "หักคะแนน", exact: true }).click();
  await page.getByLabel("จำนวนคะแนน", { exact: true }).fill("3");
  await page
    .getByLabel("เหตุผลและสิ่งที่ปรับปรุงได้")
    .fill("ข้อตกลงตัวอย่าง นัดวางแผนใหม่กับครู");
  await page.getByRole("button", { name: "ตรวจสอบก่อนหัก" }).click();
  await expect(page.getByTestId("growth-balance")).toHaveText("50");
  await page.getByRole("button", { name: "ยืนยันหัก 3 คะแนน" }).click();
  await expect(page.getByTestId("growth-balance")).toHaveText("47");
  await expect(page.getByTestId("growth-xp")).toHaveText("50 XP");
  await page
    .getByRole("button", {
      name: "ย้อนรายการ ข้อตกลงตัวอย่าง นัดวางแผนใหม่กับครู",
      exact: true,
    })
    .click();
  await page.getByLabel("เหตุผลที่แก้ไข").fill("บันทึกผิดคน");
  await page.getByRole("button", { name: "ยืนยันย้อนรายการ" }).click();
  await expect(page.getByTestId("growth-balance")).toHaveText("50");
  await expect(page.getByText("บันทึกผิดคน", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "เพิ่มคะแนน", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("นักเรียนการเติบโต")).toHaveCount(0);
  await page.getByLabel("แต่งตัวอวตาร์", { exact: true }).click();
  await page.getByRole("button", { name: "แว่นตา เลือกได้" }).click();
  await page.getByLabel("สีเสื้อ 3", { exact: true }).click();
  await page.getByRole("button", { name: "ผมบ๊อบ", exact: true }).click();
  await page.getByLabel("สีหน้าตามความก้าวหน้า").uncheck();
  await page.getByRole("button", { name: "บันทึกอวตาร์" }).click();
  await expect(
    page.getByRole("img", { name: "อวตาร์ อิงฟ้า ใจดี · สีหน้าคงที่" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  await expect(page.getByTestId("growth-balance")).toHaveText("50");
  await expect(
    page.getByRole("img", { name: "อวตาร์ อิงฟ้า ใจดี · สีหน้าคงที่" }),
  ).toBeVisible();
  await page.getByLabel("แต่งตัวอวตาร์", { exact: true }).click();
  await expect(page.getByLabel("สีเสื้อ 3", { exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("teacher can observe an individual and insufficient evidence remains unknown", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  await page.getByLabel("ห้องเรียนการเติบโต").selectOption("ม.6/3");
  await page.getByLabel("นักเรียนการเติบโต").selectOption("s12");
  await expect(page.getByTestId("growth-balance")).toHaveText("0");
  await expect(
    page.getByRole("img", { name: "อวตาร์ นที ร่วมใจ · พร้อมเริ่มต้น" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "บันทึกการสังเกต", exact: true })
    .click();
  await page.getByLabel("ด้านที่สังเกต").selectOption("reflection");
  await page.getByLabel("ระดับที่สังเกตได้").selectOption("3");
  await page
    .getByLabel("หลักฐานจากกิจกรรม")
    .fill("สะท้อนสิ่งที่เรียนรู้ด้วยตนเอง");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "บันทึกการสังเกต", exact: true })
    .click();
  await page
    .locator(".axis-values button")
    .filter({ hasText: "ทบทวนการเรียนรู้" })
    .click();
  await expect(
    page.getByRole("region", { name: "หลักฐาน ทบทวนการเรียนรู้" }),
  ).toContainText("มี 1 บันทึก ต้องมีอย่างน้อย 3 บันทึก");
  await expect(
    page.getByRole("region", { name: "หลักฐาน ทบทวนการเรียนรู้" }),
  ).toContainText("สะท้อนสิ่งที่เรียนรู้ด้วยตนเอง");
  await expect(page.getByTestId("growth-balance")).toHaveText("0");
});

test("old mock data upgrades without erasing academic work and reset includes growth", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const state = {
      version: 1,
      assignments: [
        {
          id: "old-task",
          title: "งานเดิมที่ทดลองไว้",
          description: "ห้ามหาย",
          category: "ใบงาน",
          rooms: ["ม.6/1"],
          rawMax: 10,
          finalMax: 10,
          due: "2026-09-25",
          color: "teal",
        },
      ],
      submissions: [],
    };
    localStorage.setItem("grits.flip7.prototype.v1", JSON.stringify(state));
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "งานเดิมที่ทดลองไว้", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  await expect(page.getByTestId("growth-balance")).toHaveText("45");
  await page.getByLabel("คืนค่าข้อมูลจำลอง").click();
  await page.getByRole("button", { name: "ยืนยันเริ่มใหม่" }).click();
  await expect(
    page.getByRole("heading", { name: "งานเดิมที่ทดลองไว้", exact: true }),
  ).toHaveCount(0);
});

test("growth save failures keep the ledger unchanged and retain the form", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  await page.getByRole("button", { name: "เพิ่มคะแนน", exact: true }).click();
  await page.getByLabel("จำนวนคะแนน", { exact: true }).fill("5");
  await page.getByLabel("เหตุผลที่ชื่นชม").fill("หลักฐานต้องไม่หาย");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "บันทึกเพิ่มคะแนน", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "ยังบันทึกในเครื่องไม่ได้",
  );
  await expect(page.getByLabel("เหตุผลที่ชื่นชม")).toHaveValue(
    "หลักฐานต้องไม่หาย",
  );
  await expect(page.getByTestId("growth-balance")).toHaveText("45");
});

for (const width of [360, 390, 768, 1280])
  test(`growth layout, evidence and avatar dialog at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const fit = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    await fit();
    await page.getByLabel("เทียบ 28 วันก่อนหน้า").check();
    await page.screenshot({
      path: `test-results/growth-teacher-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "มุมนักเรียน", exact: true })
      .click();
    await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
    await fit();
    await page.getByLabel("แต่งตัวอวตาร์", { exact: true }).click();
    await expect(
      page.getByRole("button", { name: "แว่นตา ระดับ 2" }),
    ).toBeDisabled();
    await fit();
    await page.screenshot({
      path: `test-results/growth-avatar-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.getByLabel("ใช้โหมดมืด").click();
    await fit();
    await page.screenshot({
      path: `test-results/growth-dark-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
