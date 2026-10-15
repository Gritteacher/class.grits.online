import { useRef, useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  Check,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Upload,
  Users,
} from "lucide-react";
import type { State, Student } from "../model";
import { Empty, Modal } from "../ui";
import { addRoom, removeRoom, removeStudents, saveStudent, setRosterStatus } from "./model";
import { ImportStudents } from "./ImportStudents";
import type { ImportRow } from "./importModel";
import "./roster.css";

type Dialog =
  | { type: "room" }
  | { type: "import" }
  | { type: "student"; student?: Student }
  | { type: "archive" | "restore"; ids: string[] }
  | { type: "deleteStudents"; ids: string[] }
  | { type: "removeRoom"; room: string }
  | null;
type Commit = (state: State, message: string) => boolean;
type PersistStudent = (
  next: State,
  student?: Student,
  password?: string,
) => Promise<State>;
type PersistStatus = (
  next: State,
  ids: string[],
  status: Student["status"],
) => Promise<State>;
type PersistDeletion = (next: State, ids: string[]) => Promise<State>;
type PersistRoomDeletion = (next: State, room: string) => Promise<State>;
type ResetStudentPassword = (studentId: string, password: string) => Promise<void>;

export function RosterPage({
  state,
  onSave,
  onCreateAccounts,
  onPersistStudent,
  onPersistStatus,
  onPersistDeletion,
  onPersistRoomDeletion,
  onResetStudentPassword,
}: {
  state: State;
  onSave: Commit;
  onCreateAccounts?: (
    room: string,
    rows: ImportRow[],
    password: string,
  ) => Promise<State>;
  onPersistStudent?: PersistStudent;
  onPersistStatus?: PersistStatus;
  onPersistDeletion?: PersistDeletion;
  onPersistRoomDeletion?: PersistRoomDeletion;
  onResetStudentPassword?: ResetStudentPassword;
}) {
  const [room, setRoom] = useState(state.rooms[0] ?? "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Student["status"]>("active");
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selectAll = useRef<HTMLInputElement>(null);
  const currentRoom = state.rooms.includes(room)
    ? room
    : (state.rooms[0] ?? "");
  const roster = state.students
    .filter(
      (s) =>
        s.room === currentRoom &&
        s.status === status &&
        `${s.name} ${s.code} ${s.number}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => a.number - b.number || a.name.localeCompare(b.name, "th"));
  const selectedVisible = selected.filter((id) =>
    roster.some((s) => s.id === id),
  );
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate =
        selectedVisible.length > 0 && selectedVisible.length < roster.length;
  }, [selectedVisible.length, roster.length]);
  function open(next: Dialog) {
    setError("");
    setDialog(next);
  }
  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      if (!dialog) return;
      let next =
        dialog.type === "removeRoom"
          ? removeRoom(state, dialog.room)
          : dialog.type === "archive" || dialog.type === "restore"
            ? setRosterStatus(
                state,
                dialog.ids,
                dialog.type === "archive" ? "archived" : "active",
              )
            : dialog.type === "deleteStudents"
              ? removeStudents(state, dialog.ids)
            : null;
      if (next && (dialog.type === "archive" || dialog.type === "restore") && onPersistStatus) {
        next = await onPersistStatus(
          next,
          dialog.ids,
          dialog.type === "archive" ? "archived" : "active",
        );
      }
      if (next && dialog.type === "deleteStudents" && onPersistDeletion) {
        next = await onPersistDeletion(next, dialog.ids);
      }
      if (next && dialog.type === "removeRoom" && onPersistRoomDeletion) {
        next = await onPersistRoomDeletion(next, dialog.room);
      }
      if (
        next &&
        onSave(
          next,
          dialog.type === "removeRoom"
            ? "ลบห้องว่างแล้ว"
            : "ปรับรายชื่อแล้ว โดยเก็บงานและคะแนนเดิมไว้",
        )
      ) {
        setSelected([]);
        setDialog(null);
      } else if (next)
        setError("บันทึกไม่สำเร็จ รายชื่อยังไม่ถูกเปลี่ยน กรุณาลองอีกครั้ง");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปลี่ยนรายชื่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">รู้จักทุกคนในห้อง</p>
          <h1>
            ห้องเรียนและรายชื่อ
          </h1>
          <p className="subtext">
            {state.rooms.length} ห้องเรียน ·{" "}
            {state.students.filter((s) => s.status === "active").length}{" "}
            คนที่ใช้งาน
          </p>
        </div>
        <button className="button gold" onClick={() => open({ type: "room" })}>
          <Plus size={18} />
          เพิ่มห้องเรียน
        </button>
      </div>
      <div className="roster-layout">
        <aside className="roster-rooms" aria-label="ห้องเรียนในรายชื่อ">
          <h2>ห้องของคุณ</h2>
          {state.rooms.map((r) => (
            <button
              key={r}
              className={`roster-room ${r === currentRoom ? "active" : ""}`}
              aria-pressed={r === currentRoom}
              onClick={() => {
                setRoom(r);
                setSelected([]);
                setQuery("");
              }}
            >
              <Users size={20} />
              <span>
                <strong>{r}</strong>
                <small>
                  {
                    state.students.filter(
                      (s) => s.room === r && s.status === "active",
                    ).length
                  }{" "}
                  คน
                </small>
              </span>
            </button>
          ))}
        </aside>
        <section className="roster-content" aria-label="รายชื่อประจำห้อง">
          <div className="section-title roster-title">
            <div>
              <p className="eyebrow">รายชื่อประจำห้อง</p>
              <h2>{currentRoom || "ยังไม่มีห้องเรียน"}</h2>
            </div>
            <div className="roster-actions">
              <button
                className="button neutral"
                disabled={!currentRoom}
                onClick={() => open({ type: "import" })}
              >
                <Upload size={18} />
                นำเข้า Excel
              </button>
              <button
                className="icon-button"
                aria-label="ลบห้องเรียนนี้"
                title="ลบห้องว่าง"
                disabled={!currentRoom}
                onClick={() => open({ type: "removeRoom", room: currentRoom })}
              >
                <Trash2 size={18} />
              </button>
              <button
                className="button teal"
                disabled={!currentRoom}
                onClick={() => open({ type: "student" })}
              >
                <UserPlus size={18} />
                เพิ่มนักเรียน
              </button>
            </div>
          </div>
          <div className="roster-filters">
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label="ค้นหารายชื่อ"
                placeholder="ค้นหาชื่อ รหัส หรือเลขที่"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected([]);
                }}
              />
            </label>
            <label className="roster-status">
              สถานะรายชื่อ
              <select
                aria-label="สถานะรายชื่อ"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as Student["status"]);
                  setSelected([]);
                }}
              >
                <option value="active">กำลังใช้งาน</option>
                <option value="archived">พักรายชื่อไว้</option>
              </select>
            </label>
          </div>
          <div className="roster-selection">
            <label>
              <input
                type="checkbox"
                ref={selectAll}
                aria-label="เลือกทั้งหมดที่แสดง"
                disabled={!roster.length}
                checked={
                  roster.length > 0 && selectedVisible.length === roster.length
                }
                onChange={(e) =>
                  setSelected(e.target.checked ? roster.map((s) => s.id) : [])
                }
              />
              {selectedVisible.length
                ? `เลือก ${selectedVisible.length} คน`
                : `${roster.length} คน`}
            </label>
            <button
              className={`button ${status === "active" ? "neutral" : "teal"}`}
              disabled={!selectedVisible.length}
              onClick={() =>
                open({
                  type: status === "active" ? "archive" : "restore",
                  ids: selectedVisible,
                })
              }
            >
              {status === "active" ? (
                <Archive size={17} />
              ) : (
                <RotateCcw size={17} />
              )}
              {status === "active"
                ? "พักรายชื่อที่เลือก"
                : "คืนรายชื่อที่เลือก"}
            </button>
            <button
              className="button coral"
              disabled={!selectedVisible.length || busy}
              onClick={() => open({ type: "deleteStudents", ids: selectedVisible })}
            >
              <Trash2 size={17} />
              ลบรายชื่อ
            </button>
          </div>
          <div className="roster-list">
            {roster.map((s) => (
              <article className="roster-person" key={s.id}>
                <input
                  type="checkbox"
                  aria-label={`เลือก ${s.name}`}
                  checked={selectedVisible.includes(s.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, s.id]
                        : selected.filter((id) => id !== s.id),
                    )
                  }
                />
                <span
                  className="roster-number"
                  aria-label={`เลขที่ ${s.number}`}
                >
                  {s.number}
                </span>
                <div className="roster-person-name">
                  <h3>{s.name}</h3>
                  <p>
                    รหัส {s.code}
                    {s.status === "archived" ? " · พักรายชื่อไว้" : ""}
                  </p>
                </div>
                <div className="roster-person-actions">
                  <button
                    className="icon-button"
                    aria-label={`แก้ไข ${s.name}`}
                    title="แก้ไขรายชื่อ"
                    onClick={() => open({ type: "student", student: s })}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`ลบ ${s.name}`}
                    title="ลบรายชื่อ"
                    onClick={() => open({ type: "deleteStudents", ids: [s.id] })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!roster.length && (
            <Empty>
              {query
                ? "ไม่พบรายชื่อที่ค้นหา"
                : status === "archived"
                  ? "ไม่มีรายชื่อที่พักไว้ในห้องนี้"
                  : "ห้องนี้ยังไม่มีนักเรียน"}
            </Empty>
          )}
        </section>
      </div>
      {dialog?.type === "room" && (
        <RoomForm
          state={state}
          onClose={() => setDialog(null)}
          onSave={(next, message) => {
            if (!onSave(next, message)) return false;
            setRoom(next.rooms.find((r) => !state.rooms.includes(r))!);
            setSelected([]);
            setQuery("");
            setStatus("active");
            setDialog(null);
            return true;
          }}
        />
      )}
      {dialog?.type === "student" && (
        <StudentForm
          state={state}
          room={currentRoom}
          student={dialog.student}
              onPersist={onPersistStudent}
              onResetPassword={onResetStudentPassword}
              onClose={() => setDialog(null)}
          onSave={(next, message) => {
            if (!onSave(next, message)) return false;
            setDialog(null);
            setSelected([]);
            return true;
          }}
        />
      )}
      {dialog?.type === "import" && (
        <ImportStudents
          state={state}
          initialRoom={currentRoom}
          onClose={() => setDialog(null)}
          onCreateAccounts={onCreateAccounts}
          onSave={(next, targetRoom, count) => {
            if (
              !onSave(
                next,
                `นำเข้านักเรียน ${count} คน เข้า ${targetRoom} แล้ว`,
              )
            )
              return false;
            setRoom(targetRoom);
            setStatus("active");
            setQuery("");
            setSelected([]);
            setDialog(null);
            return true;
          }}
        />
      )}
      {dialog && ["archive", "restore", "removeRoom", "deleteStudents"].includes(dialog.type) && (
        <Modal
          title={
            dialog.type === "removeRoom"
              ? `ลบห้อง ${dialog.room}?`
              : dialog.type === "deleteStudents"
                ? "ลบรายชื่อที่เลือก?"
              : dialog.type === "archive"
                ? "พักรายชื่อที่เลือก?"
                : "คืนรายชื่อที่เลือก?"
          }
          onClose={() => setDialog(null)}
        >
          <div className="modal-body form-stack">
            <p>
              {dialog.type === "removeRoom"
                ? "ลบได้เฉพาะห้องว่างที่ไม่มีนักเรียนหรือประวัติงาน"
                : dialog.type === "deleteStudents"
                  ? "รายชื่อจะถูกนำออกจากห้องเรียน บัญชีจะถูกพักไว้ และคะแนนกับประวัติงานเดิมจะยังเก็บไว้"
                : "งาน คะแนน และอวตาร์เดิมจะยังอยู่ครบ สามารถคืนรายชื่อกลับมาใช้งานได้"}
            </p>
            {(dialog.type === "archive" || dialog.type === "restore" || dialog.type === "deleteStudents") && (
              <ul className="roster-confirm-names">
                {dialog.ids.map((id) => (
                  <li key={id}>
                    {state.students.find((s) => s.id === id)?.name}
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-actions">
            <button className="button neutral" disabled={busy} onClick={() => setDialog(null)}>
              ยกเลิก
            </button>
              <button className="button coral" disabled={busy} onClick={confirm}>
              <Check size={17} />
              {busy && <span className="loading-spinner" aria-hidden="true" />}
              {busy ? "กำลังบันทึก " : "ยืนยัน "}
              {dialog.type === "removeRoom"
                ? "ลบห้อง"
                : dialog.type === "deleteStudents"
                  ? "ลบรายชื่อ"
                : dialog.type === "archive"
                  ? "พักรายชื่อ"
                  : "คืนรายชื่อ"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function RoomForm({
  state,
  onSave,
  onClose,
}: {
  state: State;
  onSave: Commit;
  onClose: () => void;
}) {
  const [grade, setGrade] = useState("6");
  const [number, setNumber] = useState("");
  const [subject, setSubject] = useState("สังคมศึกษา");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (
        !onSave(
          addRoom(state, Number(grade), Number(number), subject),
          "เพิ่มห้องเรียนแล้ว",
        )
      )
        setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มห้องไม่สำเร็จ");
    }
  }
  return (
    <Modal title="เพิ่มห้องเรียน" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          <div className="form-columns">
            <label>
              ระดับชั้น
              <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                {[1, 2, 3, 4, 5, 6].map((g) => (
                  <option value={g} key={g}>
                    ม.{g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              เลขห้อง
              <input
                type="number"
                min="1"
                max="999"
                step="1"
                required
                placeholder="เช่น 4"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </label>
          </div>
          <label>
            รายวิชา
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="เช่น สังคมศึกษา เศรษฐศาสตร์ หรือประวัติศาสตร์"
              maxLength={120}
              required
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
          <button className="button teal">
            <Plus size={17} />
            บันทึกห้องเรียน
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StudentForm({
  state,
  room,
  student,
  onSave,
  onPersist,
  onResetPassword,
  onClose,
}: {
  state: State;
  room: string;
  student?: Student;
  onSave: Commit;
  onPersist?: PersistStudent;
  onResetPassword?: ResetStudentPassword;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    code: student?.code ?? "",
    name: student?.name ?? "",
    room: student?.room ?? room,
    number: student ? String(student.number) : "",
  });
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (!student && password.length < 6) {
        setError("รหัสผ่านเริ่มต้นต้องมีอย่างน้อย 6 ตัวอักษร");
        return;
      }
      const next = saveStudent(
        state,
        { ...values, number: Number(values.number) },
        student?.id,
      );
      const saved = onPersist
        ? await onPersist(next, student, password)
        : next;
      if (!onSave(saved, student ? "แก้ไขรายชื่อแล้ว" : "เพิ่มนักเรียนแล้ว")) {
        setError("บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกรายชื่อไม่สำเร็จ");
    }
  }
  async function resetPassword() {
    if (!student || !onResetPassword) return;
    setResetError("");
    if (newPassword.length < 6) {
      setResetError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setResetting(true);
    try {
      await onResetPassword(student.id, newPassword);
      setNewPassword("");
      setResetError("");
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
    } finally {
      setResetting(false);
    }
  }
  return (
    <Modal
      title={student ? "แก้ไขรายชื่อ" : "เพิ่มนักเรียน"}
      subtitle={student?.status === "archived" ? "รายชื่อที่พักไว้" : undefined}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          <label>
            รหัสนักเรียน
            <input
              inputMode="numeric"
              maxLength={20}
              required
              value={values.code}
              onChange={(e) => setValues({ ...values, code: e.target.value })}
              placeholder="เช่น 00123"
            />
          </label>
          <label>
            ชื่อ–สกุล
            <input
              maxLength={120}
              required
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              placeholder="ชื่อและนามสกุล"
            />
          </label>
          {!student && (
            <label>
              รหัสผ่านเริ่มต้น
              <input
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
            </label>
          )}
          {student && onResetPassword && (
            <div className="student-password-reset">
              <label>
                ตั้งรหัสผ่านใหม่ให้นักเรียน
                <input
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </label>
              <button type="button" className="button neutral" disabled={resetting} onClick={() => void resetPassword()}>
                <KeyRound size={16} />
                {resetting ? "กำลังตั้งรหัส..." : "บันทึกรหัสผ่านใหม่"}
              </button>
              {resetError && <p className="form-error" role="alert">{resetError}</p>}
            </div>
          )}
          <div className="form-columns">
            <label>
              ห้องเรียน
              <select
                value={values.room}
                onChange={(e) => setValues({ ...values, room: e.target.value })}
              >
                {state.rooms.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              เลขที่
              <input
                type="number"
                min="1"
                max="999"
                step="1"
                required
                placeholder="เช่น 5"
                value={values.number}
                onChange={(e) =>
                  setValues({ ...values, number: e.target.value })
                }
              />
            </label>
          </div>
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
          <button className="button teal">
            <Check size={17} />
            บันทึกรายชื่อ
          </button>
        </div>
      </form>
    </Modal>
  );
}
