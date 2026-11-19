import { useEffect, useRef } from "react";
import type { Student } from "../model";

const colors = ["#d9efeb", "#fff0aa", "#f7dcd0", "#dbeaf6", "#e4ead1", "#eddff0"];
export function WheelCanvas({ students, rotation, moving, onStop }: { students: Student[]; rotation: number; moving: boolean; onStop: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 720; canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 720, 720);
    const n = students.length;
    if (!n) { ctx.fillStyle = "#e2ede9"; ctx.beginPath(); ctx.arc(360, 360, 344, 0, Math.PI * 2); ctx.fill(); return; }
    const arc = Math.PI * 2 / n;
    students.forEach((student, i) => {
      const from = -Math.PI / 2 + i * arc, middle = from + arc / 2;
      ctx.beginPath(); ctx.moveTo(360, 360); ctx.arc(360, 360, 344, from, from + arc); ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; ctx.fill(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(360, 360); ctx.rotate(middle);
      const name = student.name.replace(/^(นางสาว|นาย|เด็กชาย|เด็กหญิง|น\.ส\.)\s*/, "").split(" ")[0];
      const label = `${student.number} ${Array.from(name).slice(0, n > 32 ? 5 : 10).join("")}`;
      ctx.font = `${n > 50 ? 13 : n > 32 ? 20 : n > 20 ? 22 : 24}px Prompt, sans-serif`;
      ctx.fillStyle = "#223d3b";
      if (Math.cos(middle) < 0) { ctx.rotate(Math.PI); ctx.textAlign = "left"; ctx.fillText(label, -322, 6, 218); }
      else { ctx.textAlign = "right"; ctx.fillText(label, 322, 6, 218); }
      ctx.restore();
    });
  }, [students]);
  return <div className="wheel-stage">
    <div className="wheel-pointer" aria-hidden="true" />
    <canvas ref={ref} role="img" aria-label={`วงล้อสุ่มนักเรียน ${students.length} คน`} onTransitionEnd={event => { if (event.propertyName === "transform") onStop(); }}
      style={{ transform: `rotate(${rotation}deg)`, transition: moving ? "transform 4.2s cubic-bezier(.12,.68,.12,1)" : "none" }} />
    <span className="wheel-hub" aria-hidden="true"><img src="/school-logo.png" alt="" /></span>
  </div>;
}

export function startWheelAudio(enabled: boolean) {
  if (!enabled) return () => {};
  try {
    const context = new AudioContext();
    void context.resume();
    const tone = (frequency: number, at = context.currentTime, duration = 0.035) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, at); gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(at); oscillator.stop(at + duration);
    };
    tone(640);
    const timer = setInterval(() => tone(640), 160);
    return (finish = false) => {
      clearInterval(timer);
      if (finish) [660, 830, 990].forEach((frequency, i) => tone(frequency, context.currentTime + i * 0.11, 0.12));
      setTimeout(() => void context.close().catch(() => {}), finish ? 600 : 0);
    };
  } catch { return () => {}; }
}
