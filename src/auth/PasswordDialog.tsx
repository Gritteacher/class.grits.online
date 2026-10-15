import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { Modal } from "../ui";
import { updatePassword } from "../services/authService";

export function PasswordDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) { setError("รหัสผ่านใหม่ไม่ตรงกัน"); return; }
    setBusy(true);
    try { await updatePassword(password); onSaved(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return (
    <Modal title="เปลี่ยนรหัสผ่าน" subtitle="บัญชีของฉัน" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          <p className="muted">กำหนดรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร</p>
          <label>รหัสผ่านใหม่<input type="password" minLength={6} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label>ยืนยันรหัสผ่านใหม่<input type="password" minLength={6} autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="modal-actions"><button type="button" className="button neutral" onClick={onClose}>ยกเลิก</button><button className="button teal" disabled={busy}><KeyRound size={17} />{busy ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}</button></div>
      </form>
    </Modal>
  );
}
