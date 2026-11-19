import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import { loadEntries, loadSummary } from "./service";
import { rewardsDate, type RewardEntry, type RewardSummary } from "./model";
import "./rewards.css";

export function RewardBalance({ studentId, onOpen }: { studentId: string; onOpen?: () => void }) {
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [error, setError] = useState("");
  const [celebrate, setCelebrate] = useState(0);
  const [retry, setRetry] = useState(0);
  const loading = useRef(false);
  useEffect(() => {
    let active = true;
    loading.current = false;
    setSummary(null); setError(""); setCelebrate(0);
    const refresh = async () => {
      if (loading.current || document.visibilityState === "hidden") return;
      loading.current = true;
      try {
        const next = await loadSummary(studentId);
        if (!active) return;
        setSummary(next); setError("");
        try {
          const key = `classroom-rewards-seen:${studentId}`;
          const previous = localStorage.getItem(key);
          if (previous && next.latest_id && previous !== next.latest_id && next.latest_points > 0) setCelebrate(next.latest_points);
          if (next.latest_id) localStorage.setItem(key, next.latest_id);
        } catch { /* No persistent storage: skip repeated celebration on reload. */ }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "โหลดแต้มไม่สำเร็จ");
      } finally { if (active) loading.current = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [studentId, retry]);
  useEffect(() => { if (celebrate) { const timer = setTimeout(() => setCelebrate(0), 5000); return () => clearTimeout(timer); } }, [celebrate]);
  return <div className={`reward-balance${celebrate ? " reward-celebrate" : ""}`}>
    <Sparkles size={19} aria-hidden="true" />
    {error ? <><span role="alert">โหลดแต้มไม่สำเร็จ</span><button className="icon-button" title={error} aria-label="โหลดแต้มใหม่" onClick={() => setRetry(n => n + 1)}><RefreshCw size={16} /></button></> : <button className="reward-balance-open" onClick={onOpen} disabled={!onOpen || !summary}>
      <span>แต้มเสริมแรง</span><strong>{summary ? summary.total.toLocaleString("th-TH") : <span className="loading-spinner" />}</strong>{onOpen && <ArrowUpRight size={16} />}
    </button>}
    {celebrate > 0 && <span role="status" className="reward-new">ได้รับ +{celebrate} แต้ม</span>}
  </div>;
}

export function StudentRewards({ studentId }: { studentId: string }) {
  const [entries, setEntries] = useState<RewardEntry[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { setEntries([]); setPage(0); }, [studentId]);
  useEffect(() => {
    let active = true; setBusy(true); setError("");
    void loadEntries({ student: studentId, page }).then(rows => {
      if (active) { setEntries(previous => page ? [...previous.filter(p => !rows.some(r => r.id === p.id)), ...rows] : rows); setMore(rows.length === 50); }
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [studentId, page, retry]);
  return <section className="rewards-page">
    <div className="page-heading"><div><p className="eyebrow">พื้นที่ของฉัน</p><h1>แต้มเสริมแรง</h1></div><button className="icon-button" title="โหลดประวัติใหม่" aria-label="โหลดประวัติแต้มใหม่" disabled={busy} onClick={() => { setPage(0); setRetry(n => n + 1); }}><RefreshCw size={18} /></button></div>
    <RewardBalance key={retry} studentId={studentId} />
    <h2>ประวัติของฉัน</h2>
    {error && <p role="alert" className="form-error">{error}<button className="button neutral" onClick={() => setRetry(n => n + 1)}>ลองใหม่</button></p>}
    <div className="reward-ledger">{entries.map(entry => <article className="reward-ledger-row" key={entry.id}>
      <strong className={entry.points > 0 ? "reward-positive" : "reward-reversal"}>{entry.points > 0 ? "+" : ""}{entry.points}</strong>
      <div><h3>{entry.reason}</h3><p>{entry.teacher_name} · {rewardsDate(entry.created_at)}</p>{entry.reversed && <span className="reward-reversal">ยกเลิกรายการแล้ว</span>}{entry.reverses_id && <span className="reward-reversal">คืนแต้มจากรายการที่ให้ผิด</span>}</div>
    </article>)}</div>
    {busy && <p role="status"><span className="loading-spinner" /> กำลังโหลดประวัติแต้ม</p>}
    {!busy && !error && !entries.length && <p className="wheel-empty"><Sparkles />ยังไม่มีรายการแต้มเสริมแรง</p>}
    {more && !error && <button className="button neutral" disabled={busy} onClick={() => setPage(n => n + 1)}>โหลดรายการเพิ่มเติม</button>}
  </section>;
}
