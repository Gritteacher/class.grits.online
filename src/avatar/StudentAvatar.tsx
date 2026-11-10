import { useEffect, useState, useRef } from "react";
import {
  Check,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Shuffle,
} from "lucide-react";
import { Modal } from "../ui";
import {
  accessoryNames,
  avatarAsset,
  backdrops,
  defaultAvatar,
  faceNames,
  hairColors,
  hairNames,
  outfitNames,
  skinColors,
  type Avatar,
} from "./model";
import { renderAvatar } from "./render";
import { loadAvatar, saveAvatar } from "./service";
import "./avatar.css";

export function AvatarPortrait({
  value,
  className = "",
}: {
  value: Avatar;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    setLoading(true);
    if (ref.current)
      void renderAvatar(ref.current, value, () => current)
        .catch(() => {
          if (current) setError("โหลดภาพไม่สำเร็จ");
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    return () => {
      current = false;
    };
  }, [value.face, value.skin, value.hair, value.hairColor, value.outfit, value.accessory, value.backdrop, retry]);
  return (
    <div className={`avatar-portrait ${className}`}>
      <canvas ref={ref} role="img" aria-label="อวตาร์ของฉัน" />
      {loading && (
        <span className="avatar-loading">
          <span className="loading-spinner" />
        </span>
      )}
      {error && (
        <button
          type="button"
          className="avatar-retry"
          onClick={() => setRetry((n) => n + 1)}
        >
          <RefreshCw size={16} />
          {error}
        </button>
      )}
    </div>
  );
}
export function StudentAvatar({
  studentId,
  name,
  room,
}: {
  studentId: string;
  name: string;
  room: string;
}) {
  const [value, setValue] = useState<Avatar>({ ...defaultAvatar });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setValue({ ...defaultAvatar });
    setEditing(false);
    setLoading(true);
    setError("");
    void loadAvatar(studentId)
      .then((v) => {
        if (active) setValue(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [studentId, revision]);
  return (
    <section className="student-avatar-profile" aria-label="พื้นที่ของฉัน">
      <AvatarPortrait value={value} />
      <div className="avatar-profile-copy">
        <p className="eyebrow">พื้นที่ของฉัน</p>
        <h2>{value.nickname || name.split(" ")[0]}</h2>
        <p>
          {name} · {room}
        </p>
        {value.motto && <p className="avatar-motto">{value.motto}</p>}
        {error ? (
          <p className="form-error" role="alert">
            {error}
            <button
              className="icon-button"
              aria-label="โหลดอวตาร์ใหม่"
              onClick={() => setRevision((n) => n + 1)}
            >
              <RefreshCw size={16} />
            </button>
          </p>
        ) : null}
        <button
          className="button neutral"
          disabled={loading || !!error}
          onClick={() => setEditing(true)}
        >
          {loading ? (
            <span className="loading-spinner" />
          ) : (
            <Palette size={17} />
          )}
          แต่งอวตาร์
        </button>
      </div>
      {editing && (
        <AvatarEditor
          key={studentId}
          initial={value}
          onClose={() => setEditing(false)}
          onSave={async (draft) => {
            const saved = await saveAvatar(studentId, draft);
            setValue(saved);
            return saved;
          }}
        />
      )}
    </section>
  );
}
export function AvatarEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: Avatar;
  onClose: () => void;
  onSave: (value: Avatar) => Promise<Avatar>;
}) {
  const [draft, setDraft] = useState<Avatar>({ ...initial });
  const [saved, setSaved] = useState(initial);
  const [tab, setTab] = useState("face");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const close = () => {
    if (
      !busy &&
      (!dirty ||
        window.confirm("ยังไม่ได้บันทึกอวตาร์ ต้องการออกโดยไม่บันทึกหรือไม่?"))
    )
      onClose();
  };
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
  const change = (patch: Partial<Avatar>) => {
    setDraft((v) => ({ ...v, ...patch }));
    setNotice("");
  };
  const tiles = (
    field: "face" | "hair" | "outfit" | "accessory",
    names: string[],
    none = false,
  ) => (
    <div className={`avatar-choices ${field}`} role="group" aria-label={field}>
      {none && (
        <button
          type="button"
          aria-pressed={draft[field] === -1}
          onClick={() => change({ [field]: -1 })}
        >
          ไม่ใส่
        </button>
      )}
      {names.map((label, index) => (
        <button
          type="button"
          key={index}
          aria-pressed={draft[field] === index}
          onClick={() => change({ [field]: index })}
        >
          <img src={avatarAsset(field, index)} alt="" loading="eager" />
          <span>{label}</span>
          {draft[field] === index && (
            <Check className="avatar-choice-check" size={15} />
          )}
        </button>
      ))}
    </div>
  );
  const swatches = (
    field: "skin" | "hairColor" | "backdrop",
    colors: string[],
    label: string,
  ) => (
    <fieldset className="avatar-swatches">
      <legend>{label}</legend>
      {colors.map((color, index) => (
        <label key={color} title={`${label} ${index + 1}`}>
          <input
            type="radio"
            name={field}
            aria-label={`${label} ${index + 1}`}
            checked={draft[field] === index}
            onChange={() => change({ [field]: index })}
          />
          <span style={{ background: color }}>
            {draft[field] === index && <Check size={16} />}
          </span>
        </label>
      ))}
    </fieldset>
  );
  return (
    <Modal title="แต่งอวตาร์ของฉัน" onClose={close} wide>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          setNotice("");
          try {
            const next = await onSave(draft);
            setDraft(next);
            setSaved(next);
            setNotice("บันทึกอวตาร์แล้ว");
          } catch (e) {
            setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="avatar-editor modal-body">
          <aside className="avatar-preview">
            <AvatarPortrait value={draft} />
            <strong>{draft.nickname || "อวตาร์ของฉัน"}</strong>
            <p>{draft.motto}</p>
            <div className="avatar-preview-actions">
              <button
                type="button"
                className="icon-button"
                title="สุ่มอวตาร์"
                aria-label="สุ่มอวตาร์"
                disabled={busy}
                onClick={() =>
                  change({
                    face: Math.floor(Math.random() * 4),
                    skin: Math.floor(Math.random() * 8),
                    hair: Math.floor(Math.random() * 8),
                    hairColor: Math.floor(Math.random() * 5),
                    outfit: Math.floor(Math.random() * 12),
                    accessory: Math.floor(Math.random() * 5) - 1,
                  })
                }
              >
                <Shuffle size={18} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="คืนค่าเริ่มต้น"
                aria-label="คืนค่าเริ่มต้นอวตาร์"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm("คืนรูปลักษณ์อวตาร์เป็นค่าเริ่มต้นหรือไม่?")
                  )
                    change({
                      ...defaultAvatar,
                      nickname: draft.nickname,
                      motto: draft.motto,
                    });
                }}
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </aside>
          <div className="avatar-customize">
            <div
              className="avatar-tabs"
              role="tablist"
              aria-label="ส่วนที่ต้องการแต่ง"
            >
              {[
                ["face", "ใบหน้า"],
                ["hair", "ทรงผม"],
                ["outfit", "ชุด"],
                ["accessory", "เครื่องประดับ"],
                ["profile", "โปรไฟล์"],
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <fieldset disabled={busy} className="avatar-options">
              <legend className="sr-only">ตัวเลือกอวตาร์</legend>
              {tab === "face" && (
                <>
                  {swatches("skin", skinColors, "สีผิว")}
                  {tiles("face", faceNames)}
                </>
              )}
              {tab === "hair" && (
                <>
                  {swatches("hairColor", hairColors, "สีผม")}
                  {tiles("hair", hairNames, true)}
                </>
              )}
              {tab === "outfit" && tiles("outfit", outfitNames)}
              {tab === "accessory" && tiles("accessory", accessoryNames, true)}
              {tab === "profile" && (
                <div className="form-stack">
                  {swatches("backdrop", backdrops, "สีพื้นหลัง")}
                  <label>
                    ชื่อเล่น
                    <input
                      maxLength={24}
                      value={draft.nickname}
                      onChange={(event) =>
                        change({ nickname: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    ข้อความประจำตัว
                    <textarea
                      rows={3}
                      maxLength={80}
                      value={draft.motto}
                      onChange={(event) =>
                        change({ motto: event.target.value })
                      }
                    />
                  </label>
                </div>
              )}
            </fieldset>
          </div>
        </div>
        {error && (
          <p className="form-error avatar-message" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="avatar-message" role="status">
            {notice}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button neutral"
            disabled={busy}
            onClick={close}
          >
            ปิด
          </button>
          <button className="button teal" disabled={busy || !dirty}>
            {busy ? <span className="loading-spinner" /> : <Save size={17} />}
            บันทึกอวตาร์
          </button>
        </div>
      </form>
    </Modal>
  );
}
