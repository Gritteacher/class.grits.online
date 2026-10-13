import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Prebundle worker dependencies before the first file selection in development.
  optimizeDeps: { include: ["xlsx", "xlsx/dist/cpexcel.full.mjs"] },
  server: { host: "127.0.0.1" },
});
