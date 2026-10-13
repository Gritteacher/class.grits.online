import { supabase } from "../lib/supabase";
import type { Announcement, Material, MaterialDownloadLog, Room } from "../model";

type ClassroomRow = { id: string; room: string; name: string; teacher_id: string };
type MaterialRow = {
  id: string;
  title: string;
  description: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};
type LinkRow = { material_id: string; classroom_id: string };
type AnnouncementRow = {
  id: string;
  classroom_id: string;
  title: string;
  body: string;
  published_at: string;
};
type DownloadRow = { id: string; material_id: string; student_id: string; downloaded_at: string };
type DownloadStudent = { id: string; display_name: string; student_code: string | null };
type DownloadMember = { student_id: string; classroom_id: string };

const BUCKET = "classroom-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "material";
}

function mapRooms(classrooms: ClassroomRow[], ids: string[]) {
  const byId = new Map(classrooms.map((room) => [room.id, room.room || room.name]));
  return ids.flatMap((id) => {
    const room = byId.get(id);
    return room ? [room] : [];
  });
}

export async function loadResources(userId: string, role: "teacher" | "student") {
  const { data: classrooms, error: classroomError } = await supabase
    .from("classrooms")
    .select("id, room, name, teacher_id")
    .order("level", { ascending: true })
    .order("room", { ascending: true });
  if (classroomError) throw new Error("โหลดห้องเรียนสำหรับสื่อไม่สำเร็จ");
  const classroomRows = (classrooms ?? []) as ClassroomRow[];

  const { data: materialRows, error: materialError } = await supabase
    .from("materials")
    .select("id, title, description, file_path, mime_type, file_size, created_at")
    .order("created_at", { ascending: false });
  if (materialError) throw new Error("โหลดสื่อการสอนไม่สำเร็จ");
  const rawMaterials = (materialRows ?? []) as MaterialRow[];
  const materialIds = rawMaterials.map((material) => material.id);
  const { data: links, error: linkError } = materialIds.length
    ? await supabase.from("material_classrooms").select("material_id, classroom_id").in("material_id", materialIds)
    : { data: [], error: null };
  if (linkError) throw new Error("โหลดห้องของสื่อไม่สำเร็จ");
  const linksByMaterial = new Map<string, string[]>();
  for (const link of (links ?? []) as LinkRow[]) {
    linksByMaterial.set(link.material_id, [...(linksByMaterial.get(link.material_id) ?? []), link.classroom_id]);
  }
  const materials: Material[] = rawMaterials.map((material) => ({
    id: material.id,
    title: material.title,
    description: material.description,
    filePath: material.file_path,
    mimeType: material.mime_type,
    fileSize: Number(material.file_size ?? 0),
    rooms: mapRooms(classroomRows, linksByMaterial.get(material.id) ?? []),
    createdAt: material.created_at,
  }));

  const { data: announcementRows, error: announcementError } = await supabase
    .from("announcements")
    .select("id, classroom_id, title, body, published_at")
    .order("published_at", { ascending: false });
  if (announcementError) throw new Error("โหลดประกาศไม่สำเร็จ");
  const classroomById = new Map(classroomRows.map((room) => [room.id, room]));
  const announcements: Announcement[] = ((announcementRows ?? []) as AnnouncementRow[]).flatMap((item) => {
    const classroom = classroomById.get(item.classroom_id);
    if (!classroom) return [];
    return [{
      id: item.id,
      classroomId: item.classroom_id,
      room: classroom.room || classroom.name,
      title: item.title,
      body: item.body,
      publishedAt: item.published_at,
    }];
  });
  const { data: downloadRows, error: downloadError } = await supabase
    .from("material_download_logs")
    .select("id, material_id, student_id, downloaded_at")
    .order("downloaded_at", { ascending: false });
  if (downloadError) throw new Error("โหลดประวัติการเปิดสื่อไม่สำเร็จ");
  const downloadRecords = (downloadRows ?? []) as DownloadRow[];
  const studentIds = [...new Set(downloadRecords.map((item) => item.student_id))];
  const { data: studentRows, error: studentError } = studentIds.length
    ? await supabase.from("profiles").select("id, display_name, student_code").in("id", studentIds)
    : { data: [], error: null };
  if (studentError) throw new Error("โหลดชื่อนักเรียนในประวัติไม่สำเร็จ");
  const studentById = new Map((studentRows ?? []).map((item) => [item.id, item as DownloadStudent]));
  const { data: memberRows, error: downloadMemberError } = studentIds.length
    ? await supabase.from("classroom_members").select("student_id, classroom_id").in("student_id", studentIds)
    : { data: [], error: null };
  if (downloadMemberError) throw new Error("โหลดห้องเรียนในประวัติไม่สำเร็จ");
  const roomByClassroomId = new Map(classroomRows.map((room) => [room.id, room.room || room.name]));
  const roomByStudentId = new Map(
    (memberRows ?? []).map((item) => [item.student_id, roomByClassroomId.get(item.classroom_id) ?? ""] as const),
  );
  const materialById = new Map(materials.map((item) => [item.id, item]));
  const logs: MaterialDownloadLog[] = downloadRecords.flatMap((item) => {
    const material = materialById.get(item.material_id);
    const student = studentById.get(item.student_id);
    if (!material || !student) return [];
    const room = roomByStudentId.get(item.student_id) ?? material.rooms[0] ?? "";
    return [{
      id: item.id,
      materialId: item.material_id,
      materialTitle: material.title,
      studentId: item.student_id,
      studentName: student.display_name || "ยังไม่ระบุชื่อ",
      studentCode: student.student_code || "-",
      room,
      downloadedAt: item.downloaded_at,
    }];
  });
  void userId;
  void role;
  return { materials, announcements, downloadLogs: logs };
}

