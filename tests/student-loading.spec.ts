import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "VITE_");
const api = env.VITE_SUPABASE_URL;
const id = "00000000-0000-4000-8000-000000011111";

for (const scenario of ["missing", "denied", "timeout", "success"] as const) {
  test(`student profile loading: ${scenario}`, async ({ page }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const jwt = [
      { alg: "HS256", typ: "JWT" },
      { sub: id, exp: expires, role: "authenticated" },
    ].map((value) => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".") + ".test-signature";
    await page.addInitScript(({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    }, {
      key: `sb-${new URL(api).hostname.split(".")[0]}-auth-token`,
      session: { access_token: jwt, refresh_token: "test-only", expires_at: expires,
        expires_in: 3600, token_type: "bearer", user: { id, aud: "authenticated", role: "authenticated" } },
    });
    await page.route(`${api}/**`, async (route) => {
      const url = new URL(route.request().url());
      let body: unknown = [];
      if (url.pathname.endsWith("/profiles")) {
        body = { id, role: "student", display_name: "นักเรียนทดสอบ", student_code: "11111", status: "active" };
      } else if (url.pathname.endsWith("/classroom_members")) {
        if (scenario === "timeout") {
          await new Promise((resolve) => setTimeout(resolve, 17000));
        }
        if (scenario === "denied") {
          await route.fulfill({ status: 403, json: { code: "42501", message: "permission denied" } });
          return;
        }
        body = scenario === "success" ? [{ classroom_id: "room-1", student_number: 1 }] : [];
      } else if (url.pathname.endsWith("/classrooms")) {
        body = { room: "ม.6/1", name: "ม.6/1", subject: "สังคมศึกษา" };
      }
      await route.fulfill({ json: body });
    });
    await page.goto("/");
    if (scenario === "success") {
      await expect(page.getByText("กำลังโหลดข้อมูลนักเรียน...")).toHaveCount(0, { timeout: 10000 });
      await expect(page.getByRole("button", { name: "ออกจากระบบ", exact: true })).toBeVisible();
    } else {
      const message = scenario === "missing" ? /ยังไม่มีห้องเรียนที่เข้าถึงได้/ :
        scenario === "denied" ? /โหลดสมาชิกห้องเรียนไม่สำเร็จ/ : /นานเกินไป/;
      await expect(page.getByRole("alert")).toContainText(message, { timeout: 20000 });
      await expect(page.getByRole("button", { name: "ลองใหม่", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "ออกจากระบบ", exact: true })).toBeVisible();
    }
  });
}
