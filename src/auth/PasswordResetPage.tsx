import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, GraduationCap } from "lucide-react";
import { SchoolLogo } from "../components/SchoolLogo";
import { completeStudentPasswordReset } from "../services/passwordRecoveryService";
import "../preview/preview.css";

export function PasswordResetPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6) return setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    if (password !== confirmation) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setBusy(true);
    try {
      await completeStudentPasswordReset(token, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="preview-login">
      <header className="preview-login-header">
        <span><GraduationCap size={16} /> ตั้งรหัสผ่านใหม่</span>
      </header>
      <main className="preview-login-main">
        <SchoolLogo className="preview-school-logo" alt="ตราโรงเรียนเทพศิรินทร์ นนทบุรี" state="login" />
        <p className="eyebrow">โรงเรียนเทพศิรินทร์ นนทบุรี</p>
        <h1>ตั้งรหัสผ่านใหม่</h1>
        {done ? (
          <>
            <p className="preview-success" role="status">ตั้งรหัสผ่านเรียบร้อยแล้ว</p>
            <button className="button gold preview-enter" type="button" onClick={() => { window.location.href = "/"; }}>
              กลับเข้าสู่ระบบ <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <form className="preview-login-form" onSubmit={submit}>
            <div className="form-stack">
              <label>
                รหัสผ่านใหม่
                <div className="preview-password-input">
                  <input type={showPassword ? "text" : "password"} minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </label>
              <label>
                ยืนยันรหัสผ่านใหม่
                <div className="preview-password-input">
                  <input type={showConfirmation ? "text" : "password"} minLength={6} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
                  <button type="button" aria-label={showConfirmation ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} onClick={() => setShowConfirmation(!showConfirmation)}>{showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </label>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button gold preview-enter" type="submit" disabled={busy}>
              {busy ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"} <ArrowRight size={18} />
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
