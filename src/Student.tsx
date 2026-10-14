import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Megaphone,
  Send,
  Sparkles,
} from "lucide-react";
import { AssignmentIcon, Empty, ScoreRing, Status, TextLink } from "./ui";
import {
  type Assignment,
  type State,
  type Submission,
  type Student,
  formatDate,
  studentTotal,
} from "./model";
import { availability, dateTime, deadline } from "./work/model";
import { getGrade, gradePoints } from "./grading/model";
import { FilePreview } from "./components/FilePreview";

export function StudentHome({
  student,
  state,
  onSubmit,
  onPreview,
  onScores,
  tasksOnly = false,
  now,
}: {
  student: Student;
  state: State;
  onSubmit: (a: Assignment) => void;
  onPreview: (s: Submission) => void;
  onScores: () => void;
  tasksOnly?: boolean;
  now: number;
}) {
  const mine = state.assignments.filter((a) => a.rooms.includes(student.room));
  const submitted = state.submissions.filter((s) => s.studentId === student.id);
  const toDo = mine.filter(
    (a) =>
      a.submissionRequired !== false &&
      !submitted.some(
        (s) => s.assignmentId === a.id && s.status !== "returned",
      ),
  );
  const next =
    toDo.find(
      (a) =>
        availability(
          a,
          now,
          submitted.find((s) => s.assignmentId === a.id),
        ).allowed,
    ) ?? toDo[0];
  const total = studentTotal(state, student);
  const latestAnnouncement = (state.announcements ?? []).find(
    (announcement) => announcement.room === student.room,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {student.room} · {state.roomSubjects?.[student.room] ?? student.subject ?? "สังคมศึกษา"} · ภาคเรียน 1/2569
          </p>
          <h1>
            {tasksOnly
              ? "พื้นที่ลงมือทำ"
              : `ยินดีต้อนรับ ${student.name.split(" ")[0]}`}
          </h1>
          <p className="subtext">
            {tasksOnly
              ? `งานของ${student.name}`
              : "วันนี้มีอะไรให้เรียนรู้อีกเยอะเลย"}
          </p>
        </div>
        <span className="student-name-tag">
          <Sparkles size={18} />
          {student.name}
        </span>
      </div>
      {student.status === "archived" && (
        <p className="form-error" role="status">
          รายชื่อนี้ถูกพักไว้ ดูงานและคะแนนเดิมได้ แต่ยังส่งงานใหม่ไม่ได้
        </p>
      )}
      {!tasksOnly && (
        <div className="student-overview">
          <section className="student-next">
            <span className="mini-label">
              <Send size={17} />
              ก้าวต่อไปของคุณ
            </span>
            <h2>{next?.title ?? "ส่งงานครบแล้ว เก่งมากครับ"}</h2>
            <p>
              {next
                ? availability(
                    next,
                    now,
                    submitted.find((s) => s.assignmentId === next.id),
                  ).label
                : "แวะดูผลตรวจและข้อความจากครูได้เลย"}
            </p>
            <button
              className="button gold"
              disabled={
                !!next &&
                (student.status === "archived" ||
                  !availability(
                    next,
                    now,
                    submitted.find((s) => s.assignmentId === next.id),
                  ).allowed)
              }
              onClick={() => (next ? onSubmit(next) : onScores())}
            >
              {next ? "ลงมือทำ" : "ดูผลการเรียนรู้"}
              <ArrowRight size={18} />
            </button>
          </section>
          <section className="student-progress">
            <div>
              <span className="eyebrow">ทุกคะแนนมีความหมาย</span>
              <h2>ความก้าวหน้าของฉัน</h2>
              <p>
                ตรวจแล้ว{" "}
                {submitted.filter((s) => s.status === "reviewed").length} จาก{" "}
                {mine.length} งาน
              </p>
              <TextLink onClick={onScores}>ดูคะแนนแต่ละงาน</TextLink>
            </div>
            <ScoreRing value={total.earned} max={total.max} />
          </section>
        </div>
      )}
      <div className={`student-content ${tasksOnly ? "full" : ""}`}>
        <section>
          <div className="section-title">
            <h2>งานของฉัน</h2>
            <span className="muted">{toDo.length} งานที่ต้องทำหรือแก้ไข</span>
          </div>
          <div className="student-task-list">
            {mine.map((a) => {
              const entry = getGrade(state, student.id, a.id);
              const s = submitted.find((item) => item.assignmentId === a.id);
              const window = availability(a, now, s);
              return (
                <article className="student-task" key={a.id}>
                  <AssignmentIcon assignment={a} />
                  <div className="student-task-body">
                    <div className="task-labels">
                      <span className="category">{a.category}</span>
                      {a.submissionRequired === false ? (
                        <span className="grade-source">ครูบันทึกคะแนน</span>
                      ) : (
                        <Status status={s?.status ?? "missing"} />
                      )}
                    </div>
                    <h3>{a.title}</h3>
                    {a.submissionRequired !== false && (
                      <span className="task-date">
                        <Clock3 size={14} />
                        ส่งภายใน {dateTime(deadline(a))}
                      </span>
                    )}
                    {(!s || s.status === "returned") && (
                      <p className="work-window">{window.label}</p>
                    )}
                    {s?.status === "returned" && (
                      <p className="teacher-feedback">{s.revisionNote}</p>
                    )}
                    {s?.file && <FilePreview file={s.file} onOpen={() => onPreview(s)} />}
                    {entry && (!s || s.status !== "reviewed") && (
                      <p className="work-window">
                        คะแนนปัจจุบัน {gradePoints(entry, a)}/{a.finalMax}{" "}
                        {entry.source === "manual"
                          ? "· กรอกโดยครู"
                          : "· คงคะแนนเดิมจนกว่าครูตรวจใหม่"}
                      </p>
                    )}
                    {s?.status === "reviewed" && (
                      <p className="teacher-feedback">
                        {s.feedback || "ครูบันทึกคะแนนแล้วครับ"}
                      </p>
                    )}
                  </div>
                  {a.submissionRequired === false ? (
                    <strong className="score-value">
                      {entry ? gradePoints(entry, a) : "—"}
                      <small>/{a.finalMax}</small>
                    </strong>
                  ) : s ? (
                    <div className="revision-actions">
                      <button
                        className={`task-action ${s.status === "reviewed" ? "complete" : ""}`}
                        onClick={() => onPreview(s)}
                      >
                        {s.status === "reviewed" ? (
                          <>
                            <strong>
                              {entry ? gradePoints(entry, a) : "—"}
                              <small>/{a.finalMax}</small>
                            </strong>
                            <span>
                              ดูผลตรวจ
                              <ArrowUpRight size={13} />
                            </span>
                          </>
                        ) : (
                          <>
                            <Check size={20} />
                            <span>ดูงานที่ส่ง</span>
                          </>
                        )}
                      </button>
                      {s.status === "returned" && (
                        <button
                          className="button coral"
                          disabled={
                            !window.allowed || student.status === "archived"
                          }
                          onClick={() => onSubmit(a)}
                        >
                          แก้ไขและส่งใหม่
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      className="button teal"
                      disabled={
                        student.status === "archived" || !window.allowed
                      }
                      onClick={() => onSubmit(a)}
                    >
                      ส่งงาน
                      <ArrowRight size={17} />
                    </button>
                  )}
                </article>
              );
            })}
            {!mine.length && <Empty>ยังไม่มีงานที่ได้รับมอบหมาย</Empty>}
          </div>
        </section>
        {!tasksOnly && latestAnnouncement && (
          <aside className="student-aside">
            <section className="announcement">
              <span className="announcement-icon">
                <Megaphone size={23} />
              </span>
              <p className="eyebrow">ประกาศจากครู</p>
              <h3>{latestAnnouncement.title}</h3>
              <p>{latestAnnouncement.body}</p>
              <span className="announcement-sign">
                เผยแพร่เมื่อ {new Date(latestAnnouncement.publishedAt).toLocaleDateString("th-TH")}
              </span>
            </section>
            <div className="small-reminder">
              <span className="reminder-line" />
              <p>
                ความก้าวหน้า
                <br />
                <strong>เริ่มจากการลองทำ</strong>
              </p>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
