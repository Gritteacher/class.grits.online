import { supabase } from "../lib/supabase";
import type { Room, State, Student } from "../model";

export type ClassroomRecord = {
  id: string;
  name: string;
  academic_year: string;
  level: string;
  room: string;
  subject: string;
  teacher_id: string;
};

type MemberRecord = {
  classroom_id: string;
  student_id: string;
  student_number: number | null;
};

type ProfileRecord = {
  id: string;
  role: "teacher" | "student";
  display_name: string;
  student_code: string | null;
  status?: "active" | "archived";
};

export type TeacherRoster = {
  classrooms: ClassroomRecord[];
  students: Student[];
};

export async function loadStudentProfile(studentId: string): Promise<Student | null> {
  const { data: members, error: memberError } = await supabase
    .from("classroom_members")
    .select("classroom_id, student_number")
    .eq("student_id", studentId);
  if (memberError) throw new Error(`โหลดสมาชิกห้องเรียนไม่สำเร็จ (${memberError.code || "network"})`);
  if (!members?.length) throw new Error("บัญชีนักเรียนนี้ยังไม่มีห้องเรียนที่เข้าถึงได้ กรุณาให้ครูตรวจสอบการผูกบัญชีกับห้องเรียน");
  const member = members[0] as { classroom_id: string; student_number: number | null };
  const { data: classroom, error: classroomError } = await supabase
    .from("classrooms")
    .select("room, name, subject")
    .eq("id", member.classroom_id)
    .maybeSingle<{ room: string; name: string; subject?: string | null }>();
  if (classroomError) throw new Error(`โหลดห้องเรียนไม่สำเร็จ (${classroomError.code || "network"})`);
  if (!classroom) throw new Error("ไม่พบห้องเรียนหรือไม่มีสิทธิ์เข้าถึง กรุณาให้ครูตรวจสอบห้องเรียน");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, student_code, status")
    .eq("id", studentId)
    .maybeSingle<{
      id: string;
      display_name: string;
      student_code: string | null;
      status?: "active" | "archived";
    }>();
  if (profileError) throw new Error(`โหลดโปรไฟล์นักเรียนไม่สำเร็จ (${profileError.code || "network"})`);
  if (!profile) throw new Error("ไม่พบโปรไฟล์นักเรียน กรุณาติดต่อครู");
  return {
    id: profile.id,
    code: profile.student_code || profile.id.slice(0, 8),
    name: profile.display_name || "ยังไม่ระบุชื่อ",
    room: classroom.name || classroom.room,
    number: member.student_number ?? 0,
    status: profile.status ?? "active",
    subject: classroom.subject || "สังคมศึกษา",
  };
}

export async function loadTeacherRoster(teacherId: string): Promise<TeacherRoster> {
  const { data: classrooms, error: classroomError } = await supabase
    .from("classrooms")
    .select("id, name, academic_year, level, room, subject, teacher_id")
    .eq("teacher_id", teacherId)
    .order("level", { ascending: true })
    .order("room", { ascending: true });
  if (classroomError) throw new Error("โหลดห้องเรียนไม่สำเร็จ กรุณาลองใหม่");

  const classroomRows = (classrooms ?? []) as ClassroomRecord[];
  if (!classroomRows.length) return { classrooms: [], students: [] };
  const classroomIds = classroomRows.map((classroom) => classroom.id);
  const { data: members, error: memberError } = await supabase
    .from("classroom_members")
    .select("classroom_id, student_id, student_number")
    .in("classroom_id", classroomIds)
    .order("student_number", { ascending: true });
  if (memberError) throw new Error("โหลดสมาชิกห้องเรียนไม่สำเร็จ กรุณาลองใหม่");

  const memberRows = (members ?? []) as MemberRecord[];
  const studentIds = [...new Set(memberRows.map((member) => member.student_id))];
  if (!studentIds.length) return { classrooms: classroomRows, students: [] };
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, display_name, student_code, status")
    .in("id", studentIds)
    .eq("role", "student");
  if (profileError) throw new Error("โหลดข้อมูลนักเรียนไม่สำเร็จ กรุณาลองใหม่");

  const profileById = new Map(
    ((profiles ?? []) as ProfileRecord[]).map((profile) => [profile.id, profile]),
  );
  if (studentIds.some((id) => !profileById.has(id))) {
    throw new Error("พบสมาชิกในห้อง แต่โหลดโปรไฟล์นักเรียนไม่ครบ กรุณาตรวจสอบสิทธิ์การอ่านข้อมูล ไม่ใช่ห้องเรียนว่าง");
  }
  const roomByClassroomId = new Map(
    classroomRows.map((classroom) => [
      classroom.id,
      classroom.name || classroom.room,
    ]),
  );
  const students: Student[] = memberRows.flatMap((member) => {
    const profile = profileById.get(member.student_id);
    const room = roomByClassroomId.get(member.classroom_id);
    if (!profile || !room) return [];
    return [
      {
        id: profile.id,
        classroomId: member.classroom_id,
        code: profile.student_code || profile.id.slice(0, 8),
        name: profile.display_name || "ยังไม่ระบุชื่อ",
        room,
        number: member.student_number ?? 0,
        status: profile.status ?? "active",
      },
    ];
  });
  return { classrooms: classroomRows, students };
}

