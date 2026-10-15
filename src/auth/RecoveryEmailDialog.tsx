import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { Modal } from "../ui";
import { saveRecoveryEmail } from "../services/authService";

export function RecoveryEmailDialog({
  initialEmail,
  onClose,
  onSaved,
}: {
  initialEmail?: string | null;
  onClose: () => void;
  onSaved: (email: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const saved = await saveRecoveryEmail(email);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกอีเมลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="เพิ่มอีเมลกู้รหัสผ่าน" subtitle="ข้อมูลบัญชีนักเรียน" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          <p className="muted">ใช้อีเมลที่เปิดรับข้อความได้จริง สำหรับกู้รหัสผ่านในอนาคต</p>
          <label>
            อีเมลของนักเรียน
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="button neutral" onClick={onClose}>ไว้ภายหลัง</button>
          <button className="button teal" disabled={busy}><Mail size={17} />{busy ? "กำลังบันทึก..." : "บันทึกอีเมล"}</button>
        </div>
      </form>
    </Modal>
  );
}
