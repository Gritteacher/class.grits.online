import { File, FileText, Image as ImageIcon } from "lucide-react";
import { useState } from "react";

type PreviewFile = { name: string; data: string; type: string };

function isImage(file: PreviewFile) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}

function isPdf(file: PreviewFile) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function FilePreview({
  file,
  compact = true,
  onOpen,
}: {
  file: PreviewFile;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const canRender = /^https?:\/\//i.test(file.data) || file.data.startsWith("data:");
  const previewable = canRender && (isImage(file) || isPdf(file));
  const loading = previewable && loaded !== file.data && failed !== file.data;
  const label = compact ? "กดเพื่อดูไฟล์" : file.name;
  const body = isImage(file) && canRender ? (
    <img className={compact ? "file-preview-thumb" : "file-preview-image"} src={file.data} alt={file.name}
      onLoad={() => setLoaded(file.data)} onError={() => setFailed(file.data)} />
  ) : isPdf(file) && canRender ? (
    <iframe className={compact ? "file-preview-pdf-thumb" : "file-preview-pdf"} src={`${file.data}#toolbar=0&navpanes=0`} title={file.name}
      onLoad={() => setLoaded(file.data)} onError={() => setFailed(file.data)} />
  ) : (
    <span className="file-preview-generic">
      {isPdf(file) ? <FileText size={compact ? 20 : 28} /> : isImage(file) ? <ImageIcon size={compact ? 20 : 28} /> : <File size={compact ? 20 : 28} />}
      <span>{file.name}</span>
    </span>
  );

  return (
    <button
      type="button"
      className={`file-preview ${compact ? "compact" : "expanded"}`}
      onClick={onOpen}
      disabled={!onOpen}
      aria-label={`${label}: ${file.name}`}
      title={onOpen ? label : file.name}
    >
      <span className="file-preview-media" aria-busy={loading}>
        {failed && failed === file.data ? <span className="file-preview-generic">โหลดตัวอย่างไม่สำเร็จ</span> : body}
        {loading && <span className="file-preview-loading" role="status" aria-label="กำลังโหลดตัวอย่างไฟล์"><span className="loading-spinner" aria-hidden="true" /></span>}
      </span>
      {compact && <span className="file-preview-caption">{file.name}</span>}
    </button>
  );
}
