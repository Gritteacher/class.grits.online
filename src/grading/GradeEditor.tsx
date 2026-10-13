import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import type { State } from "../model";
import { Modal } from "../ui";
import { dateTime } from "../work/model";
import { getGrade, gradePoints, writeGrade } from "./model";

export function GradeEditor({
  state,
  studentId,
  assignmentId,
  onSave,
  onClose,
}: {
  state: State;
  studentId: string;
  assignmentId: string;
  onSave: (next: State) => boolean;
  onClose: () => void;
}) {
  const student = state.students.find((s) => s.id === studentId)!;
  const assignment = state.assignments.find((a) => a.id === assignmentId)!;
  const entry = getGrade(state, studentId, assignmentId);
  const [baseline] = useState({
    revision: entry?.revision ?? 0,
    rawMax: assignment.rawMax,
    finalMax: assignment.finalMax,
  });
  const [raw, setRaw] = useState(entry ? String(entry.raw) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const events = (state.gradeEvents ?? [])
    .filter((e) => e.studentId === studentId && e.assignmentId === assignmentId)
    .slice()
    .reverse();
  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (!raw.trim())
        throw new Error("กรอกคะแนนก่อนบันทึก คะแนนศูนย์ต้องระบุ 0");
      if (
        assignment.rawMax !== baseline.rawMax ||
        assignment.finalMax !== baseline.finalMax
      )
        throw new Error("คะแนนเต็มเปลี่ยนแล้ว กรุณาปิดแล้วเปิดช่องคะแนนใหม่");
      const next = writeGrade(state, {
        studentId,
        assignmentId,
        raw: Number(raw),
        note,
        source: "manual",
        expectedRevision: baseline.revision,
      });
      if (!onSave(next))
        setError("บันทึกไม่สำเร็จ คะแนนเดิมยังอยู่ ข้อมูลที่กรอกยังไม่หาย");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกคะแนนไม่สำเร็จ");
    }
  }
  return (
    <Modal
      title="บันทึกคะแนน"
      subtitle={`${student.name} · ${student.room}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          <h3>{assignment.title}</h3>
          <p>
            คะแนนปัจจุบัน{" "}
            {entry
              ? `${gradePoints(entry, assignment)} / ${assignment.finalMax}`
              : "ยังไม่กรอก"}
          </p>
          <label>
            คะแนนดิบ
            <input
              aria-label="คะแนนดิบ"
              type="number"
              min="0"
              max={assignment.rawMax}
              step="any"
              required
              placeholder={`0–${assignment.rawMax}`}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
          </label>
          <p role="status">
            คะแนนเก็บ{" "}
            {raw.trim() &&
            Number.isFinite(Number(raw)) &&
            Number(raw) >= 0 &&
            Number(raw) <= assignment.rawMax
              ? gradePoints({ raw: Number(raw) }, assignment)
              : "—"}{" "}
            / {assignment.finalMax}
          </p>
          <label>
            เหตุผลการบันทึกคะแนน
            <textarea
              aria-label="เหตุผลการบันทึกคะแนน"
              required
              rows={2}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {entry && (
            <p className="muted">
              {entry.source === "manual" ? "กรอกโดยครู" : "จากการตรวจงาน"} ·{" "}
              {dateTime(entry.updatedAt)}
              <br />
              {entry.note}
            </p>
          )}
          {!!events.length && (
            <details className="grade-history">
              <summary>ประวัติคะแนน {events.length} รายการ</summary>
              <ol>
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>
                      {event.before ?? "ยังไม่กรอก"} → {event.after} /{" "}
                      {event.rawMax}
                    </strong>
                    <span>
                      {dateTime(event.at)} ·{" "}
                      {event.source === "manual" ? "กรอกโดยครู" : "ตรวจงาน"}
                    </span>
                    <p>{event.note}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button neutral" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="button teal">
            <Save size={17} />
            บันทึกคะแนน
          </button>
        </div>
      </form>
    </Modal>
  );
}
