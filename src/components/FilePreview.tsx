import { File, FileText, Image as ImageIcon } from "lucide-react";

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
  const canRender = /^https?:\/\//i.test(file.data) || file.data.startsWith("data:");
  const label = compact ? "กดเพื่อดูไฟล์" : file.name;
  const body = isImage(file) && canRender ? (
    <img className={compact ? "file-preview-thumb" : "file-preview-image"} src={file.data} alt={file.name} />
  ) : isPdf(file) && canRender ? (
    <iframe className={compact ? "file-preview-pdf-thumb" : "file-preview-pdf"} src={`${file.data}#toolbar=0&navpanes=0`} title={file.name} />
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
      {body}
      {compact && <span className="file-preview-caption">{file.name}</span>}
    </button>
  );
}
