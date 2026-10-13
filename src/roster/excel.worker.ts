import { parseWorkbook } from "./excel";

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage({ sheets: parseWorkbook(event.data) });
  } catch {
    self.postMessage({
      error:
        "อ่านไฟล์ Excel ไม่ได้ ไฟล์อาจเสียหาย มีรหัสผ่าน เกินขีดจำกัด หรือรูปแบบไม่รองรับ",
    });
  }
};