async function teacherClassrooms(teacherId: string) {
  const { data, error } = await supabase
    .from("classrooms")
    .select("id, room, name, teacher_id")
    .eq("teacher_id", teacherId);
  if (error || !data?.length) throw new Error("ไม่พบห้องเรียนของครู");
  return data as ClassroomRow[];
}

export async function createMaterial(input: {
  teacherId: string;
  title: string;
  description: string;
  rooms: Room[];
  file: File;
}) {
  const title = input.title.trim();
  if (!title) throw new Error("กรอกชื่อสื่อก่อนอัปโหลด");
  if (!input.rooms.length) throw new Error("เลือกห้องเรียนอย่างน้อย 1 ห้อง");
  if (input.file.size > MAX_FILE_SIZE) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
  if (!input.file.type || !(input.file.type === "application/pdf" || input.file.type.startsWith("image/"))) {
    throw new Error("รองรับเฉพาะไฟล์ PDF หรือรูปภาพ");
  }
  const classrooms = await teacherClassrooms(input.teacherId);
  const selected = classrooms.filter((room) => input.rooms.includes(room.room || room.name));
  if (selected.length !== new Set(input.rooms).size) throw new Error("ไม่พบห้องเรียนที่เลือกครบ");
  const path = `materials/${input.teacherId}/${crypto.randomUUID()}-${safeFileName(input.file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, input.file, {
    contentType: input.file.type,
    upsert: false,
  });
  if (uploadError) throw new Error("อัปโหลดไฟล์สื่อไม่สำเร็จ กรุณาลองใหม่");
  const { data: row, error: insertError } = await supabase.from("materials").insert({
    title,
    description: input.description.trim(),
    file_path: path,
    mime_type: input.file.type,
    file_size: input.file.size,
    teacher_id: input.teacherId,
  }).select("id, title, description, file_path, mime_type, file_size, created_at").single<MaterialRow>();
  if (insertError || !row) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error("บันทึกสื่อไม่สำเร็จ");
  }
  const { error: linkError } = await supabase.from("material_classrooms").insert(
    selected.map((classroom) => ({ material_id: row.id, classroom_id: classroom.id })),
  );
  if (linkError) {
    await supabase.from("materials").delete().eq("id", row.id).eq("teacher_id", input.teacherId);
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error("ผูกสื่อกับห้องเรียนไม่สำเร็จ");
  }
  return {
    id: row.id, title: row.title, description: row.description, filePath: row.file_path,
    mimeType: row.mime_type, fileSize: Number(row.file_size), rooms: selected.map((room) => room.room || room.name), createdAt: row.created_at,
  } satisfies Material;
}

export async function deleteMaterial(teacherId: string, material: Material) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([material.filePath]);
  if (storageError) throw new Error("ลบไฟล์สื่อไม่สำเร็จ กรุณาลองใหม่");
  const { error } = await supabase.from("materials").delete().eq("id", material.id).eq("teacher_id", teacherId);
  if (error) throw new Error("ลบข้อมูลสื่อไม่สำเร็จ กรุณาลองใหม่");
}

export async function createAnnouncement(input: { teacherId: string; room: Room; title: string; body: string }) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new Error("กรอกหัวข้อและรายละเอียดประกาศให้ครบ");
  const classrooms = await teacherClassrooms(input.teacherId);
  const classroom = classrooms.find((item) => (item.room || item.name) === input.room);
  if (!classroom) throw new Error("ไม่พบห้องเรียนที่เลือก");
  const { data, error } = await supabase.from("announcements").insert({
    classroom_id: classroom.id, title, body, teacher_id: input.teacherId,
  }).select("id, classroom_id, title, body, published_at").single<AnnouncementRow>();
  if (error || !data) throw new Error("สร้างประกาศไม่สำเร็จ");
  return { id: data.id, classroomId: data.classroom_id, room: input.room, title: data.title, body: data.body, publishedAt: data.published_at } satisfies Announcement;
}

export async function deleteAnnouncement(teacherId: string, announcementId: string) {
  const { error } = await supabase.from("announcements").delete().eq("id", announcementId).eq("teacher_id", teacherId);
  if (error) throw new Error("ลบประกาศไม่สำเร็จ");
}

export async function openMaterial(studentId: string, material: Material) {
  // Open a tab synchronously so mobile browsers do not block the later signed URL.
  const popup = window.open("about:blank", "_blank");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(material.filePath, 3600);
  if (error || !data?.signedUrl) {
    popup?.close();
    throw new Error("เปิดสื่อไม่สำเร็จ กรุณาลองใหม่");
  }
  const { error: logError } = await supabase.from("material_download_logs").insert({ material_id: material.id, student_id: studentId });
  if (logError) {
    popup?.close();
    throw new Error("เปิดสื่อได้ แต่บันทึกประวัติไม่สำเร็จ");
  }
  if (popup) popup.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
  return data.signedUrl;
}
