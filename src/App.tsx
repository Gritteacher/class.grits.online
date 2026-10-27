import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  File,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  KeyRound,
  LogOut,
  Moon,
  MoreHorizontal,
  Plus,
  Send,
  Sprout,
  Sun,
  TrendingUp,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  type Assignment,
  type Room,
  type State,
  type Submission,
  type Student,
  emptyState,
  formatDate,
  persist,
  review,
  safeLink,
} from "./model";
import { Modal, Status } from "./ui";
import { FilePreview } from "./components/FilePreview";
import { SchoolLogo } from "./components/SchoolLogo";
import { Results, TeacherHome, Workspace } from "./Teacher";
import { StudentHome } from "./Student";
import { GrowthPage } from "./growth/GrowthPage";
import { RosterPage } from "./roster/RosterPage";
import {
  availability,
  dateTime,
  deadline,
  fromThaiInput,
  saveAssignmentGroup,
  submitGroupWork,
  submitWork,
  thaiInput,
} from "./work/model";
import { ReturnWorkForm, WorkHistory } from "./work/WorkHistory";
import { siblingAssignments, assignmentGroupId } from "./work/rooms";
import { assignmentGroups } from "./work/rooms";
import "./work/work.css";
import { PreviewLogin } from "./preview/PreviewLogin";
import { GradeEditor } from "./grading/GradeEditor";
import {
  getGrade,
  gradeEntries,
  gradePoints,
  type GradeEntry,
} from "./grading/model";
import {
  getCurrentIdentity,
  signOut,
  type AuthIdentity,
} from "./services/authService";
import { PasswordDialog } from "./auth/PasswordDialog";
import { RecoveryEmailDialog } from "./auth/RecoveryEmailDialog";
import { PasswordResetPage } from "./auth/PasswordResetPage";
import { supabase } from "./lib/supabase";
import {
  applyTeacherRoster,
  createClassroom,
  getTeacherClassroomId,
  loadStudentProfile,
  loadTeacherRoster,
  removeClassroomFromSupabase,
  updateStudentInSupabase,
  updateStudentStatusInSupabase,
} from "./services/classroomService";
import { createStudentAccount, deleteStudentAccount, resetStudentPassword } from "./services/studentAccountService";
import type { ImportRow } from "./roster/importModel";
import { applyWorkData, loadWork } from "./services/workService";
import {
  saveAssignmentToSupabase,
  submitGroupWorkToSupabase,
  submitWorkToSupabase,
} from "./services/assignmentService";
import { saveGradeToSupabase, saveReviewToSupabase } from "./services/scoreService";
import { loadResources } from "./services/resourceService";
import { loadGrowth, saveGrowth } from "./services/growthService";
import { ResourcesPage } from "./resources/ResourcesPage";
import { ReportsPage } from "./reports/ReportsPage";
import {
  deleteAssignmentFromSupabase,
  saveSubmissionStatusToSupabase,
} from "./services/submissionService";

