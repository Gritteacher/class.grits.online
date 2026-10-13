import { test, expect } from "@playwright/test";
import { teacherPreview } from "./preview-fixture";
test.beforeEach(teacherPreview);
import {
  seed,
  review,
  studentTotal,
  demoStudent,
  safeLink,
  grade,
} from "../src/model";

test("scores use a single total, preserve zeros, and validate the entire review batch", () => {
  const original = seed();
  expect(studentTotal(original, demoStudent)).toEqual({ earned: 16, max: 40 });
  const next = review(original, ["p0"], { p0: "10" }, "ดีมาก");
  expect(studentTotal(next, demoStudent)).toEqual({ earned: 26, max: 40 });
  expect(original.submissions[0].status).toBe("pending");
  expect(review(original, ["p0"], { p0: "0" }, "").submissions[0].score).toBe(
    0,
  );
  expect(() =>
    review(original, ["p0", "p1"], { p0: "10", p1: "11" }, ""),
  ).toThrow();
  expect(() => review(original, ["p0"], { p0: "" }, "")).toThrow();
  expect(() => review(next, ["p0"], { p0: "10" }, "")).toThrow();
  expect(safeLink("javascript:alert(1)")).toBe(null);
  expect(safeLink("data:text/html,test")).toBe(null);
  expect(grade(74, 100)).toBe("3");
  expect(grade(75, 100)).toBe("3.5");
});

test("teacher batch review updates student score and persists after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "พื้นที่งาน", exact: true }).click();
  await page.getByLabel("ห้องเรียนในพื้นที่งาน").selectOption("ม.6/1");
  await page.getByLabel("เลือกงานรอตรวจทั้งหมด").check();
  await page.getByRole("button", { name: "ให้คะแนนเต็ม", exact: true }).click();
  await page.getByRole("button", { name: "บันทึกและส่งคะแนน 2 คน" }).click();
  await expect(
    page.getByText("ตรวจครบแล้ว ขอบคุณที่ใส่ใจทุกการเรียนรู้ครับ"),
  ).toBeVisible();
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 26 จาก 40" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 26 จาก 40" }),
  ).toBeVisible();
});

test("student submits and teacher finds, previews, and reviews the same work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await page.getByRole("button", { name: "ลงมือทำ", exact: true }).click();
  await page
    .getByLabel("คำตอบของฉัน")
    .fill("เพิ่มพื้นที่สีเขียว ระบบขนส่งสาธารณะ และจุดแยกขยะร่วมกับชุมชน");
  await page.getByRole("button", { name: "ยืนยันส่งงาน" }).click();
  await expect(page.getByRole("status")).toContainText("ส่งงานแล้ว");
  await page.getByRole("button", { name: "มุมครู", exact: true }).click();
  await page
    .locator(".assignment-card")
    .filter({ hasText: "ออกแบบเมืองที่เราอยากอยู่" })
    .click();
  await page
    .getByRole("button", { name: "ดูงาน อิงฟ้า ใจดี", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("เพิ่มพื้นที่สีเขียว");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("คะแนน อิงฟ้า ใจดี", { exact: true }).fill("18");
  await page.getByRole("button", { name: "บันทึกและส่งคะแนน 1 คน" }).click();
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "คะแนน 25 จาก 40" }),
  ).toBeVisible();
});

test("new assignment only appears in selected classrooms and invalid review does not commit", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "มอบหมายงาน", exact: true }).click();
  await page.getByLabel("ชื่องาน", { exact: true }).fill("ทดลองเฉพาะห้องสาม");
  await page.getByLabel("โจทย์หรือรายละเอียด").fill("วิเคราะห์การออมในชุมชน");
  await page.getByLabel("ม.6/3", { exact: true }).check();
  await page.getByLabel("คะแนนดิบเต็ม").fill("20");
  await page.getByLabel("คะแนนเก็บเต็ม").fill("10");
  await page.getByRole("button", { name: "มอบหมายให้ 1 ห้อง" }).click();
  await expect(page.locator(".detail-title")).toContainText(
    "ทดลองเฉพาะห้องสาม",
  );
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ทดลองเฉพาะห้องสาม" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "มุมครู", exact: true }).click();
  await page
    .locator(".assignment-card")
    .filter({ hasText: "สหกรณ์ใกล้ตัวเรา" })
    .click();
  await page.getByLabel("คะแนน อิงฟ้า ใจดี", { exact: true }).fill("11");
  await page.getByRole("button", { name: "บันทึกและส่งคะแนน 1 คน" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "กรอกคะแนนระหว่าง 0 ถึง 10",
  );
  await expect(page.getByLabel("เลือกงานของ อิงฟ้า ใจดี")).toBeVisible();
});

