import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import type { State } from "../model";
import { Modal } from "../ui";
import { readSpreadsheet } from "./readSpreadsheet";
import {
  fieldLabels,
  guessHeader,
  guessMapping,
  importStudents,
  mappingError,
  previewStudents,
  type ImportRow,
  type Field,
  type ImportSheet,
  type Mapping,
} from "./importModel";
import "./import.css";

export function ImportStudents({
  state,
  initialRoom,
  onSave,
  onCreateAccounts,
  onClose,
}: {
  state: State;
  initialRoom: string;
  onSave: (next: State, room: string, count: number) => boolean;
  onCreateAccounts?: (
    room: string,
    rows: ImportRow[],
    password: string,
  ) => Promise<State>;
  onClose: () => void;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [sheets, setSheets] = useState<ImportSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [fileName, setFileName] = useState("");
  const [header, setHeader] = useState(0);
  const [mapping, setMapping] = useState<Mapping>(guessMapping([]));
  const [mode, setMode] = useState<"full" | "split">("split");
  const [excluded, setExcluded] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const controller = useRef<AbortController | null>(null);
  const saving = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const sheet = sheets[sheetIndex];
  const configurationError = sheet
    ? mappingError(sheet, header, mapping, mode)
    : "";
  const rows =
    sheet && !configurationError
      ? previewStudents(state, sheet, header, mapping, mode, room)
      : [];
  const selected = rows.filter((row) => !excluded.includes(row.row));
  const problems = selected.filter((row) => row.errors.length);
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  const currentPage = Math.min(page, pageCount - 1);
  function clearSelection() {
    setExcluded([]);
    setPage(0);
    setError("");
  }
  function chooseHeader(next: number, source: ImportSheet) {
    setHeader(next);
    const guessed = guessMapping(source.rows[next]?.values ?? []);
    setMapping(guessed);
    setMode(guessed.name >= 0 ? "full" : "split");
    clearSelection();
  }
  async function load(file?: File) {
    if (!file) return;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError("");
    setSheets([]);
    setFileName(file.name);
    clearSelection();
    try {
      const loaded = await readSpreadsheet(file, active.signal);
      if (active.signal.aborted) return;
      setSheets(loaded);
      setSheetIndex(0);
      chooseHeader(guessHeader(loaded[0]), loaded[0]);
    } catch (e) {
      if (!active.signal.aborted)
        setError(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      if (!active.signal.aborted) setBusy(false);
    }
  }
  async function confirm() {
    if (busy || saving.current || configurationError || !sheet) return;
    saving.current = true;
    setError("");
    try {
      // Validate against the latest state again before the single local save.
      const next = importStudents(state, selected);
      let persistedState = next;
      if (onCreateAccounts) {
        if (password.length < 6) {
          setError("กำหนดรหัสผ่านเริ่มต้นอย่างน้อย 6 ตัวอักษร");
          return;
        }
        setBusy(true);
        persistedState = await onCreateAccounts(room, selected, password);
      }
      if (!onSave(persistedState, room, selected.length)) {
        setError("บันทึกไม่สำเร็จ ยังไม่เพิ่มรายชื่อใด ๆ กรุณาลองอีกครั้ง");
        return;
      }
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "นำเข้ารายชื่อไม่สำเร็จ");
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }
  const fields: Field[] =
    mode === "full"
      ? ["number", "code", "name"]
      : ["number", "code", "prefix", "first", "last"];
  const width = sheet
    ? Math.max(0, ...sheet.rows.map((row) => row.values.length))
    : 0;
  return (
    <Modal
      title="นำเข้านักเรียนจาก Excel"
      subtitle="เพิ่มรายชื่อใหม่เท่านั้น"
      onClose={onClose}
      wide
    >
      <div className="modal-body form-stack roster-import">
        <div className="form-columns">
          <label>
            ห้องเรียนปลายทาง
            <select
              aria-label="ห้องเรียนปลายทาง"
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                clearSelection();
              }}
            >
              {state.rooms.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="roster-import-file">
            ไฟล์รายชื่อนักเรียน
            <input
              aria-label="ไฟล์รายชื่อนักเรียน"
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => {
                void load(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {onCreateAccounts && (
          <label>
            รหัสผ่านเริ่มต้นสำหรับบัญชีใหม่
            <input
              type="password"
              minLength={6}
              autoComplete="new-password"
              value={password}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              onChange={(e) => setPassword(e.target.value)}
            />
            <small className="muted">นักเรียนเปลี่ยนรหัสผ่านได้ภายหลัง</small>
          </label>
        )}
        {fileName && (
          <p className="import-file-name">
            <FileSpreadsheet size={18} />
            {fileName}
          </p>
        )}
        {busy && <p role="status">กำลังอ่านไฟล์…</p>}
        {sheet && (
          <>
            <div className="form-columns">
              <label>
                ชีต
                <select
                  aria-label="ชีต"
                  value={sheetIndex}
                  onChange={(e) => {
                    const index = Number(e.target.value);
                    setSheetIndex(index);
                    chooseHeader(guessHeader(sheets[index]), sheets[index]);
                  }}
                >
                  {sheets.map((item, i) => (
                    <option key={i} value={i}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                แถวหัวตาราง
                <input
                  aria-label="แถวหัวตาราง"
                  type="number"
                  min={1}
                  max={sheet.rows.length || 1}
                  value={header + 1}
                  onChange={(e) =>
                    chooseHeader(Number(e.target.value) - 1, sheet)
                  }
                />
              </label>
            </div>
            <label>
              รูปแบบชื่อ
              <select
                aria-label="รูปแบบชื่อ"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as "full" | "split");
                  clearSelection();
                }}
              >
                <option value="split">คำนำหน้า / ชื่อ / สกุล แยกคอลัมน์</option>
                <option value="full">ชื่อ–สกุล รวมคอลัมน์</option>
              </select>
            </label>
            <div className="import-mapping">
              {fields.map((key) => (
                <label key={key}>
                  {fieldLabels[key]}
                  {key === "prefix" ? " (ไม่บังคับ)" : " *"}
                  <select
                    aria-label={`คอลัมน์${fieldLabels[key]}`}
                    value={mapping[key]}
                    onChange={(e) => {
                      setMapping({ ...mapping, [key]: Number(e.target.value) });
                      clearSelection();
                    }}
                  >
                    <option value={-1}>
                      {key === "prefix" ? "ไม่ใช้" : "เลือกคอลัมน์"}
                    </option>
                    {Array.from({ length: width }, (_, i) => (
                      <option value={i} key={i}>
                        {i + 1}.{" "}
                        {sheet.rows[header]?.values[i] || "ไม่มีชื่อคอลัมน์"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {configurationError && (
              <p className="form-error" role="alert">
                {configurationError}
              </p>
            )}
            {!configurationError && !rows.length && (
              <p role="status">ไม่มีรายชื่อนักเรียนหลังแถวหัวตาราง</p>
            )}
            {!!rows.length && (
              <>
                <div className="import-summary" role="status">
                  <strong>
                    ห้อง {room} · เลือก {selected.length} / {rows.length} คน
                  </strong>
                  <span>
                    ต้องแก้ไข {problems.length} คน · ไม่นำเข้า{" "}
                    {rows.length - selected.length} คน
                  </span>
                </div>
                <div className="import-selection-actions">
                  <button
                    className="button neutral"
                    onClick={() => {
                      setExcluded([]);
                      setError("");
                    }}
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    className="button neutral"
                    onClick={() => {
                      setExcluded(
                        rows
                          .filter((row) => row.errors.length)
                          .map((row) => row.row),
                      );
                      setError("");
                    }}
                  >
                    เลือกเฉพาะรายการพร้อมนำเข้า
                  </button>
                </div>
                <div
                  className="import-preview"
                  aria-label="ตัวอย่างรายชื่อก่อนนำเข้า"
                >
                  <div className="import-preview-head" aria-hidden="true">
                    <span /> <span>แถว</span>
                    <span>เลขที่</span>
                    <span>รหัส / ชื่อ–สกุล / สถานะ</span>
                  </div>
                  {rows
                    .slice(currentPage * 20, currentPage * 20 + 20)
                    .map((row) => (
                      <label
                        className={`import-preview-row ${row.errors.length ? "invalid" : ""}`}
                        key={row.row}
                      >
                        <input
                          type="checkbox"
                          aria-label={`นำเข้าแถว ${row.row}`}
                          checked={!excluded.includes(row.row)}
                          onChange={(e) => {
                            setExcluded(
                              e.target.checked
                                ? excluded.filter((n) => n !== row.row)
                                : [...excluded, row.row],
                            );
                            setError("");
                          }}
                        />
                        <span className="import-row-number">
                          <small>แถว </small>
                          {row.row}
                        </span>
                        <span className="import-roll-number">
                          <small>เลขที่ </small>
                          {Number.isFinite(row.input.number)
                            ? row.input.number
                            : "—"}
                        </span>
                        <span className="import-person">
                          <strong>
                            {row.input.code || "ไม่มีรหัส"} ·{" "}
                            {row.input.name || "ไม่มีชื่อ"}
                          </strong>
                          <span
                            className={
                              row.errors.length
                                ? "import-row-error"
                                : "import-ready"
                            }
                          >
                            {row.errors.length
                              ? row.errors.join(" · ")
                              : "พร้อมนำเข้า"}
                          </span>
                        </span>
                      </label>
                    ))}
                </div>
                {pageCount > 1 && (
                  <div className="import-pagination">
                    <button
                      className="icon-button"
                      aria-label="รายชื่อหน้าก่อน"
                      disabled={!currentPage}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span>
                      หน้า {currentPage + 1} / {pageCount}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="รายชื่อหน้าถัดไป"
                      disabled={currentPage + 1 >= pageCount}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="import-limit">
          .xls / .xlsx · ไม่เกิน 5 MB · 1,000 แถวต่อชีต
          <br />
          เก็บรหัสที่มีเลขศูนย์นำหน้าเป็นข้อความใน Excel · ไม่แก้ไขรายชื่อ งาน
          หรือคะแนนเดิม
        </p>
      </div>
      <div className="modal-actions">
        <button className="button neutral" onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className="button teal"
          disabled={
            busy ||
            !!configurationError ||
            !selected.length ||
            !!problems.length
          }
          onClick={confirm}
        >
          {sheet ? <Check size={17} /> : <Upload size={17} />}ยืนยันนำเข้า{" "}
          {selected.length} คน
        </button>
      </div>
    </Modal>
  );
}
