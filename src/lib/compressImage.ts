const MAX_EDGE = 2560;
const TARGET_BYTES = 1500 * 1024;

export async function compressImage(file: File): Promise<File> {
  // Leave animated, vector and unsupported formats unchanged.
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    let scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale === 1 && file.size <= 300 * 1024) return file;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("ไม่สามารถเตรียมรูปภาพได้ กรุณาลองใหม่");
    let best: Blob | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) : reject(new Error("ย่อรูปภาพไม่สำเร็จ")), file.type, 0.85);
      });
      if (blob.type !== file.type) return file;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= TARGET_BYTES) break;
      scale *= 0.8;
    }
    if (!best || best.size >= file.size) return file;
    return new File([best], file.name, { type: file.type, lastModified: file.lastModified });
  } finally {
    URL.revokeObjectURL(url);
  }
}
