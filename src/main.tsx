import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initializeLineEntry, isLineEntry } from "./lib/lineEntry";
import "./styles.css";
import "./shell.css";

const root = createRoot(document.getElementById("root")!);
const renderApp = () => root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Let LIFF finish processing its redirect credentials before mounting the app.
// LINE identity does not replace the existing classroom authentication.
if (isLineEntry()) {
  root.render(<main style={{ padding: 24 }} role="status">กำลังเปิดห้องเรียนผ่าน LINE…</main>);
  void initializeLineEntry().then(renderApp).catch(() => {
    root.render(
      <main style={{ padding: 24 }}>
        <p role="alert">เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่ หรือเปิดเว็บผ่านเบราว์เซอร์</p>
        <a href="https://liff.line.me/2012019762-QjgazsLZ">ลองอีกครั้ง</a>
        <p><a href="https://class.grits.online/?openExternalBrowser=1">เปิดเว็บปกติ</a></p>
      </main>,
    );
  });
} else {
  renderApp();
}
