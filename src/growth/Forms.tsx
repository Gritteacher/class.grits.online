import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  Glasses,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  Star,
} from "lucide-react";
import { Modal } from "../ui";
import type { Student } from "../model";
import { Avatar } from "./Avatar";
import {
  addObservation,
  addPoints,
  axes,
  backdrops,
  effectiveAvatar,
  reversePoints,
  saveAvatar,
  shirts,
  skins,
  wallet,
  type GrowthEvent,
  type GrowthState,
  type Mood,
  type RubricAxis,
} from "./model";

type FormProps = {
  student: Student;
  growth: GrowthState;
  onClose: () => void;
  onSave: (next: GrowthState, message: string) => boolean;
};
const persistenceError =
  "ยังบันทึกในเครื่องไม่ได้ ข้อมูลเดิมไม่เปลี่ยน กรุณาลองอีกครั้ง";
export function PointsForm({
  student,
  growth,
  kind,
  onClose,
  onSave,
}: FormProps & { kind: "award" | "deduct" }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const isAward = kind === "award";
  const balance = wallet(growth, student.id).balance;
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const next = addPoints(growth, student.id, kind, Number(amount), reason);
      if (!isAward && !confirm) {
        setConfirm(true);
        return;
      }
      if (
        onSave(
          next,
          isAward ? "เพิ่มคะแนนเสริมแรงแล้ว" : "บันทึกการหักคะแนนแล้ว",
        )
      )
        onClose();
      else setError(persistenceError);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่ได้");
    }
  }
  return (
    <Modal
      title={
        isAward
          ? "เติมแรงใจอีกนิด"
          : confirm
            ? "ยืนยันการหักคะแนน"
            : "บันทึกตามข้อตกลง"
      }
      subtitle={`${student.name} · ${student.room}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          {confirm ? (
            <>
              <div className="point-change-confirm">
                <span>คะแนนเสริมแรง</span>
                <strong>
                  {balance} <span>→</span> {balance - Number(amount)}
                </strong>
                <p>หัก {amount} คะแนน · XP ไม่ลด</p>
              </div>
              <p className="confirm-reason">{reason}</p>
              <p className="growth-policy">คะแนนวิชาและเกรดไม่เปลี่ยน</p>
            </>
          ) : (
            <>
              <label>
                จำนวนคะแนน
                <input
                  autoFocus
                  required
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="เช่น 5"
                />
              </label>
              <label>
                {isAward ? "เหตุผลที่ชื่นชม" : "เหตุผลและสิ่งที่ปรับปรุงได้"}
                <textarea
                  required
                  maxLength={500}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    isAward
                      ? "วันนี้นักเรียนทำสิ่งดี ๆ อะไรบ้าง"
                      : "ระบุข้อตกลงและสิ่งที่นักเรียนทำเพื่อปรับปรุงได้"
                  }
                />
              </label>
              <p className="growth-policy">
                มี {balance} คะแนนเสริมแรง · แยกจากคะแนนวิชา
              </p>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="button neutral"
            onClick={() => (confirm ? setConfirm(false) : onClose())}
          >
            {confirm ? (
              <>
                <ArrowLeft size={16} />
                กลับไปแก้
              </>
            ) : (
              "ยกเลิก"
            )}
          </button>
          <button
            type="submit"
            className={`button ${isAward ? "gold" : "coral"}`}
          >
            {isAward ? <Plus size={17} /> : <Minus size={17} />}{" "}
            {isAward
              ? "บันทึกเพิ่มคะแนน"
              : confirm
                ? `ยืนยันหัก ${amount} คะแนน`
                : "ตรวจสอบก่อนหัก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ReverseForm({
  student,
  growth,
  event,
  onClose,
  onSave,
}: FormProps & { event: GrowthEvent }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const next = reversePoints(growth, event.id, reason);
      if (onSave(next, "ย้อนรายการแล้ว ประวัติเดิมยังอยู่")) onClose();
      else setError(persistenceError);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ย้อนรายการไม่สำเร็จ");
    }
  }
  return (
    <Modal
      title="ย้อนรายการที่บันทึกผิด"
      subtitle={student.name}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          <p>{event.reason}</p>
          <div className="point-change-confirm">
            <span>
              ย้อน {event.delta > 0 ? "+" : ""}
              {event.delta} คะแนน
            </span>
            <strong>
              {wallet(growth, student.id).balance} →{" "}
              {wallet(growth, student.id).balance - event.delta}
            </strong>
          </div>
          <p className="growth-policy">
            เพิ่มหลักฐานแก้ไขโดยไม่ลบรายการเดิม หากย้อนรายการเพิ่มคะแนน XP
            ของรายการนั้นจะถูกคืนด้วย
          </p>
          <label>
            เหตุผลที่แก้ไข
            <textarea
              required
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="button neutral" type="button" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="button coral" type="submit">
            <RotateCcw size={17} />
            ยืนยันย้อนรายการ
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ObservationForm({
  student,
  growth,
  onClose,
  onSave,
}: FormProps) {
  const [axis, setAxis] = useState<RubricAxis>("participation");
  const [rating, setRating] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (rating === "") throw new Error("เลือกระดับที่สังเกตได้ก่อน");
      const next = addObservation(
        growth,
        student.id,
        axis,
        Number(rating),
        note,
      );
      if (onSave(next, "บันทึกหลักฐานพัฒนาการแล้ว")) onClose();
      else setError(persistenceError);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่ได้");
    }
  }
  return (
    <Modal
      title="เห็นความพยายาม บันทึกไว้"
      subtitle={`${student.name} · การสังเกตของครู`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          <label>
            ด้านที่สังเกต
            <select
              value={axis}
              onChange={(e) => setAxis(e.target.value as RubricAxis)}
            >
              {axes.slice(2).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <p className="growth-policy">
            {axes.find((a) => a.id === axis)?.description}
          </p>
          <label>
            ระดับที่สังเกตได้
            <select
              required
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="">เลือกระดับ</option>
              <option value="0">0 · ยังไม่แสดงพฤติกรรม แม้ได้รับโอกาส</option>
              <option value="1">1 · ทำได้เมื่อครูช่วยอย่างใกล้ชิด</option>
              <option value="2">2 · ทำได้เมื่อมีคำแนะนำบางส่วน</option>
              <option value="3">3 · ทำได้ด้วยตนเอง</option>
              <option value="4">
                4 · ทำได้ด้วยตนเองและอธิบายให้ผู้อื่นได้
              </option>
            </select>
          </label>
          <label>
            หลักฐานจากกิจกรรม
            <textarea
              required
              maxLength={500}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เกิดอะไรขึ้น ในกิจกรรมไหน"
            />
          </label>
          <p className="growth-policy">
            บันทึกเฉพาะเมื่อมีโอกาสสังเกต · อย่างน้อย 3
            บันทึกต่อด้านจึงคำนวณกราฟ · ไม่เพิ่มหรือหักคะแนนเสริมแรง
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="button neutral" type="button" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="button teal" type="submit">
            <Check size={17} />
            บันทึกการสังเกต
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function AvatarForm({
  student,
  growth,
  mood,
  onClose,
  onSave,
}: FormProps & { mood: Mood }) {
  const [avatar, setAvatar] = useState(() =>
    effectiveAvatar(growth, student.id),
  );
  const [error, setError] = useState("");
  const level = wallet(growth, student.id).level;
  return (
    <Modal
      title="ตัวฉัน ในแบบของฉัน"
      subtitle="แต่งตัวอวตาร์"
      onClose={onClose}
    >
      <div className="modal-body avatar-editor">
        <Avatar appearance={avatar} mood={mood} name={student.name} />
        <div className="avatar-options">
          <fieldset>
            <legend>สีผิว</legend>
            <div className="color-swatches">
              {skins.map((color, i) => (
                <button
                  key={color}
                  type="button"
                  style={{ backgroundColor: color }}
                  aria-label={`สีผิว ${i + 1}`}
                  title={`สีผิว ${i + 1}`}
                  aria-pressed={avatar.skin === color}
                  onClick={() => setAvatar({ ...avatar, skin: color })}
                >
                  {avatar.skin === color && <Check size={17} />}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>ทรงผม</legend>
            <div className="avatar-segment">
              {(["short", "bob", "curly"] as const).map((hair, i) => (
                <button
                  key={hair}
                  aria-pressed={avatar.hair === hair}
                  onClick={() => setAvatar({ ...avatar, hair })}
                >
                  {["ผมสั้น", "ผมบ๊อบ", "ผมหยิก"][i]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>สีเสื้อ</legend>
            <div className="color-swatches">
              {shirts.map((color, i) => (
                <button
                  key={color}
                  style={{ backgroundColor: color }}
                  aria-label={`สีเสื้อ ${i + 1}`}
                  title={`สีเสื้อ ${i + 1}`}
                  aria-pressed={avatar.shirt === color}
                  onClick={() => setAvatar({ ...avatar, shirt: color })}
                >
                  {avatar.shirt === color && <Check size={17} />}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>พื้นหลัง</legend>
            <div className="color-swatches">
              {backdrops.map((color, i) => (
                <button
                  key={color}
                  style={{ backgroundColor: color }}
                  aria-label={`พื้นหลัง ${i + 1}`}
                  title={`พื้นหลัง ${i + 1}`}
                  aria-pressed={avatar.backdrop === color}
                  onClick={() => setAvatar({ ...avatar, backdrop: color })}
                >
                  {avatar.backdrop === color && <Check size={17} />}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <fieldset className="accessory-options">
          <legend>ของสะสม</legend>
          <div>
            {(
              [
                { id: "none", name: "เรียบง่าย", at: 1, icon: Check },
                { id: "glasses", name: "แว่นตา", at: 2, icon: Glasses },
                { id: "star", name: "ดาวติดเสื้อ", at: 3, icon: Star },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-pressed={avatar.accessory === item.id}
                disabled={level < item.at}
                onClick={() => setAvatar({ ...avatar, accessory: item.id })}
              >
                <item.icon size={23} />
                <strong>{item.name}</strong>
                <small>
                  {level < item.at ? (
                    <>
                      <LockKeyhole size={12} />
                      ระดับ {item.at}
                    </>
                  ) : (
                    "เลือกได้"
                  )}
                </small>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="checkbox-label mood-switch">
          <input
            type="checkbox"
            checked={avatar.automatic}
            onChange={(e) =>
              setAvatar({ ...avatar, automatic: e.target.checked })
            }
          />
          สีหน้าตามความก้าวหน้า
        </label>
        <p className="growth-policy">
          สีหน้าเป็นสัญลักษณ์ความก้าวหน้า ไม่ใช่การประเมินอารมณ์จริง
          ปิดได้เพื่อใช้สีหน้าปกติ
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-actions">
        <button className="button neutral" onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className="button gold"
          onClick={() => {
            try {
              if (
                onSave(
                  saveAvatar(growth, student.id, avatar),
                  "บันทึกอวตาร์แล้ว",
                )
              )
                onClose();
              else setError(persistenceError);
            } catch (e) {
              setError(e instanceof Error ? e.message : "บันทึกไม่ได้");
            }
          }}
        >
          <Check size={17} />
          บันทึกอวตาร์
        </button>
      </div>
    </Modal>
  );
}
