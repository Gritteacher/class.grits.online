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
  if (memberError || !members?.length) return null;
  const member = members[0] as { classroom_id: string; student_number: number | null };
  const { data: classroom, error: classroomError } = await supabase
    .from("classrooms")
    .select("room, name, subject")
    .eq("id", member.classroom_id)
    .maybeSingle<{ room: string; name: string; subject?: string | null }>();
  if (classroomError || !classroom) return null;
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
  if (profileError || !profile) return null;
  return {
    id: profile.id,
    code: profile.student_code || profile.id.slice(0, 8),
    name: profile.display_name || "ยังไม่ระบุชื่อ",
    room: classroom.room || classroom.name,
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
  const roomByClassroomId = new Map(
    classroomRows.map((classroom) => [
      classroom.id,
      classroom.room || classroom.name,
    ]),
  );
  const students: Student[] = memberRows.flatMap((member) => {
    const profile = profileById.get(member.student_id);
    const room = roomByClassroomId.get(member.classroom_id);
    if (!profile || !room) return [];
    return [
      {
        id: profile.id,
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

export async function getTeacherClassroomId(teacherId: string, roomName: string) {
  const { data: byRoom, error: roomError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("room", roomName)
    .maybeSingle<{ id: string }>();
  if (roomError) throw new Error("ค้นหาห้องเรียนไม่สำเร็จ กรุณาลองใหม่");
  if (byRoom) return byRoom.id;
  const { data: byName, error: nameError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("name", roomName)
    .maybeSingle<{ id: string }>();
  if (nameError || !byName)
    throw new Error("ไม่พบห้องเรียนจริงใน Supabase กรุณารีเฟรชรายชื่อ");
  return byName.id;
}

export function applyTeacherRoster(state: State, roster: TeacherRoster): State {
  const rooms: Room[] = roster.classrooms.map(
    (classroom) => classroom.room || classroom.name,
  );
  return {
    ...state,
    rooms,
    roomSubjects: Object.fromEntries(
      roster.classrooms.map((classroom) => [
        classroom.room || classroom.name,
        classroom.subject?.trim() || "สังคมศึกษา",
      ]),
    ),
    students: roster.students,
  };
}
