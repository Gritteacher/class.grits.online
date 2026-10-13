import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  Filter,
  Plus,
  Pencil,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  type Assignment,
  type Room,
  type State,
  type Submission,
  formatDate,
  studentTotal,
  grade,
} from "./model";
import { AssignmentIcon, Empty, ScoreRing, Status, TextLink } from "./ui";
import { availability, dateTime, deadline } from "./work/model";
import { assignmentGroupId, assignmentGroups } from "./work/rooms";
import { getGrade, gradePoints } from "./grading/model";

type Shared = { state: State; onOpen: (id: string) => void; onNew: () => void };
export function TeacherHome({ state, onOpen, onNew }: Shared) {
  const { rooms, students } = state;
  const pending = state.submissions.filter((s) => s.status === "pending");
  const [room, setRoom] = useState<Room | "all">("all");
  const groups = assignmentGroups(state.assignments).filter(
    (group) => room === "all" || group.some((a) => a.rooms.includes(room)),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">พฤหัสบดี 24 กันยายน · ภาคเรียน 1/2569</p>
          <h1>
            ทุกการเรียนรู้ เริ่มจากวันนี้<span className="heading-dot">.</span>
          </h1>
          <p className="subtext">สวัสดีครับ ครูไต๋</p>
        </div>
        <button className="button gold" onClick={onNew}>
          <Plus size={19} />
          มอบหมายงาน
        </button>
      </div>
      <div className="teacher-overview">
        <section className="review-callout">
          <div className="callout-top">
            <span className="mini-label">
              <ClipboardCheck size={18} />
              ถึงตาครูแล้ว
            </span>
            <span className="callout-number">
              {pending.length.toString().padStart(2, "0")}
            </span>
          </div>
          <h2>
            {pending.length
              ? "ความตั้งใจของนักเรียน\nกำลังรอคำตอบจากคุณ"
              : "งานที่ส่งมา ตรวจครบแล้ว"}
          </h2>
          <div className="callout-bottom">
            <span>
              {new Set(pending.map((s) => s.studentId)).size} คน ·{" "}
              {new Set(pending.map((s) => s.assignmentId)).size} งาน
            </span>
            <button
              className="button gold"
              disabled={!pending.length}
              onClick={() => onOpen(pending[0].assignmentId)}
            >
              เริ่มตรวจงาน
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
        <section className="overview-notes">
          <div className="section-title">
            <h2>ห้องเรียนของคุณ</h2>
            <span className="muted">
              {rooms.length} ห้อง ·{" "}
              {students.filter((s) => s.status === "active").length} คน
            </span>
          </div>
          {rooms.map((r, i) => {
            const count = pending.filter(
              (s) => students.find((st) => st.id === s.studentId)?.room === r,
            ).length;
            return (
              <button
                className="class-row"
                key={r}
                onClick={() => setRoom(room === r ? "all" : r)}
                aria-pressed={room === r}
              >
                <span className={`room-tile room-${i % 3}`}>
                  {r.replace("ม.", "")}
                </span>
                <span className="grow">
                  <strong>เศรษฐศาสตร์</strong>
                  <span className="muted">
                    {r} ·{" "}
                    {
                      students.filter(
                        (s) => s.room === r && s.status === "active",
                      ).length
                    }{" "}
                    คน
                  </span>
                </span>
                <span className="class-count">
                  {count ? `${count} รอตรวจ` : "ตรวจครบแล้ว"}
                </span>
                <ChevronRight size={17} />
              </button>
            );
          })}
        </section>
      </div>
      <div className="section-title spaced">
        <div>
          <span className="eyebrow">พื้นที่การเรียนรู้</span>
          <h2>งานที่กำลังเดินทาง</h2>
        </div>
        <div className="room-chips" aria-label="กรองงานตามห้อง">
          <button
            className={room === "all" ? "active" : ""}
            onClick={() => setRoom("all")}
          >
            ทุกห้อง
          </button>
          {rooms.map((r) => (
            <button
              key={r}
              className={room === r ? "active" : ""}
              onClick={() => setRoom(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="assignment-grid">
        {groups.map((group) => {
          const a =
            (room !== "all" &&
              group.find((item) => item.rooms.includes(room))) ||
            group[0];
          const groupRooms = group.map((item) => item.rooms[0]);
          const groupIds = new Set(group.map((item) => item.id));
          const assignedCount = students.filter(
            (s) => groupRooms.includes(s.room) && s.status === "active",
          ).length;
          const all = state.submissions.filter((s) =>
            groupIds.has(s.assignmentId),
          );
          const activeSubmitted = students.filter((student) => {
            if (student.status !== "active") return false;
            const roomAssignment = group.find((item) =>
              item.rooms.includes(student.room),
            );
            if (!roomAssignment) return false;
            return roomAssignment.submissionRequired === false
              ? !!getGrade(state, student.id, roomAssignment.id)
              : all.some((submission) => submission.studentId === student.id);
          }).length;
          const waiting = all.filter((s) => s.status === "pending").length;
          const methods = new Set(
            group.map((item) => item.submissionRequired !== false),
          );
          return (
            <button
              className={`assignment-card ${a.color}`}
              onClick={() => onOpen(a.id)}
              key={assignmentGroupId(a)}
            >
              <div className="card-top">
                <AssignmentIcon assignment={a} />
                <span className="category">{a.category}</span>
              </div>
              <h3>{a.title}</h3>
              <p>{groupRooms.join(" · ")}</p>
              <div className="submission-meter">
                <span>
                  {methods.size > 1
                    ? "บันทึกแล้ว"
                    : a.submissionRequired === false
                      ? "มีคะแนน"
                      : "ส่งแล้ว"}{" "}
                  <strong>
                    {activeSubmitted}/{assignedCount}
                  </strong>
                </span>
                <span>
                  {methods.size > 1
                    ? `${waiting} รอตรวจ`
                    : a.submissionRequired === false
                      ? "ครูบันทึก"
                      : `${waiting} รอตรวจ`}
                </span>
              </div>
              <div className="meter">
                <span
                  style={{
                    width: `${assignedCount ? (activeSubmitted / assignedCount) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="card-footer">
                <span>
                  <Clock3 size={14} />
                  {new Set(group.map((item) => item.due)).size === 1
                    ? formatDate(a.due)
                    : "กำหนดส่งต่างกัน"}
                </span>
                <span>
                  เปิดพื้นที่งาน
                  <ArrowRight size={16} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="teacher-footer-note">
        <span className="note-symbol">
          <CheckCheck size={21} />
        </span>
        <div>
          <strong>ทีละงาน ทีละก้าว</strong>
          <p>
            วันนี้ตรวจแล้ว{" "}
            {state.submissions.filter((s) => s.status === "reviewed").length}{" "}
            รายการ
          </p>
        </div>
        <TextLink
          onClick={() =>
            state.assignments[0] ? onOpen(state.assignments[0].id) : onNew()
          }
        >
          ไปที่พื้นที่งาน
        </TextLink>
      </div>
    </>
  );
}

export function Workspace({
  state,
  activeId,
  setActiveId,
  onNew,
  onPreview,
  onReview,
  onEdit,
  onDelete,
  onReturn,
  onGrades,
  now,
}: {
  state: State;
  activeId: string;
  setActiveId: (id: string) => void;
  onNew: () => void;
  onPreview: (s: Submission) => void;
  onEdit: (a: Assignment) => void;
  onDelete: (a: Assignment) => void;
  onReturn: (s: Submission) => void;
  onGrades: () => void;
  now: number;
  onReview: (
    ids: string[],
    scores: Record<string, string>,
    feedback: string,
  ) => boolean;
}) {
  const { rooms, students } = state;
  const [room, setRoom] = useState<Room | "all">("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<
    "pending" | "reviewed" | "returned" | "missing"
  >("pending");
  const [selected, setSelected] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const groups = assignmentGroups(state.assignments).filter(
    (group) =>
      (room === "all" || group.some((a) => a.rooms.includes(room))) &&
      group.some((a) =>
        a.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      ),
  );
  const assignments = groups.map(
    (group) =>
      (room !== "all" && group.find((a) => a.rooms.includes(room))) ||
      group.find((a) => a.id === activeId) ||
      group[0],
  );
  const activeGroup = groups.find((group) =>
    group.some((a) => a.id === activeId),
  );
  const assignment = activeGroup
    ? (room !== "all" && activeGroup.find((a) => a.rooms.includes(room))) ||
      activeGroup.find((a) => a.id === activeId) ||
      activeGroup[0]
    : assignments[0];
  const audience = students.filter(
    (s) =>
      assignment?.rooms.includes(s.room) && (room === "all" || s.room === room),
  );
  const relevant = state.submissions.filter(
    (s) =>
      s.assignmentId === assignment?.id &&
      audience.some((student) => student.id === s.studentId),
  );
  const visible = relevant.filter((s) => s.status === tab);
  const missing = audience.filter(
    (s) =>
      assignment?.submissionRequired !== false &&
      s.status === "active" &&
      !relevant.some((r) => r.studentId === s.id),
  );
  const selectedVisible = selected.filter((id) =>
    visible.some((s) => s.id === id),
  );
  function selectAssignment(id: string) {
    setActiveId(id);
    setSelected([]);
    setScores({});
    setFeedback("");
  }
  function changeRoom(value: Room | "all") {
    setRoom(value);
    setSelected([]);
    if (value === "all") return;
    const current = state.assignments.find((a) => a.id === activeId);
    const sibling = current
      ? state.assignments.find(
          (a) =>
            assignmentGroupId(a) === assignmentGroupId(current) &&
            a.rooms.includes(value),
        )
      : undefined;
    const next =
      sibling ?? state.assignments.find((a) => a.rooms.includes(value));
    if (next) selectAssignment(next.id);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">มอบหมาย · รับงาน · ให้คำตอบ</p>
          <h1>
            พื้นที่งาน<span className="heading-dot">.</span>
          </h1>
        </div>
        <button className="button gold" onClick={onNew}>
          <Plus size={18} />
          มอบหมายงาน
        </button>
      </div>
      <div className="workbench">
        <aside className="work-list">
          <div className="work-list-filters">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="ค้นหางาน"
                placeholder="ค้นหางาน..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="select-field">
              <Filter size={16} />
              <select
                value={room}
                onChange={(e) => changeRoom(e.target.value as Room | "all")}
                aria-label="ห้องเรียนในพื้นที่งาน"
              >
                <option value="all">ทุกห้องเรียน</option>
                {rooms.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="list-caption">
            กลุ่มงานทั้งหมด <span>{assignments.length}</span>
          </div>
          <div className="assignment-list">
            {assignments.map((a) => {
              const groupIds = new Set(
                state.assignments
                  .filter(
                    (item) =>
                      assignmentGroupId(item) === assignmentGroupId(a) &&
                      (room === "all" || item.rooms.includes(room)),
                  )
                  .map((item) => item.id),
              );
              const count = state.submissions.filter(
                (s) =>
                  groupIds.has(s.assignmentId) &&
                  s.status === "pending" &&
                  (room === "all" ||
                    students.find((st) => st.id === s.studentId)?.room ===
                      room),
              ).length;
              return (
                <button
                  className={`work-list-item ${a.id === assignment?.id ? "active" : ""}`}
                  key={a.id}
                  onClick={() => selectAssignment(a.id)}
                  aria-pressed={a.id === assignment?.id}
                >
                  <AssignmentIcon assignment={a} small />
                  <span className="grow">
                    <strong>{a.title}</strong>
                    <small>
                      {a.category} · {a.finalMax} คะแนน
                      {room === "all" && groupIds.size > 1
                        ? ` · ${groupIds.size} ห้อง`
                        : ""}
                    </small>
                  </span>
                  {count > 0 && <span className="count-badge">{count}</span>}
                </button>
              );
            })}
            {!assignments.length && <Empty>ไม่พบงานที่ค้นหา</Empty>}
          </div>
        </aside>
        {assignment ? (
          <section className="work-detail" aria-label="รายละเอียดงาน">
            <div className="detail-title">
              <AssignmentIcon assignment={assignment} />
              <div>
                <p className="eyebrow">
                  {assignment.category} · ส่งภายใน {formatDate(assignment.due)}
                </p>
                <h2>{assignment.title}</h2>
              </div>
              <span className="max-score">
                <strong>{assignment.finalMax}</strong>คะแนนเก็บ
              </span>
            </div>
            <p className="assignment-description">{assignment.description}</p>
            <div className="work-detail-actions">
              <span className="work-window">
                {availability(assignment, now).label} · กำหนดส่ง{" "}
                {dateTime(deadline(assignment))}
              </span>
              <button
                className="button neutral"
                onClick={() => onEdit(assignment)}
              >
                <Pencil size={16} />
                แก้ไขงาน
              </button>
              <button
                className="button neutral"
                onClick={() => onDelete(assignment)}
                aria-label={`ลบงาน ${assignment.title}`}
              >
                ลบงาน
              </button>
            </div>
            <div className="assignment-metadata">
              <span>
                <Users size={16} />
                {assignment.rooms[0]}
              </span>
              <span>
                ดิบ {assignment.rawMax} → เก็บ {assignment.finalMax}
              </span>
            </div>
            {assignment.submissionRequired === false && (
              <div className="score-only-callout">
                <p>งานนี้บันทึกคะแนนโดยครู ไม่รับงานส่งบนเว็บ</p>
                <button className="button teal" onClick={onGrades}>
                  <Pencil size={17} />
                  ไปกรอกคะแนน
                </button>
              </div>
            )}
            <div
              className="review-tabs"
              role="tablist"
              aria-label="สถานะงาน"
              hidden={assignment.submissionRequired === false}
            >
              {(["pending", "reviewed", "returned", "missing"] as const).map(
                (t) => (
                  <button
                    role="tab"
                    aria-selected={tab === t}
                    key={t}
                    onClick={() => {
                      setTab(t);
                      setSelected([]);
                    }}
                    className={tab === t ? "active" : ""}
                  >
                    {t === "pending"
                      ? "รอตรวจ"
                      : t === "reviewed"
                        ? "ตรวจแล้ว"
                        : t === "returned"
                          ? "ส่งกลับแก้ไข"
                          : "ยังไม่ส่ง"}
                    <span>
                      {t === "missing"
                        ? missing.length
                        : relevant.filter((s) => s.status === t).length}
                    </span>
                  </button>
                ),
              )}
            </div>
            <div
              className="review-content"
              hidden={assignment.submissionRequired === false}
            >
              {tab === "pending" && visible.length > 0 && (
                <div className="selection-toolbar">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      aria-label="เลือกงานรอตรวจทั้งหมด"
                      checked={selectedVisible.length === visible.length}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? visible.map((s) => s.id) : [],
                        )
                      }
                    />
                    เลือกทั้งหมด
                  </label>
                  <span>คะแนนดิบ / {assignment.rawMax}</span>
                </div>
              )}
              {visible.map((s) => {
                const student = students.find((st) => st.id === s.studentId)!;
                const entry = getGrade(state, s.studentId, assignment.id);
                return (
                  <div
                    className={`review-row ${selectedVisible.includes(s.id) ? "selected" : ""}`}
                    key={s.id}
                  >
                    {tab === "pending" ? (
                      <input
                        type="checkbox"
                        aria-label={`เลือกงานของ ${student.name}`}
                        checked={selectedVisible.includes(s.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, s.id]
                              : selected.filter((id) => id !== s.id),
                          )
                        }
                      />
                    ) : (
                      <span className="reviewed-check">
                        <Check size={18} />
                      </span>
                    )}
                    <div className="student-info">
                      <strong>{student.name}</strong>
                      <small>
                        {student.room} · เลขที่ {student.number} ·{" "}
                        {formatDate(s.submittedAt)}
                      </small>
                      <small>
                        ฉบับที่ {s.revision ?? 1}
                        {s.status !== "reviewed" && entry
                          ? ` · คงคะแนนเดิม ${gradePoints(entry, assignment)}/${assignment.finalMax}`
                          : ""}
                      </small>
                    </div>
                    <div className="work-row-actions">
                      <button
                        className="icon-button preview-button"
                        onClick={() => onPreview(s)}
                        aria-label={`ดูงาน ${student.name}`}
                        title="ดูงานที่ส่ง"
                      >
                        <Eye size={19} />
                      </button>
                      <button
                        className="icon-button"
                        title={
                          s.status === "returned"
                            ? "ปรับเวลาแก้ไข"
                            : "ส่งกลับให้แก้ไข"
                        }
                        aria-label={`ส่งกลับแก้ไข ${student.name}`}
                        onClick={() => onReturn(s)}
                      >
                        <RotateCcw size={18} />
                      </button>
                    </div>
                    {tab === "pending" ? (
                      <input
                        className="score-input"
                        type="number"
                        min="0"
                        max={assignment.rawMax}
                        step="0.5"
                        placeholder="—"
                        aria-label={`คะแนน ${student.name}`}
                        value={scores[s.id] ?? ""}
                        onChange={(e) => {
                          setScores({ ...scores, [s.id]: e.target.value });
                          if (!selected.includes(s.id))
                            setSelected([...selected, s.id]);
                        }}
                      />
                    ) : (
                      <span className="reviewed-score">
                        {entry ? gradePoints(entry, assignment) : "—"}
                        <small>/{assignment.finalMax}</small>
                      </span>
                    )}
                  </div>
                );
              })}
              {tab === "missing" &&
                missing.map((s) => (
                  <div className="review-row missing-row" key={s.id}>
                    <Clock3 size={20} />
                    <div className="student-info">
                      <strong>{s.name}</strong>
                      <small>
                        {s.room} · เลขที่ {s.number}
                      </small>
                    </div>
                    <Status status="missing" />
                  </div>
                ))}
              {(tab === "missing"
                ? missing.length === 0
                : visible.length === 0) && (
                <Empty>
                  {tab === "pending"
                    ? "ตรวจครบแล้ว ขอบคุณที่ใส่ใจทุกการเรียนรู้ครับ"
                    : tab === "reviewed"
                      ? "ยังไม่มีผลตรวจในห้องนี้"
                      : tab === "returned"
                        ? "ยังไม่มีงานที่ส่งกลับแก้ไข"
                        : "นักเรียนส่งงานครบแล้ว"}
                </Empty>
              )}
            </div>
            {tab === "pending" && selectedVisible.length > 0 && (
              <div className="grading-dock">
                <div className="dock-top">
                  <strong>เลือก {selectedVisible.length} รายการ</strong>
                  <button
                    className="text-link"
                    onClick={() => {
                      const next = { ...scores };
                      selectedVisible.forEach((id) => {
                        next[id] = String(assignment.rawMax);
                      });
                      setScores(next);
                    }}
                  >
                    <CheckCheck size={17} />
                    ให้คะแนนเต็ม
                  </button>
                  <button
                    className="icon-button small-icon"
                    onClick={() => setSelected([])}
                    aria-label="ยกเลิกการเลือก"
                    title="ยกเลิกการเลือก"
                  >
                    <X size={17} />
                  </button>
                </div>
                <label className="feedback-field">
                  <span>
                    ข้อความถึงนักเรียน <small>(ไม่บังคับ)</small>
                  </span>
                  <textarea
                    rows={2}
                    placeholder="มีอะไรอยากบอกนักเรียนไหมครับ"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </label>
                <button
                  className="button teal dock-save"
                  onClick={() => {
                    if (onReview(selectedVisible, scores, feedback)) {
                      setSelected([]);
                      setScores({});
                      setFeedback("");
                    }
                  }}
                >
                  <Check size={18} />
                  บันทึกและส่งคะแนน {selectedVisible.length} คน
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="work-detail" aria-label="รายละเอียดงาน">
            <Empty>
              {query
                ? "ไม่พบงานที่ค้นหาในห้องนี้"
                : "ยังไม่มีงานที่มอบหมายให้ห้องนี้"}
            </Empty>
          </section>
        )}
      </div>
    </>
  );
}

export function Results({
  state,
  studentOnly = false,
  studentId,
  onEditGrade,
}: {
  state: State;
  studentOnly?: boolean;
  studentId?: string;
  onEditGrade?: (studentId: string, assignmentId: string) => void;
}) {
  const { rooms, students } = state;
  const [room, setRoom] = useState<Room>(state.rooms[0]);
  const person = students.find((s) => s.id === studentId) ?? students[0];
  const total = studentTotal(state, person);
  const assignments = state.assignments.filter((a) =>
    a.rooms.includes(studentOnly ? person.room : room),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">เศรษฐศาสตร์ · ภาคเรียน 1/2569</p>
          <h1>
            {studentOnly ? "ทุกก้าวของการเรียนรู้" : "มองเห็นความก้าวหน้า"}
            <span className="heading-dot">.</span>
          </h1>
        </div>
        {!studentOnly && (
          <label className="select-field">
            <Users size={18} />
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value as Room)}
              aria-label="ห้องเรียนตารางคะแนน"
            >
              {rooms.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {studentOnly ? (
        <>
          <div className="student-score-summary">
            <ScoreRing value={total.earned} max={total.max} />
            <div>
              <p className="eyebrow">คะแนนสะสมของ{person.name.split(" ")[0]}</p>
              <h2>
                {total.earned} จาก {total.max} คะแนน
              </h2>
              <p>เกรดปัจจุบัน {grade(total.earned, total.max)}</p>
            </div>
          </div>
          <div className="score-list">
            {assignments.map((a) => {
              const entry = getGrade(state, person.id, a.id);
              const s = state.submissions.find(
                (item) =>
                  item.assignmentId === a.id && item.studentId === person.id,
              );
              return (
                <div className="score-list-row" key={a.id}>
                  <AssignmentIcon assignment={a} small />
                  <div className="grow">
                    <strong>{a.title}</strong>
                    <small>{entry?.note || s?.feedback || a.category}</small>
                  </div>
                  {entry?.source === "manual" ||
                  a.submissionRequired === false ? (
                    <span className="grade-source">
                      {entry ? "กรอกโดยครู" : "รอบันทึกคะแนน"}
                    </span>
                  ) : (
                    <Status status={s?.status ?? "missing"} />
                  )}
                  <strong className="score-value">
                    {entry ? gradePoints(entry, a) : "—"}
                    <small> / {a.finalMax}</small>
                  </strong>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="table-meta">
            <span>
              {students.filter((s) => s.room === room).length} คน ·{" "}
              {assignments.length} งาน
            </span>
            <strong>
              คะแนนเต็ม {assignments.reduce((sum, a) => sum + a.finalMax, 0)}
            </strong>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>นักเรียน</th>
                  {assignments.map((a, i) => (
                    <th key={a.id}>
                      <span className="table-work-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {a.title}
                      <small>เต็ม {a.finalMax}</small>
                    </th>
                  ))}
                  <th>รวม</th>
                  <th>เกรดปัจจุบัน</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .filter((s) => s.room === room)
                  .sort((a, b) => a.number - b.number)
                  .map((st) => {
                    const totals = studentTotal(state, st);
                    return (
                      <tr key={st.id}>
                        <th>
                          <small>เลขที่ {st.number}</small>
                          {st.name}
                          {st.status === "archived" && (
                            <small>พักรายชื่อไว้</small>
                          )}
                        </th>
                        {assignments.map((a) => {
                          const entry = getGrade(state, st.id, a.id);
                          const s = state.submissions.find(
                            (item) =>
                              item.studentId === st.id &&
                              item.assignmentId === a.id,
                          );
                          return (
                            <td key={a.id} className={entry ? "has-grade" : ""}>
                              {entry ? (
                                <>
                                  {gradePoints(entry, a)}
                                  {entry.source === "manual" && (
                                    <small>กรอกโดยครู</small>
                                  )}
                                  {entry.source === "review" &&
                                    s &&
                                    s.status !== "reviewed" && (
                                      <small>
                                        คะแนนเดิม ·{" "}
                                        {s.status === "returned"
                                          ? "รอแก้ไข"
                                          : "รอตรวจใหม่"}
                                      </small>
                                    )}
                                </>
                              ) : (
                                <span className="muted">
                                  {s
                                    ? s.status === "returned"
                                      ? "รอแก้ไข"
                                      : "รอตรวจ"
                                    : a.submissionRequired === false
                                      ? "รอบันทึก"
                                      : "—"}
                                </span>
                              )}
                              {onEditGrade && st.status === "active" && (
                                <button
                                  className="grade-edit-button"
                                  title={`แก้คะแนน ${st.name} · ${a.title}`}
                                  aria-label={`แก้คะแนน ${st.name} · ${a.title}`}
                                  onClick={() => onEditGrade(st.id, a.id)}
                                >
                                  <Pencil size={15} />
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <strong>
                            {totals.earned}/{totals.max}
                          </strong>
                        </td>
                        <td>{grade(totals.earned, totals.max)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
