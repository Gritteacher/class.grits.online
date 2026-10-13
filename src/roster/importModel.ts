import type { State } from "../model";
import { saveStudent, validateStudentInput, type StudentInput } from "./model";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_SHEET_ROWS = 1000;
export const MAX_SHEET_COLUMNS = 50;
export type SheetRow = { values: string[]; issues: Record<number, string> };
export type ImportSheet = { name: string; rows: SheetRow[]; error?: string };
export type Field = "number" | "code" | "name" | "prefix" | "first" | "last";
export type Mapping = Record<Field, number>;
export type ImportRow = { row: number; input: StudentInput; errors: string[] };
export const fieldLabels: Record<Field, string> = {
  number: "เลขที่",
  code: "รหัสนักเรียน",
  name: "ชื่อ–สกุล",
  prefix: "คำนำหน้า",
  first: "ชื่อ",
  last: "สกุล",
};
const aliases: Record<Field, string[]> = {
  number: ["เลขที่", "ลำดับ", "ลำดับที่", "no", "number"],
  code: [
    "รหัสนักเรียน",
    "รหัสประจำตัว",
    "รหัสประจำตัวนักเรียน",
    "เลขประจำตัว",
    "เลขประจำตัวนักเรียน",
    "studentid",
    "studentcode",
    "id",
  ],
  name: [
    "ชื่อสกุล",
    "ชื่อนามสกุล",
    "ชื่อและนามสกุล",
    "ชื่อสกุลนักเรียน",
    "fullname",
  ],
  prefix: ["คำนำหน้า", "คำนำหน้าชื่อ", "prefix", "title"],
  first: ["ชื่อ", "ชื่อนักเรียน", "firstname"],
  last: ["สกุล", "นามสกุล", "lastname", "surname"],
};
const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s._–—\-/()]/g, "");
export function guessMapping(values: string[]): Mapping {
  return Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      values.findIndex((value) => names.includes(normalize(value))),
    ]),
  ) as Mapping;
}
export function guessHeader(sheet: ImportSheet): number {
  const found = sheet.rows.slice(0, 30).findIndex((row) => {
    const map = guessMapping(row.values);
    return (
      map.code >= 0 && map.number >= 0 && (map.name >= 0 || map.first >= 0)
    );
  });
  return found >= 0
    ? found
    : Math.max(
        0,
        sheet.rows.findIndex((row) => row.values.some(Boolean)),
      );
}
export function mappingError(
  sheet: ImportSheet,
  header: number,
  mapping: Mapping,
  mode: "full" | "split",
) {
  if (sheet.error) return sheet.error;
  if (!Number.isInteger(header) || header < 0 || header >= sheet.rows.length)
    return "เลือกแถวหัวตารางที่มีอยู่ในชีต";
  const required: Field[] =
    mode === "full"
      ? ["number", "code", "name"]
      : ["number", "code", "first", "last"];
  if (required.some((key) => mapping[key] < 0))
    return "จับคู่คอลัมน์ที่จำเป็นให้ครบ";
  const columns = [
    ...required,
    ...(mode === "split" && mapping.prefix >= 0 ? ["prefix" as const] : []),
  ].map((key) => mapping[key]);
  if (new Set(columns).size !== columns.length)
    return "แต่ละข้อมูลต้องใช้คนละคอลัมน์";
  const width = Math.max(0, ...sheet.rows.map((row) => row.values.length));
  if (columns.some((column) => !Number.isInteger(column) || column >= width))
    return "ไม่พบคอลัมน์ที่เลือก";
  return "";
}
export function previewStudents(
  state: State,
  sheet: ImportSheet,
  header: number,
  mapping: Mapping,
  mode: "full" | "split",
  room: string,
): ImportRow[] {
  if (mappingError(sheet, header, mapping, mode)) return [];
  const fields: Field[] =
    mode === "full"
      ? ["number", "code", "name"]
      : ["number", "code", "prefix", "first", "last"];
  const result: ImportRow[] = [];
  sheet.rows.forEach((row, index) => {
    if (index <= header || !row.values.some((value) => value.trim())) return;
    const cell = (key: Field) => (row.values[mapping[key]] ?? "").trim();
    const input: StudentInput = {
      number: /^\d+$/.test(cell("number")) ? Number(cell("number")) : NaN,
      code: cell("code"),
      room,
      name:
        mode === "full"
          ? cell("name")
          : `${cell("prefix")}${cell("first")} ${cell("last")}`.trim(),
    };
    const errors = fields.flatMap((key) =>
      row.issues[mapping[key]]
        ? [`${fieldLabels[key]}: ${row.issues[mapping[key]]}`]
        : [],
    );
    if (mode === "split" && (!cell("first") || !cell("last")))
      errors.push("กรอกชื่อและสกุลให้ครบ");
    try {
      validateStudentInput(state, input);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง");
    }
    result.push({ row: index + 1, input, errors });
  });
  const codes = new Map<string, number>();
  const numbers = new Map<number, number>();
  result.forEach(({ input }) => {
    codes.set(input.code, (codes.get(input.code) ?? 0) + 1);
    numbers.set(input.number, (numbers.get(input.number) ?? 0) + 1);
  });
  return result.map((row) => ({
    ...row,
    errors: [
      ...row.errors,
      ...(row.input.code && (codes.get(row.input.code) ?? 0) > 1
        ? ["รหัสนักเรียนซ้ำในไฟล์"]
        : []),
      ...(Number.isFinite(row.input.number) &&
      (numbers.get(row.input.number) ?? 0) > 1
        ? ["เลขที่ซ้ำในไฟล์"]
        : []),
    ],
  }));
}

// Build a complete new state first. The caller persists once, never a partial import.
export function importStudents(state: State, rows: ImportRow[]): State {
  if (!rows.length) throw new Error("เลือกรายชื่อที่จะนำเข้าก่อน");
  if (rows.length > MAX_SHEET_ROWS) throw new Error("จำนวนรายชื่อเกินขีดจำกัด");
  let next = state;
  for (const row of rows) {
    if (row.errors.length)
      throw new Error(`แถว ${row.row}: ${row.errors.join(" · ")}`);
    try {
      next = saveStudent(next, row.input);
    } catch (error) {
      throw new Error(
        `แถว ${row.row}: ${error instanceof Error ? error.message : "นำเข้าไม่ได้"}`,
      );
    }
  }
  return next;
}
