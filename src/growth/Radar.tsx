import { useState } from "react";
import { ChevronRight, FileCheck2 } from "lucide-react";
import { axes, type AxisId, type AxisResult } from "./model";
import { formatDate } from "../model";

export function Radar({
  current,
  previous,
}: {
  current: AxisResult[];
  previous: AxisResult[];
}) {
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState<AxisId>("completion");
  const axis = axes.find((a) => a.id === selected)!;
  const result = current.find((a) => a.id === selected)!;
  const old = previous.find((a) => a.id === selected)!;
  const point = (index: number, value: number, radius = 98) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3;
    return [
      180 + (Math.cos(angle) * radius * value) / 100,
      150 + (Math.sin(angle) * radius * value) / 100,
    ];
  };
  const shape = (values: number[]) =>
    values.map((v, i) => point(i, v).join(",")).join(" ");
  function series(data: AxisResult[], previous = false) {
    const complete = data.every((a) => a.value !== null);
    return (
      <g className={previous ? "radar-previous" : "radar-current"}>
        {complete ? (
          <polygon points={shape(data.map((a) => a.value!))} />
        ) : (
          data.map((a, i) => {
            const next = data[(i + 1) % 6];
            if (a.value === null || next.value === null) return null;
            const p = point(i, a.value);
            const q = point((i + 1) % 6, next.value);
            return <line key={a.id} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />;
          })
        )}
        {data.map((a, i) =>
          a.value === null ? null : (
            <circle
              key={a.id}
              cx={point(i, a.value)[0]}
              cy={point(i, a.value)[1]}
              r={previous ? 3 : selected === a.id ? 6 : 4}
            />
          ),
        )}
      </g>
    );
  }
  return (
    <section className="growth-radar" aria-label="พัฒนาการ 6 ด้าน">
      <div className="section-title">
        <div>
          <p className="eyebrow">พัฒนาการ 6 ด้าน</p>
          <h2>มองเห็นทุกด้านของการเติบโต</h2>
        </div>
        <span className="growth-period">28 วันล่าสุด</span>
      </div>
      <div className="radar-controls">
        <span>
          <i className="legend-current" />
          ช่วงปัจจุบัน
        </span>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
          />
          เทียบ 28 วันก่อนหน้า
        </label>
        {compare && (
          <span>
            <i className="legend-previous" />
            ก่อนหน้า (เส้นประ)
          </span>
        )}
      </div>
      <div className="radar-body">
        <svg
          className="radar-chart"
          viewBox="0 0 360 310"
          role="img"
          aria-label={`กราฟพัฒนาการ: ${current.map((a, i) => `${axes[i].name} ${a.value === null ? "ข้อมูลไม่พอ" : a.value}`).join(", ")}`}
        >
          {[25, 50, 75, 100].map((v) => (
            <polygon
              key={v}
              className="radar-grid"
              points={shape(Array(6).fill(v))}
            />
          ))}
          {axes.map((a, i) => {
            const [x, y] = point(i, 100);
            const [lx, ly] = point(i, 100, 135);
            return (
              <g key={a.id}>
                <line className="radar-spoke" x1="180" y1="150" x2={x} y2={y} />
                <text
                  x={lx}
                  y={ly}
                  dominantBaseline="middle"
                  textAnchor="middle"
                >
                  {a.short}
                </text>
              </g>
            );
          })}
          <text className="radar-scale" x="186" y="81">
            75
          </text>
          <text className="radar-scale" x="186" y="130">
            25
          </text>
          {compare && series(previous, true)}
          {series(current)}
        </svg>
        <div className="axis-values">
          {axes.map((a, i) => {
            const value = current[i];
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                aria-pressed={selected === a.id}
                className={selected === a.id ? "selected" : ""}
              >
                <span className="axis-index">{i + 1}</span>
                <span className="grow">
                  <strong>{a.name}</strong>
                  <small>
                    {value.value === null
                      ? "ข้อมูลยังไม่พอ"
                      : `${value.count} ${i < 2 ? "งาน" : "บันทึก"}`}
                  </small>
                </span>
                <b>{value.value ?? "—"}</b>
                <ChevronRight size={14} />
              </button>
            );
          })}
        </div>
      </div>
      <p className="growth-policy">— หมายถึงหลักฐานยังไม่พอ ไม่ใช่คะแนนศูนย์</p>
      <section className="axis-evidence" aria-label={`หลักฐาน ${axis.name}`}>
        <div className="evidence-heading">
          <FileCheck2 size={19} />
          <h3>{axis.name}</h3>
          <span>
            {result.value === null ? "ยังประเมินไม่ได้" : `${result.value}/100`}
          </span>
        </div>
        <p>{axis.description}</p>
        <p className="evidence-formula">
          {result.explanation}
          {compare &&
            ` · ช่วงก่อน ${old.value === null ? "ข้อมูลไม่พอ" : `${old.value}/100`}`}
        </p>
        <div className="evidence-items">
          {result.evidence.length ? (
            result.evidence.map((e, i) => (
              <div key={i}>
                <span>
                  {e.label}
                  <small>{e.detail}</small>
                </span>
                <time>{formatDate(e.at)}</time>
              </div>
            ))
          ) : (
            <p>ยังไม่มีหลักฐานในช่วงนี้</p>
          )}
        </div>
      </section>
    </section>
  );
}
