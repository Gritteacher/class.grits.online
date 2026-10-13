import * as XLSX from "xlsx";
import type { Assignment, MaterialDownloadLog, State, Student } from "../model";
import { getGrade, gradePoints } from "../grading/model";

function downloadWorkbook(rows: Record<string, unknown>[], filename: string) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ รายการ: "ไม่มีข้อมูล" }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "รายงาน");
  XLSX.writeFile(workbook, filename);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printDocument(title: string, headers: string[], rows: unknown[][]) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
  if (!popup) throw new Error("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup แล้วลองใหม่");
  const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const bodyHtml = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Prompt,Arial,sans-serif;color:#182329}h1{font-size:22px;margin:0 0 4px}p{color:#69777d;margin:0 0 14px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccd7d8;padding:6px 7px;text-align:left}th{background:#eaf4f1;font-weight:700}tr:nth-child(even){background:#f8fbfa}</style></head><body><h1>${escapeHtml(title)}</h1><p>ห้องเรียนสังคมครูไต๋ · สร้างเมื่อ ${escapeHtml(new Date().toLocaleString("th-TH"))}</p><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml || `<tr><td colspan="${headers.length}">ไม่มีข้อมูล</td></tr>`}</tbody></table><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
  popup.document.close();
}

export function exportRoster(state: State, room: string) {
  const rows = state.students
    .filter((student) => student.room === room)
    .sort((a, b) => a.number - b.number)
    .map((student) => ({
      เลขที่: student.number,
      รหัสนักเรียน: student.code,
      ชื่อ: student.name,
      ห้องเรียน: student.room,
      สถานะ: student.status === "active" ? "ใช้งาน" : "พักรายชื่อ",
    }));
  downloadWorkbook(rows, `รายชื่อนักเรียน-${room}.xlsx`);
}

export function exportScores(state: State, room: string) {
  const assignments = state.assignments.filter((assignment) => assignment.rooms.includes(room));
  const rows = state.students
    .filter((student) => student.room === room)
    .sort((a, b) => a.number - b.number)
    .map((student) => {
      const result: Record<string, unknown> = {
        เลขที่: student.number,
        รหัสนักเรียน: student.code,
        ชื่อ: student.name,
      };
      let earned = 0;
      let max = 0;
      for (const assignment of assignments) {
        const entry = getGrade(state, student.id, assignment.id);
        const value = entry ? gradePoints(entry, assignment) : 0;
        earned += value;
        max += assignment.finalMax;
        result[assignment.title] = `${value}/${assignment.finalMax}`;
      }
      result["คะแนนรวม"] = earned;
      result["คะแนนเต็ม"] = max;
      result["ร้อยละ"] = max ? Math.round((earned / max) * 10000) / 100 : 0;
      return result;
    });
  downloadWorkbook(rows, `คะแนน-${room}.xlsx`);
}

export function exportDownloadHistory(logs: MaterialDownloadLog[], room: string) {
  const rows = logs
    .filter((log) => log.room === room)
    .map((log) => ({
      ห้องเรียน: log.room,
      เลขประจำตัว: log.studentCode,
      นักเรียน: log.studentName,
      สื่อ: log.materialTitle,
      วันที่เปิด: new Date(log.downloadedAt).toLocaleString("th-TH"),
    }));
  downloadWorkbook(rows, `ประวัติการเปิดสื่อ-${room}.xlsx`);
}

export function printScores(state: State, room: string) {
  const assignments = state.assignments.filter((assignment) => assignment.rooms.includes(room));
  const headers = ["เลขที่", "รหัสนักเรียน", "ชื่อ–สกุล", ...assignments.map((assignment) => assignment.title), "คะแนนรวม", "คะแนนเต็ม"];
  const rows = state.students.filter((student) => student.room === room).sort((a, b) => a.number - b.number).map((student) => {
    let earned = 0;
    let max = 0;
    const values = assignments.map((assignment) => {
      const entry = getGrade(state, student.id, assignment.id);
      const points = entry ? gradePoints(entry, assignment) : 0;
      earned += points;
      max += assignment.finalMax;
      return `${points}/${assignment.finalMax}`;
    });
    return [student.number, student.code, student.name, ...values, earned, max];
  });
  printDocument(`คะแนนรวม ${room}`, headers, rows);
}

export function printRoster(state: State, room: string) {
  const rows = state.students.filter((student) => student.room === room).sort((a, b) => a.number - b.number)
    .map((student) => [student.number, student.code, student.name, student.status === "active" ? "ใช้งาน" : "พักรายชื่อ"]);
  printDocument(`รายชื่อนักเรียน ${room}`, ["เลขที่", "รหัสนักเรียน", "ชื่อ–สกุล", "สถานะ"], rows);
}

export function printDownloadHistory(logs: MaterialDownloadLog[], room: string) {
  const rows = logs.filter((log) => log.room === room).map((log) => [
    new Date(log.downloadedAt).toLocaleString("th-TH"), log.studentName, log.studentCode, log.materialTitle,
  ]);
  printDocument(`ประวัติการเปิดสื่อ ${room}`, ["เวลา", "นักเรียน", "รหัสนักเรียน", "สื่อ"], rows);
}

export type ReportTab = "scores" | "roster" | "downloads";
export type ReportContext = {
  assignments: Assignment[];
  students: Student[];
};
