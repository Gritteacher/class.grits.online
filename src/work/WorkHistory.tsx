import { useState, type FormEvent } from "react";
import { RotateCcw, ExternalLink, Download, History } from "lucide-react";
import type { State, Submission } from "../model";
import { safeLink } from "../model";
import { Modal, Status } from "../ui";
import { dateTime, fromThaiInput, returnWork, thaiInput } from "./model";

export function ReturnWorkForm({
  state,
  submission,
  onSave,
  onClose,
}: {
  state: State;
  submission: Submission;
  onSave: (next: State) => boolean;
  onClose: () => void;
}) {
  const [note, setNote] = useState(submission.revisionNote ?? "");
  const [until, setUntil] = useState(
    thaiInput(new Date(Date.now() + 7 * 86400000).toISOString()),
  );
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (!onSave(returnWork(state, submission.id, note, fromThaiInput(until))))
        setError("บันทึกไม่สำเร็จ ยังไม่ได้ส่งกลับ ข้อมูลที่กรอกยังอยู่");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งกลับไม่สำเร็จ");
    }
  }
  return (
    <Modal
      title="ส่งกลับให้แก้ไข"
      subtitle={state.students.find((s) => s.id === submission.studentId)?.name}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          <p>เก็บงานฉบับเดิมและคะแนนเดิมไว้ จนกว่าครูจะตรวจฉบับใหม่</p>
          <label>
            สิ่งที่ต้องแก้ไข
            <textarea
              required
              maxLength={2000}
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label>
            กำหนดส่งฉบับแก้ไข (เวลาประเทศไทย)
            <input
              required
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button neutral" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="button coral">
            <RotateCcw size={17} />
            ยืนยันส่งกลับ
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function WorkHistory({ submission }: { submission: Submission }) {
  return (
    <section className="work-history" aria-label="ประวัติงาน">
      <h3>
        <History size={18} />
        ฉบับที่ {submission.revision ?? 1} · ประวัติงาน
      </h3>
      <p className="muted">
        ส่งล่าสุด {dateTime(submission.submittedAt)}
        {submission.reviewedAt
          ? ` · ให้คะแนนล่าสุด ${dateTime(submission.reviewedAt)}`
          : ""}
      </p>
      {(submission.history ?? [])
        .slice()
        .reverse()
        .map((entry, i) => (
          <details key={i}>
            <summary>
              ฉบับที่ {entry.revision ?? 1} ·{" "}
              {entry.action === "returned"
                ? "ครูส่งกลับ"
                : entry.action === "resubmitted"
                  ? "ก่อนส่งฉบับใหม่"
                  : "ก่อนครูบันทึกคะแนน"}{" "}
              · {dateTime(entry.at)}
            </summary>
            <div className="work-history-body">
              <Status status={entry.status} />
              <p>{entry.assignmentTitle}</p>
              <p className="history-response">
                {entry.response || "ส่งเป็นไฟล์หรือลิงก์"}
              </p>
              {entry.link && safeLink(entry.link) && (
                <a
                  className="button neutral"
                  href={safeLink(entry.link)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={16} />
                  เปิดลิงก์ฉบับนี้
                </a>
              )}
              {entry.file &&
                ["application/pdf", "image/png", "image/jpeg"].includes(
                  entry.file.type,
                ) &&
                entry.file.data.startsWith(
                  `data:${entry.file.type};base64,`,
                ) && (
                  <a
                    className="button neutral"
                    href={entry.file.data}
                    download={entry.file.name}
                  >
                    <Download size={16} />
                    {entry.file.name}
                  </a>
                )}
              {entry.score !== null && (
                <p>
                  คะแนนก่อนเปลี่ยน: {entry.score} / {entry.rawMax} →{" "}
                  {Math.round((entry.score / entry.rawMax) * entry.finalMax)} /{" "}
                  {entry.finalMax}
                </p>
              )}
              {entry.feedback && <p>คำแนะนำ: {entry.feedback}</p>}
              {entry.revisionNote && (
                <p>สิ่งที่ให้แก้ไข: {entry.revisionNote}</p>
              )}
            </div>
          </details>
        ))}
      {!submission.history?.length && (
        <p className="muted">ยังไม่มีการเปลี่ยนฉบับหรือผลตรวจเพิ่มเติม</p>
      )}
    </section>
  );
}