export async function createClassroom(input: {
  teacherId: string;
  name: string;
  academicYear: string;
  level: string;
  room: string;
  subject: string;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("กรอกชื่อห้องเรียนก่อน");
  const { data, error } = await supabase
    .from("classrooms")
    .insert({
      name,
      academic_year: input.academicYear.trim() || "2569",
      level: input.level.trim(),
      room: input.room.trim(),
      subject: input.subject.trim() || "สังคมศึกษา",
      teacher_id: input.teacherId,
    })
    .select("id, name, academic_year, level, room, subject, teacher_id")
    .single<ClassroomRecord>();
  if (error || !data) throw new Error("เพิ่มห้องเรียนไม่สำเร็จ กรุณาลองใหม่");
  return data;
}

export async function updateStudentInSupabase(input: {
  teacherId: string;
  student: Student;
  previousRoom: string;
}) {
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: input.student.name.trim(),
      student_code: input.student.code.trim(),
    })
    .eq("id", input.student.id);
  if (profileError) {
    if (profileError.code === "23505") throw new Error("รหัสนักเรียนนี้มีอยู่แล้ว");
    throw new Error("แก้ไขข้อมูลนักเรียนไม่สำเร็จ");
  }
  const nextClassroomId = await getTeacherClassroomId(input.teacherId, input.student.room);
  if (input.previousRoom === input.student.room) {
    const { error } = await supabase
      .from("classroom_members")
      .update({ student_number: input.student.number })
      .eq("classroom_id", nextClassroomId)
      .eq("student_id", input.student.id);
    if (error) throw new Error("แก้ไขเลขที่นักเรียนไม่สำเร็จ");
    return;
  }
  const previousClassroomId = await getTeacherClassroomId(input.teacherId, input.previousRoom);
  const { error: removeError } = await supabase
    .from("classroom_members")
    .delete()
    .eq("classroom_id", previousClassroomId)
    .eq("student_id", input.student.id);
  if (removeError) throw new Error("ย้ายห้องเดิมของนักเรียนไม่สำเร็จ");
  const { error: addError } = await supabase.from("classroom_members").insert({
    classroom_id: nextClassroomId,
    student_id: input.student.id,
    student_number: input.student.number,
  });
  if (addError) throw new Error("เพิ่มนักเรียนเข้าห้องใหม่ไม่สำเร็จ");
}

