import { test, expect, type Page } from "@playwright/test";
import { utils, write, type WorkSheet, type BookType } from "xlsx";
import { teacherPreview } from "./preview-fixture";
import { seed, type State } from "../src/model";
import { parseWorkbook } from "../src/roster/excel";
import {
  guessHeader,
  guessMapping,
  importStudents,
  mappingError,
  previewStudents,
} from "../src/roster/importModel";
import { saveStudent, setRosterStatus } from "../src/roster/model";
test.beforeEach(teacherPreview);

const KEY = "grits.flip7.prototype.v1";
const header = ["เลขที่", "เลขประจำตัว", "คำนำหน้า", "ชื่อ", "สกุล"];
function book(
  sheets: Record<string, WorkSheet>,
  type: BookType = "xlsx",
): Buffer {
  const wb = utils.book_new();
  for (const [name, sheet] of Object.entries(sheets))
    utils.book_append_sheet(wb, sheet, name);
  return Buffer.from(
    write(wb, { type: "array", bookType: type, codepage: 874 }),
  );
}
function arrayBuffer(bytes: Buffer): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}
function simpleBook(type: BookType = "xlsx") {
  return book(
    {
      รายชื่อ: utils.aoa_to_sheet([
        header,
        [5, "00123", "นาย", "ทดสอบ", "นำเข้า"],
        [6, "00124", "นางสาว", "ทดลอง", "เรียนรู้"],
      ]),
    },
    type,
  );
}
function preview(bytes: Buffer, state = seed(), sheetIndex = 0) {
  const sheet = parseWorkbook(arrayBuffer(bytes))[sheetIndex];
  const head = guessHeader(sheet);
  const map = guessMapping(sheet.rows[head]?.values ?? []);
  return previewStudents(
    state,
    sheet,
    head,
    map,
    map.name >= 0 ? "full" : "split",
    "ม.6/1",
  );
}
async function openImport(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "ห้องเรียน", exact: true }).click();
  await page.getByRole("button", { name: "นำเข้า Excel", exact: true }).click();
}
async function upload(page: Page, buffer: Buffer, name = "รายชื่อ.xlsx") {
  await page
    .getByLabel("ไฟล์รายชื่อนักเรียน", { exact: true })
    .setInputFiles({
      name,
      mimeType: name.endsWith(".xls")
        ? "application/vnd.ms-excel"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
}

for (const type of ["biff8", "xlsx"] as const) {
  test(`${type} parses Thai names, split columns and text identifiers`, () => {
    const rows = preview(simpleBook(type));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      row: 2,
      errors: [],
      input: { number: 5, code: "00123", name: "นายทดสอบ นำเข้า" },
    });
    const before = seed();
    const after = importStudents(before, rows);
    expect(after.students).toHaveLength(14);
    expect(after.students.slice(0, 12)).toEqual(before.students);
    expect(after.submissions).toBe(before.submissions);
    expect(after.assignments).toBe(before.assignments);
    expect(after.growth!.events).toBe(before.growth!.events);
    expect(after.growth!.observations).toBe(before.growth!.observations);
    expect(Object.keys(after.growth!.avatars)).toHaveLength(14);
    expect(before.students).toHaveLength(12);
  });
}

test("legacy BIFF5 workbook is readable", () => {
  const bytes = book(
    {
      Students: utils.aoa_to_sheet([
        ["number", "studentcode", "fullname"],
        [5, "00123", "Sample Student"],
      ]),
    },
    "biff5",
  );
  expect(preview(bytes)[0]).toMatchObject({
    errors: [],
    input: { number: 5, code: "00123", name: "Sample Student" },
  });
});

test("combined names, title rows, blank rows and numeric zero formatting", () => {
  const sheet = utils.aoa_to_sheet([
    ["ทะเบียนนักเรียน"],
    [],
    ["เลขที่", "รหัสนักเรียน", "ชื่อ–สกุล"],
    [5, 123, "  ผู้เรียน   ทดสอบ  "],
    [],
    [6, "00124", "นางสาวทดสอบ ภาษาไทย"],
  ]);
  sheet.B4.z = "00000";
  const bytes = book({ รายชื่อ: sheet });
  expect(guessHeader(parseWorkbook(arrayBuffer(bytes))[0])).toBe(2);
  const rows = preview(bytes);
  expect(rows.map((row) => row.row)).toEqual([4, 6]);
  expect(rows[0].input.code).toBe("00123");
  expect(importStudents(seed(), rows).students.at(-2)!.name).toBe(
    "ผู้เรียน ทดสอบ",
  );
});

