import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, ListChecks, Printer, Users } from "lucide-react";
import type { State } from "../model";
import { getGrade, gradePoints } from "../grading/model";
import { exportDownloadHistory, exportRoster, exportScores, printDownloadHistory, printRoster, printScores, type ReportTab } from "../services/reportService";
import "./reports.css";

export function ReportsPage({ state }: { state: State }) {
  const [room, setRoom] = useState(state.rooms[0] ?? "");
  const [tab, setTab] = useState<ReportTab>("scores");
  const students = useMemo(() => state.students.filter((student) => student.room === room).sort((a, b) => a.number - b.number), [state.students, room]);
  const assignments = useMemo(() => state.assignments.filter((assignment) => assignment.rooms.includes(room)), [state.assignments, room]);
  const logs = (state.downloadLogs ?? []).filter((log) => log.room === room);

  return <>
    <div className="page-heading reports-heading"><div><p className="eyebrow">ข้อมูลสำหรับครู</p><h1>รายงาน<span className="heading-dot">.</span></h1><p className="subtext">เลือกห้อง แล้วส่งออกข้อมูลที่ต้องการเป็น Excel</p></div><label className="report-room">ห้องเรียน<select value={room} onChange={(e) => setRoom(e.target.value)}>{state.rooms.map((item) => <option key={item}>{item}</option>)}</select></label></div>
    <section className="panel reports-panel">
      <div className="report-tabs" role="tablist" aria-label="ประเภทรายงาน">
        <button className={tab === "scores" ? "active" : ""} onClick={() => setTab("scores")}><ListChecks size={17} /> คะแนนรวม</button>
        <button className={tab === "roster" ? "active" : ""} onClick={() => setTab("roster")}><Users size={17} /> รายชื่อนักเรียน</button>
        <button className={tab === "downloads" ? "active" : ""} onClick={() => setTab("downloads")}><Download size={17} /> เปิดสื่อ</button>
      </div>
      <div className="report-toolbar"><div><strong>{room || "ยังไม่มีห้อง"}</strong><span>{tab === "scores" ? `${students.length} คน · ${assignments.length} งาน` : tab === "roster" ? `${students.length} คน` : `${logs.length} รายการ`}</span></div><div className="report-actions"><button className="button secondary" disabled={!room} onClick={() => tab === "scores" ? printScores(state, room) : tab === "roster" ? printRoster(state, room) : printDownloadHistory(state.downloadLogs ?? [], room)}><Printer size={17} /> พิมพ์ / PDF</button><button className="button teal" disabled={!room} onClick={() => tab === "scores" ? exportScores(state, room) : tab === "roster" ? exportRoster(state, room) : exportDownloadHistory(state.downloadLogs ?? [], room)}><FileSpreadsheet size={17} /> Excel</button></div></div>
      {tab === "scores" && <div className="report-table-wrap"><table className="report-table"><thead><tr><th>เลขที่</th><th>รหัสนักเรียน</th><th>ชื่อ–สกุล</th>{assignments.map((assignment, index) => <th key={assignment.id}>งาน {index + 1}<small>{assignment.finalMax} คะแนน</small></th>)}<th>รวม</th></tr></thead><tbody>{students.map((student) => { let earned = 0; let max = 0; return <tr key={student.id}><td>{student.number}</td><td>{student.code}</td><td>{student.name}</td>{assignments.map((assignment) => { const entry = getGrade(state, student.id, assignment.id); const value = entry ? gradePoints(entry, assignment) : 0; earned += value; max += assignment.finalMax; return <td key={assignment.id}>{value}/{assignment.finalMax}</td>; })}<td><strong>{earned}/{max}</strong></td></tr>; })}</tbody></table>{!students.length && <p className="report-empty">ยังไม่มีนักเรียนในห้องนี้</p>}</div>}
      {tab === "roster" && <div className="report-table-wrap"><table className="report-table compact"><thead><tr><th>เลขที่</th><th>รหัสนักเรียน</th><th>ชื่อ–สกุล</th><th>สถานะ</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.number}</td><td>{student.code}</td><td>{student.name}</td><td>{student.status === "active" ? "ใช้งาน" : "พักรายชื่อ"}</td></tr>)}</tbody></table></div>}
      {tab === "downloads" && <div className="report-table-wrap"><table className="report-table compact"><thead><tr><th>เวลา</th><th>นักเรียน</th><th>รหัส</th><th>สื่อ</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.downloadedAt).toLocaleString("th-TH")}</td><td>{log.studentName}</td><td>{log.studentCode}</td><td>{log.materialTitle}</td></tr>)}</tbody></table>{!logs.length && <p className="report-empty">ยังไม่มีประวัติการเปิดสื่อในห้องนี้</p>}</div>}
    </section>
  </>;
}
