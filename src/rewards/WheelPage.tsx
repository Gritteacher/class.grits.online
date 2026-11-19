import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Play, RefreshCw, RotateCcw, Search, Volume2, VolumeX } from "lucide-react";
import type { State, Student } from "../model";
import { bangkokToday } from "../attendance/model";
import { loadPresentStudents, loadWheelRooms, loadWheelRound, spinRound, startRound } from "./service";
import { remainingIds, winningRotation, type WheelDraw, type WheelRoom, type WheelRound } from "./model";
import { WheelCanvas, startWheelAudio } from "./WheelCanvas";
import { DrawResult } from "./DrawResult";
import { RewardHistory } from "./RewardHistory";
import "./rewards.css";

export function WheelPage({ state, teacherId, onPendingChange }: { state: State; teacherId: string; onPendingChange: (pending: boolean) => void }) {
  const [rooms, setRooms] = useState<WheelRoom[]>([]);
  const [room, setRoom] = useState("");
  const [round, setRound] = useState<WheelRound | null>(null);
  const [draws, setDraws] = useState<WheelDraw[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [mode, setMode] = useState("all");
  const [day, setDay] = useState(bangkokToday);
  const [period, setPeriod] = useState(1);
  const [present, setPresent] = useState<string[]>([]);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roomError, setRoomError] = useState("");
  const [retry, setRetry] = useState(0);
  const [operation, setOperation] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [moving, setMoving] = useState(false);
  const [result, setResult] = useState<WheelDraw | null>(null);
  const [pool, setPool] = useState<Student[] | null>(null);
  const [rotation, setRotation] = useState(0);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [sound, setSound] = useState(false);
  const finish = useRef<() => void>(() => {});
  const stopAudio = useRef<(finish?: boolean) => void>(() => {});
  const animationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestRef = useRef<Record<string, string>>({});
  const startRequest = useRef({ signature: "", id: "" });
  const busyRef = useRef(false);
  const busy = operation || spinning;
  const students = useMemo(() => state.students.filter(student => student.classroomId === room), [state.students, room]);
  const active = useMemo(() => students.filter(student => student.status === "active"), [students]);
  const activeSignature = active.map(student => student.id).join(",");
  const selectable = mode === "present" ? active.filter(student => present.includes(student.id)) : active;
  const availableIds = round ? remainingIds(round, draws) : [];
  const candidates = active.filter(student => availableIds.includes(student.id) && (mode !== "present" || present.includes(student.id)));
  const dirty = Boolean(round && (round.allow_repeat !== repeat || (round.attendance_date ? "present" : "all") !== mode ||
    (mode === "present" && (round.attendance_date !== day || round.attendance_period !== period)) ||
    [...round.participant_ids].sort().join() !== [...selected].sort().join()));
  useEffect(() => {
    let current = true;
    void loadWheelRooms(teacherId).then(data => { if (current) { setRooms(data); setRoom(previous => data.some(item => item.id === previous) ? previous : data[0]?.id ?? ""); setLoading(false); } }).catch(error => { if (current) { setRoomError(error.message); setLoading(false); } });
    return () => { current = false; };
  }, [teacherId, retry]);
  useEffect(() => {
    if (!room) return;
    let current = true; setLoading(true); setError(""); setRound(null); setDraws([]); setResult(null); setPool(null); setRotation(0); setSearch(""); setNotice("");
    setSelected(active.map(student => student.id));
    void loadWheelRound(room).then(data => {
      if (!current) return;
      setRound(data.round); setDraws(data.draws); setResult(data.draws[0] ?? null);
      if (data.round) {
        const key = `wheel-draw:${teacherId}:${data.round.id}`;
        try {
          const pending = sessionStorage.getItem(key);
          if (pending && data.draws.some(draw => draw.id === pending)) { sessionStorage.removeItem(key); delete requestRef.current[key]; }
        } catch { /* Restore from server even when browser storage is unavailable. */ }
        if (startRequest.current.id === data.round.id) startRequest.current = { signature: "", id: "" };
      }
      setSelected(data.round?.participant_ids ?? active.map(student => student.id));
      setRepeat(data.round?.allow_repeat ?? false); setMode(data.round?.attendance_date ? "present" : "all");
      setDay(data.round?.attendance_date ?? bangkokToday()); setPeriod(data.round?.attendance_period ?? 1);
    }).catch(error => { if (current) setError(error.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [room, retry]);
  useEffect(() => { if (!round && mode === "all") setSelected(active.map(student => student.id)); }, [activeSignature, round?.id]);
  useEffect(() => {
    if (mode !== "present" || !room) { setAttendanceError(""); return; }
    let current = true; setAttendanceBusy(true); setAttendanceError("");
    void loadPresentStudents(room, day, period).then(ids => {
      if (!current) return;
      setPresent(ids);
      const sameConfig = round?.attendance_date === day && round.attendance_period === period;
      if (!sameConfig) setSelected(active.filter(student => ids.includes(student.id)).map(student => student.id));
    }).catch(error => { if (current) { setAttendanceError(error.message); setPresent([]); } }).finally(() => { if (current) setAttendanceBusy(false); });
    return () => { current = false; };
  }, [room, mode, day, period, round?.id, activeSignature, retry]);
  useEffect(() => {
    onPendingChange(busy);
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, onPendingChange]);
  useEffect(() => () => { clearTimeout(animationTimer.current); stopAudio.current(); onPendingChange(false); }, [onPendingChange]);
  function requestId(key: string) {
    try { const previous = sessionStorage.getItem(key); if (previous) return previous; } catch { /* Keep a retry ID in memory if storage is blocked. */ }
    const id = requestRef.current[key] ?? crypto.randomUUID(); requestRef.current[key] = id;
    try { sessionStorage.setItem(key, id); } catch { /* Storage is optional. */ }
    return id;
  }
  async function beginRound() {
    if (busyRef.current || busy || !room || !selected.length) return;
    if (round && draws.length && !window.confirm("เริ่มรอบใหม่และคืนรายชื่อผู้เข้าร่วมทั้งหมดหรือไม่? ประวัติเดิมและแต้มยังอยู่")) return;
    busyRef.current = true; setOperation(true); setError(""); setNotice("");
    const signature = JSON.stringify([room, [...selected].sort(), repeat, mode, day, period]);
    if (startRequest.current.signature !== signature) startRequest.current = { signature, id: crypto.randomUUID() };
    try {
      const saved = await startRound(startRequest.current.id, room, selected, repeat, mode === "present" ? day : null, mode === "present" ? period : null);
      setRound(saved); setSelected(saved.participant_ids); setDraws([]); setResult(null); setPool(null); setRotation(0);
      startRequest.current = { signature: "", id: "" }; setNotice("เริ่มรอบสุ่มแล้ว"); setRevision(n => n + 1);
    } catch (error) { setError(error instanceof Error ? error.message : "เริ่มรอบไม่สำเร็จ"); }
    finally { setOperation(false); busyRef.current = false; }
  }
  async function spin() {
    if (busyRef.current || busy || !round || dirty || !candidates.length) return;
    busyRef.current = true; setSpinning(true); setError(""); setNotice(""); setResult(null); setPool(candidates);
    stopAudio.current = startWheelAudio(sound);
    const key = `wheel-draw:${teacherId}:${round.id}`;
    try {
      const draw = await spinRound(round.id, requestId(key));
      try { sessionStorage.removeItem(key); } catch { /* No persistent browser storage. */ }
      delete requestRef.current[key];
      const index = candidates.findIndex(student => student.id === draw.student_id);
      const complete = () => {
        clearTimeout(animationTimer.current); finish.current = () => {};
        setMoving(false); setSpinning(false); setResult(draw); setDraws(previous => [draw, ...previous.filter(item => item.id !== draw.id)]);
        stopAudio.current(true); stopAudio.current = () => {}; busyRef.current = false; setRevision(n => n + 1);
      };
      finish.current = complete;
      if (index < 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { complete(); return; }
      setMoving(true); setRotation(current => winningRotation(current, index, candidates.length));
      animationTimer.current = setTimeout(complete, 4600);
    } catch (error) {
      stopAudio.current(); stopAudio.current = () => {}; busyRef.current = false; setSpinning(false); setMoving(false);
      setError(error instanceof Error ? error.message : "สุ่มไม่สำเร็จ กรุณาลองใหม่");
    }
  }
  const shown = selectable.filter(student => `${student.name} ${student.number} ${student.code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="wheel-page">
    <div className="page-heading"><div><p className="eyebrow">พื้นที่ของครู</p><h1>วงล้อสุ่มนักเรียน</h1></div><button className="icon-button" title="โหลดรอบสุ่มใหม่" aria-label="โหลดวงล้อใหม่" disabled={busy} onClick={() => setRetry(n => n + 1)}><RefreshCw size={18} /></button></div>
    <div className="wheel-toolbar">
      <label>ห้องเรียน<select aria-label="ห้องเรียน" value={room} disabled={busy || loading} onChange={event => setRoom(event.target.value)}><option value="" disabled>เลือกห้องเรียน</option>{rooms.map(item => <option value={item.id} key={item.id}>{item.name || item.room}{rooms.some(other => other.id !== item.id && (other.name || other.room) === (item.name || item.room)) ? ` · ${[item.level ? `${item.level}/${item.room}` : item.room, item.subject, item.academic_year, `#${item.id.slice(-4)}`].filter(Boolean).join(" · ")}` : ""}</option>)}</select></label>
      <label>ผู้เข้าร่วม<select aria-label="ผู้เข้าร่วม" disabled={busy || loading} value={mode} onChange={event => { setMode(event.target.value); if (event.target.value === "all") setSelected(active.map(student => student.id)); }}><option value="all">ทุกคนในห้อง</option><option value="present">เฉพาะผู้ที่เช็คชื่อว่ามาแล้ว</option></select></label>
      {mode === "present" && <><label>วันที่<input disabled={busy || loading} type="date" value={day} onChange={event => setDay(event.target.value)} /></label><label>คาบ<input disabled={busy || loading} type="number" min={1} max={20} step={1} value={period} onChange={event => setPeriod(Number(event.target.value))} /></label></>}
      <label className="wheel-toggle"><input type="checkbox" checked={!repeat} disabled={busy || loading} onChange={event => setRepeat(!event.target.checked)} />ไม่สุ่มซ้ำในรอบ</label>
      <label className="wheel-toggle">{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}<input type="checkbox" checked={sound} disabled={busy} onChange={event => setSound(event.target.checked)} />เสียงเอฟเฟกต์</label>
    </div>
    {(error || roomError) && <div className="form-error" role="alert">{error || roomError}<button className="button neutral" disabled={busy} onClick={() => { setRoomError(""); setRetry(n => n + 1); }}>โหลดใหม่</button></div>}
    {notice && <p className="wheel-notice" role="status">{notice}</p>}
    {loading ? <p role="status"><span className="loading-spinner" /> กำลังโหลดวงล้อ</p> : !rooms.length ? <p className="wheel-empty">ยังไม่มีห้องเรียน</p> : <div className="wheel-layout">
      <div className="wheel-play-area">
        <WheelCanvas students={pool ?? (round ? candidates : selectable.filter(student => selected.includes(student.id)))} rotation={rotation} moving={moving} onStop={() => finish.current()} />
        <div className="wheel-spin-controls"><p>{round ? `เหลือ ${candidates.length} จาก ${round.participant_ids.length} คน${round.allow_repeat ? " · สุ่มซ้ำได้" : ""}` : `เลือกแล้ว ${selected.length} คน`}</p>
          {!round || dirty ? <button className="button gold" disabled={busy || !selected.length || attendanceBusy || !!attendanceError || !!error || !Number.isInteger(period) || period < 1 || period > 20} onClick={() => void beginRound()}>{operation ? <span className="loading-spinner" /> : <Dices size={19} />}{round ? "ใช้ตัวเลือกนี้และเริ่มรอบใหม่" : "เริ่มรอบสุ่ม"}</button> : <button className="button gold wheel-spin-button" disabled={busy || !candidates.length || attendanceBusy || !!attendanceError || !!error} onClick={() => void spin()}>{spinning ? <span className="loading-spinner" /> : <Play size={19} />}{spinning ? "กำลังหมุนวงล้อ" : result ? "สุ่มคนถัดไป" : "หมุนวงล้อ"}</button>}
          {round && !dirty && <button className="button neutral" disabled={busy || attendanceBusy || !selected.length} onClick={() => void beginRound()}><RotateCcw size={17} />เริ่มรอบใหม่</button>}
          {round && !dirty && !candidates.length && <p role="status">ครบทุกคนในรอบแล้ว หรือไม่มีผู้เข้าร่วมที่พร้อมสุ่ม</p>}
        </div>
        {result && <DrawResult key={`${result.id}:${revision}`} draw={result} student={students.find(student => student.id === result.student_id)} busy={busy} onBusy={setOperation} onAward={() => setRevision(n => n + 1)} />}
      </div>
      <aside className="wheel-participants"><div className="wheel-section-heading"><h2>ผู้เข้าร่วม</h2><span>{selected.length} คน</span></div>
        <label className="wheel-search"><Search size={17} /><input aria-label="ค้นหานักเรียนในวงล้อ" value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาชื่อ เลขที่ หรือรหัส" /></label>
        {attendanceBusy && <p role="status"><span className="loading-spinner" /> กำลังโหลดการเช็คชื่อ</p>}
        {attendanceError && <p className="form-error" role="alert">{attendanceError}</p>}
        {mode === "present" && !attendanceBusy && !attendanceError && !selectable.length && <p className="wheel-empty">ยังไม่มีผู้เช็คชื่อว่ามาหรือมาสายในวันและคาบนี้</p>}
        <label className="wheel-select-all"><input type="checkbox" disabled={busy || !selectable.length || attendanceBusy} checked={selectable.length > 0 && selectable.every(student => selected.includes(student.id))} onChange={event => setSelected(event.target.checked ? selectable.map(student => student.id) : [])} />เลือกทั้งหมด</label>
        <div className="wheel-roster">{shown.map(student => <label key={student.id} className={round && !repeat && !availableIds.includes(student.id) && round.participant_ids.includes(student.id) ? "wheel-drawn" : ""}>
          <input type="checkbox" disabled={busy || attendanceBusy} checked={selected.includes(student.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, student.id] : previous.filter(id => id !== student.id))} />
          <span className="wheel-student-number">{student.number}</span><span>{student.name}<small>{student.code}{round && !repeat && !availableIds.includes(student.id) && round.participant_ids.includes(student.id) ? " · สุ่มแล้ว" : ""}</small></span>
        </label>)}</div>
        {!active.length && <p className="wheel-empty">ยังไม่มีนักเรียนที่ใช้งานในห้องนี้</p>}
      </aside>
    </div>}
    {room && !loading && <RewardHistory key={room} room={room} students={students} revision={revision} busy={busy} onBusy={setOperation} onChanged={() => setRevision(n => n + 1)} onPick={draw => { setResult(draw); setPool(students.filter(student => student.id === draw.student_id)); setRotation(0); }} />}
  </section>;
}