type Page = "today" | "workspace" | "results" | "growth" | "roster" | "resources" | "reports";
type Notice = { text: string; error?: boolean } | null;
type ImportProgress = { completed: number; total: number; failed: number };
type ImportJob = ImportProgress & { id: number; active: boolean; error?: boolean };
export function App() {
  const [state, setState] = useState<State>(emptyState);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const role = identity?.profile.role ?? "teacher";
  const [studentId, setStudentId] = useState("");
  const [studentLoadError, setStudentLoadError] = useState("");
  const [studentRetry, setStudentRetry] = useState(0);
  const [rosterError, setRosterError] = useState("");
  const [rosterRetry, setRosterRetry] = useState(0);
  const [loginRole, setLoginRole] = useState<"teacher" | "student">("student");
  const [page, setPage] = useState<Page>("today");
  const [activeId, setActiveId] = useState("");
  const [dark, setDark] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [recoveryEmailDismissedFor, setRecoveryEmailDismissedFor] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [newTask, setNewTask] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [returning, setReturning] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState<Assignment | null>(null);
  const [now, setNow] = useState(Date.now);
  const [preview, setPreview] = useState<Submission | null>(null);
  const [submitTask, setSubmitTask] = useState<Assignment | null>(null);
  const [gradeTarget, setGradeTarget] = useState<{
    studentId: string;
    assignmentId: string;
  } | null>(null);
  const [reviewOverride, setReviewOverride] = useState<{
    ids: string[];
    scores: Record<string, string>;
    feedback: string;
    revisions: Record<string, number>;
  } | null>(null);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const importJobId = useRef(0);
  const resetToken = new URLSearchParams(window.location.search).get("reset");
  const [overrideError, setOverrideError] = useState("");
  const student =
    state.students.find((s) => s.id === (role === "student" ? identity?.profile.id : studentId));
  const needsRecoveryEmail = Boolean(
    identity?.profile.role === "student" &&
      student &&
      !identity.profile.recovery_email &&
      recoveryEmailDismissedFor !== identity.profile.id,
  );
  useEffect(() => {
    let mounted = true;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const current = await getCurrentIdentity(data.session);
          if (mounted) setIdentity(current);
        }
      } finally {
        if (mounted) setAuthLoading(false);
      }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      clearTimeout(authTimer);
      if (!next) {
        setIdentity(null);
        setState(emptyState());
        setStudentId("");
        return;
      }
      // Run queries outside Supabase's auth callback lock.
      authTimer = setTimeout(() => {
        void getCurrentIdentity(next).then((current) => {
          if (mounted) setIdentity(current);
        }).catch(() => {
          if (mounted) setNotice({ text: "โหลดข้อมูลผู้ใช้ไม่สำเร็จ กรุณาลองใหม่", error: true });
        });
      }, 0);
    });
    return () => {
      mounted = false;
      clearTimeout(authTimer);
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!importJob?.active) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [importJob?.active]);
  useEffect(() => {
    if (!identity || identity.profile.role !== "teacher") return;
    let mounted = true;
    setRosterError("");
    const timeout = setTimeout(() => {
      if (mounted) {
        mounted = false;
        setRosterError("โหลดรายชื่อนานเกินไป ข้อมูลที่แสดงอาจยังไม่ครบ กรุณาลองใหม่");
      }
    }, 15000);
    void loadTeacherRoster(identity.profile.id)
      .then((roster) => {
        if (!mounted) return;
        clearTimeout(timeout);
        setState((current) => applyTeacherRoster(current, roster));
        void loadGrowth(roster.students.map((student) => student.id))
          .then((growth) => {
            if (mounted) setState((current) => ({ ...current, growth }));
          })
          .catch((error) => {
            if (mounted) setNotice({ text: error instanceof Error ? error.message : "โหลดข้อมูลการเติบโตไม่สำเร็จ", error: true });
          });
      })
      .catch((error) => {
        clearTimeout(timeout);
        if (mounted) {
          setRosterError(error instanceof Error ? error.message : "โหลดรายชื่อนักเรียนไม่สำเร็จ");
          setNotice({
            text:
              error instanceof Error
                ? error.message
                : "โหลดข้อมูลห้องเรียนไม่สำเร็จ",
            error: true,
          });
        }
      });
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [identity?.profile.id, identity?.profile.role, rosterRetry]);
  useEffect(() => {
    if (!identity) return;
    let mounted = true;
    void loadResources(identity.profile.id, identity.profile.role)
      .then((resources) => {
        if (mounted) setState((current) => ({ ...current, ...resources }));
      })
      .catch((error) => {
        if (mounted) {
          setNotice({
            text: error instanceof Error ? error.message : "โหลดสื่อและประกาศไม่สำเร็จ",
            error: true,
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, [identity?.profile.id, identity?.profile.role]);
  useEffect(() => {
    if (!identity || identity.profile.role !== "student") return;
    let mounted = true;
    setStudentLoadError("");
    const timeout = setTimeout(() => {
      if (mounted) {
        mounted = false;
        setStudentLoadError("โหลดข้อมูลนักเรียนนานเกินไป กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
      }
    }, 15000);
    void loadStudentProfile(identity.profile.id).then((profile) => {
      if (!mounted) return;
      clearTimeout(timeout);
      if (!profile) throw new Error("ไม่พบข้อมูลนักเรียน กรุณาติดต่อครู");
      setStudentId(profile.id);
      setState((current) => ({
        ...current,
        rooms: current.rooms.includes(profile.room)
          ? current.rooms
          : [...current.rooms, profile.room],
        roomSubjects: {
          ...(current.roomSubjects ?? {}),
          [profile.room]: profile.subject ?? "สังคมศึกษา",
        },
        students: [
          ...current.students.filter((student) => student.id !== profile.id),
          profile,
        ],
      }));
      void loadGrowth([profile.id])
        .then((growth) => {
          if (mounted) setState((current) => ({ ...current, growth }));
        })
        .catch((error) => {
          if (mounted) setNotice({ text: error instanceof Error ? error.message : "โหลดข้อมูลการเติบโตไม่สำเร็จ", error: true });
        });
    }).catch((error) => {
      clearTimeout(timeout);
      if (mounted) setStudentLoadError(error instanceof Error ? error.message : "โหลดข้อมูลนักเรียนไม่สำเร็จ");
    });
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [identity?.profile.id, identity?.profile.role, studentRetry]);
  useEffect(() => {
    if (!identity) return;
    let mounted = true;
    void loadWork(identity.profile.id, identity.profile.role)
      .then((work) => {
        if (mounted) setState((current) => applyWorkData(current, work));
      })
      .catch((error) => {
        if (mounted)
          setNotice({
            text: error instanceof Error ? error.message : "โหลดงานไม่สำเร็จ",
            error: true,
          });
      });
    return () => {
      mounted = false;
    };
  }, [identity?.profile.id, identity?.profile.role]);
  function navigate(next: Page) {
    setPage(next);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function open(id: string) {
    setActiveId(id);
    navigate("workspace");
  }
  function clearView() {
    setNewTask(false);
    setEditing(null);
    setReturning(null);
    setDeleting(null);
    setPreview(null);
    setSubmitTask(null);
    setGradeTarget(null);
    setReviewOverride(null);
    setNotice(null);
    navigate("today");
  }
  async function leaveAccount() {
    try {
      await signOut();
      setIdentity(null);
      setLoginRole("teacher");
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "ออกจากระบบไม่สำเร็จ",
        error: true,
      });
    }
  }
  async function refreshIdentity() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("ไม่พบ session กรุณาเข้าสู่ระบบใหม่");
    const current = await getCurrentIdentity(data.session);
    if (!current) throw new Error("บัญชีนี้ยังไม่มีโปรไฟล์ในระบบ");
    setIdentity(current);
    if (current.profile.role === "student") setStudentId(current.profile.id);
  }
  async function createImportedAccounts(
    room: string,
    rows: ImportRow[],
    onProgress?: (progress: ImportProgress) => void,
  ): Promise<State> {
    if (!identity || identity.profile.role !== "teacher")
      throw new Error("กรุณาเข้าสู่ระบบครูก่อน");
    const jobId = importJobId.current + 1;
    importJobId.current = jobId;
    const failures: string[] = [];
    let nextIndex = 0;
    let completed = 0;
    let jobError = false;
    const report = (progress: ImportProgress) => {
      setImportJob({ id: jobId, active: true, ...progress });
      onProgress?.(progress);
    };
    report({ completed: 0, total: rows.length, failed: 0 });
    try {
      const classroomId = await getTeacherClassroomId(identity.profile.id, room);
      const worker = async () => {
        while (true) {
          const index = nextIndex++;
          if (index >= rows.length) return;
          const row = rows[index];
          try {
            await createStudentAccount({
              studentCode: row.input.code,
              displayName: row.input.name,
              classroomId,
              studentNumber: row.input.number,
            });
          } catch (error) {
            failures.push(
              `${row.row}: ${error instanceof Error ? error.message : "สร้างบัญชีไม่สำเร็จ"}`,
            );
          } finally {
            completed += 1;
            report({
              completed,
              total: rows.length,
              failed: failures.length,
            });
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(4, rows.length) }, () => worker()),
      );
      const roster = await loadTeacherRoster(identity.profile.id);
      const nextState = applyTeacherRoster(state, roster);
      setState(nextState);
      if (failures.length)
        throw new Error(`สร้างบัญชีสำเร็จ ${rows.length - failures.length} คน · ${failures.join(" · ")}`);
      return nextState;
    } catch (error) {
      jobError = true;
      throw error;
    } finally {
      const finished = {
        completed,
        total: rows.length,
        failed: Math.max(failures.length, rows.length - completed),
      };
      setImportJob((current) =>
        current?.id === jobId
          ? { ...current, ...finished, active: false, error: jobError || finished.failed > 0 }
          : current,
      );
      onProgress?.(finished);
      window.setTimeout(() => {
        setImportJob((current) =>
          current?.id === jobId && !current.active ? null : current,
        );
      }, 2600);
    }
  }
  async function persistStudentToSupabase(
    next: State,
    previous: Student | undefined,
    _password?: string,
  ): Promise<State> {
    if (!identity || identity.profile.role !== "teacher")
      throw new Error("กรุณาเข้าสู่ระบบครูก่อน");
    const studentToSave = previous
      ? next.students.find((item) => item.id === previous.id)
      : next.students.at(-1);
    if (!studentToSave) throw new Error("ไม่พบข้อมูลนักเรียน");
    if (previous) {
      await updateStudentInSupabase({
        teacherId: identity.profile.id,
        student: studentToSave,
        previousRoom: previous.room,
      });
    } else {
      const classroomId = await getTeacherClassroomId(
        identity.profile.id,
        studentToSave.room,
      );
      await createStudentAccount({
        studentCode: studentToSave.code,
        displayName: studentToSave.name,
        classroomId,
        studentNumber: studentToSave.number,
      });
    }
    const roster = await loadTeacherRoster(identity.profile.id);
    return applyTeacherRoster(next, roster);
  }
  async function persistStudentStatusToSupabase(
    next: State,
    ids: string[],
    status: Student["status"],
  ): Promise<State> {
    if (!identity || identity.profile.role !== "teacher")
      throw new Error("กรุณาเข้าสู่ระบบครูก่อน");
    await updateStudentStatusInSupabase(identity.profile.id, ids, status);
    const roster = await loadTeacherRoster(identity.profile.id);
    return applyTeacherRoster(next, roster);
  }
  async function persistStudentDeletion(next: State, ids: string[]): Promise<State> {
    if (!identity || identity.profile.role !== "teacher")
      throw new Error("กรุณาเข้าสู่ระบบครูก่อน");
    for (const id of ids) await deleteStudentAccount(id);
    const roster = await loadTeacherRoster(identity.profile.id);
    return applyTeacherRoster(next, roster);
  }
  async function persistRoomDeletion(next: State, room: string): Promise<State> {
    if (!identity || identity.profile.role !== "teacher")
      throw new Error("กรุณาเข้าสู่ระบบครูก่อน");
    await removeClassroomFromSupabase(identity.profile.id, room);
    return next;
  }
  async function syncRealAssignments(previous: State, next: State) {
    if (!identity || identity.profile.role !== "teacher") return;
    const previousIds = new Set(previous.assignments.map((assignment) => assignment.id));
    const groups = assignmentGroups(next.assignments);
    for (const group of groups) {
      const representative = group[0];
      const changed = group.some((assignment) => !previousIds.has(assignment.id));
      const before = previous.assignments.find((assignment) => assignment.id === representative.id);
      const fieldsChanged = before
        ? ["title", "description", "category", "rawMax", "finalMax", "due", "opensAt", "closesAt", "submissionRequired", "submissionMode", "groupSize"]
            .some((field) => before[field as keyof Assignment] !== representative[field as keyof Assignment])
        : false;
      if (!changed && !fieldsChanged) continue;
      await saveAssignmentToSupabase(
        identity.profile.id,
        representative,
        [...new Set(group.flatMap((assignment) => assignment.rooms))],
        previousIds.has(representative.id) ? representative.id : undefined,
      );
    }
    const work = await loadWork(identity.profile.id, "teacher");
    setState((current) => applyWorkData(current, work));
  }
  async function resyncWorkFromSupabase() {
    if (!identity) return;
    try {
      const work = await loadWork(identity.profile.id, identity.profile.role);
      setState((current) => {
        const synced = applyWorkData(current, work);
        persist(synced);
        return synced;
      });
    } catch {
      // Keep the visible error from the original operation; the next refresh will retry.
    }
  }
  function commit(next: State, message: string) {
    try {
      const previousRooms = new Set(state.rooms);
      persist(next);
      setState(next);
      setNotice({ text: message });
      if (identity?.profile.role === "teacher") {
        const addedRooms = next.rooms.filter((room) => !previousRooms.has(room));
        void Promise.all(
          addedRooms.map((roomName) => {
            const match = roomName.match(/^ม\.(\d+)\/(\d+)$/);
            return createClassroom({
              teacherId: identity.profile.id,
              name: roomName,
              academicYear: "2569",
              level: match ? `ม.${match[1]}` : "",
              room: match?.[2] ?? roomName,
              subject: next.roomSubjects?.[roomName] ?? "สังคมศึกษา",
            });
          }),
        ).catch(() => {
          setNotice({
            text: "บันทึกหน้าจอแล้ว แต่เพิ่มห้องใน Supabase ไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่",
            error: true,
          });
          void loadTeacherRoster(identity.profile.id).then((roster) => {
            const synced = applyTeacherRoster(state, roster);
            persist(synced);
            setState(synced);
          }).catch(() => undefined);
        });
      }
      return true;
    } catch {
      setNotice({
        text: "บันทึกในเครื่องไม่ได้ พื้นที่อาจเต็ม กรุณาลองไฟล์ขนาดเล็กลง",
        error: true,
      });
      return false;
    }
  }
  function saveReview(
    ids: string[],
    scores: Record<string, string>,
    feedback: string,
  ) {
    try {
      const selected = state.submissions.filter((s) => ids.includes(s.id));
      if (
        selected.some(
          (s) =>
            getGrade(state, s.studentId, s.assignmentId)?.source === "manual",
        )
      ) {
        setOverrideError("");
        setReviewOverride({
          ids,
          scores: { ...scores },
          feedback,
          revisions: Object.fromEntries(
            selected.map((s) => [
              s.id,
              getGrade(state, s.studentId, s.assignmentId)?.revision ?? 0,
            ]),
          ),
        });
        return false;
      }
      const next = review(state, ids, scores, feedback);
      const saved = commit(next, `บันทึกคะแนน ${ids.length} คนแล้ว`);
      if (saved && identity?.profile.role === "teacher") {
        void saveReviewToSupabase(identity.profile.id, next, ids).catch((error) => {
          setNotice({
            text: error instanceof Error ? error.message : "บันทึกคะแนนจริงไม่สำเร็จ",
            error: true,
          });
          void resyncWorkFromSupabase();
        });
      }
      return saved;
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง",
        error: true,
      });
      return false;
    }
  }
  function removeAssignmentLocal(current: State, assignmentId: string): State {
    const target = current.assignments.find((item) => item.id === assignmentId);
    if (!target) throw new Error("ไม่พบงานที่ต้องการลบ");
    const groupId = assignmentGroupId(target);
    const ids = new Set(
      current.assignments
        .filter((item) => assignmentGroupId(item) === groupId)
        .map((item) => item.id),
    );
    return {
      ...current,
      assignments: current.assignments.filter(
        (item) => !ids.has(item.id),
      ),
      submissions: current.submissions.filter(
        (item) => !ids.has(item.assignmentId),
      ),
      grades: (current.grades ?? []).filter(
        (item) => !ids.has(item.assignmentId),
      ),
      gradeEvents: (current.gradeEvents ?? []).filter(
        (item) => !ids.has(item.assignmentId),
      ),
    };
  }
  async function confirmDeleteAssignment() {
    if (!deleting) return;
    try {
      if (identity?.profile.role === "teacher") {
        await deleteAssignmentFromSupabase(identity.profile.id, deleting.id);
      }
      const next = removeAssignmentLocal(state, deleting.id);
      if (commit(next, "ลบงานและข้อมูลที่เกี่ยวข้องแล้ว")) {
        setDeleting(null);
        setActiveId(next.assignments[0]?.id ?? "");
      }
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "ลบงานไม่สำเร็จ",
        error: true,
      });
    }
  }
  if (resetToken) return <PasswordResetPage token={resetToken} />;
  if (authLoading)
    return (
      <div className="preview-login auth-loading" role="status">
        <div className="preview-login-main">
          <SchoolLogo className="preview-school-logo" alt="" state="auth-loading" />
          <p><span className="loading-spinner" aria-hidden="true" /> กำลังตรวจสอบการเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  if (!identity)
    return (
      <PreviewLogin
        dark={dark}
        onTheme={() => setDark(!dark)}
        initialRole={loginRole}
        onAuthenticated={refreshIdentity}
      />
    );
  if (role === "student" && !student)
    return (
      <div className="preview-login auth-loading" role="status">
        <div className="preview-login-main">
          <SchoolLogo className="preview-school-logo" state="student-loading" />
          {studentLoadError ? <>
            <p role="alert">{studentLoadError}</p>
            <p>รหัสนักเรียน {identity.profile.student_code}</p>
            <button type="button" onClick={() => setStudentRetry((value) => value + 1)}>ลองใหม่</button>
            <button type="button" onClick={() => void leaveAccount()}>ออกจากระบบ</button>
          </> : <p><span className="loading-spinner" aria-hidden="true" /> กำลังโหลดข้อมูลนักเรียน...</p>}
        </div>
      </div>
    );
  const menu = [
    {
      key: "today" as Page,
      title: role === "teacher" ? "โต๊ะทำงาน" : "วันนี้ของฉัน",
      icon: LayoutDashboard,
    },
    {
      key: "workspace" as Page,
      title: role === "teacher" ? "พื้นที่งาน" : "งานของฉัน",
      icon: ClipboardList,
    },
    { key: "results" as Page, title: "ความก้าวหน้า", icon: TrendingUp },
    { key: "resources" as Page, title: role === "teacher" ? "สื่อและประกาศ" : "สื่อการเรียนรู้", icon: BookOpen },
  ];
  const moreMenu = [
    { key: "growth" as Page, title: "การเติบโต", icon: Sprout },
    ...(role === "teacher" ? [
      { key: "reports" as Page, title: "รายงาน", icon: File },
      { key: "roster" as Page, title: "ห้องเรียน", icon: Users },
    ] : []),
  ];
  return (
    <div className={`app-shell${importJob ? " has-background-import" : ""}`}>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => navigate("today")}
            aria-label="ห้องเรียนสังคมครูไต๋ หน้าหลัก"
          >
            <span className="logo-wrap">
              <SchoolLogo state={role} />
            </span>
            <span>
              <strong>ห้องเรียนสังคมครูไต๋</strong>
              <small>โรงเรียนเทพศิรินทร์ นนทบุรี</small>
            </span>
          </button>
          <div className="header-actions">
            <button
              className="icon-button theme-button"
              aria-label={dark ? "ใช้โหมดสว่าง" : "ใช้โหมดมืด"}
              title={dark ? "โหมดสว่าง" : "โหมดมืด"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="role-label account-button"
              type="button"
              title="บัญชีและรหัสผ่าน"
              onClick={() => setPasswordDialog(true)}
            >
              <GraduationCap size={18} />
              {identity?.profile.display_name ||
                (role === "teacher" ? "ครูไต๋" : student?.name.split(" ")[0])}
              <KeyRound size={14} aria-hidden="true" />
            </button>
            <button
              className="icon-button account-icon"
              type="button"
              title="เปลี่ยนรหัสผ่าน"
              aria-label="เปลี่ยนรหัสผ่าน"
              onClick={() => setPasswordDialog(true)}
            >
              <KeyRound size={18} />
            </button>
            <button
              className="icon-button logout-button"
              title={importJob?.active ? "กำลังนำเข้า ไม่สามารถออกจากระบบได้" : "ออกจากระบบ"}
              aria-label="ออกจากระบบ"
              disabled={importJob?.active}
              onClick={() => void leaveAccount()}
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>
      <aside className="glass-dock" aria-label="แถบนำทางด้านล่าง">
        <nav className="main-nav" aria-label="เมนูหลัก">
          {menu.map((item) => (
            <button
              key={item.key}
              className={page === item.key && !moreOpen ? "active" : ""}
              aria-current={page === item.key && !moreOpen ? "page" : undefined}
              aria-label={item.title}
              title={item.title}
              onClick={() => navigate(item.key)}
            >
              <item.icon size={21} />
              <span>{item.title}</span>
            </button>
          ))}
          <button
            className={moreOpen ? "active" : ""}
            aria-expanded={moreOpen}
            aria-label="เมนูเพิ่มเติม"
            title="เมนูเพิ่มเติม"
            onClick={() => setMoreOpen((open) => !open)}
          >
            <MoreHorizontal size={21} />
            <span>เพิ่มเติม</span>
          </button>
        </nav>
        {moreOpen && (
          <div className="more-menu" role="menu" aria-label="เมนูเพิ่มเติม">
            {moreMenu.map((item) => (
              <button
                key={item.key}
                role="menuitem"
                className={page === item.key ? "active" : ""}
                aria-current={page === item.key ? "page" : undefined}
                onClick={() => navigate(item.key)}
              >
                <item.icon size={18} />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        )}
      </aside>
      <main className="main-content" key={`${role}:${studentId}`}>
        {role === "teacher" && rosterError && <div role="alert">
          <p>{rosterError}</p>
          <button type="button" onClick={() => setRosterRetry((value) => value + 1)}>โหลดรายชื่อใหม่</button>
        </div>}
        {page === "reports" && role === "teacher" ? (
          <ReportsPage state={state} />
        ) : page === "resources" ? (
          <ResourcesPage
            state={state}
            role={role}
            userId={identity?.profile.role === "teacher" ? identity.profile.id : undefined}
            studentId={identity?.profile.role === "student" ? identity.profile.id : undefined}
            onState={(next) => {
              persist(next);
              setState(next);
            }}
            onNotice={(text, error) => setNotice({ text, error })}
          />
        ) : page === "growth" ? (
          <GrowthPage
            state={state}
            teacher={role === "teacher"}
            studentId={studentId}
            onSave={(growth, message) => {
              const saved = commit({ ...state, growth }, message);
              if (saved && identity?.profile.role === "teacher") {
                void saveGrowth(identity.profile.id, growth).catch((error) => {
                  setNotice({ text: error instanceof Error ? error.message : "บันทึกข้อมูลการเติบโตไม่สำเร็จ", error: true });
                });
              }
              return saved;
            }}
          />
        ) : role === "teacher" ? (
          page === "roster" ? (
            <RosterPage
              state={state}
              onSave={commit}
              onCreateAccounts={identity ? createImportedAccounts : undefined}
              onPersistStudent={identity ? persistStudentToSupabase : undefined}
              onPersistStatus={identity ? persistStudentStatusToSupabase : undefined}
              onPersistDeletion={identity ? persistStudentDeletion : undefined}
              onPersistRoomDeletion={identity ? persistRoomDeletion : undefined}
              onResetStudentPassword={identity ? resetStudentPassword : undefined}
            />
          ) : page === "today" ? (
            <TeacherHome
              state={state}
              onOpen={open}
              onNew={() => setNewTask(true)}
            />
          ) : page === "workspace" ? (
            <Workspace
              state={state}
              activeId={activeId}
              setActiveId={setActiveId}
              onNew={() => setNewTask(true)}
              onPreview={setPreview}
              onReview={saveReview}
              onEdit={setEditing}
              onDelete={setDeleting}
              onReturn={setReturning}
              onGrades={() => navigate("results")}
              now={now}
            />
          ) : (
            <Results
              state={state}
              onEditGrade={(studentId, assignmentId) =>
                setGradeTarget({ studentId, assignmentId })
              }
            />
          )
        ) : page === "results" ? (
          <Results state={state} studentOnly studentId={studentId} />
        ) : (
          student && <StudentHome
            state={state}
            student={student}
            onSubmit={setSubmitTask}
            onPreview={setPreview}
            onScores={() => navigate("results")}
            tasksOnly={page === "workspace"}
            now={now}
          />
        )}
        <footer className="page-footer">
          <span>ห้องเรียนสังคมครูไต๋</span>
          <span>พื้นที่เล็ก ๆ ของการเรียนรู้ที่ยิ่งใหญ่</span>
        </footer>
      </main>
      {importJob && (
        <button
          type="button"
          className={`background-import-pill${importJob.active ? " is-active" : " is-complete"}${importJob.error ? " is-error" : ""}`}
          title="เปิดหน้าห้องเรียนเพื่อดูรายชื่อนักเรียน"
          onClick={() => navigate("roster")}
          aria-live="polite"
        >
          {importJob.active ? (
            <span className="loading-spinner" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" />
          )}
          <span>
            {importJob.active
              ? `กำลังนำเข้า ${importJob.completed}/${importJob.total}`
              : importJob.error
                ? importJob.failed
                  ? `นำเข้าเสร็จ · ไม่สำเร็จ ${importJob.failed}`
                  : "นำเข้าไม่สำเร็จ · ลองใหม่"
                : `นำเข้าเสร็จแล้ว · ${importJob.total} คน`}
          </span>
        </button>
      )}
      {gradeTarget && (
        <GradeEditor
          state={state}
          {...gradeTarget}
          onClose={() => setGradeTarget(null)}
          onSave={(next) => {
            if (!commit(next, "บันทึกคะแนนแล้ว")) return false;
            if (identity?.profile.role === "teacher") {
              void saveGradeToSupabase(
                identity.profile.id,
                next,
                gradeTarget.studentId,
                gradeTarget.assignmentId,
              ).catch((error) => {
                setNotice({
                  text: error instanceof Error ? error.message : "บันทึกคะแนนจริงไม่สำเร็จ",
                  error: true,
                });
                void resyncWorkFromSupabase();
              });
            }
            setGradeTarget(null);
            return true;
          }}
        />
      )}
      {reviewOverride && (
        <Modal
          title="แทนคะแนนที่ครูกรอกไว้?"
          onClose={() => setReviewOverride(null)}
        >
          <div className="modal-body form-stack">
            <p>
              ผลตรวจครั้งนี้จะเปลี่ยนคะแนนปัจจุบัน โดยเก็บค่าเดิมไว้ในประวัติ
            </p>
            <ul className="grade-override-list">
              {reviewOverride.ids.map((id) => {
                const s = state.submissions.find((item) => item.id === id)!;
                const a = state.assignments.find(
                  (item) => item.id === s.assignmentId,
                )!;
                const entry = getGrade(state, s.studentId, s.assignmentId);
                return (
                  <li key={id}>
                    <strong>
                      {state.students.find((st) => st.id === s.studentId)?.name}
                    </strong>
                    <span>{a.title}</span>
                    <span>
                      คะแนนดิบ {entry?.raw ?? "ยังไม่กรอก"} →{" "}
                      {reviewOverride.scores[id] || "ยังไม่กรอก"} / {a.rawMax}
                    </span>
                  </li>
                );
              })}
            </ul>
            {overrideError && (
              <p className="form-error" role="alert">
                {overrideError}
              </p>
            )}
          </div>
          <div className="modal-actions">
            <button
              className="button neutral"
              onClick={() => setReviewOverride(null)}
            >
              ยกเลิก
            </button>
            <button
              className="button coral"
              onClick={() => {
                try {
                  const next = review(
                    state,
                    reviewOverride.ids,
                    reviewOverride.scores,
                    reviewOverride.feedback,
                    {
                      confirmManual: true,
                      expectedRevisions: reviewOverride.revisions,
                    },
                  );
                  if (commit(next, "บันทึกผลตรวจและคะแนนแล้ว")) {
                    if (identity?.profile.role === "teacher") {
                      void saveReviewToSupabase(
                        identity.profile.id,
                        next,
                        reviewOverride.ids,
                      ).catch((error) => {
                        setNotice({
                          text:
                            error instanceof Error
                              ? error.message
                              : "บันทึกคะแนนจริงไม่สำเร็จ",
                          error: true,
                        });
                        void resyncWorkFromSupabase();
                      });
                    }
                    setReviewOverride(null);
                  } else {
                    setOverrideError(
                      "บันทึกในเครื่องไม่ได้ คะแนนเดิมยังอยู่ กรุณาตรวจพื้นที่จัดเก็บแล้วลองใหม่",
                    );
                  }
                } catch (e) {
                  setOverrideError(
                    e instanceof Error ? e.message : "บันทึกไม่สำเร็จ",
                  );
                }
              }}
            >
              <Check size={17} />
              ยืนยันแทนคะแนน
            </button>
          </div>
        </Modal>
      )}
      {notice && (
        <div
          className={`toast ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? (
            <FlaskConical size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <span>{notice.text}</span>
          <button aria-label="ปิดข้อความ" onClick={() => setNotice(null)}>
            <X size={18} />
          </button>
        </div>
      )}
      {(newTask || editing) && (
        <NewAssignment
          initial={editing ?? undefined}
          state={state}
          rooms={state.rooms}
          onClose={() => {
            setNewTask(false);
            setEditing(null);
          }}
          onCreate={(a, confirmed, revisions) => {
            const previous = state;
            let next: State;
            try {
              next = saveAssignmentGroup(previous, a, confirmed, revisions);
            } catch (error) {
              setNotice({
                text: error instanceof Error ? error.message : "บันทึกงานไม่สำเร็จ",
                error: true,
              });
              return false;
            }
            if (
              commit(
                next,
                editing
                  ? "บันทึกการแก้ไขงานแล้ว"
                  : "มอบหมายงานให้ห้องที่เลือกแล้ว",
              )
            ) {
              if (identity?.profile.role === "teacher")
                void syncRealAssignments(previous, next).catch((error) => {
                  setNotice({
                    text: error instanceof Error ? error.message : "บันทึกงานจริงไม่สำเร็จ",
                    error: true,
                  });
                  void resyncWorkFromSupabase();
                });
              setNewTask(false);
              setEditing(null);
              open(a.id);
              return true;
            }
            return false;
          }}
        />
      )}
      {returning && (
        <ReturnWorkForm
          state={state}
          submission={returning}
          onClose={() => setReturning(null)}
          onSave={(next) => {
            if (!commit(next, "ส่งกลับให้นักเรียนแก้ไขแล้ว คะแนนเดิมยังคงอยู่"))
              return false;
            const updated = next.submissions.find(
              (item) => item.id === returning.id,
            );
            if (updated && identity?.profile.role === "teacher") {
              void saveSubmissionStatusToSupabase(
                identity.profile.id,
                updated,
              ).catch((error) =>
                setNotice({
                  text:
                    error instanceof Error
                      ? error.message
                      : "บันทึกสถานะงานจริงไม่สำเร็จ",
                  error: true,
                }),
              );
            }
            setReturning(null);
            return true;
          }}
        />
      )}
      {deleting && (
        <Modal
          title="ลบงานนี้?"
          subtitle={deleting.title}
          onClose={() => setDeleting(null)}
        >
          <div className="modal-body form-stack">
            <p>
              งาน ห้องที่ผูกไว้ คะแนน และไฟล์งานส่งที่เกี่ยวข้องจะถูกลบออก
              การดำเนินการนี้ย้อนกลับไม่ได้
            </p>
          </div>
          <div className="modal-actions">
            <button className="button neutral" onClick={() => setDeleting(null)}>
              ยกเลิก
            </button>
            <button className="button coral" onClick={() => void confirmDeleteAssignment()}>
              ลบงานและไฟล์
            </button>
          </div>
        </Modal>
      )}
      {preview && (
        <SubmissionPreview
          currentGrade={getGrade(
            state,
            preview.studentId,
            preview.assignmentId,
          )}
          student={state.students.find((s) => s.id === preview.studentId)!}
          subject={state.roomSubjects?.[state.students.find((s) => s.id === preview.studentId)?.room ?? ""] ?? "สังคมศึกษา"}
          submission={preview}
          assignment={state.assignments.find(
            (a) => a.id === preview.assignmentId,
          )!}
          onClose={() => setPreview(null)}
        />
      )}
      {submitTask && student && (
        <SubmitWork
          previous={state.submissions.find(
            (s) =>
              s.assignmentId === submitTask.id && s.studentId === student.id,
          )}
          student={student}
          members={state.students.filter((item) => item.room === student.room && item.status === "active")}
          assignment={submitTask}
          onClose={() => setSubmitTask(null)}
          onSubmit={async (s) => {
            const assignment = state.assignments.find((a) => a.id === submitTask.id);
            if (!assignment) return false;
            if (identity?.profile.role === "student") {
              try {
                if (assignment.submissionMode === "group") await submitGroupWorkToSupabase(identity.profile.id, assignment, s);
                else await submitWorkToSupabase(identity.profile.id, assignment, s);
              } catch (error) {
                setNotice({
                  text: error instanceof Error ? error.message : "ส่งงานจริงไม่สำเร็จ",
                  error: true,
                });
                return false;
              }
            }
            if (
              commit(
                assignment?.submissionMode === "group"
                  ? submitGroupWork(state, { ...s, studentId: student.id })
                  : submitWork(state, { ...s, studentId: student.id }),
                "ส่งงานแล้ว ครูจะเห็นงานในคิวรอตรวจ",
              )
            ) {
              setSubmitTask(null);
              return true;
            }
            return false;
          }}
        />
      )}
      {passwordDialog && (
        <PasswordDialog
          onClose={() => setPasswordDialog(false)}
          onSaved={() => setNotice({ text: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" })}
        />
      )}
      {needsRecoveryEmail && identity && (
        <RecoveryEmailDialog
          onClose={() => setRecoveryEmailDismissedFor(identity.profile.id)}
          onSaved={(email) =>
            setIdentity((current) =>
              current
                ? { ...current, profile: { ...current.profile, recovery_email: email } }
                : current,
            )
          }
        />
      )}
    </div>
  );
}

function NewAssignment({
  initial,
  state,
  rooms,
  onClose,
  onCreate,
}: {
  initial?: Assignment;
  state: State;
  rooms: Room[];
  onClose: () => void;
  onCreate: (
    assignment: Assignment,
    confirmed: boolean,
    revisions?: Record<string, number>,
  ) => boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "ใบงาน");
  const [targets, setTargets] = useState<Room[]>(initial?.rooms ?? []);
  const [raw, setRaw] = useState(initial ? String(initial.rawMax) : "");
  const [final, setFinal] = useState(initial ? String(initial.finalMax) : "");
  const [due, setDue] = useState(
    initial?.due ??
      thaiInput(new Date(Date.now() + 7 * 86400000).toISOString()).slice(0, 10),
  );
  const [endTime, setEndTime] = useState(
    initial ? thaiInput(deadline(initial)).slice(11) : "23:59",
  );
  const [opens, setOpens] = useState(
    initial?.opensAt ? thaiInput(initial.opensAt) : "",
  );
  const [allowLate, setAllowLate] = useState(
    initial ? (initial.allowLate ?? true) : false,
  );
  const [submissionRequired, setSubmissionRequired] = useState(
    initial?.submissionRequired ?? true,
  );
  const [submissionMode, setSubmissionMode] = useState<"individual" | "group">(
    initial?.submissionMode ?? "individual",
  );
  const [groupSize, setGroupSize] = useState(String(initial?.groupSize ?? 2));
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const siblings = initial ? siblingAssignments(state, initial) : [];
  const [revisions] = useState(() =>
    initial
      ? Object.fromEntries(siblings.map((a) => [a.id, a.revision ?? 0]))
      : undefined,
  );
  const selectedAssignments = siblings.filter((a) =>
    targets.includes(a.rooms[0]),
  );
  const nextMax = (a: Assignment) => ({
    ...a,
    rawMax: initial && Number(raw) !== initial.rawMax ? Number(raw) : a.rawMax,
    finalMax:
      initial && Number(final) !== initial.finalMax
        ? Number(final)
        : a.finalMax,
  });
  const graded = gradeEntries(state).filter((s) =>
    selectedAssignments.some(
      (a) =>
        a.id === s.assignmentId &&
        (nextMax(a).rawMax !== a.rawMax || nextMax(a).finalMax !== a.finalMax),
    ),
  );
  const changedScale =
    !!initial &&
    (Number(raw) !== initial.rawMax || Number(final) !== initial.finalMax);
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !targets.length || !description.trim()) {
      setError("กรอกชื่อ รายละเอียด และเลือกห้องอย่างน้อย 1 ห้อง");
      return;
    }
    if (
      !Number.isFinite(Number(raw)) ||
      Number(raw) <= 0 ||
      !Number.isInteger(Number(final)) ||
      Number(final) <= 0
    ) {
      setError(
        "คะแนนดิบเต็มต้องมากกว่า 0 และคะแนนเก็บเต็มต้องเป็นจำนวนเต็มบวก",
      );
      return;
    }
    try {
      const saved = onCreate(
        {
          id: initial?.id ?? crypto.randomUUID(),
          title: title.trim(),
          description: description.trim(),
          category,
          rooms: targets,
          rawMax: Number(raw),
          finalMax: Number(final),
          submissionRequired,
          submissionMode: submissionRequired ? submissionMode : "individual",
          groupSize: submissionRequired && submissionMode === "group" ? Math.max(2, Number(groupSize) || 2) : 1,
          due,
          opensAt:
            submissionRequired && opens ? fromThaiInput(opens) : undefined,
          closesAt: !submissionRequired
            ? fromThaiInput(`${due}T23:59`)
            : initial && `${due}T${endTime}` === thaiInput(deadline(initial))
              ? deadline(initial)
              : fromThaiInput(`${due}T${endTime}`),
          allowLate: submissionRequired && allowLate,
          color:
            category === "กิจกรรม"
              ? "gold"
              : category === "แบบฝึกหัด"
                ? "sky"
                : "teal",
        },
        confirmed,
        revisions,
      );
      if (!saved)
        setError("บันทึกในเครื่องไม่ได้ กรุณาตรวจพื้นที่จัดเก็บแล้วลองใหม่");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกงานไม่สำเร็จ");
    }
  }
  return (
    <Modal
      title={initial ? "แก้ไขงาน" : "ชวนให้เกิดการเรียนรู้"}
      subtitle={initial ? initial.title : "มอบหมายงานใหม่"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          <label>
            ชื่องาน
            <input
              required
              maxLength={120}
              placeholder="วันนี้อยากให้นักเรียนลองทำอะไร"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            โจทย์หรือรายละเอียด
            <textarea
              required
              rows={3}
              maxLength={2000}
              placeholder="เขียนโจทย์ของคุณ..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <fieldset>
            <legend>
              {initial ? "แก้ไขห้องไหนบ้าง" : "ส่งให้ห้องไหนบ้าง"}
            </legend>
            <div className="room-checkboxes">
              {(initial ? siblings.map((a) => a.rooms[0]) : rooms).map((r) => (
                <label key={r} className={targets.includes(r) ? "checked" : ""}>
                  <input
                    type="checkbox"
                    checked={targets.includes(r)}
                    onChange={(e) => {
                      setConfirmed(false);
                      setTargets(
                        e.target.checked
                          ? [...targets, r]
                          : targets.filter((x) => x !== r),
                      );
                    }}
                  />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>
          {initial && (
            <section
              className="room-edit-summary"
              aria-label="ห้องที่ได้รับผลกระทบ"
            >
              <h3>
                เปลี่ยน {targets.length} ห้อง · คงเดิม{" "}
                {siblings.length - targets.length} ห้อง
              </h3>
              <ul>
                {selectedAssignments.map((a) => (
                  <li key={a.id}>
                    <strong>{a.rooms[0]}</strong>
                    <span>
                      ดิบ {a.rawMax} → {nextMax(a).rawMax || "—"} · เก็บ{" "}
                      {a.finalMax} → {nextMax(a).finalMax || "—"}
                    </span>
                    <span>
                      กำหนดส่ง {formatDate(a.due)}
                      {due !== initial.due
                        ? ` → ${formatDate(due || a.due)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="form-columns work-schedule">
            <label>
              ประเภทงาน
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>ใบงาน</option>
                <option>กิจกรรม</option>
                <option>แบบฝึกหัด</option>
                <option>สอบ</option>
              </select>
            </label>
            <label>
              {submissionRequired ? "ส่งภายใน" : "วันที่กิจกรรม"}
              <input
                required
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          </div>
          <label>
            วิธีรับคะแนน
            <select
              aria-label="วิธีรับคะแนน"
              value={submissionRequired ? "submission" : "manual"}
              onChange={(e) =>
                setSubmissionRequired(e.target.value === "submission")
              }
            >
              <option value="submission">รับงานส่งบนเว็บ</option>
              <option value="manual">บันทึกคะแนนอย่างเดียว</option>
            </select>
          </label>
          <div className="form-columns work-schedule" hidden={!submissionRequired}>
            <label>
              รูปแบบการส่ง
              <select value={submissionMode} disabled={!submissionRequired} onChange={(e) => setSubmissionMode(e.target.value as "individual" | "group")}>
                <option value="individual">ส่งเดี่ยว</option>
                <option value="group">ส่งงานกลุ่ม</option>
              </select>
            </label>
            <label hidden={submissionMode !== "group"}>
              จำนวนสมาชิกสูงสุด
              <input type="number" min="2" max="50" step="1" value={groupSize} onChange={(e) => setGroupSize(e.target.value)} />
            </label>
          </div>
          <div
            className="form-columns work-schedule"
            hidden={!submissionRequired}
          >
            <label>
              เวลาเปิดรับ (เว้นว่าง = เปิดทันที)
              <input
                type="datetime-local"
                disabled={!submissionRequired}
                value={opens}
                onChange={(e) => setOpens(e.target.value)}
              />
            </label>
            <label>
              เวลาปิดรับ
              <input
                type="time"
                disabled={!submissionRequired}
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
          <p className="muted">วันและเวลาประเทศไทย</p>
          <label
            className="checkbox-label work-check"
            hidden={!submissionRequired}
          >
            <input
              type="checkbox"
              checked={allowLate}
              onChange={(e) => setAllowLate(e.target.checked)}
            />
            รับงานล่าช้าหลังเวลาปิดรับ
          </label>
          <div className="form-columns">
            <label>
              คะแนนดิบเต็ม
              <input
                required
                type="number"
                min="0.5"
                max="1000"
                step="0.5"
                placeholder="เช่น 20"
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              คะแนนเก็บเต็ม
              <input
                required
                type="number"
                min="1"
                max="1000"
                step="1"
                placeholder="เช่น 10"
                value={final}
                onChange={(e) => {
                  setFinal(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
          </div>
          {changedScale && graded.length > 0 && (
            <section className="work-warning" aria-label="ผลกระทบต่อคะแนน">
              <h3>คะแนนที่ตรวจแล้วจะเปลี่ยน {graded.length} คน</h3>
              <p>คงคะแนนดิบเดิม และคำนวณคะแนนเก็บใหม่ตามคะแนนเต็มที่ปรับ</p>
              <ul>
                {graded.map((s) => (
                  <li key={s.id}>
                    <span>
                      {state.students.find((st) => st.id === s.studentId)?.name}{" "}
                      ·{" "}
                      {
                        state.assignments.find((a) => a.id === s.assignmentId)
                          ?.rooms[0]
                      }
                    </span>
                    <strong>
                      {gradePoints(
                        s,
                        state.assignments.find((a) => a.id === s.assignmentId)!,
                      )}{" "}
                      →{" "}
                      {Number(raw) > 0 && Number(final) > 0
                        ? gradePoints(
                            s,
                            nextMax(
                              state.assignments.find(
                                (a) => a.id === s.assignmentId,
                              )!,
                            ),
                          )
                        : "—"}
                    </strong>
                  </li>
                ))}
              </ul>
              <label className="checkbox-label work-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                ยืนยันปรับคะแนนเก็บของงานนี้
              </label>
            </section>
          )}
          {!!initial?.edits?.length && (
            <details className="work-edit-history">
              <summary>ประวัติแก้ไขงาน {initial.edits.length} ครั้ง</summary>
              {initial.edits
                .slice()
                .reverse()
                .map((edit, i) => (
                  <p key={i}>
                    {dateTime(edit.at)} · ก่อนแก้: {edit.before.title} · ดิบ{" "}
                    {edit.before.rawMax} → เก็บ {edit.before.finalMax}
                  </p>
                ))}
            </details>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button neutral" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="button gold" type="submit">
            <Plus size={18} />
            {initial ? "บันทึกการแก้ไข" : `มอบหมายให้ ${targets.length} ห้อง`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SubmissionPreview({
  currentGrade,
  student,
  subject,
  submission,
  assignment,
  onClose,
}: {
  currentGrade?: GradeEntry;
  student: Student;
  subject: string;
  submission: Submission;
  assignment: Assignment;
  onClose: () => void;
}) {
  const url = safeLink(submission.link ?? "");
  const file = submission.file;
  return (
    <Modal
      title={assignment.title}
      subtitle={`${student.name} · ${student.room}`}
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <div className="preview-meta">
          <span>ส่งเมื่อ {formatDate(submission.submittedAt)}</span>
          <Status status={submission.status} />
        </div>
        <div className="paper-preview">
          <div className="paper-heading">
            <BookOpen size={20} />
            <span>{subject} · {assignment.category}</span>
          </div>
          <h3>{assignment.title}</h3>
          <p className="paper-question">{assignment.description}</p>
          <div className="paper-answer">
            {submission.response || "ส่งคำตอบเป็นไฟล์แนบ"}
          </div>
          {url && (
            <a
              className="button neutral"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              เปิดลิงก์งาน
              <ExternalLink size={16} />
            </a>
          )}
          {file && <FilePreview file={file} compact={false} />}
          {file && (
            <a className="button neutral" href={file.data} target="_blank" rel="noopener noreferrer" download={file.name}>
              <File size={17} />
              เปิดหรือดาวน์โหลด {file.name}
            </a>
          )}
        </div>
        {currentGrade && (
          <section className="feedback-result">
            <div>
              <span className="eyebrow">คำตอบจากครู</span>
              <p>
                {currentGrade.note ||
                  submission.feedback ||
                  "ครูบันทึกคะแนนแล้วครับ"}
              </p>
              {currentGrade.source === "manual" && (
                <small>คะแนนปัจจุบันจากการกรอกโดยครู</small>
              )}
            </div>
            <strong>
              {gradePoints(currentGrade, assignment)}
              <small> / {assignment.finalMax}</small>
            </strong>
          </section>
        )}
        {submission.status === "returned" && (
          <div className="work-warning">
            <strong>สิ่งที่ครูให้แก้ไข</strong>
            <p>{submission.revisionNote}</p>
            <p>{availability(assignment, Date.now(), submission).label}</p>
          </div>
        )}
        <WorkHistory submission={submission} />
      </div>
      <div className="modal-actions">
        <button className="button teal" onClick={onClose}>
          <Check size={18} />
          เรียบร้อย
        </button>
      </div>
    </Modal>
  );
}

function SubmitWork({
  previous,
  student,
  members,
  assignment,
  onClose,
  onSubmit,
}: {
  previous?: Submission;
  student: Student;
  members: Student[];
  assignment: Assignment;
  onClose: () => void;
  onSubmit: (s: Submission) => boolean | Promise<boolean>;
}) {
  const [kind, setKind] = useState<"text" | "link" | "file">(
    previous?.file ? "file" : previous?.link ? "link" : "text",
  );
  const [response, setResponse] = useState(previous?.response ?? "");
  const [link, setLink] = useState(previous?.link ?? "");
  const [file, setFile] = useState<Submission["file"]>(previous?.file);
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>(previous?.groupMemberIds ?? [student.id]);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  async function readFile(value: File | undefined) {
    setFile(undefined);
    setError("");
    if (!value) return;
    if (
      !["application/pdf", "image/png", "image/jpeg"].includes(value.type) ||
      value.size > 2 * 1024 * 1024
    ) {
      setError("เลือก PDF, PNG หรือ JPG ขนาดไม่เกิน 2 MB");
      return;
    }
    setReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
        reader.readAsDataURL(value);
      });
      setFile({ name: value.name, type: value.type, data });
    } catch {
      setError("อ่านไฟล์ไม่สำเร็จ กรุณาลองเลือกใหม่");
    } finally {
      setReading(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (kind === "text" && !response.trim()) {
      setError("เขียนคำตอบก่อนส่งงาน");
      return;
    }
    const url = safeLink(link);
    if (kind === "link" && !url) {
      setError("ใส่ลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://");
      return;
    }
    if (kind === "file" && !file) {
      setError("เลือกไฟล์ก่อนส่งงาน");
      return;
    }
    if (assignment.submissionMode === "group" && groupMemberIds.length < 2) {
      setError("เลือกสมาชิกกลุ่มอย่างน้อย 2 คน");
      return;
    }
    try {
      setSubmitting(true);
      const saved = await onSubmit({
        id: crypto.randomUUID(),
        assignmentId: assignment.id,
        studentId: student.id,
        groupId: assignment.submissionMode === "group" ? crypto.randomUUID() : undefined,
        groupMemberIds: assignment.submissionMode === "group" ? groupMemberIds : [student.id],
        response: response.trim(),
        ...(kind === "link" ? { link: url! } : {}),
        ...(kind === "file" ? { file } : {}),
        submittedAt: new Date().toISOString(),
        status: "pending",
        score: null,
        feedback: "",
      });
      if (!saved)
        setError(
          "ส่งงานไม่สำเร็จ ข้อมูลยังไม่ถูกบันทึก กรุณาตรวจพื้นที่จัดเก็บหรือลองไฟล์เล็กลง",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งงานไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Modal
      title={assignment.title}
      subtitle={`งานของ${student.name} · ส่งภายใน ${formatDate(assignment.due)}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body form-stack">
          {previous && (
            <div className="work-warning">
              <strong>ฉบับแก้ไขครั้งที่ {(previous.revision ?? 1) + 1}</strong>
              <p>{previous.revisionNote}</p>
              <p>{availability(assignment, Date.now(), previous).label}</p>
              <p>คะแนนที่ตรวจแล้วจะคงอยู่จนกว่าครูตรวจฉบับใหม่</p>
            </div>
          )}
          <p className="assignment-description">{assignment.description}</p>
          <div className="submit-modes" role="group" aria-label="รูปแบบส่งงาน">
            {(
              [
                { id: "text", text: "เขียนคำตอบ", icon: ClipboardList },
                { id: "link", text: "แนบลิงก์", icon: ArrowUpRight },
                { id: "file", text: "แนบไฟล์", icon: Upload },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={kind === mode.id}
                className={kind === mode.id ? "active" : ""}
                onClick={() => {
                  setKind(mode.id);
                  setError("");
                }}
              >
                <mode.icon size={17} />
                {mode.text}
              </button>
            ))}
          </div>
          {assignment.submissionMode === "group" && (
            <fieldset className="group-members">
              <legend>เลือกสมาชิกกลุ่ม ({groupMemberIds.length}/{assignment.groupSize ?? 2})</legend>
              {members.map((member) => <label key={member.id} className="checkbox-label"><input type="checkbox" checked={groupMemberIds.includes(member.id)} disabled={member.id !== student.id && groupMemberIds.length >= (assignment.groupSize ?? 2)} onChange={(event) => setGroupMemberIds((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} />{member.name} · {member.code}{member.id === student.id ? " (ฉัน)" : ""}</label>)}
            </fieldset>
          )}
          {kind === "link" && (
            <label>
              ลิงก์งาน
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://..."
                required
              />
            </label>
          )}
          {kind === "file" && (
            <label className="upload-area">
              <Upload size={26} />
              <strong>
                {reading
                  ? "กำลังอ่านไฟล์..."
                  : file?.name || "เลือกไฟล์"}
              </strong>
              <span>PDF, PNG, JPG · ไม่เกิน 2 MB</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                disabled={reading}
                onChange={(e) => void readFile(e.target.files?.[0])}
              />
            </label>
          )}
          <label>
            {kind === "text" ? "คำตอบของฉัน" : "ข้อความถึงครู (ไม่บังคับ)"}
            <textarea
              rows={6}
              maxLength={5000}
              required={kind === "text"}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="เขียนสิ่งที่ได้เรียนรู้..."
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button neutral" onClick={onClose}>
            <ArrowLeft size={17} />
            กลับไปแก้ต่อ
          </button>
          <button className="button gold" type="submit" disabled={reading || submitting}>
            <Send size={17} />
            {submitting ? "กำลังส่ง..." : "ยืนยันส่งงาน"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
