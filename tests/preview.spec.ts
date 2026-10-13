import { test, expect, type Page } from "@playwright/test";
import { seed } from "../src/model";
import { saveStudent } from "../src/roster/model";
import { studentSession, validSession } from "../src/preview/session";

async function loginStudent(page: Page, code: string) {
  await page.getByRole("button", { name: "นักเรียน", exact: true }).click();
  await page.getByLabel("รหัสนักเรียน", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "เข้าสู่มุมนักเรียน", exact: true })
    .click();
}

test("mock identity validates active roster and preserves leading-zero student codes", () => {
  const state = saveStudent(seed(), {
    name: "ชื่อใหม่ จำลอง",
    code: "00123",
    room: "ม.6/3",
    number: 5,
  });
  expect(studentSession(state, " 00123 ")).toEqual({
    role: "student",
    studentId: state.students.at(-1)!.id,
  });
  expect(() => studentSession(state, "123")).toThrow("ไม่พบรหัส");
  expect(() => studentSession(state, " ")).toThrow("กรอกรหัส");
  expect(validSession(state, { role: "admin" })).toBe(false);
  expect(validSession(state, { role: "student", studentId: "missing" })).toBe(
    false,
  );
  state.students[0].status = "archived";
  expect(validSession(state, { role: "student", studentId: "s1" })).toBe(false);
  expect(() => studentSession(state, "20001")).toThrow("พักไว้");
});

test("first visit shows login, teacher can enter and logout without erasing classroom data", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("บัญชีจำลอง · ไม่ใช่การเข้าสู่ระบบจริง"),
  ).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByLabel("ใช้โหมดมืด").click();
  await page
    .getByRole("button", { name: "เข้าสู่มุมครู", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("navigation", { name: "เมนูหลัก" }),
  ).toBeVisible();
  await page.getByLabel("ออกจากระบบจำลอง").click();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "เข้าสู่มุมครู", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("grits.flip7.preview-session.v1"),
    ),
  ).toBeNull();
});

test("student identity controls room, work, scores and avatar and remains selected after reload", async ({
  page,
}) => {
  await page.goto("/");
  await loginStudent(page, "20003");
  await expect(page.locator(".student-name-tag")).toContainText(
    "พิมพ์ดาว ตั้งใจ",
  );
  await expect(page.getByRole("img", { name: "คะแนน 9 จาก 40" })).toBeVisible();
  await page.getByRole("button", { name: "ความก้าวหน้า", exact: true }).click();
  await expect(page.getByText("9 จาก 40 คะแนน", { exact: true })).toBeVisible();
  await page.getByLabel("สลับนักเรียนจำลอง").selectOption("s12");
  await expect(page.locator(".student-name-tag")).toHaveText("นที ร่วมใจ");
  await expect(page.locator(".student-task")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "เศรษฐศาสตร์ในชีวิตจริง", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("img", { name: "คะแนน 0 จาก 15" })).toBeVisible();
  await page.getByRole("button", { name: "การเติบโต", exact: true }).click();
  await expect(page.locator(".identity-name h2")).toHaveText("นที ร่วมใจ");
  await expect(page.getByTestId("growth-balance")).toHaveText("0");
  await page.getByLabel("แต่งตัวอวตาร์", { exact: true }).click();
  await page.getByLabel("สีหน้าตามความก้าวหน้า").uncheck();
  await page.getByRole("button", { name: "บันทึกอวตาร์", exact: true }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("grits.flip7.prototype.v1")!),
  );
  expect(saved.growth.avatars.s12.automatic).toBe(false);
  expect(saved.growth.avatars.s3.automatic).toBe(true);
  await page.reload();
  await expect(page.getByLabel("สลับนักเรียนจำลอง")).toHaveValue("s12");
  await expect(page.locator(".student-name-tag")).toContainText("นที ร่วมใจ");
  await page.getByLabel("สลับนักเรียนจำลอง").selectOption("s1");
  await expect(
    page.getByRole("img", { name: "คะแนน 16 จาก 40" }),
  ).toBeVisible();
});