test("duplicates, archived codes, occupied roll numbers and invalid cells cannot overwrite or partially import", () => {
  const state = setRosterStatus(seed(), ["s1"], "archived");
  const sheet = utils.aoa_to_sheet([
    header,
    [5, "20001", "นาย", "รหัสพักไว้", "ซ้ำ"],
    [2, "999", "นาย", "เลขที่", "ซ้ำ"],
    [6, "00123", "นาย", "ก", "ข"],
    [7, "00123", "นาย", "ก", "ข"],
    [8, "00124", "นาย", "ก", "ข"],
    [8, "00125", "นาย", "ก", "ข"],
    [9, "00126", "นาย", "ชื่อ", ""],
    [10, "00127", "นาย", "ชื่อ", "ทดสอบ"],
    [11, 123456789012345678, "นาย", "เลขยาว", "ทดสอบ"],
  ]);
  sheet.B9 = { t: "n", v: 127, f: "100+27", z: "00000" };
  const rows = preview(book({ รายชื่อ: sheet }), state);
  expect(rows.every((row) => row.errors.length > 0)).toBe(true);
  expect(rows[0].errors.join()).toContain("พักไว้");
  expect(rows[1].errors.join()).toContain("เลขที่นี้");
  expect(rows[2].errors.join()).toContain("รหัสนักเรียนซ้ำในไฟล์");
  expect(rows[4].errors.join()).toContain("เลขที่ซ้ำในไฟล์");
  expect(rows[7].errors.join()).toContain("สูตร");
  expect(rows[8].errors.join()).toContain("ความแม่นยำ");
  expect(() => importStudents(state, rows)).toThrow();
  const valid = preview(simpleBook());
  const conflicting = saveStudent(state, {
    code: "00124",
    number: 20,
    name: "คนเดิม ทดสอบ",
    room: "ม.6/2",
  });
  const before = JSON.stringify(conflicting);
  expect(() => importStudents(conflicting, valid)).toThrow(
    "รหัสนักเรียนนี้มีอยู่แล้ว",
  );
  expect(JSON.stringify(conflicting)).toBe(before);
  expect(() => importStudents(state, [])).toThrow();
});

test("mapping and file boundaries reject malformed data without truncating records", () => {
  expect(() => parseWorkbook(new ArrayBuffer(0))).toThrow();
  expect(() => parseWorkbook(new ArrayBuffer(5 * 1024 * 1024 + 1))).toThrow();
  expect(() =>
    parseWorkbook(arrayBuffer(Buffer.from("<html>not excel</html>"))),
  ).toThrow();
  const sheet = utils.aoa_to_sheet([header]);
  sheet["!ref"] = "A1:E1001";
  const oversized = parseWorkbook(arrayBuffer(book({ มากเกิน: sheet })))[0];
  expect(oversized.error).toContain("1,000");
  const normal = parseWorkbook(arrayBuffer(simpleBook()))[0];
  const map = guessMapping(normal.rows[0].values);
  expect(mappingError(normal, 0, { ...map, code: -1 }, "split")).toContain(
    "ให้ครบ",
  );
  expect(
    mappingError(normal, 0, { ...map, code: map.number }, "split"),
  ).toContain("คนละคอลัมน์");
  expect(mappingError(normal, -1, map, "split")).toContain("หัวตาราง");
});

