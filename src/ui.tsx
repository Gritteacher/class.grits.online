import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  Lightbulb,
  NotebookPen,
  X,
} from "lucide-react";
import type { Assignment } from "./model";

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <div>
          {subtitle && <p className="eyebrow">{subtitle}</p>}
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="ปิดหน้าต่าง"
          title="ปิด"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
export function AssignmentIcon({
  assignment,
  small = false,
}: {
  assignment: Assignment;
  small?: boolean;
}) {
  const Icon =
    assignment.category === "กิจกรรม"
      ? Lightbulb
      : assignment.category === "แบบฝึกหัด"
        ? NotebookPen
        : BookOpen;
  return (
    <span
      className={`assignment-icon ${assignment.color} ${small ? "small" : ""}`}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}
export function Status({
  status,
}: {
  status: "pending" | "reviewed" | "missing" | "returned";
}) {
  return (
    <span className={`badge ${status}`}>
      <span className="status-dot" />
      {status === "pending"
        ? "รอตรวจ"
        : status === "reviewed"
          ? "ตรวจแล้ว"
          : status === "returned"
            ? "ส่งกลับแก้ไข"
            : "ยังไม่ส่ง"}
    </span>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <FileText />
      <p>{children}</p>
    </div>
  );
}
export function ScoreRing({
  value,
  max,
  small = false,
}: {
  value: number;
  max: number;
  small?: boolean;
}) {
  return (
    <div
      className={`score-ring ${small ? "small" : ""}`}
      style={
        {
          "--progress": `${max ? Math.min(100, (value / max) * 100) : 0}%`,
        } as CSSProperties
      }
      role="img"
      aria-label={`คะแนน ${value} จาก ${max}`}
    >
      <div>
        <strong>{value}</strong>
        <span>จาก {max} คะแนน</span>
      </div>
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={17} />
    </button>
  );
}
