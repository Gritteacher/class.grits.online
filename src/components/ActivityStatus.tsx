import { useEffect, useState, useSyncExternalStore } from "react";
import { getActivity, subscribeActivity } from "../lib/activity";

export function ActivityStatus({ inline = false }: { inline?: boolean }) {
  const activity = useSyncExternalStore(subscribeActivity, getActivity, getActivity);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(activity.total > 0), activity.total ? 150 : 200);
    return () => window.clearTimeout(timer);
  }, [activity.total > 0]);
  if (!visible) return null;
  const label = activity.uploading ? "กำลังอัปโหลดไฟล์" : activity.saving ? "กำลังบันทึกข้อมูล" : "กำลังโหลดข้อมูล";
  return <div className={`activity-status ${inline ? "inline" : "floating"}`} role="status" aria-live="polite">
    <span className="loading-spinner" aria-hidden="true" />
    <span>{label}</span>
    <span className="activity-track" aria-hidden="true"><span /></span>
  </div>;
}
