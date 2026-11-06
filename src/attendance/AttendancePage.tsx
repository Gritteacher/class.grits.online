import { useEffect, useState, type FormEvent } from "react";
import { CalendarCheck, Check, Plus, RefreshCw, Save } from "lucide-react";
import type { State } from "../model";
import { Modal } from "../ui";
import {
  approvedLeaveOn,
  attendanceDate,
  attendanceLabels,
  bangkokToday,
  leaveLabels,
  type AttendanceRecord,
  type AttendanceStatus,
  type LeaveRequest,
} from "./model";
import {
  loadAttendance,
  loadAttendanceRooms,
  loadLeaves,
  requestLeave,
  reviewLeave,
  saveAttendance,
  type AttendanceRoom,
} from "./service";
import "./attendance.css";

type Mark = { status: AttendanceStatus | ""; note: string };
export function AttendancePage({
  state,
  role,
  onPendingChange,
}: {
  state: State;
  role: "teacher" | "student";
  onPendingChange?: (pending: boolean) => void;
}) {
  const teacher = role === "teacher";
  const [rooms, setRooms] = useState<AttendanceRoom[]>([]);
  const [roomId, setRoomId] = useState("");
  const [pane, setPane] = useState(teacher ? "check" : "history");
  const [day, setDay] = useState(bangkokToday);
  const [period, setPeriod] = useState(1);
  const [historyMonth, setHistoryMonth] = useState(bangkokToday().slice(0, 7));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [leaveFilter, setLeaveFilter] = useState("pending");
  const [newLeave, setNewLeave] = useState(false);
  const [decision, setDecision] = useState<{
    request: LeaveRequest;
    status: "approved" | "rejected";
  } | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const month = pane === "history" ? historyMonth : day.slice(0, 7);
  const classroom = rooms.find((room) => room.id === roomId);
  const members = state.students
    .filter((student) =>
      student.classroomId
        ? student.classroomId === roomId
        : student.room === (classroom?.name || classroom?.room),
    )
    .filter((student) => student.status === "active")
    .sort((a, b) => a.number - b.number);
  const studentName = (id: string) =>
    state.students.find((student) => student.id === id)?.name ||
    "นักเรียนที่เคยอยู่ในห้องนี้";
  const canLeave = () =>
    !dirty ||
    window.confirm(
      "มีการเช็คชื่อที่ยังไม่บันทึก ต้องการออกจากรายการนี้หรือไม่?",
    );
  useEffect(() => {
    let active = true;
    setRoomsLoading(true);
    void loadAttendanceRooms()
      .then((items) => {
        if (active) {
          setRooms(items);
          setRoomId((current) =>
            items.some((room) => room.id === current)
              ? current
              : items[0]?.id || "",
          );
          if (!items.length) setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setError(error.message);
          setLoading(false);
        }
      })
      .finally(() => {
        if (active) setRoomsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    onPendingChange?.(dirty || busy);
    return () => onPendingChange?.(false);
  }, [dirty, busy, onPendingChange]);
  useEffect(() => {
    if (!roomId) return;
    let active = true;
    setLoading(true);
    setError("");
    setRecords([]);
    setLeaves([]);
    setMarks({});
    setDirty(false);
    void Promise.all([loadAttendance(roomId, month), loadLeaves(roomId)])
      .then(([attendance, requests]) => {
        if (active) {
          setRecords(attendance);
          setLeaves(requests);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roomId, month, revision]);
  useEffect(() => {
    setMarks(
      Object.fromEntries(
        records
          .filter(
            (record) =>
              record.attendance_date === day && record.period === period,
          )
          .map((record) => [
            record.student_id,
            { status: record.status, note: record.note },
          ]),
      ),
    );
    setDirty(false);
  }, [records, day, period]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty || busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, busy]);
  function updateMark(id: string, patch: Partial<Mark>) {
    setMarks((current) => ({
      ...current,
      [id]: { ...(current[id] || { status: "", note: "" }), ...patch },
    }));
    setDirty(true);
    setNotice("");
  }
  async function save() {
    setMutationError("");
    setNotice("");
    if (members.some((student) => !marks[student.id]?.status)) {
      setMutationError("กรุณาเช็คชื่อให้ครบทุกคนก่อนบันทึก");
      return;
    }
    setBusy(true);
    try {
      await saveAttendance(
        roomId,
        day,
        period,
        members.map((student) => ({
          studentId: student.id,
          status: marks[student.id].status as AttendanceStatus,
          note: marks[student.id].note,
        })),
      );
      setDirty(false);
      setNotice("บันทึกเช็คชื่อแล้ว");
      setRevision((value) => value + 1);
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  async function decide(event: FormEvent) {
    event.preventDefault();
    if (!decision || busy) return;
    setBusy(true);
    setMutationError("");
    try {
      await reviewLeave(decision.request.id, decision.status, reviewNote);
      setDecision(null);
      setNotice("บันทึกผลการลาแล้ว");
      setRevision((value) => value + 1);
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  const visibleLeaves =
    teacher && leaveFilter !== "all"
      ? leaves.filter((item) => item.status === leaveFilter)
      : leaves;
  const selectedStatuses =
    pane === "check"
      ? members.map((student) => marks[student.id]?.status).filter(Boolean)
      : records.map((record) => record.status);
  return (
    <section className="attendance-page">
      <header className="attendance-heading">
        <div>
          <h1>
            <CalendarCheck size={24} /> เช็คชื่อและการลา
          </h1>
          <p className="muted">
            {teacher ? "การเข้าเรียนประจำห้อง" : "ประวัติการเข้าเรียนของฉัน"}
          </p>
        </div>
        <button
          className="icon-button"
          title="โหลดข้อมูลใหม่"
          aria-label="โหลดข้อมูลเช็คชื่อใหม่"
          disabled={loading || busy || roomsLoading}
          onClick={() => {
            if (canLeave()) {
              setDirty(false);
              setRevision((value) => value + 1);
            }
          }}
        >
          <RefreshCw size={18} />
        </button>
      </header>
      <div className="attendance-toolbar">
        <label>
          ห้องเรียน
          <select
            aria-label="ห้องเรียนเช็คชื่อ"
            disabled={busy || roomsLoading}
            value={roomId}
            onChange={(event) => {
              if (canLeave()) {
                setDirty(false);
                setMutationError("");
                setNotice("");
                setRoomId(event.target.value);
              }
            }}
          >
            <option value="" disabled>
              เลือกห้องเรียน
            </option>
            {rooms.map((room, index) => (
              <option key={room.id} value={room.id}>
                {room.name || room.room}
                {rooms.filter(
                  (item) =>
                    (item.name || item.room) === (room.name || room.room),
                ).length > 1
                  ? ` · รายการที่ ${index + 1}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <div
          className="attendance-tabs"
          role="tablist"
          aria-label="รายการเข้าเรียน"
        >
          {(teacher
            ? [
                ["check", "เช็คชื่อ"],
                ["history", "ประวัติ"],
                ["leave", "คำขอลา"],
              ]
            : [
                ["history", "ประวัติ"],
                ["leave", "การลาของฉัน"],
              ]
          ).map(([key, text]) => (
            <button
              role="tab"
              aria-selected={pane === key}
              disabled={busy}
              key={key}
              onClick={() => {
                if (canLeave()) {
                  setDirty(false);
                  setMutationError("");
                  setPane(key);
                }
              }}
            >
              {text}
              {key === "leave" &&
              teacher &&
              leaves.some((item) => item.status === "pending")
                ? ` (${leaves.filter((item) => item.status === "pending").length})`
                : ""}
            </button>
          ))}
        </div>
        {pane === "check" && (
          <>
            <label>
              วันที่
              <input
                aria-label="วันที่เช็คชื่อ"
                type="date"
                max={bangkokToday()}
                disabled={busy}
                value={day}
                onChange={(event) => {
                  if (event.target.value && canLeave()) {
                    setDirty(false);
                    setDay(event.target.value);
                  }
                }}
              />
            </label>
            <label>
              คาบ
              <select
                aria-label="คาบเรียน"
                disabled={busy}
                value={period}
                onChange={(event) => {
                  if (canLeave()) setPeriod(Number(event.target.value));
                }}
              >
                {Array.from({ length: 20 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    คาบ {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {pane === "history" && (
          <label>
            เดือน
            <input
              type="month"
              aria-label="เดือนประวัติเช็คชื่อ"
              value={historyMonth}
              disabled={busy}
              onChange={(event) => {
                if (event.target.value) setHistoryMonth(event.target.value);
              }}
            />
          </label>
        )}
      </div>
      {notice && (
        <p role="status" className="attendance-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading || roomsLoading ? (
        <p className="attendance-loading" role="status">
          <span className="loading-spinner" aria-hidden="true" />{" "}
          กำลังโหลดข้อมูลเข้าเรียน...
        </p>
      ) : !rooms.length ? (
        <p className="attendance-empty">ยังไม่มีห้องเรียน</p>
      ) : (
        !error && (
          <>
            {pane !== "leave" && (
              <div className="attendance-summary">
                {Object.entries(attendanceLabels).map(([key, label]) => (
                  <span key={key} className={`attendance-count ${key}`}>
                    {label}{" "}
                    <strong>
                      {
                        selectedStatuses.filter((status) => status === key)
                          .length
                      }
                    </strong>
                  </span>
                ))}
              </div>
            )}
            {pane === "check" && teacher && (
              <>
                <div className="attendance-check-actions">
                  <span>
                    {members.length} คน · ยังไม่เช็ค{" "}
                    {
                      members.filter((student) => !marks[student.id]?.status)
                        .length
                    }{" "}
                    คน
                  </span>
                  <button
                    className="button neutral"
                    disabled={busy || !members.length}
                    onClick={() => {
                      const next = { ...marks };
                      members.forEach((student) => {
                        if (!next[student.id]?.status)
                          next[student.id] = {
                            status: approvedLeaveOn(leaves, student.id, day)
                              ? "leave"
                              : "present",
                            note: next[student.id]?.note || "",
                          };
                      });
                      setMarks(next);
                      setDirty(true);
                      setNotice("");
                    }}
                  >
                    <Check size={16} /> เติมคนที่ยังไม่เช็ค
                  </button>
                </div>
                <div className="attendance-roster">
                  {members.map((student) => (
                    <div className="attendance-person" key={student.id}>
                      <div>
                        <strong>
                          {student.number}. {student.name}
                        </strong>
                        <small>รหัส {student.code}</small>
                        {approvedLeaveOn(leaves, student.id, day) && (
                          <small className="attendance-approved">
                            อนุมัติลาในวันนี้
                          </small>
                        )}
                      </div>
                      <fieldset className="attendance-options" disabled={busy}>
                        <legend className="sr-only">
                          สถานะ {student.name}
                        </legend>
                        {Object.entries(attendanceLabels).map(
                          ([key, label]) => (
                            <label
                              key={key}
                              className={
                                marks[student.id]?.status === key
                                  ? `selected ${key}`
                                  : ""
                              }
                            >
                              <input
                                type="radio"
                                name={`attendance-${student.id}`}
                                value={key}
                                checked={marks[student.id]?.status === key}
                                onChange={() =>
                                  updateMark(student.id, {
                                    status: key as AttendanceStatus,
                                  })
                                }
                              />
                              {label}
                            </label>
                          ),
                        )}
                      </fieldset>
                      <input
                        aria-label={`หมายเหตุ ${student.name}`}
                        placeholder="หมายเหตุ"
                        maxLength={500}
                        value={marks[student.id]?.note || ""}
                        disabled={busy}
                        onChange={(event) =>
                          updateMark(student.id, { note: event.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
                {!members.length && (
                  <p className="attendance-empty">
                    ยังไม่มีนักเรียนที่กำลังใช้งานในห้องนี้
                  </p>
                )}
                {mutationError && (
                  <p role="alert" className="form-error">
                    {mutationError}
                  </p>
                )}
                <div className="attendance-save">
                  <span>{dirty ? "มีรายการที่ยังไม่บันทึก" : ""}</span>
                  <button
                    className="button teal"
                    disabled={busy || !members.length || !dirty}
                    onClick={() => void save()}
                  >
                    {busy ? (
                      <span className="loading-spinner" aria-hidden="true" />
                    ) : (
                      <Save size={17} />
                    )}
                    {busy ? "กำลังบันทึก" : "บันทึกเช็คชื่อ"}
                  </button>
                </div>
              </>
            )}
            {pane === "history" && (
              <div className="attendance-history">
                {records.map((record) => (
                  <article key={record.id}>
                    <div>
                      <strong>
                        {attendanceDate(record.attendance_date)} · คาบ{" "}
                        {record.period}
                      </strong>
                      {teacher && <p>{studentName(record.student_id)}</p>}
                      {record.note && <p className="muted">{record.note}</p>}
                    </div>
                    <span className={`attendance-result ${record.status}`}>
                      {attendanceLabels[record.status]}
                    </span>
                  </article>
                ))}
                {!records.length && (
                  <p className="attendance-empty">
                    ยังไม่มีประวัติเช็คชื่อในเดือนนี้
                  </p>
                )}
              </div>
            )}
            {pane === "leave" && (
              <>
                <div className="attendance-check-actions">
                  {teacher ? (
                    <label>
                      สถานะคำขอ
                      <select
                        aria-label="สถานะคำขอลา"
                        value={leaveFilter}
                        onChange={(event) => setLeaveFilter(event.target.value)}
                      >
                        <option value="pending">รอพิจารณา</option>
                        <option value="all">ทั้งหมด</option>
                        <option value="approved">อนุมัติ</option>
                        <option value="rejected">ไม่อนุมัติ</option>
                      </select>
                    </label>
                  ) : (
                    <button
                      className="button teal"
                      onClick={() => {
                        setMutationError("");
                        setNewLeave(true);
                      }}
                    >
                      <Plus size={16} /> ยื่นคำขอลา
                    </button>
                  )}
                </div>
                <div className="leave-list">
                  {visibleLeaves.map((item) => (
                    <article key={item.id} className="leave-item">
                      <div className="leave-title">
                        <strong>
                          {teacher ? studentName(item.student_id) : "คำขอลา"}
                        </strong>
                        <span className={`leave-status ${item.status}`}>
                          {leaveLabels[item.status]}
                        </span>
                      </div>
                      <p>
                        {attendanceDate(item.starts_on)}
                        {item.ends_on !== item.starts_on
                          ? ` ถึง ${attendanceDate(item.ends_on)}`
                          : ""}
                      </p>
                      <p className="leave-reason">{item.reason}</p>
                      {item.review_note && (
                        <p className="leave-reply">
                          ข้อความจากครู: {item.review_note}
                        </p>
                      )}
                      {teacher && item.status === "pending" && (
                        <div className="leave-actions">
                          <button
                            className="button neutral"
                            onClick={() => {
                              setMutationError("");
                              setReviewNote("");
                              setDecision({
                                request: item,
                                status: "rejected",
                              });
                            }}
                          >
                            ไม่อนุมัติ
                          </button>
                          <button
                            className="button teal"
                            onClick={() => {
                              setMutationError("");
                              setReviewNote("");
                              setDecision({
                                request: item,
                                status: "approved",
                              });
                            }}
                          >
                            <Check size={16} /> อนุมัติ
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {!visibleLeaves.length && (
                  <p className="attendance-empty">
                    ไม่มีคำขอลา
                    {teacher && leaveFilter === "pending" ? "ที่รอพิจารณา" : ""}
                  </p>
                )}
              </>
            )}
          </>
        )
      )}
      {newLeave && (
        <LeaveForm
          busy={busy}
          error={mutationError}
          room={classroom?.name || classroom?.room || ""}
          onClose={() => {
            if (!busy) setNewLeave(false);
          }}
          onSubmit={async (start, end, reason) => {
            if (busy) return;
            setBusy(true);
            setMutationError("");
            try {
              await requestLeave(roomId, start, end, reason);
              setNewLeave(false);
              setNotice("ส่งคำขอลาแล้ว รอครูพิจารณา");
              setRevision((value) => value + 1);
            } catch (error) {
              setMutationError(
                error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {decision && (
        <Modal
          title={
            decision.status === "approved"
              ? "อนุมัติคำขอลา"
              : "ไม่อนุมัติคำขอลา"
          }
          onClose={() => {
            if (!busy) setDecision(null);
          }}
        >
          <form
            className="modal-body form-stack"
            onSubmit={(event) => void decide(event)}
          >
            <p>
              {studentName(decision.request.student_id)} ·{" "}
              {attendanceDate(decision.request.starts_on)}
            </p>
            <label>
              ข้อความถึงนักเรียน (ไม่บังคับ)
              <textarea
                rows={3}
                value={reviewNote}
                maxLength={500}
                disabled={busy}
                onChange={(event) => setReviewNote(event.target.value)}
              />
            </label>
            {mutationError && (
              <p role="alert" className="form-error">
                {mutationError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button neutral"
                disabled={busy}
                onClick={() => setDecision(null)}
              >
                ยกเลิก
              </button>
              <button className="button teal" disabled={busy}>
                {busy && (
                  <span className="loading-spinner" aria-hidden="true" />
                )}
                ยืนยันผลการลา
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function LeaveForm({
  room,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  room: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (start: string, end: string, reason: string) => Promise<void>;
}) {
  const [start, setStart] = useState(bangkokToday);
  const [end, setEnd] = useState(bangkokToday);
  const [reason, setReason] = useState("");
  return (
    <Modal title="ยื่นคำขอลา" subtitle={room} onClose={onClose}>
      <form
        className="modal-body form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(start, end, reason);
        }}
      >
        <div className="attendance-date-range">
          <label>
            ตั้งแต่วันที่
            <input
              type="date"
              required
              value={start}
              disabled={busy}
              onChange={(event) => {
                setStart(event.target.value);
                if (event.target.value > end) setEnd(event.target.value);
              }}
            />
          </label>
          <label>
            ถึงวันที่
            <input
              type="date"
              required
              min={start}
              value={end}
              disabled={busy}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
        </div>
        <label>
          เหตุผลการลา
          <textarea
            rows={4}
            required
            maxLength={1000}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button neutral"
            disabled={busy}
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button className="button teal" disabled={busy || !reason.trim()}>
            {busy && <span className="loading-spinner" aria-hidden="true" />}
            ส่งคำขอลา
          </button>
        </div>
      </form>
    </Modal>
  );
}
