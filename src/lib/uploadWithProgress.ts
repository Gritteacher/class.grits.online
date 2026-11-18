export function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number | null) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 5 * 60 * 1000;
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      onProgress(event.lengthComputable && event.total > 0
        ? Math.min(99, Math.floor(event.loaded / event.total * 100))
        : null);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else reject(new Error("อัปโหลดไฟล์สื่อไม่สำเร็จ กรุณาลองใหม่"));
    };
    xhr.onerror = () => reject(new Error("การเชื่อมต่อขัดข้อง อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่"));
    xhr.ontimeout = () => reject(new Error("อัปโหลดนานเกินไป กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"));
    xhr.onabort = () => reject(new Error("การอัปโหลดถูกยกเลิก กรุณาลองใหม่"));
    // Match Supabase's signed-upload multipart format; the URL grants this path only.
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.send(body);
  });
}
