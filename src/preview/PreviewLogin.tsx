import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  GraduationCap,
  Moon,
  Sun,
  Users,
  FlaskConical,
} from "lucide-react";
import type { State } from "../model";
import { signIn, type UserRole } from "../services/authService";
import { studentSession, type PreviewSession } from "./session";
import "./preview.css";

export function PreviewLogin({
  state,
  dark,
  onTheme,
  onEnter,
  initialRole = "teacher",
  onAuthenticated,
}: {
  state: State;
  dark: boolean;
  onTheme: () => void;
  onEnter: (session: PreviewSession) => void;
  initialRole?: "teacher" | "student";
  onAuthenticated: () => Promise<void>;
}) {
  const [role, setRole] = useState(initialRole);
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("all");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const selected = state.students.find(
    (s) => s.code === code.trim() && s.status === "active",
  );
  const active = state.students
    .filter((s) => s.status === "active" && (room === "all" || s.room === room))
    .sort(
      (a, b) =>
        a.room.localeCompare(b.room, "th", { numeric: true }) ||
        a.number - b.number,
    );
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (demoMode) {
      try {
        onEnter(
          role === "teacher" ? { role: "teacher" } : studentSession(state, code),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "เปิดมุมมองไม่สำเร็จ");
      }
      return;
    }
    void (async () => {
      setBusy(true);
      try {
        await signIn(role as UserRole, role === "teacher" ? code : code, password);
        await onAuthenticated();
      } catch (e) {
        setError(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    })();
  }
  return (
    <div className="preview-login">
      <header className="preview-login-header">
        <span>
          {demoMode ? <FlaskConical size={16} /> : <GraduationCap size={16} />}
          {demoMode ? "โหมดจำลอง · ใช้ข้อมูลตัวอย่าง" : "เข้าสู่ระบบจริงด้วย Supabase"}
        </span>
        <button
          className="icon-button"
          onClick={onTheme}
          aria-label={dark ? "ใช้โหมดสว่าง" : "ใช้โหมดมืด"}
          title={dark ? "โหมดสว่าง" : "โหมดมืด"}
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>
      <main className="preview-login-main">
        <img
          className="preview-school-logo"
          src="/school-logo.png"
          alt="ตราโรงเรียนเทพศิรินทร์ นนทบุรี"
        />
        <p className="eyebrow">โรงเรียนเทพศิรินทร์ นนทบุรี</p>
        <h1>
          ห้องเรียนสังคมครูไต๋<span className="heading-dot">.</span>
        </h1>
        <p className="preview-greeting">เริ่มการเรียนรู้ในแบบของคุณ</p>
        <div
          className="preview-role-tabs"
          role="group"
          aria-label="เลือกบทบาทจำลอง"
        >
          <button
            aria-pressed={role === "teacher"}
            onClick={() => {
              setRole("teacher");
              setError("");
            }}
          >
            <GraduationCap size={20} />
            ครู
          </button>
          <button
            aria-pressed={role === "student"}
            onClick={() => {
              setRole("student");
              setError("");
            }}
          >
            <Users size={20} />
            นักเรียน
          </button>
        </div>
        <form className="preview-login-form" onSubmit={submit}>
          {demoMode && role === "teacher" ? (
            <div className="preview-teacher">
              <h2>สวัสดีครับ ครูไต๋</h2>
              <p>
                ห้องเรียน {state.rooms.length} ห้อง · นักเรียน{" "}
                {state.students.filter((s) => s.status === "active").length} คน
              </p>
            </div>
          ) : demoMode ? (
            <div className="form-stack">
              <label>
                รหัสนักเรียน
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={20}
                  value={code}
                  placeholder="รหัสจากรายชื่อจำลอง"
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError("");
                  }}
                />
              </label>
              <div className="preview-sample-picker">
                <label>
                  ห้องเรียนจำลอง
                  <select
                    aria-label="ห้องเรียนจำลอง"
                    value={room}
                    onChange={(e) => {
                      setRoom(e.target.value);
                      setCode("");
                      setError("");
                    }}
                  >
                    <option value="all">ทุกห้อง</option>
                    {state.rooms.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label>
                  เลือกรายชื่อนักเรียนจำลอง
                  <select
                    aria-label="เลือกรายชื่อนักเรียนจำลอง"
                    value={
                      active.some((s) => s.id === selected?.id)
                        ? selected!.id
                        : ""
                    }
                    onChange={(e) => {
                      setCode(
                        state.students.find((s) => s.id === e.target.value)
                          ?.code ?? "",
                      );
                      setError("");
                    }}
                  >
                    <option value="">เลือกรายชื่อ</option>
                    {active.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.room} · {s.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selected && (
                <div className="preview-selected" role="status">
                  <strong>{selected.name}</strong>
                  <span>
                    {selected.room} · เลขที่ {selected.number} · รหัส{" "}
                    {selected.code}
                  </span>
                </div>
              )}
              {!active.length && (
                <p className="muted">ยังไม่มีนักเรียนที่ใช้งานในห้องนี้</p>
              )}
            </div>
          ) : (
            <div className="form-stack">
              <label>
                {role === "teacher" ? "อีเมลครู" : "รหัสนักเรียน"}
                <input
                  type={role === "teacher" ? "email" : "text"}
                  inputMode={role === "student" ? "numeric" : "email"}
                  autoComplete={role === "teacher" ? "username" : "username"}
                  value={code}
                  placeholder={role === "teacher" ? "teacher@school.ac.th" : "รหัสประจำตัวนักเรียน"}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError("");
                  }}
                />
              </label>
              <label>
                รหัสผ่าน
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={6}
                  value={password}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />
              </label>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button gold preview-enter" type="submit" disabled={busy}>
            {busy ? "กำลังตรวจสอบ..." : role === "teacher" ? "เข้าสู่ระบบครู" : "เข้าสู่ระบบนักเรียน"}
            <ArrowRight size={18} />
          </button>
        </form>
        <button className="preview-mode-link" type="button" onClick={() => {
          setDemoMode((value) => !value);
          setError("");
          setPassword("");
        }}>
          {demoMode ? "กลับไปเข้าสู่ระบบจริง" : "ทดลองดูหน้าตัวอย่างด้วยข้อมูลจำลอง"}
        </button>
      </main>
    </div>
  );
}
