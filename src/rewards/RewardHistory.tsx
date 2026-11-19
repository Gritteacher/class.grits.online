import { useEffect, useState } from "react";
import { History, RefreshCw, RotateCcw } from "lucide-react";
import type { Student } from "../model";
import { Modal } from "../ui";
import { loadDrawHistory, loadEntries, reversePoints } from "./service";
import { rewardsDate, type RewardEntry, type WheelDraw } from "./model";

export function RewardHistory({ room, students, revision, onPick, onBusy, busy, onChanged }: { room: string; students: Student[]; revision: number; onPick: (draw: WheelDraw) => void; onBusy: (busy: boolean) => void; busy: boolean; onChanged: () => void }) {
  const [tab, setTab] = useState("draws");
  const [draws, setDraws] = useState<WheelDraw[]>([]);
  const [entries, setEntries] = useState<RewardEntry[]>([]);
  const [filterStudent, setFilterStudent] = useState("");
  const [day, setDay] = useState("");
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [reversing, setReversing] = useState<RewardEntry | null>(null);
  const [reason, setReason] = useState("");
  const [reverseError, setReverseError] = useState("");
  useEffect(() => { setPage(0); }, [tab, filterStudent, day, revision]);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    const promise = tab === "draws" ? loadDrawHistory(room, page, filterStudent || undefined, day || undefined) : loadEntries({ room, student: filterStudent || undefined, day: day || undefined, page });
    void promise.then(rows => {
      if (!active) return;
      setMore(rows.length === 50);
      if (tab === "draws") setDraws(previous => page ? [...previous.filter(item => !rows.some(row => row.id === item.id)), ...rows as WheelDraw[]] : rows as WheelDraw[]);
      else setEntries(previous => page ? [...previous.filter(item => !rows.some(row => row.id === item.id)), ...rows as RewardEntry[]] : rows as RewardEntry[]);
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [room, tab, page, filterStudent, day, revision, retry]);
  const names = new Map(students.map(student => [student.id, student]));
  const shownDraws = draws;
  return <section className="wheel-history">
    <div className="wheel-section-heading"><h2><History size={20} /> ประวัติ</h2><button className="icon-button" aria-label="โหลดประวัติใหม่" title="โหลดประวัติใหม่" disabled={loading || busy} onClick={() => { setPage(0); setRetry(n => n + 1); }}><RefreshCw size={17} /></button></div>
    <div className="wheel-history-tabs" role="tablist" aria-label="ประเภทประวัติ">{[["draws", "การสุ่ม"], ["points", "แต้มเสริมแรง"]].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} disabled={busy} onClick={() => { setTab(key); setPage(0); }}>{label}</button>)}</div>
    <div className="wheel-history-filters"><label>นักเรียน<select disabled={busy} value={filterStudent} onChange={event => { setFilterStudent(event.target.value); setPage(0); }}><option value="">ทุกคน</option>{students.map(student => <option value={student.id} key={student.id}>{student.number}. {student.name}</option>)}</select></label><label>วันที่<input disabled={busy} type="date" value={day} onChange={event => { setDay(event.target.value); setPage(0); }} /></label></div>
    {error && <p role="alert" className="form-error">{error}<button className="button neutral" onClick={() => setRetry(n => n + 1)}>ลองใหม่</button></p>}
    {tab === "draws" ? <div className="reward-ledger">{shownDraws.map(draw => <article className="reward-ledger-row" key={draw.id}><div><h3>{names.get(draw.student_id)?.name ?? "นักเรียน"}</h3><p>{rewardsDate(draw.created_at)}</p></div><button className="button neutral" disabled={busy} onClick={() => onPick(draw)}>ดูผลสุ่ม</button></article>)}</div> : <div className="reward-ledger">{entries.map(entry => <article className="reward-ledger-row" key={entry.id}><strong className={entry.points > 0 ? "reward-positive" : "reward-reversal"}>{entry.points > 0 ? "+" : ""}{entry.points}</strong><div><h3>{names.get(entry.student_id)?.name ?? "นักเรียน"}</h3><p>{entry.reason}</p><small>{rewardsDate(entry.created_at)} · {entry.teacher_name}</small>{entry.reversed && <p className="reward-reversal">ยกเลิกแล้ว</p>}{entry.reverses_id && <p className="reward-reversal">คืนแต้มจากรายการที่ให้ผิด</p>}</div>{entry.points > 0 && !entry.reversed && <button className="icon-button" aria-label={`ยกเลิกแต้ม ${names.get(entry.student_id)?.name ?? "นักเรียน"}`} title="ยกเลิกรายการให้แต้ม" disabled={busy} onClick={() => { setReversing(entry); setReason(""); setReverseError(""); }}><RotateCcw size={17} /></button>}</article>)}</div>}
    {loading && <p role="status"><span className="loading-spinner" /> กำลังโหลดประวัติ</p>}
    {!loading && !error && !(tab === "draws" ? shownDraws.length : entries.length) && <p className="wheel-empty">ยังไม่มีรายการที่ตรงกับตัวกรอง</p>}
    {more && !error && <button className="button neutral" disabled={loading || busy} onClick={() => setPage(n => n + 1)}>โหลดรายการเพิ่มเติม</button>}
    {reversing && <Modal title="ยกเลิกรายการให้แต้ม" onClose={() => { if (!busy) setReversing(null); }}>
      <form onSubmit={async event => {
        event.preventDefault(); if (busy) return; onBusy(true); setReverseError("");
        try { await reversePoints(reversing.id, reason); setReversing(null); onChanged(); }
        catch (error) { setReverseError(error instanceof Error ? error.message : "ยกเลิกแต้มไม่สำเร็จ"); }
        finally { onBusy(false); }
      }}><div className="modal-body form-stack"><p>{names.get(reversing.student_id)?.name} · คืน {reversing.points} แต้ม</p><p>{reversing.reason}</p><label>เหตุผลการยกเลิก<textarea required maxLength={500} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label>{reverseError && <p role="alert" className="form-error">{reverseError}</p>}</div><div className="modal-actions"><button type="button" className="button neutral" disabled={busy} onClick={() => setReversing(null)}>กลับ</button><button className="button coral" disabled={busy || !reason.trim()}>{busy ? <span className="loading-spinner" /> : <RotateCcw size={17} />} ยืนยันยกเลิกแต้ม</button></div></form>
    </Modal>}
  </section>;
}
