import type { Page } from "@playwright/test";

// Existing workflow suites start inside the teacher preview; login is covered separately.
export async function teacherPreview({ page }: { page: Page }) {
  await page.addInitScript(() => {
    const key = "grits.flip7.preview-session.v1";
    if (!sessionStorage.getItem(key))
      sessionStorage.setItem(key, JSON.stringify({ role: "teacher" }));
  });
}
