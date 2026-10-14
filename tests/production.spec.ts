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
  await expect(page.getByLabel("อีเมลครู", { exact: true })).toBeVisible();
  await expect(page.getByLabel("รหัสผ่าน", { exact: true })).toBeVisible();
  await expect(page.getByText("บัญชีจำลอง · ไม่ใช่การเข้าสู่ระบบจริง")).toHaveCount(0);
});
