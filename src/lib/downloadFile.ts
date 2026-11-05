import { trackedFetch } from "./activity";

export async function downloadFile(url: string, name: string) {
  const response = await trackedFetch(url);
  if (!response.ok) throw new Error("ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name.replace(/[\\/:*?"<>|]/g, "_") || "download";
  document.body.append(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  }
}