test("reset is confirmed, preview is keyboard accessible, and no remote requests occur", async ({
  page,
}) => {
  const remote: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4317/"))
      remote.push(request.url());
  });
  await page.goto("/");
  await page.getByLabel("คืนค่าข้อมูลจำลอง").click();
  await expect(page.getByRole("dialog")).toContainText(
    "ไม่มีผลต่อเว็บไซต์จริง",
  );
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await page.getByRole("button", { name: "ความก้าวหน้า", exact: true }).click();
  await expect(page.getByText("16 จาก 40 คะแนน")).toBeVisible();
  await page.getByLabel("ใช้โหมดมืด").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(remote).toEqual([]);
});

test("sample file upload is viewable by teacher and local storage failure keeps the draft", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "มุมนักเรียน", exact: true }).click();
  await page.getByRole("button", { name: "ลงมือทำ", exact: true }).click();
  await page.getByRole("button", { name: "แนบไฟล์", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/school-logo.png");
  await expect(page.locator(".upload-area")).toContainText("school-logo.png");
  await page.evaluate(() => {
    (
      window as unknown as { originalSet: typeof Storage.prototype.setItem }
    ).originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "ยืนยันส่งงาน" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "ส่งงานไม่สำเร็จ",
  );
  await expect(page.locator(".upload-area")).toContainText("school-logo.png");
  await page.evaluate(() => {
    Storage.prototype.setItem = (
      window as unknown as { originalSet: typeof Storage.prototype.setItem }
    ).originalSet;
  });
  await page.getByRole("button", { name: "ยืนยันส่งงาน" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "มุมครู", exact: true }).click();
  await page
    .locator(".assignment-card")
    .filter({ hasText: "ออกแบบเมืองที่เราอยากอยู่" })
    .click();
  await page
    .getByRole("button", { name: "ดูงาน อิงฟ้า ใจดี", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("img", { name: "school-logo.png" }),
  ).toBeVisible();
});

for (const width of [360, 390, 768, 1280, 1440]) {
  test(`responsive interactive screens at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    async function fit(label: string) {
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            ),
          { message: label },
        )
        .toBeLessThanOrEqual(1);
    }
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await fit("teacher home");
    await expect(page.locator(".brand img")).toBeVisible();
    expect(
      await page
        .locator(".brand img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
    await page.screenshot({
      path: `test-results/teacher-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "พื้นที่งาน", exact: true }).click();
    await page.getByLabel("เลือกงานรอตรวจทั้งหมด").check();
    await fit("grading dock");
    await page.screenshot({
      path: `test-results/workspace-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "ดูงาน อิงฟ้า ใจดี", exact: true })
      .click();
    await fit("preview dialog");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "ความก้าวหน้า", exact: true })
      .click();
    await fit("score table");
    await page
      .getByRole("button", { name: "มุมนักเรียน", exact: true })
      .click();
    await fit("student home");
    await page.screenshot({
      path: `test-results/student-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "ลงมือทำ", exact: true }).click();
    await page.getByRole("button", { name: "แนบลิงก์", exact: true }).click();
    await page.getByLabel("ลิงก์งาน").fill("https://invalid.test/long-path");
    await fit("submission dialog");
    await page.keyboard.press("Escape");
    await page.getByLabel("ใช้โหมดมืด").click();
    await fit("dark student home");
    await page.screenshot({
      path: `test-results/student-dark-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
