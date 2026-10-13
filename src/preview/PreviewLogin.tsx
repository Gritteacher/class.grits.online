import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  GraduationCap,
  Moon,
  Sun,
  Users,
} from "lucide-react";
import { signIn, type UserRole } from "../services/authService";
import "./preview.css";

export function PreviewLogin({
  dark,
  onTheme,
  initialRole = "teacher",
  onAuthenticated,
}: {
  dark: boolean;
  onTheme: () => void;
  initialRole?: "teacher" | "student";
  onAuthenticated: () => Promise<void>;
}) {
  const [role, setRole] = useState(initialRole);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
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
          <GraduationCap size={16} />
          เข้าสู่ระบบด้วย Supabase
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
          <div className="form-stack">
            <label>
              {role === "teacher" ? "อีเมลครู" : "รหัสนักเรียน"}
              <input
                type={role === "teacher" ? "email" : "text"}
                inputMode={role === "student" ? "numeric" : "email"}
                autoComplete="username"
                value={code}
                placeholder={role === "teacher" ? "name@school.ac.th" : "รหัสประจำตัวนักเรียน"}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                required
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
                required
              />
            </label>
          </div>
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
      </main>
    </div>
  );
}
