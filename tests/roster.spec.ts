import { test, expect, type Page } from "@playwright/test";
import { teacherPreview } from "./preview-fixture";
test.beforeEach(teacherPreview);
import { seed, studentTotal } from "../src/model";
import {
  addRoom,
  removeRoom,
  saveStudent,
  setRosterStatus,
} from "../src/roster/model";
import { radar, wallet } from "../src/growth/model";

test("room and roster commands validate without changing academic or growth history", () => {
  const original = seed();
  const next = addRoom(addRoom(addRoom(original, 6, 10), 6, 8), 1, 2);
  expect(next.rooms).toEqual([
    "ม.1/2",
    "ม.6/1",
    "ม.6/2",
    "ม.6/3",
    "ม.6/8",
    "ม.6/10",
  ]);
  expect(() => addRoom(next, 6, 8)).toThrow("มีห้องเรียนนี้แล้ว");
  expect(() => addRoom(next, 0, 1)).toThrow();
  expect(() => addRoom(next, 6, 1.5)).toThrow();
  const withStudent = saveStudent(next, {
    name: "  ทดสอบ   รายชื่อ  ",
    code: " 00123 ",
    number: 1,
    room: "ม.6/8",
  });
  const student = withStudent.students.at(-1)!;
  expect(student).toMatchObject({
    name: "ทดสอบ รายชื่อ",
    code: "00123",
    status: "active",
  });
  expect(wallet(withStudent.growth!, student.id)).toMatchObject({
    balance: 0,
    xp: 0,
    level: 1,
  });
  expect(
    radar(withStudent, withStudent.growth!, student).every(
      (axis) => axis.value === null,
    ),
  ).toBe(true);
  expect(() =>
    saveStudent(withStudent, { ...student, name: "รหัสซ้ำ", number: 2 }),
  ).toThrow("รหัสนักเรียนนี้มีอยู่แล้ว");
  expect(() => saveStudent(withStudent, { ...student, code: "999" })).toThrow(
    "เลขที่นี้มีผู้ใช้อยู่",
  );
  expect(() => saveStudent(next, { ...student, code: "abc" })).toThrow();
  expect(() => saveStudent(next, { ...student, code: "" })).toThrow();
  expect(() => saveStudent(next, { ...student, number: 0 })).toThrow();
  expect(() => saveStudent(next, { ...student, room: "ม.6/99" })).toThrow();
  expect(() => removeRoom(withStudent, "ม.6/8")).toThrow("ลบได้เฉพาะห้องว่าง");
  expect(() => removeRoom(next, "ม.6/1")).toThrow();
  expect(removeRoom(next, "ม.6/10").rooms).not.toContain("ม.6/10");
  expect(() =>
    saveStudent(next, { ...original.students[0], room: "ม.6/8" }, "s1"),
  ).toThrow("ยังย้ายห้องไม่ได้");
  const archived = setRosterStatus(withStudent, ["s1", "s2"], "archived");
  expect(archived.submissions).toBe(original.submissions);
  expect(archived.assignments).toBe(original.assignments);
  expect(archived.growth).toBe(withStudent.growth);
  expect(studentTotal(archived, archived.students[0])).toEqual({
    earned: 16,
    max: 40,
  });
  expect(original.students[0].status).toBe("active");
  const conflict = saveStudent(archived, {
    code: "999",
    name: "ผู้มาใหม่",
    room: "ม.6/1",
    number: 1,
  });
  expect(() => setRosterStatus(conflict, ["s1", "s2"], "active")).toThrow(
    "เลขที่ซ้ำ",
  );
  expect(
    setRosterStatus(archived, ["s1", "s2"], "active").students[0].status,
  ).toBe("active");
});

async function openRoster(page: Page) {
  await page.getByRole("button", { name: "ห้องเรียน", exact: true }).click();
}
async function newRoom(page: Page, number: string) {
  await page
    .getByRole("button", { name: "เพิ่มห้องเรียน", exact: true })
    .click();
  await page.getByLabel("เลขห้อง", { exact: true }).fill(number);
  await page
    .getByRole("button", { name: "บันทึกห้องเรียน", exact: true })
    .click();
}
async function fillStudent(page: Page, name = "นักเรียน ทดสอบใหม่") {
  await page
    .getByRole("button", { name: "เพิ่มนักเรียน", exact: true })
    .click();
  await page.getByLabel("รหัสนักเรียน", { exact: true }).fill("00123");
  await page.getByLabel("ชื่อ–สกุล", { exact: true }).fill(name);
  await page.getByLabel("เลขที่", { exact: true }).fill("1");
}

