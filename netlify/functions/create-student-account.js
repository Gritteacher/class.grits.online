import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://class.grits.online",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

const studentEmail = (code) => `${code.trim()}@students.class.grits.online`;

async function findAuthUserByEmail(admin, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  return null;
}

function authFailureMessage(error) {
  const code = String(error?.code || error?.status || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  if (code.includes("rate") || message.includes("rate limit") || message.includes("too many")) {
    return "ระบบจำกัดการสร้างบัญชีชั่วคราว กรุณารอสักครู่แล้วลองใหม่";
  }
  if (code.includes("email_address_invalid") || message.includes("invalid email")) {
    return "ระบบสร้างบัญชีภายในไม่สำเร็จ กรุณาตรวจการตั้งค่าอีเมลของระบบ";
  }
  return "สร้างบัญชีนักเรียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

function logAuthError(stage, error, context = {}) {
  console.error(`[create-student-account] ${stage}`, {
    ...context,
    code: error?.code || null,
    status: error?.status || null,
    message: error?.message || String(error || "unknown error"),
  });
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return json(500, { error: "ระบบยังไม่ได้ตั้งค่า Supabase ฝั่งเซิร์ฟเวอร์" });
  }
  const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "ไม่พบสิทธิ์ผู้ใช้งาน" });

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "ข้อมูลคำขอไม่ถูกต้อง" });
  }
  const code = String(input.studentCode || "").trim();
  const displayName = String(input.displayName || "").trim();
  const classroomId = String(input.classroomId || "").trim();
  // The teacher no longer needs to handle a shared starter password. A random
  // internal password keeps the Auth user creatable until the student claims it.
  // Supabase Auth rejects passwords longer than 72 characters. One UUID is
  // sufficient for this hidden bootstrap password; students replace it when
  // they claim the account.
  const password = String(input.password || crypto.randomUUID());
  const studentNumber = Number(input.studentNumber);
  if (!/^\d{1,20}$/.test(code)) return json(400, { error: "รหัสนักเรียนไม่ถูกต้อง" });
  if (!displayName || displayName.length > 120) return json(400, { error: "ชื่อ–สกุลไม่ถูกต้อง" });
  if (!classroomId || !Number.isInteger(studentNumber) || studentNumber < 1) {
    return json(400, { error: "ข้อมูลห้องเรียนหรือเลขที่ไม่ถูกต้อง" });
  }
  if (password.length < 6) return json(400, { error: "ไม่สามารถสร้างรหัสผ่านภายในได้" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) {
    return json(401, {
      error: "ตรวจสอบ session ครูไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่",
    });
  }

  const { data: teacher, error: teacherError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", caller.user.id)
    .maybeSingle();
  if (teacherError) {
    console.error("[create-student-account] teacher profile lookup failed", teacherError);
    return json(500, { error: "ตรวจสอบข้อมูลครูไม่สำเร็จ กรุณาลองใหม่" });
  }
  if (!teacher || teacher.role !== "teacher") return json(403, { error: "เฉพาะครูเท่านั้นที่สร้างบัญชีนักเรียนได้" });

  const { data: classroom, error: classroomError } = await admin
    .from("classrooms")
    .select("id")
    .eq("id", classroomId)
    .eq("teacher_id", caller.user.id)
    .maybeSingle();
  if (classroomError) {
    console.error("[create-student-account] classroom lookup failed", classroomError);
    return json(500, { error: "ตรวจสอบห้องเรียนไม่สำเร็จ กรุณาลองใหม่" });
  }
  if (!classroom) return json(403, { error: "ครูไม่มีสิทธิ์จัดการห้องเรียนนี้" });

  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id, display_name, role, status")
    .eq("student_code", code)
    .maybeSingle();
  if (existingError) {
    console.error("[create-student-account] student lookup failed", existingError);
    return json(500, { error: "ตรวจสอบรหัสนักเรียนไม่สำเร็จ กรุณาลองใหม่" });
  }
  if (existing) {
    if (existing.role !== "student") return json(409, { error: "รหัสนี้ถูกใช้กับบัญชีครูแล้ว" });
    const { data: membership, error: membershipError } = await admin
      .from("classroom_members")
      .select("classroom_id")
      .eq("classroom_id", classroomId)
      .eq("student_id", existing.id)
      .maybeSingle();
    if (membershipError) return json(500, { error: "ตรวจสอบห้องของนักเรียนไม่สำเร็จ" });
    if (membership) return json(409, { error: "นักเรียนคนนี้อยู่ในห้องเรียนนี้แล้ว" });

    // Repair a partially-created account: the Auth user/profile exists but
    // the classroom membership insert did not finish. Keep the old password.
    const { error: attachError } = await admin.from("classroom_members").insert({
      classroom_id: classroomId,
      student_id: existing.id,
      student_number: studentNumber,
    });
    if (attachError) {
      console.error("[create-student-account] repair membership failed", attachError);
      return json(400, { error: "ผูกนักเรียนเข้าห้องเรียนไม่สำเร็จ กรุณาตรวจเลขที่แล้วลองใหม่" });
    }
    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({ display_name: displayName, status: "active" })
      .eq("id", existing.id);
    if (profileUpdateError) {
      console.error("[create-student-account] repair profile update failed", profileUpdateError);
      return json(400, { error: "ผูกห้องสำเร็จ แต่ปรับข้อมูลนักเรียนไม่สำเร็จ" });
    }
    return json(200, {
      id: existing.id,
      studentCode: code,
      displayName,
      repaired: true,
    });
  }

  const email = studentEmail(code);
  let authUser;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created?.user) {
    authUser = created.user;
  } else if (
    createError?.message?.toLowerCase().includes("already")
    || createError?.code === "email_exists"
    || createError?.code === "user_already_exists"
  ) {
    // A previous delete may have removed the profile but left the Auth user.
    // Reuse that orphaned Auth account instead of forcing a new student code.
    authUser = await findAuthUserByEmail(admin, email);
    if (authUser) {
      const { error: resetError } = await admin.auth.admin.updateUserById(authUser.id, {
        password,
        email_confirm: true,
      });
      if (resetError) {
        logAuthError("orphan account recovery failed", resetError, { email });
        return json(400, { error: "กู้คืนบัญชีนักเรียนเดิมไม่สำเร็จ" });
      }
    }
  }
  if (!authUser) {
    logAuthError("create auth user failed", createError, { email });
    return json(400, { error: authFailureMessage(createError) });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.id,
    role: "student",
    display_name: displayName,
    student_code: code,
  });
  const { error: memberError } = profileError
    ? { error: profileError }
    : await admin.from("classroom_members").insert({
        classroom_id: classroomId,
        student_id: authUser.id,
        student_number: studentNumber,
      });
  if (profileError || memberError) {
    if (profileError) console.error("[create-student-account] profile insert failed", profileError);
    if (memberError) console.error("[create-student-account] membership insert failed", memberError);
    const cleanup = await admin.auth.admin.deleteUser(authUser.id);
    if (cleanup.error) logAuthError("auth cleanup after create failure failed", cleanup.error, { userId: authUser.id });
    return json(400, {
      error: profileError
        ? "สร้างบัญชีแล้ว แต่บันทึกข้อมูลนักเรียนไม่สำเร็จ บัญชีถูกยกเลิกแล้ว"
        : "สร้างบัญชีแล้ว แต่เพิ่มนักเรียนเข้าห้องไม่สำเร็จ บัญชีถูกยกเลิกแล้ว",
    });
  }
  return json(200, { id: authUser.id, studentCode: code, displayName });
}
