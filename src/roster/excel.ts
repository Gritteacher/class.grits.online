import { read, utils, set_cptable } from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.full.mjs";
import {
  MAX_IMPORT_BYTES,
  MAX_SHEET_ROWS,
  MAX_SHEET_COLUMNS,
  type ImportSheet,
  type SheetRow,
} from "./importModel";

// Legacy XLS files may store Thai text in Windows-874 rather than Unicode.
set_cptable(cptable);

export function parseWorkbook(bytes: ArrayBuffer): ImportSheet[] {
  if (!bytes.byteLength || bytes.byteLength > MAX_IMPORT_BYTES)
    throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 5 MB และไม่เป็นไฟล์ว่าง");
  const signature = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength));
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
    (n, i) => signature[i] === n,
  );
  const zip = [0x50, 0x4b, 0x03, 0x04].every((n, i) => signature[i] === n);
  if (!ole && !zip)
    throw new Error(
      "ไฟล์ไม่ใช่ Excel .xls หรือ .xlsx ที่รองรับ กรุณาบันทึกเป็นไฟล์ Excel ใหม่",
    );
  const workbook = read(bytes, {
    type: "array",
    cellFormula: true,
    cellNF: true,
    cellText: true,
    sheetRows: MAX_SHEET_ROWS + 1,
  });
  if (!workbook.SheetNames.length) throw new Error("ไม่พบชีตในไฟล์");
  if (workbook.SheetNames.length > 30)
    throw new Error("ไฟล์ต้องมีไม่เกิน 30 ชีต");
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const ref = sheet["!fullref"] ?? sheet["!ref"];
    if (!ref) return { name, rows: [], error: "ชีตนี้ไม่มีข้อมูล" };
    const range = utils.decode_range(ref);
    if (range.e.r >= MAX_SHEET_ROWS || range.e.c >= MAX_SHEET_COLUMNS)
      return {
        name,
        rows: [],
        error: "ชีตต้องมีไม่เกิน 1,000 แถวรวมหัวตาราง และ 50 คอลัมน์",
      };
    const rows: SheetRow[] = [];
    for (let r = 0; r <= range.e.r; r++) {
      const row: SheetRow = { values: [], issues: {} };
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[utils.encode_cell({ r, c })];
        const value = cell ? utils.format_cell(cell).trim() : "";
        row.values.push(value);
        if (cell?.f || cell?.F)
          row.issues[c] = "ใช้ค่าข้อความหรือตัวเลขแทนสูตร";
        else if (cell?.t === "e") row.issues[c] = "เซลล์มีข้อผิดพลาด";
        else if (cell?.t === "n" && Math.abs(Number(cell.v)) >= 1e15)
          row.issues[c] = "เลขยาวเกินความแม่นยำของ Excel ให้เก็บเป็นข้อความ";
        else if (cell?.t === "n" && !Number.isInteger(cell.v))
          row.issues[c] = "ข้อมูลรายชื่อไม่ควรเป็นเลขทศนิยม";
        else if (value.length > 500)
          row.issues[c] = "ข้อความในเซลล์ยาวเกิน 500 ตัวอักษร";
      }
      rows.push(row);
    }
    return { name, rows };
  });
}
