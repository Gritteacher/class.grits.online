import { useEffect, useState } from "react";
import { Check, Plus, UserRound } from "lucide-react";
import type { Student } from "../model";
import { AvatarPortrait } from "../avatar/StudentAvatar";
import type { Avatar } from "../avatar/model";
import { loadAvatar } from "../avatar/service";
import { awardPoints, loadDrawAward, loadSummary } from "./service";
import { rewardReasons, type RewardEntry, type WheelDraw } from "./model";

export function DrawResult({ draw, student, busy, onBusy, onAward }: { draw: WheelDraw; student?: Student; busy: boolean; onBusy: (value: boolean) => void; onAward: () => void }) {
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [points, setPoints] = useState("1");
  const [reason, setReason] = useState(rewardReasons[0]);
  const [note, setNote] = useState("");
  const [entry, setEntry] = useState<RewardEntry | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let active = true; setLoading(true); setError(""); setEntry(null);
    void loadAvatar(draw.student_id).then(value => { if (active) setAvatar(value); }).catch(() => { if (active) setAvatar(null); });
    void loadSummary(draw.student_id).then(value => { if (active) setTotal(value.total); }).catch(() => { if (active) setTotal(null); });
    void loadDrawAward(draw.id).then(value => { if (active) setEntry(value); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [draw.id, draw.student_id, retry]);
  async function save() {
    if (busy || loading || entry || !student) return;
    onBusy(true); setError("");
    try {
      const saved = await awardPoints(draw.id, requestId, Number(points), `${reason}${note.trim() ? ` · ${note.trim()}` : ""}`);
      setEntry(saved); setConfirm(false); onAward();
      try { setTotal((await loadSummary(draw.student_id)).total); } catch { setTotal(null); }
    } catch (error) { setError(error instanceof Error ? error.message : "บันทึกแต้มไม่สำเร็จ กรุณาลองใหม่"); }
    finally { onBusy(false); }
  }
  return <section className="wheel-result" aria-label="ผลการสุ่ม" aria-live="polite">
    <div className="wheel-result-person">
      {avatar ? <AvatarPortrait value={avatar} label={`อวตาร์ของ${student?.name ?? "นักเรียน"}`} /> : <span className="wheel-avatar-placeholder"><UserRound size={48} /></span>}
      <div><p className="eyebrow">ถึงตาคุณแล้ว</p><h2>{student?.name ?? "ไม่พบรายชื่อนักเรียน"}</h2><p>เลขที่ {student?.number ?? "–"} · {student?.room ?? ""}</p><p className="reward-positive">แต้มเสริมแรงสะสม {total === null ? "–" : total.toLocaleString("th-TH")}</p></div>
    </div>
    {loading ? <p role="status"><span className="loading-spinner" /> กำลังตรวจสอบแต้ม</p> : entry ? <p className="wheel-awarded" role="status"><Check size={19} />{entry.reversed ? "รายการให้แต้มนี้ถูกยกเลิกแล้ว" : `บันทึก +${entry.points} แต้มแล้ว · ${entry.reason}`}</p> : <form className="wheel-award-form" onSubmit={event => { event.preventDefault(); if (confirm) void save(); else setConfirm(true); }}>
      <fieldset disabled={busy || loading || !student || student.status !== "active"}><legend>เพิ่มแต้มเสริมแรง</legend>
        <div className="wheel-point-options" role="group" aria-label="เลือกจำนวนแต้ม">{[1, 2, 3, 5].map(n => <button key={n} type="button" aria-pressed={points === String(n)} onClick={() => { setPoints(String(n)); setConfirm(false); }}>+{n}</button>)}
          <label>จำนวนเอง<input type="number" min={1} max={100} step={1} required value={points} onChange={event => { setPoints(event.target.value); setConfirm(false); }} /></label>
        </div>
        <label>เหตุผล<select value={reason} onChange={event => { setReason(event.target.value); setConfirm(false); }}>{rewardReasons.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>หมายเหตุเพิ่มเติม<input maxLength={300} value={note} onChange={event => { setNote(event.target.value); setConfirm(false); }} /></label>
        {confirm && <p className="wheel-confirm">ให้ {student?.name} จำนวน <strong>+{points} แต้ม</strong> ใช่ไหม?</p>}
        <button className="button teal" disabled={busy || !Number.isInteger(Number(points)) || Number(points) < 1 || Number(points) > 100}>{busy ? <span className="loading-spinner" /> : <Plus size={17} />}{confirm ? "ยืนยันให้แต้ม" : "เพิ่มแต้มเสริมแรง"}</button>
      </fieldset>
    </form>}
    {error && <div role="alert" className="form-error">{error}{!confirm && <button className="button neutral" disabled={busy} onClick={() => setRetry(n => n + 1)}>ตรวจสอบอีกครั้ง</button>}</div>}
  </section>;
}
