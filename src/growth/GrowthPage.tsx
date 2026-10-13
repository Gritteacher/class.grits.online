import { useState } from "react";
import {
  ArrowUpRight,
  Coins,
  Glasses,
  History,
  LockKeyhole,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Sprout,
  Star,
  Target,
} from "lucide-react";
import { formatDate, type Room, type State } from "../model";
import { Empty } from "../ui";
import { Avatar } from "./Avatar";
import { Radar } from "./Radar";
import { AvatarForm, ObservationForm, PointsForm, ReverseForm } from "./Forms";
import {
  axes,
  effectiveAvatar,
  growthMood,
  moods,
  radar,
  wallet,
  type GrowthEvent,
  type GrowthState,
} from "./model";
import "./growth.css";

type Dialog =
  | { type: "points"; kind: "award" | "deduct" }
  | { type: "reverse"; event: GrowthEvent }
  | { type: "observe" }
  | { type: "avatar" }
  | null;
export function GrowthPage({
  state,
  teacher,
  studentId,
  onSave,
}: {
  state: State;
  teacher: boolean;
  studentId: string;
  onSave: (growth: GrowthState, message: string) => boolean;
}) {
  const { rooms, students } = state;
  const growth = state.growth!;
  const [room, setRoom] = useState<Room>(state.rooms[0]);
  const [selectedId, setSelectedId] = useState(state.students[0]?.id ?? "");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [showAll, setShowAll] = useState(false);
  const student = teacher
    ? (students.find((s) => s.id === selectedId && s.room === room) ??
      students.find((s) => s.room === room))
    : students.find((s) => s.id === studentId);
  if (!student)
    return (
      <>
        <div className="page-heading">
          <h1>การเติบโต</h1>
          <label className="select-field">
            ห้องเรียน
            <select
              aria-label="ห้องเรียนการเติบโต"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            >
              {rooms.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <Empty>ห้องนี้ยังไม่มีนักเรียน</Empty>
      </>
    );
  const current = radar(state, growth, student);
  const previous = radar(state, growth, student, Date.now(), true);
  const mood = growthMood(current, previous);
  const avatar = effectiveAvatar(growth, student.id);
  const stats = wallet(growth, student.id);
  const events = growth.events
    .filter((e) => e.studentId === student.id)
    .slice()
    .reverse();
  const reversed = new Set(
    events.filter((e) => e.reversalOf).map((e) => e.reversalOf),
  );
  const weakest = current
    .filter((a) => a.value !== null)
    .sort((a, b) => a.value! - b.value!)[0];
  const nextAxis = weakest ? axes.find((a) => a.id === weakest.id)! : axes[2];
  const nextGoal: Record<string, string> = {
    completion: "เลือกงานที่ยังค้างสักหนึ่งงาน แล้วลงมือทำทีละส่วน",
    punctuality: "วางแผนเวลาส่งงานถัดไป และเผื่อเวลาตรวจทาน",
    participation: "ลองแบ่งปันหนึ่งความคิดในกิจกรรมครั้งต่อไป",
    persistence: "เลือกคำแนะนำจากครูหนึ่งข้อ แล้วลองปรับงานดู",
    cooperation: "คุยกับเพื่อนว่าครั้งหน้าจะช่วยรับผิดชอบส่วนไหน",
    reflection: "บอกหนึ่งสิ่งที่เรียนรู้ และหนึ่งสิ่งที่จะลองครั้งหน้า",
  };
  const formProps = { student, growth, onClose: () => setDialog(null), onSave };
  return (
    <>
      <div className="page-heading growth-heading">
        <div>
          <p className="eyebrow">พื้นที่เติบโต · แยกจากคะแนนวิชา</p>
          <h1>
            {teacher ? "เห็นคุณค่าในทุกความพยายาม" : "ฉันกำลังเติบโต"}
          </h1>
          <p className="subtext">ไม่ต้องเหมือนใคร แค่ไปต่อในแบบของตัวเอง</p>
        </div>
        {teacher && (
          <div className="growth-person-picker">
            <label>
              ห้องเรียน
              <select
                aria-label="ห้องเรียนการเติบโต"
                value={room}
                onChange={(e) => {
                  const value = e.target.value as Room;
                  setRoom(value);
                  setSelectedId(
                    students.find((s) => s.room === value)?.id ?? "",
                  );
                  setShowAll(false);
                }}
              >
                {rooms.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              นักเรียน
              <select
                aria-label="นักเรียนการเติบโต"
                value={student.id}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setShowAll(false);
                }}
              >
                {students
                  .filter((s) => s.room === room)
                  .sort((a, b) => a.number - b.number)
                  .map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.number}. {s.name}
                      {s.status === "archived" ? " (พักรายชื่อ)" : ""}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}
      </div>
      <div className="growth-layout">
        <aside className="growth-identity">
          <div className="growth-avatar-stage">
            <span className="level-label">
              <Sparkles size={15} />
              ระดับ {stats.level}
            </span>
            <Avatar appearance={avatar} mood={mood} name={student.name} />
            {!teacher && (
              <button
                className="avatar-edit icon-button"
                aria-label="แต่งตัวอวตาร์"
                title="แต่งตัวอวตาร์"
                onClick={() => setDialog({ type: "avatar" })}
              >
                <Pencil size={18} />
              </button>
            )}
          </div>
          <div className="identity-name">
            <h2>{student.name}</h2>
            {student.status === "archived" && <p>พักรายชื่อไว้</p>}
            <p>
              {student.room} · เลขที่ {student.number}
            </p>
            <span className="mood-label">
              <Sprout size={14} />
              {avatar.automatic ? moods[mood].name : "สีหน้าคงที่"}
            </span>
          </div>
          <p className="mood-explanation">
            {avatar.automatic ? moods[mood].note : "นักเรียนเลือกใช้สีหน้าปกติ"}
          </p>
          <p className="mood-disclaimer">
            สีหน้าสะท้อนสถานะความก้าวหน้า
            <br />
            ไม่ใช่อารมณ์จริงของนักเรียน
          </p>
          <div className="growth-wallet">
            <span>
              <Coins size={17} />
              คะแนนเสริมแรง
            </span>
            <strong data-testid="growth-balance">{stats.balance}</strong>
            <small>ไม่รวมกับคะแนนวิชา</small>
          </div>
          <div className="xp-summary">
            <div>
              <span>ประสบการณ์สะสม</span>
              <strong data-testid="growth-xp">{stats.xp} XP</strong>
            </div>
            <div
              className="xp-track"
              role="progressbar"
              aria-label="ความก้าวหน้าระดับอวตาร์"
              aria-valuemin={0}
              aria-valuemax={50}
              aria-valuenow={stats.xp % 50}
            >
              <span style={{ width: `${stats.progress}%` }} />
            </div>
            <p>
              อีก {stats.remaining} XP ถึงระดับ {stats.level + 1}
            </p>
          </div>
          {teacher && (
            <div className="growth-point-actions">
              <button
                className="button gold"
                onClick={() => setDialog({ type: "points", kind: "award" })}
              >
                <Plus size={17} />
                เพิ่มคะแนน
              </button>
              <button
                className="button neutral"
                onClick={() => setDialog({ type: "points", kind: "deduct" })}
              >
                <Minus size={17} />
                หักคะแนน
              </button>
            </div>
          )}
          <div className="growth-reward">
            <span className="reward-icon">
              {stats.level < 2 ? <Glasses size={24} /> : <Star size={24} />}
            </span>
            <div>
              <strong>
                {stats.level < 2
                  ? "แว่นตาคู่ใหม่"
                  : stats.level < 3
                    ? "ดาวแห่งความพยายาม"
                    : "ของสะสมพร้อมแล้ว"}
              </strong>
              <small>
                {stats.level < 3 ? (
                  <>
                    <LockKeyhole size={11} />
                    ปลดล็อกระดับ {stats.level < 2 ? "2" : "3"}
                  </>
                ) : (
                  "เลือกใช้ได้ในตู้เสื้อผ้า"
                )}
              </small>
            </div>
          </div>
        </aside>
        <div className="growth-main">
          <Radar key={student.id} current={current} previous={previous} />
          <div className="next-growth-goal">
            <Target size={23} />
            <div>
              <span>ก้าวเล็ก ๆ ครั้งต่อไป · {nextAxis.name}</span>
              <p>{nextGoal[nextAxis.id]}</p>
            </div>
            {teacher && (
              <button
                className="text-link"
                onClick={() => setDialog({ type: "observe" })}
              >
                บันทึกการสังเกต
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      <section className="growth-history">
        <div className="section-title">
          <div>
            <p className="eyebrow">ทุกความพยายามมีเรื่องราว</p>
            <h2>
              <History size={21} />
              บันทึกแรงใจ
            </h2>
          </div>
          <span className="muted">{events.length} รายการ</span>
        </div>
        <div className="growth-events">
          {(showAll ? events : events.slice(0, 6)).map((event) => (
            <article
              key={event.id}
              className={`growth-event ${event.kind} ${reversed.has(event.id) ? "reversed" : ""}`}
            >
              <span className="event-symbol">
                {event.kind === "reverse" ? (
                  <RotateCcw size={18} />
                ) : event.delta > 0 ? (
                  <Plus size={20} />
                ) : (
                  <Minus size={20} />
                )}
              </span>
              <div className="grow">
                <strong>{event.reason}</strong>
                <p>
                  {event.actor} · {formatDate(event.at)}
                  {event.kind === "reverse"
                    ? " · ย้อนรายการ"
                    : reversed.has(event.id)
                      ? " · ย้อนกลับแล้ว"
                      : ""}
                </p>
              </div>
              <b className="event-delta">
                {event.delta > 0 ? "+" : ""}
                {event.delta}
              </b>
              {teacher &&
                event.kind !== "reverse" &&
                !reversed.has(event.id) && (
                  <button
                    className="icon-button"
                    aria-label={`ย้อนรายการ ${event.reason}`}
                    title="ย้อนรายการที่บันทึกผิด"
                    onClick={() => setDialog({ type: "reverse", event })}
                  >
                    <RotateCcw size={16} />
                  </button>
                )}
            </article>
          ))}
          {!events.length && (
            <p className="growth-empty">
              ยังไม่มีบันทึกแรงใจ เริ่มได้จากความพยายามเล็ก ๆ วันนี้
            </p>
          )}
        </div>
        {events.length > 6 && (
          <button className="text-link" onClick={() => setShowAll(!showAll)}>
            {showAll ? "แสดงน้อยลง" : `ดูทั้งหมด ${events.length} รายการ`}
          </button>
        )}
      </section>
      {dialog?.type === "points" && teacher && (
        <PointsForm {...formProps} kind={dialog.kind} />
      )}
      {dialog?.type === "reverse" && teacher && (
        <ReverseForm {...formProps} event={dialog.event} />
      )}
      {dialog?.type === "observe" && teacher && (
        <ObservationForm {...formProps} />
      )}
      {dialog?.type === "avatar" && !teacher && (
        <AvatarForm {...formProps} mood={mood} />
      )}
    </>
  );
}
