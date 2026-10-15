import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Moon,
  Sun,
} from "lucide-react";
import { signIn, type UserRole } from "../services/authService";
import { claimStudentAccount, StudentSignupError } from "../services/studentAccountService";
import { LineAccountNotLinkedError } from "../services/lineAccountService";
import { SchoolLogo } from "../components/SchoolLogo";
import "./preview.css";

export function PreviewLogin({
  dark,
  onTheme,
  initialRole = "teacher",
  onAuthenticated,
  lineAvailable = false,
  onLineLogin,
  onLineLink,
}: {
  dark: boolean;
  onTheme: () => void;
  initialRole?: "teacher" | "student";
  onAuthenticated: () => Promise<void>;
  lineAvailable?: boolean;
  onLineLogin?: () => Promise<void>;
  onLineLink?: () => Promise<void>;
}) {
  const [role, setRole] = useState(initialRole);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [lineBusy, setLineBusy] = useState(false);
  const [lineNeedsLink, setLineNeedsLink] = useState(false);
  const [studentSignup, setStudentSignup] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isTeacher = role === "teacher";
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    void (async () => {
      setBusy(true);
      try {
        if (role === "student" && studentSignup) {
          await claimStudentAccount({ studentCode: code, firstName, lastName, email, password });
        }
        await signIn(role as UserRole, code, password);
        await onAuthenticated();
      } catch (e) {
        if (e instanceof StudentSignupError) setFieldErrors({ [e.field]: e.message });
        setError(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    })();
  }
  async function continueWithLine() {
    if (!onLineLogin || !onLineLink) return;
    setError("");
    setLineBusy(true);
    try {
      if (lineNeedsLink) {
        if (role !== "student" || !code.trim() || !password) {
          throw new Error("กรอกรหัสนักเรียนและรหัสผ่านก่อนเชื่อมบัญชี LINE");
        }
        await signIn("student", code, password);
        await onLineLink();
        await onAuthenticated();
      } else {
        await onLineLogin();
        await onAuthenticated();
      }
    } catch (e) {
      if (e instanceof LineAccountNotLinkedError) {
        setLineNeedsLink(true);
        setError("LINE นี้ยังไม่เชื่อมบัญชี กรอกรหัสนักเรียนและรหัสผ่านเดิม แล้วกดปุ่มอีกครั้ง");
      } else {
        setError(e instanceof Error ? e.message : "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
      }
    } finally {
      setLineBusy(false);
    }
  }
  return (
    <div className="preview-login">
      <header className="preview-login-header">
        <span>
          <GraduationCap size={16} />
          เริ่มเรียนรู้
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
        <SchoolLogo
          className="preview-school-logo"
          alt="ตราโรงเรียนเทพศิรินทร์ นนทบุรี"
          state="login"
        />
        <p className="eyebrow">โรงเรียนเทพศิรินทร์ นนทบุรี</p>
        <h1>
          ห้องเรียนสังคมครูไต๋
        </h1>
        <p className="preview-greeting">เริ่มการเรียนรู้ในแบบของคุณ</p>
        {isTeacher ? (
          <p className="preview-teacher-context">
            <GraduationCap size={16} /> เข้าสู่ระบบสำหรับครู
          </p>
        ) : (
          <>
            <p className="preview-access-intro">
              ครั้งแรกที่ใช้งาน ให้ลงทะเบียนก่อน จากนั้นจึงเข้าสู่ระบบด้วยรหัสนักเรียน
            </p>
            <div className="preview-access-choice" role="group" aria-label="เลือกการใช้งาน">
              <button
                type="button"
                className={studentSignup ? "is-selected" : ""}
                onClick={() => { setStudentSignup(true); setError(""); }}
              >
                <strong>ลงทะเบียนครั้งแรก</strong>
                <span>ยืนยันข้อมูลนักเรียนและตั้งรหัสผ่าน</span>
              </button>
              <button
                type="button"
                className={!studentSignup ? "is-selected" : ""}
                onClick={() => { setStudentSignup(false); setError(""); }}
              >
                <strong>เข้าสู่ระบบ</strong>
                <span>สำหรับนักเรียนที่ลงทะเบียนแล้ว</span>
              </button>
            </div>
          </>
        )}
        {!isTeacher && !studentSignup && lineAvailable && (
          <section className="line-login-panel">
            <button
              className="button preview-line-button"
              type="button"
              onClick={() => void continueWithLine()}
              disabled={busy || lineBusy}
            >
              {lineBusy
                ? "กำลังเชื่อมต่อ LINE..."
                : lineNeedsLink
                  ? "เชื่อม LINE กับบัญชีนี้"
                  : "เข้าสู่ระบบด้วย LINE"}
            </button>
            <p>
              {lineNeedsLink
                ? "ใช้ข้อมูลนักเรียนเดิมเพื่อยืนยันการเชื่อมบัญชีครั้งแรก"
                : "เข้าใช้งานด้วย LINE ที่เชื่อมไว้"}
            </p>
          </section>
        )}
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
                  setFieldErrors({});
                }}
                required
              />
              {fieldErrors.studentCode && <small className="preview-field-error">{fieldErrors.studentCode}</small>}
            </label>
            {role === "student" && studentSignup && (
              <>
                <p className="preview-signup-hint">กรอกชื่อและนามสกุลให้ตรงกับรายชื่อที่ครูเตรียมไว้ ไม่ต้องใส่คำนำหน้า เช่น นาย นางสาว เด็กชาย หรือเด็กหญิง</p>
                <label>
                  ชื่อ
                  <input
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setError(""); setFieldErrors({}); }}
                    required
                  />
                  {(fieldErrors.firstName || fieldErrors.name) && <small className="preview-field-error">{fieldErrors.firstName || fieldErrors.name}</small>}
                </label>
                <label>
                  นามสกุล
                  <input
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); setError(""); setFieldErrors({}); }}
                    required
                  />
                  {fieldErrors.lastName && <small className="preview-field-error">{fieldErrors.lastName}</small>}
                </label>
                <label>
                  อีเมลสำหรับกู้รหัสผ่าน
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); setFieldErrors({}); }}
                    required
                  />
                  {fieldErrors.email && <small className="preview-field-error">{fieldErrors.email}</small>}
                </label>
              </>
            )}
            <label>
              {studentSignup ? "ตั้งรหัสผ่าน" : "รหัสผ่าน"}
              <div className="preview-password-input">
                <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                minLength={6}
                value={password}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                  setFieldErrors({});
                }}
                required
                />
                <button type="button" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && <small className="preview-field-error">{fieldErrors.password}</small>}
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button gold preview-enter" type="submit" disabled={busy}>
            {busy ? "กำลังตรวจสอบ..." : studentSignup ? "สมัครใช้งานนักเรียน" : role === "teacher" ? "เข้าสู่ระบบครู" : "เข้าสู่ระบบนักเรียน"}
            <ArrowRight size={18} />
          </button>
          {!isTeacher && !studentSignup && (
            <div className="preview-auth-links">
              <button type="button" className="preview-forgot-link" onClick={() => setError("ลืมรหัสผ่านใช่ไหม ให้ครูเปิดรายชื่อของคุณ แล้วเลือกแก้ไขเพื่อกำหนดรหัสผ่านใหม่")}>
                ลืมรหัสผ่าน?
              </button>
            </div>
          )}
        </form>
        <button
          type="button"
          className="preview-teacher-link"
          onClick={() => { setRole(isTeacher ? "student" : "teacher"); setStudentSignup(false); setError(""); }}
        >
          {isTeacher ? "กลับหน้าสำหรับนักเรียน" : "เข้าสู่ระบบสำหรับครู"}
        </button>
      </main>
    </div>
  );
}