test("selected student submits own work, teacher grades it, other student scores stay unchanged", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-09-27T08:00:00Z") });
  await page.goto("/");
  await loginStudent(page, "20012");
  await page.getByRole("button", { name: "ลงมือทำ", exact: true }).click();
  await page.getByLabel("คำตอบของฉัน").fill("คำตอบเฉพาะของนที");
  await page.getByRole("button", { name: "ยืนยันส่งงาน", exact: true }).click();
  await page.getByRole("button", { name: "มุมครู", exact: true }).click();
  await page
    .locator(".assignment-card")
    .filter({ hasText: "ออกแบบเมืองที่เราอยากอยู่" })
    .click();
  await page.getByLabel("ห้องเรียนในพื้นที่งาน").selectOption("ม.6/3");
  await page.getByLabel("ดูงาน นที ร่วมใจ", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("คำตอบเฉพาะของนที");
  await page.keyboard.press("Escape");
  await page.getByLabel("คะแนน นที ร่วมใจ", { exact: true }).fill("20");
  await page
    .getByRole("button", { name: "บันทึกและส่งคะแนน 1 คน", exact: true })
    .click();
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 10 จาก 15" }),
  ).toBeVisible();
  await page.getByLabel("สลับนักเรียนจำลอง").selectOption("s1");
  await expect(
    page.getByRole("img", { name: "คะแนน 16 จาก 40" }),
  ).toBeVisible();
  await expect(page.getByText("คำตอบเฉพาะของนที", { exact: true })).toHaveCount(
    0,
  );
});

test("newly added roster entry can login by exact code; archived and stale sessions cannot", async ({
  page,
}) => {
  const initial = saveStudent(seed(), {
    name: "ลองใหม่ เรียนดี",
    code: "00123",
    number: 5,
    room: "ม.6/2",
  });
  initial.students[0].status = "archived";
  await page.addInitScript((state) => {
    localStorage.setItem("grits.flip7.prototype.v1", JSON.stringify(state));
    sessionStorage.setItem(
      "grits.flip7.preview-session.v1",
      JSON.stringify({ role: "student", studentId: "s1" }),
    );
  }, initial);
  await page.goto("/");
  await loginStudent(page, "20001");
  await expect(page.getByRole("alert")).toContainText("พักไว้");
  await expect(page.getByRole("option", { name: /อิงฟ้า/ })).toHaveCount(0);
  await page.getByLabel("รหัสนักเรียน", { exact: true }).fill("123");
  await page
    .getByRole("button", { name: "เข้าสู่มุมนักเรียน", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("ไม่พบรหัส");
  await page.getByLabel("รหัสนักเรียน", { exact: true }).fill("00123");
  await page
    .getByRole("button", { name: "เข้าสู่มุมนักเรียน", exact: true })
    .click();
  await expect(page.locator(".student-name-tag")).toHaveText("ลองใหม่ เรียนดี");
  await expect(page.getByRole("img", { name: "คะแนน 0 จาก 30" })).toBeVisible();
});

for (const width of [360, 768, 1280])
  test(`preview login and student switcher fit ${width}px in both themes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "นักเรียน", exact: true }).click();
    await page
      .getByLabel("ห้องเรียนจำลอง", { exact: true })
      .selectOption("ม.6/3");
    await page
      .getByLabel("เลือกรายชื่อนักเรียนจำลอง", { exact: true })
      .selectOption("s12");
    await page.evaluate(() => document.fonts.ready);
    const fit = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    await fit();
    await page.screenshot({
      path: `test-results/login-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("ใช้โหมดมืด").click();
    await fit();
    await page.screenshot({
      path: `test-results/login-dark-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "เข้าสู่มุมนักเรียน", exact: true })
      .click();
    await fit();
    await expect(page.getByLabel("ออกจากระบบจำลอง")).toBeVisible();
    await page.screenshot({
      path: `test-results/student-identity-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("ออกจากระบบจำลอง").click();
    await expect(page.getByLabel("รหัสนักเรียน", { exact: true })).toHaveValue(
      "",
    );
  });
