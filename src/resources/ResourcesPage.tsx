import { useRef, useState } from "react";
import { Bell, BookOpen, Download, FileText, Megaphone, Plus, Trash2, Upload } from "lucide-react";
import type { Announcement, Material, Room, State } from "../model";
import { Modal } from "../ui";
import { createAnnouncement, createMaterial, deleteAnnouncement, deleteMaterial, openMaterial } from "../services/resourceService";
import "./resources.css";

export function ResourcesPage({
  state,
  role,
  userId,
  studentId,
  onState,
  onNotice,
}: {
  state: State;
  role: "teacher" | "student";
  userId?: string;
  studentId?: string;
  onState: (next: State) => void;
  onNotice: (text: string, error?: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [deleting, setDeleting] = useState<{ type: "material" | "announcement"; value: Material | Announcement } | null>(null);
  const materials = state.materials ?? [];
  const announcements = state.announcements ?? [];
  const downloadLogs = state.downloadLogs ?? [];

  async function remove() {
    if (!deleting || !userId) return;
    setBusy(true);
    try {
      if (deleting.type === "material") {
        await deleteMaterial(userId, deleting.value as Material);
        onState({ ...state, materials: materials.filter((item) => item.id !== deleting.value.id) });
      } else {
        await deleteAnnouncement(userId, deleting.value.id);
        onState({ ...state, announcements: announcements.filter((item) => item.id !== deleting.value.id) });
      }
      onNotice("ลบรายการแล้ว");
      setDeleting(null);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "ลบรายการไม่สำเร็จ", true);
    } finally {
      setBusy(false);
    }
  }

  async function view(material: Material) {
    if (!studentId) {
      onNotice("กรุณาเข้าสู่ระบบนักเรียนก่อนเปิดสื่อ", true);
      return;
    }
    setBusy(true);
    try {
      await openMaterial(studentId, material);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "เปิดสื่อไม่สำเร็จ", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading resources-heading">
        <div>
          <p className="eyebrow">พื้นที่การเรียนรู้</p>
          <h1>{role === "teacher" ? "สื่อและประกาศ" : "สื่อการเรียนรู้"}<span className="heading-dot">.</span></h1>
          <p className="subtext">{role === "teacher" ? "จัดการเนื้อหาและข่าวสารให้แต่ละห้องเรียน" : "สื่อและประกาศสำหรับห้องเรียนของคุณ"}</p>
        </div>
        {role === "teacher" && (
          <div className="resource-actions">
            <button className="button neutral" onClick={() => setAnnouncementOpen(true)}><Megaphone size={17} /> ประกาศ</button>
            <button className="button gold" onClick={() => setMaterialOpen(true)}><Upload size={17} /> เพิ่มสื่อ</button>
          </div>
        )}
      </div>
      <div className="resource-layout">
        <section className="panel resource-panel">
          <div className="section-title"><div><span className="eyebrow"><BookOpen size={15} /> เอกสาร</span><h2>{role === "teacher" ? "สื่อการสอน" : "สื่อของห้องเรียน"}</h2></div><span className="muted">{materials.length} รายการ</span></div>
          {!materials.length ? <div className="resource-empty"><FileText size={24} /><p>ยังไม่มีสื่อในห้องเรียนนี้</p></div> : <div className="resource-list">{materials.map((material) => <article className="resource-item" key={material.id}><div className="resource-icon"><FileText /></div><div className="resource-copy"><h3>{material.title}</h3><p>{material.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p><span>{material.rooms.join(" · ")} · {new Date(material.createdAt).toLocaleDateString("th-TH")}</span></div><div className="resource-item-actions">{role === "student" ? <button className="button teal" disabled={busy} onClick={() => void view(material)}><Download size={16} /> ดู / ดาวน์โหลด</button> : <button className="icon-button danger" title="ลบสื่อ" aria-label={`ลบ ${material.title}`} onClick={() => setDeleting({ type: "material", value: material })}><Trash2 size={17} /></button>}</div></article>)}</div>}
        </section>
        <section className="panel resource-panel">
          <div className="section-title"><div><span className="eyebrow"><Bell size={15} /> ข่าวสาร</span><h2>ประกาศล่าสุด</h2></div><span className="muted">{announcements.length} รายการ</span></div>
          {!announcements.length ? <div className="resource-empty"><Megaphone size={24} /><p>ยังไม่มีประกาศ</p></div> : <div className="announcement-list">{announcements.map((item) => <article className="announcement-item" key={item.id}><div><span className="announcement-room">{item.room}</span><h3>{item.title}</h3><p>{item.body}</p><time>{new Date(item.publishedAt).toLocaleString("th-TH")}</time></div>{role === "teacher" && <button className="icon-button danger" title="ลบประกาศ" aria-label={`ลบประกาศ ${item.title}`} onClick={() => setDeleting({ type: "announcement", value: item })}><Trash2 size={17} /></button>}</article>)}</div>}
        </section>
      </div>
      <section className="panel resource-panel download-history-panel">
        <div className="section-title"><div><span className="eyebrow"><Download size={15} /> การใช้งานสื่อ</span><h2>ประวัติการเปิดสื่อ</h2></div><span className="muted">{downloadLogs.length} รายการ</span></div>
        {!downloadLogs.length ? <div className="resource-empty compact"><Download size={24} /><p>ยังไม่มีประวัติการเปิดสื่อ</p></div> : <div className="download-history">{downloadLogs.map((log) => <article className="download-log" key={log.id}><div className="resource-icon"><Download size={17} /></div><div className="resource-copy"><h3>{log.materialTitle}</h3><p>{role === "teacher" ? `${log.studentName} · ${log.studentCode} · ${log.room}` : "เปิดสื่อของคุณ"}</p></div><time>{new Date(log.downloadedAt).toLocaleString("th-TH")}</time></article>)}</div>}
      </section>
      {materialOpen && <MaterialModal rooms={state.rooms} busy={busy} onClose={() => setMaterialOpen(false)} onSubmit={async (input) => { if (!userId) return; setBusy(true); try { const material = await createMaterial({ ...input, teacherId: userId }); onState({ ...state, materials: [material, ...materials] }); onNotice("อัปโหลดสื่อเรียบร้อยแล้ว"); setMaterialOpen(false); } catch (error) { onNotice(error instanceof Error ? error.message : "อัปโหลดสื่อไม่สำเร็จ", true); } finally { setBusy(false); } }} />}
      {announcementOpen && <AnnouncementModal rooms={state.rooms} busy={busy} onClose={() => setAnnouncementOpen(false)} onSubmit={async (input) => { if (!userId) return; setBusy(true); try { const announcement = await createAnnouncement({ ...input, teacherId: userId }); onState({ ...state, announcements: [announcement, ...announcements] }); onNotice("ประกาศเรียบร้อยแล้ว"); setAnnouncementOpen(false); } catch (error) { onNotice(error instanceof Error ? error.message : "สร้างประกาศไม่สำเร็จ", true); } finally { setBusy(false); } }} />}
      {deleting && <Modal title="ยืนยันการลบ" onClose={() => setDeleting(null)}><div className="modal-body"><p>ต้องการลบรายการนี้ใช่ไหม ข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้</p></div><div className="modal-actions"><button className="button neutral" onClick={() => setDeleting(null)}>ยกเลิก</button><button className="button coral" disabled={busy} onClick={() => void remove()}><Trash2 size={16} /> ยืนยันลบ</button></div></Modal>}
    </>
  );
}

function MaterialModal({ rooms, busy, onClose, onSubmit }: { rooms: Room[]; busy: boolean; onClose: () => void; onSubmit: (input: { title: string; description: string; rooms: Room[]; file: File }) => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null); const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [selected, setSelected] = useState<Room[]>([]); const [file, setFile] = useState<File | null>(null);
  return <Modal title="เพิ่มสื่อการสอน" subtitle="อัปโหลดให้ห้องเรียน" onClose={onClose}><form className="modal-body form-stack" onSubmit={(e) => { e.preventDefault(); if (file && title.trim() && selected.length) void onSubmit({ title, description, rooms: selected, file }); }}><label>ชื่อสื่อ<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ใบความรู้เรื่องสหกรณ์" required /></label><label>รายละเอียด<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="รายละเอียดสั้น ๆ (ไม่บังคับ)" rows={3} /></label><fieldset className="resource-rooms"><legend>ห้องเรียน</legend>{rooms.map((room) => <label key={room}><input type="checkbox" checked={selected.includes(room)} onChange={() => setSelected((current) => current.includes(room) ? current.filter((item) => item !== room) : [...current, room])} /> {room}</label>)}</fieldset><label>ไฟล์ PDF หรือรูปภาพ<input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></label><div className="modal-actions"><button type="button" className="button neutral" onClick={onClose}>ยกเลิก</button><button className="button gold" disabled={busy || !file || !selected.length}><Plus size={16} /> อัปโหลด</button></div></form></Modal>;
}

function AnnouncementModal({ rooms, busy, onClose, onSubmit }: { rooms: Room[]; busy: boolean; onClose: () => void; onSubmit: (input: { room: Room; title: string; body: string }) => Promise<void> }) {
  const [room, setRoom] = useState(rooms[0] ?? ""); const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  return <Modal title="สร้างประกาศ" subtitle="ส่งข่าวสารถึงห้องเรียน" onClose={onClose}><form className="modal-body form-stack" onSubmit={(e) => { e.preventDefault(); if (room && title.trim() && body.trim()) void onSubmit({ room, title, body }); }}><label>ห้องเรียน<select value={room} onChange={(e) => setRoom(e.target.value)}>{rooms.map((item) => <option key={item}>{item}</option>)}</select></label><label>หัวข้อประกาศ<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="หัวข้อ" required /></label><label>รายละเอียด<textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="เขียนข้อความประกาศ" rows={5} required /></label><div className="modal-actions"><button type="button" className="button neutral" onClick={onClose}>ยกเลิก</button><button className="button gold" disabled={busy || !room}><Megaphone size={16} /> เผยแพร่ประกาศ</button></div></form></Modal>;
}