test("new room and student propagate to assignments, scores and growth, including empty-room states", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await openRoster(page);
  await newRoom(page, "10");
  await newRoom(page, "8");
  await expect(page.locator(".roster-room strong")).toHaveText([
    "ม.6/1",
    "ม.6/2",
    "ม.6/3",
    "ม.6/8",
    "ม.6/10",
  ]);
  await page.getByRole("button", { name: "พื้นที่งาน", exact: true }).click();
  await page.getByLabel("ห้องเรียนในพื้นที่งาน").selectOption("ม.6/8");
  await expect(
    page.getByRole("region", { name: "รายละเอียดงาน" }),
  ).toContainText("ยังไม่มีงานที่มอบหมายให้ห้องนี้");
  await expect(
    page
      .getByRole("region", { name: "รายละเอียดงาน" })
      .getByText("สหกรณ์ใกล้ตัวเรา"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  await page.getByLabel("ห้องเรียนการเติบโต").selectOption("ม.6/8");
  await expect(
    page.getByText("ห้องนี้ยังไม่มีนักเรียน", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("ห้องเรียนการเติบโต").selectOption("ม.6/1");
  await expect(page.getByTestId("growth-balance")).toHaveText("45");
  await openRoster(page);
  await page.locator(".roster-room").filter({ hasText: "ม.6/8" }).click();
  await fillStudent(page);
  await page
    .getByRole("button", { name: "บันทึกรายชื่อ", exact: true })
    .click();
  await expect(page.getByText("รหัส 00123", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ความก้าวหน้า", exact: true }).click();
  await page.getByLabel("ห้องเรียนตารางคะแนน").selectOption("ม.6/8");
  await expect(
    page.getByRole("row").filter({ hasText: "นักเรียน ทดสอบใหม่" }),
  ).toContainText("0/0");
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  await page.getByLabel("ห้องเรียนการเติบโต").selectOption("ม.6/8");
  await expect(page.getByTestId("growth-balance")).toHaveText("0");
  await expect(page.locator(".identity-name h2")).toHaveText(
    "นักเรียน ทดสอบใหม่",
  );
  await page.getByRole("button", { name: "โต๊ะทำงาน", exact: true }).click();
  await page.getByRole("button", { name: "มอบหมายงาน", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("ม.6/8", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await openRoster(page);
  await page.locator(".roster-room").filter({ hasText: "ม.6/8" }).click();
  await expect(page.getByText("รหัส 00123", { exact: true })).toBeVisible();
  await page.locator(".roster-room").filter({ hasText: "ม.6/10" }).click();
  await page.getByLabel("ลบห้องเรียนนี้").click();
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(
    page.locator(".roster-room strong").filter({ hasText: "ม.6/10" }),
  ).toBeVisible();
  await page.getByLabel("ลบห้องเรียนนี้").click();
  await page.getByRole("button", { name: "ยืนยันลบห้อง", exact: true }).click();
  await expect(
    page.locator(".roster-room strong").filter({ hasText: "ม.6/10" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("archive confirmation, filtered selection, restore and edit keep existing records and preview identity", async ({
  page,
}) => {
  await page.goto("/");
  await openRoster(page);
  await page.getByLabel("เลือก อิงฟ้า ใจดี", { exact: true }).check();
  await page
    .getByRole("button", { name: "พักรายชื่อที่เลือก", exact: true })
    .click();
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(
    page.getByLabel("เลือก อิงฟ้า ใจดี", { exact: true }),
  ).toBeChecked();
  await page.getByLabel("ค้นหารายชื่อ").fill("20001");
  await expect(
    page.getByRole("button", { name: "พักรายชื่อที่เลือก", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("เลือกทั้งหมดที่แสดง").check();
  await expect(page.locator(".roster-person")).toHaveCount(1);
  await page
    .getByRole("button", { name: "พักรายชื่อที่เลือก", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ยืนยันพักรายชื่อ", exact: true })
    .click();
  await expect(page.locator(".roster-person")).toHaveCount(0);
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await page.getByLabel("รหัสนักเรียน", { exact: true }).fill("20001");
  await page
    .getByRole("button", { name: "เข้าสู่มุมนักเรียน", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("รายชื่อนี้ถูกพักไว้");
  await page.getByRole("button", { name: "ครู", exact: true }).click();
  await page
    .getByRole("button", { name: "เข้าสู่มุมครู", exact: true })
    .click();
  await openRoster(page);
  await page
    .getByLabel("สถานะรายชื่อ", { exact: true })
    .selectOption("archived");
  await page.getByLabel("เลือกทั้งหมดที่แสดง").check();
  await page
    .getByRole("button", { name: "คืนรายชื่อที่เลือก", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ยืนยันคืนรายชื่อ", exact: true })
    .click();
  await page.getByLabel("สถานะรายชื่อ", { exact: true }).selectOption("active");
  await page.getByLabel("แก้ไข อิงฟ้า ใจดี", { exact: true }).click();
  await page.getByLabel("ชื่อ–สกุล", { exact: true }).fill("อิงฟ้า เรียนรู้");
  await page
    .getByRole("button", { name: "บันทึกรายชื่อ", exact: true })
    .click();
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(page.locator(".student-name-tag")).toContainText(
    "อิงฟ้า เรียนรู้",
  );
  await expect(
    page.getByRole("button", { name: "ลงมือทำ", exact: true }),
  ).toBeEnabled();
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("grits.flip7.prototype.v1")!),
  );
  expect(saved.submissions).toEqual(seed().submissions);
  expect(saved.students[0]).toMatchObject({
    name: "อิงฟ้า เรียนรู้",
    status: "active",
  });
});

test("failed local save retains roster form and makes no partial mutation", async ({
  page,
}) => {
  await page.goto("/");
  await openRoster(page);
  await newRoom(page, "8");
  await fillStudent(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "บันทึกรายชื่อ", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "บันทึกไม่สำเร็จ",
  );
  await expect(page.getByLabel("รหัสนักเรียน", { exact: true })).toHaveValue(
    "00123",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".roster-person")).toHaveCount(0);
});

for (const width of [360, 768, 1280])
  test(`roster layout and dialogs at ${width}px in both themes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await openRoster(page);
    await page.evaluate(() => document.fonts.ready);
    const fit = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    await fit();
    await page.screenshot({
      path: `test-results/roster-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("ใช้โหมดมืด").click();
    await fit();
    await page.getByLabel("เลือกทั้งหมดที่แสดง").check();
    await page
      .getByRole("button", { name: "พักรายชื่อที่เลือก", exact: true })
      .click();
    await fit();
    await page.screenshot({
      path: `test-results/roster-confirm-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.getByLabel("แก้ไข อิงฟ้า ใจดี", { exact: true }).click();
    await fit();
    await page.screenshot({
      path: `test-results/roster-edit-${width}.png`,
      fullPage: true,
    });
  });
