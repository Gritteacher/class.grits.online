import { MAX_IMPORT_BYTES, type ImportSheet } from "./importModel";

export async function readSpreadsheet(
  file: File,
  signal: AbortSignal,
): Promise<ImportSheet[]> {
  if (!/\.(xls|xlsx)$/i.test(file.name))
    throw new Error("เลือกไฟล์ .xls หรือ .xlsx เท่านั้น");
  if (!file.size || file.size > MAX_IMPORT_BYTES)
    throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 5 MB และไม่เป็นไฟล์ว่าง");
  const bytes = await file.arrayBuffer();
  if (signal.aborted) throw new Error("ยกเลิกการอ่านไฟล์แล้ว");
  // A worker keeps parsing off the UI thread and can be terminated on cancel/timeout.
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./excel.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const abort = () => fail("ยกเลิกการอ่านไฟล์แล้ว");
    const timer = setTimeout(
      () => fail("อ่านไฟล์นานเกินไป กรุณาแยกรายชื่อเป็นไฟล์ที่เล็กลง"),
      15000,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => fail("อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่");
    worker.onmessage = (
      event: MessageEvent<{ sheets?: ImportSheet[]; error?: string }>,
    ) => {
      cleanup();
      if (event.data.sheets) resolve(event.data.sheets);
      else reject(new Error(event.data.error ?? "อ่านไฟล์ไม่สำเร็จ"));
    };
    worker.postMessage(bytes, [bytes]);
  });
}