export async function updateStudentStatusInSupabase(
  teacherId: string,
  studentIds: string[],
  status: "active" | "archived",
) {
  if (!studentIds.length) throw new Error("เลือกรายชื่อก่อน");
  const { data: classrooms, error: classroomError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("teacher_id", teacherId);
  if (classroomError || !classrooms?.length) throw new Error("ไม่พบห้องเรียนของครู");
  const classroomIds = classrooms.map((classroom) => classroom.id);
  const { data: members, error: memberError } = await supabase
    .from("classroom_members")
    .select("student_id")
    .in("classroom_id", classroomIds)
    .in("student_id", studentIds);
  if (memberError || !members?.length) throw new Error("ไม่พบรายชื่อในห้องของครู");
  const allowedIds = [...new Set(members.map((member) => member.student_id))];
  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .in("id", allowedIds)
    .eq("role", "student");
  if (error) throw new Error("บันทึกสถานะรายชื่อไม่สำเร็จ");
}

export async function removeStudentsFromClassroom(
  teacherId: string,
  studentIds: string[],
) {
  if (!studentIds.length) throw new Error("เลือกรายชื่อก่อน");
  const { data: classrooms, error: classroomError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("teacher_id", teacherId);
  if (classroomError || !classrooms?.length) throw new Error("ไม่พบห้องเรียนของครู");
  const classroomIds = classrooms.map((classroom) => classroom.id);
  const { data: members, error: memberError } = await supabase
    .from("classroom_members")
    .select("classroom_id, student_id")
    .in("classroom_id", classroomIds)
    .in("student_id", studentIds);
  if (memberError || !members?.length) throw new Error("ไม่พบรายชื่อในห้องของครู");
  const allowedIds = [...new Set(members.map((member) => member.student_id))];
  const { error: removeError } = await supabase
    .from("classroom_members")
    .delete()
    .in("classroom_id", classroomIds)
    .in("student_id", allowedIds);
  if (removeError) throw new Error("ลบรายชื่อออกจากห้องไม่สำเร็จ");
  const { error: archiveError } = await supabase
    .from("profiles")
    .update({ status: "archived" })
    .in("id", allowedIds)
    .eq("role", "student");
  if (archiveError) throw new Error("ลบรายชื่อสำเร็จ แต่ปรับสถานะบัญชีไม่สำเร็จ");
}

export async function removeClassroomFromSupabase(
  teacherId: string,
  roomName: string,
  selectedClassroomId?: string,
) {
  const classroomId = await getTeacherClassroomId(teacherId, roomName, selectedClassroomId);
  const { count: memberCount, error: memberError } = await supabase
    .from("classroom_members")
    .select("student_id", { count: "exact", head: true })
    .eq("classroom_id", classroomId);
  if (memberError) throw new Error("ตรวจสอบสมาชิกห้องไม่สำเร็จ");
  if (memberCount) throw new Error("ลบไม่ได้ เพราะห้องนี้ยังมีรายชื่ออยู่");
  const { count: assignmentCount, error: assignmentError } = await supabase
    .from("assignment_classrooms")
    .select("assignment_id", { count: "exact", head: true })
    .eq("classroom_id", classroomId);
  if (assignmentError) throw new Error("ตรวจสอบงานของห้องไม่สำเร็จ");
  if (assignmentCount) throw new Error("ลบไม่ได้ เพราะห้องนี้ยังมีงานที่มอบหมายอยู่");
  const { count: materialCount, error: materialError } = await supabase
    .from("material_classrooms")
    .select("material_id", { count: "exact", head: true })
    .eq("classroom_id", classroomId);
  if (materialError) throw new Error("ตรวจสอบสื่อของห้องไม่สำเร็จ");
  if (materialCount) throw new Error("ลบไม่ได้ เพราะห้องนี้ยังมีสื่อการสอนอยู่");
  const { count: announcementCount, error: announcementError } = await supabase
    .from("announcements")
    .select("id", { count: "exact", head: true })
    .eq("classroom_id", classroomId);
  if (announcementError) throw new Error("ตรวจสอบประกาศของห้องไม่สำเร็จ");
  if (announcementCount) throw new Error("ลบไม่ได้ เพราะห้องนี้ยังมีประกาศอยู่");
  const { data: deletedClassroom, error } = await supabase
    .from("classrooms")
    .delete()
    .eq("id", classroomId)
    .eq("teacher_id", teacherId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(`ลบห้องเรียนไม่สำเร็จ (${error.code || "network"})`);
  if (!deletedClassroom || deletedClassroom.id !== classroomId) {
    throw new Error("ยังลบห้องเรียนไม่สำเร็จ กรุณาตรวจสอบสิทธิ์การลบห้องของบัญชีครู แล้วลองใหม่");
  }
}

export async function renameClassroomInSupabase(teacherId: string, previousName: string, nextName: string, selectedClassroomId?: string) {
  const name = nextName.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) throw new Error("กรอกชื่อห้องเรียนไม่เกิน 120 ตัวอักษร");
  const classroomId = await getTeacherClassroomId(teacherId, previousName, selectedClassroomId);
  const { data: duplicates, error: lookupError } = await supabase
    .from("classrooms").select("id").eq("teacher_id", teacherId).eq("name", name).neq("id", classroomId);
  if (lookupError) throw new Error("ตรวจสอบชื่อห้องเรียนไม่สำเร็จ กรุณาลองใหม่");
  if (duplicates?.length) throw new Error("มีชื่อห้องเรียนนี้แล้ว กรุณาใช้ชื่ออื่น");
  const { data, error } = await supabase.from("classrooms")
    .update({ name }).eq("id", classroomId).eq("teacher_id", teacherId).eq("name", previousName)
    .select("id, name").maybeSingle<{ id: string; name: string }>();
  if (error) throw new Error(`แก้ไขชื่อห้องเรียนไม่สำเร็จ (${error.code || "network"})`);
  if (!data || data.id !== classroomId || data.name !== name) {
    throw new Error("บันทึกชื่อห้องไม่สำเร็จ ห้องอาจถูกแก้ไขแล้วหรือไม่มีสิทธิ์ กรุณาโหลดรายชื่อใหม่");
  }
}

export async function getTeacherClassroomId(teacherId: string, roomName: string, selectedClassroomId?: string) {
  const { data, error } = await supabase
    .from("classrooms")
    .select("id, name, room")
    .eq("teacher_id", teacherId);
  if (error) throw new Error(`ค้นหาห้องเรียนไม่สำเร็จ (${error.code || "network"}) กรุณาลองใหม่`);
  const rows = (data ?? []) as { id: string; name: string; room: string }[];
  if (selectedClassroomId) {
    const selected = rows.find((row) => row.id === selectedClassroomId);
    if (!selected || (selected.name || selected.room) !== roomName) {
      throw new Error("ห้องเรียนที่เลือกมีการเปลี่ยนแปลงหรือไม่มีสิทธิ์ กรุณาโหลดรายชื่อใหม่");
    }
    return selected.id;
  }
  const exact = rows.filter((row) => (row.name || row.room) === roomName);
  const matches = exact.length ? exact : rows.filter((row) => row.room === roomName);
  if (matches.length > 1) {
    throw new Error(`พบห้องเรียนชื่อหรือเลขห้องซ้ำ (${roomName}) กรุณาโหลดรายชื่อใหม่และเลือกห้องด้วยชื่อเต็ม`);
  }
  if (!matches.length)
    throw new Error("ไม่พบห้องเรียนจริงใน Supabase กรุณารีเฟรชรายชื่อ");
  return matches[0].id;
}

export function applyTeacherRoster(state: State, roster: TeacherRoster): State {
  const rooms: Room[] = roster.classrooms.map(
    (classroom) => classroom.name || classroom.room,
  );
  return {
    ...state,
    rooms,
    classrooms: roster.classrooms.map((classroom) => ({
      id: classroom.id, name: classroom.name || classroom.room, academicYear: classroom.academic_year,
    })),
    roomSubjects: Object.fromEntries(
      roster.classrooms.map((classroom) => [
        classroom.name || classroom.room,
        classroom.subject?.trim() || "สังคมศึกษา",
      ]),
    ),
    students: roster.students,
  };
}
