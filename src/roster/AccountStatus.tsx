import { useEffect, useState } from "react";
import { CheckCircle2, LogIn, Minus, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { trackedFetch } from "../lib/activity";

export type AccountStatus = { id: string; registeredAt: string | null; lastSignInAt: string | null; loginStatusKnown: boolean };

export function useAccountStatuses(classroomId: string | undefined, memberKey: string) {
  const [statuses, setStatuses] = useState<Record<string, AccountStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setStatuses({});
    setError("");
    setLoading(!!classroomId);
    if (!classroomId) return;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("กรุณาเข้าสู่ระบบครูใหม่เพื่อตรวจสอบสถานะบัญชี");
        const response = await trackedFetch("/api/student-account-status", {
          method: "POST", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
          headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ classroomId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "โหลดสถานะบัญชีไม่สำเร็จ");
        if (active) setStatuses(Object.fromEntries((result.students as AccountStatus[]).map(item => [item.id, item])));
      } catch (error) {
        if (active) setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "โหลดสถานะบัญชีไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [classroomId, memberKey, revision]);
  return { statuses, loading, error, refresh: () => setRevision(value => value + 1) };
}

const date = (value: string) => new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export function AccountMarkers({ status, loading }: { status?: AccountStatus; loading: boolean }) {
  if (!status) return <p className="account-status-pending">{loading ? "กำลังตรวจสอบบัญชี..." : "ยังตรวจสอบสถานะบัญชีไม่ได้"}</p>;
  return <div className="account-markers">
    <span className={status.registeredAt ? "account-marker confirmed" : "account-marker"} title={status.registeredAt ? `ลงทะเบียน ${date(status.registeredAt)}` : undefined}>
      {status.registeredAt ? <CheckCircle2 size={14} /> : <Minus size={14} />}
      {status.registeredAt ? "ลงทะเบียนแล้ว" : "ยังไม่ลงทะเบียน"}
    </span>
    <span className={status.loginStatusKnown && status.lastSignInAt ? "account-marker confirmed" : "account-marker"}>
      {status.loginStatusKnown && status.lastSignInAt ? <LogIn size={14} /> : <Minus size={14} />}
      {!status.loginStatusKnown ? "ตรวจสอบการเข้าใช้ไม่ได้" : status.lastSignInAt ? "เคยเข้าสู่ระบบแล้ว" : "ยังไม่เคยเข้าสู่ระบบ"}
    </span>
    {status.loginStatusKnown && status.lastSignInAt && <small className="account-last-login">เข้าใช้ล่าสุด {date(status.lastSignInAt)}</small>}
  </div>;
}

export function AccountStatusRefresh({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return <button type="button" className="icon-button" aria-label="อัปเดตสถานะบัญชี" title="อัปเดตสถานะบัญชี" disabled={loading} onClick={onClick}>
    {loading ? <span className="loading-spinner" aria-hidden="true" /> : <RefreshCw size={17} />}
  </button>;
}
