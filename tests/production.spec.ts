import { test, expect } from "@playwright/test";

test("production entry point requires Supabase authentication", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("เริ่มเรียนรู้")).toBeVisible();
  await expect(page.getByText("ต้นแบบ · ข้อมูลสมมติ")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "มุมครู" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "มุมนักเรียน" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "เริ่มใหม่" })).toHaveCount(0);
});

test("production login form exposes only real account fields", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("รหัสนักเรียน", { exact: true })).toBeVisible();
  await expect(page.getByLabel("รหัสผ่าน", { exact: true })).toBeVisible();
  await expect(page.getByText("ลงทะเบียนครั้งแรก")).toBeVisible();
  await expect(page.getByText("เข้าสู่ระบบสำหรับครู")).toBeVisible();
  await expect(page.getByText("บัญชีจำลอง · ไม่ใช่การเข้าสู่ระบบจริง")).toHaveCount(0);
  await page.getByRole("button", { name: "เข้าสู่ระบบสำหรับครู" }).click();
  await expect(page.getByLabel("อีเมลครู", { exact: true })).toBeVisible();
  await expect(page.getByText("กลับหน้าสำหรับนักเรียน")).toBeVisible();
  await page.getByRole("button", { name: "กลับหน้าสำหรับนักเรียน" }).click();
  await page.getByRole("button", { name: "ลืมรหัสผ่าน?" }).click();
  await expect(page.getByLabel("อีเมลที่ลงทะเบียนไว้", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ส่งลิงก์ตั้งรหัสผ่าน" })).toBeVisible();
});

test("password reset link opens the reset screen", async ({ page }) => {
  await page.goto("/?reset=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(page.getByRole("heading", { name: "ตั้งรหัสผ่านใหม่", exact: true })).toBeVisible();
  await expect(page.getByLabel("ยืนยันรหัสผ่านใหม่", { exact: true })).toBeVisible();
});