for (const extension of ["xls", "xlsx"] as const) {
  test(`browser imports ${extension}, persists and exposes the selected student without changing old records`, async ({
    page,
  }) => {
    await openImport(page);
    const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await upload(
      page,
      simpleBook(extension === "xls" ? "biff8" : "xlsx"),
      `รายชื่อ.${extension}`,
    );
    await expect(
      page.getByText("ห้อง ม.6/1 · เลือก 2 / 2 คน", { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
      before,
    );
    await page.getByLabel("ห้องเรียนปลายทาง").selectOption("ม.6/2");
    await page
      .getByRole("button", { name: "ยืนยันนำเข้า 2 คน", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".roster-person")).toHaveCount(6);
    await expect(
      page
        .getByRole("region", { name: "รายชื่อประจำห้อง" })
        .getByRole("heading", { name: "ม.6/2", exact: true }),
    ).toBeVisible();
    const state: State = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      KEY,
    );
    expect(state.students.at(-2)).toMatchObject({
      code: "00123",
      room: "ม.6/2",
      name: "นายทดสอบ นำเข้า",
    });
    expect(state.submissions).toEqual(seed().submissions);
    await page.reload();
    await page.getByRole("button", { name: "ออกจากระบบจำลอง" }).click();
    await page.getByRole("button", { name: "นักเรียน", exact: true }).click();
    await page.getByLabel("รหัสนักเรียน", { exact: true }).fill("00123");
    await page.getByRole("button", { name: "เข้าสู่มุมนักเรียน" }).click();
    await expect(
      page.getByRole("heading", { name: /ยินดีต้อนรับ/ }),
    ).toContainText("นายทดสอบ");
    await expect(
      page.getByRole("img", { name: "คะแนน 0 จาก 30" }),
    ).toBeVisible();
  });
}

test("choose worksheet, remap unknown headers and explicitly exclude invalid rows", async ({
  page,
}) => {
  await openImport(page);
  await upload(
    page,
    book({
      คำอธิบาย: utils.aoa_to_sheet([["คำอธิบาย"]]),
      นักเรียน: utils.aoa_to_sheet([
        ["roll", "code", "person"],
        [5, "00123", "ผู้เรียน ทดสอบ"],
        [6, "20001", "ซ้ำ คนเดิม"],
      ]),
    }),
  );
  await expect(
    page.getByRole("button", { name: "ยืนยันนำเข้า 0 คน" }),
  ).toBeDisabled();
  await page.getByLabel("ชีต", { exact: true }).selectOption("1");
  await page.getByLabel("รูปแบบชื่อ").selectOption("full");
  await page.getByLabel("คอลัมน์เลขที่", { exact: true }).selectOption("0");
  await page
    .getByLabel("คอลัมน์รหัสนักเรียน", { exact: true })
    .selectOption("1");
  await page.getByLabel("คอลัมน์ชื่อ–สกุล", { exact: true }).selectOption("2");
  await expect(
    page.getByRole("button", { name: "ยืนยันนำเข้า 2 คน" }),
  ).toBeDisabled();
  await expect(page.locator(".import-preview-row.invalid")).toContainText(
    "มีอยู่แล้ว",
  );
  await page
    .getByRole("button", { name: "เลือกเฉพาะรายการพร้อมนำเข้า" })
    .click();
  await expect(
    page.getByLabel("นำเข้าแถว 3", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "ยืนยันนำเข้า 1 คน" }).click();
  await expect(page.locator(".roster-person")).toHaveCount(5);
});

test("cancel, corrupt files and storage failure never mutate the roster", async ({
  page,
}) => {
  await openImport(page);
  await upload(page, simpleBook());
  await expect(
    page.getByRole("button", { name: "ยืนยันนำเข้า 2 คน" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(page.locator(".roster-person")).toHaveCount(4);
  await page.getByRole("button", { name: "นำเข้า Excel", exact: true }).click();
  await upload(page, Buffer.from("broken"));
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "อ่านไฟล์ Excel ไม่ได้",
  );
  await upload(page, simpleBook(), "wrong.csv");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    ".xls หรือ .xlsx",
  );
  await upload(page, Buffer.alloc(5 * 1024 * 1024 + 1));
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "5 MB",
  );
  await upload(page, simpleBook());
  await expect(
    page.getByRole("button", { name: "ยืนยันนำเข้า 2 คน" }),
  ).toBeEnabled();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "ยืนยันนำเข้า 2 คน" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "ยังไม่เพิ่มรายชื่อใด",
  );
  await expect(page.getByLabel("นำเข้าแถว 2", { exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.locator(".roster-person")).toHaveCount(4);
});

test("pagination preserves selection across pages", async ({ page }) => {
  await openImport(page);
  const data = Array.from({ length: 26 }, (_, i) => [
    i + 5,
    String(90000 + i),
    "นาย",
    `นักเรียน${i}`,
    "ทดสอบ",
  ]);
  await upload(page, book({ รายชื่อ: utils.aoa_to_sheet([header, ...data]) }));
  await expect(page.locator(".import-preview-row")).toHaveCount(20);
  await page.getByLabel("นำเข้าแถว 2", { exact: true }).uncheck();
  await page.getByRole("button", { name: "รายชื่อหน้าถัดไป" }).click();
  await expect(page.locator(".import-preview-row")).toHaveCount(6);
  await page.getByLabel("นำเข้าแถว 22", { exact: true }).uncheck();
  await page.getByRole("button", { name: "รายชื่อหน้าก่อน" }).click();
  await expect(
    page.getByLabel("นำเข้าแถว 2", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "ยืนยันนำเข้า 24 คน" }).click();
  await expect(page.locator(".roster-person")).toHaveCount(28);
});

for (const width of [360, 768, 1280]) {
  test(`import preview fits ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openImport(page);
    await upload(page, simpleBook("biff8"), "รายชื่อ.xls");
    await expect(
      page.getByRole("button", { name: "ยืนยันนำเข้า 2 คน" }),
    ).toBeEnabled();
    for (const dark of [false, true]) {
      await page.evaluate(
        (dark) =>
          (document.documentElement.dataset.theme = dark ? "dark" : "light"),
        dark,
      );
      await page
        .getByRole("button", { name: "ยืนยันนำเข้า 2 คน" })
        .scrollIntoViewIfNeeded();
      expect(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/import-${width}-${dark ? "dark" : "light"}.png`,
      });
    }
  });
}
