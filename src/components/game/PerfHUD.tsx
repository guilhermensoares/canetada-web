import { useEffect, useState } from "react";
import { snapshot, isHudVisible, setHudVisible } from "@/game/perf";

function fmt(ms: number, digits = 1) {
  if (!ms) return "0";
  return ms.toFixed(digits);
}

export function PerfHUD() {
  const [visible, setVisible] = useState(() => isHudVisible());
  const [snap, setSnap] = useState(() => snapshot());

  useEffect(() => {
    const onToggle = () => setVisible(isHudVisible());
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setHudVisible(!isHudVisible());
      }
    };
    window.addEventListener("perfhud:toggle", onToggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("perfhud:toggle", onToggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 250) {
        setSnap(snapshot());
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  const fps = snap.fps;
  const fpsColor = fps >= 55 ? "#4ade80" : fps >= 30 ? "#facc15" : "#f87171";

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 9999,
        background: "rgba(10,12,18,0.86)",
        color: "#e5e7eb",
        font: "11px/1.35 ui-monospace,Menlo,Consolas,monospace",
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.12)",
        pointerEvents: "auto",
        minWidth: 200,
        boxShadow: "0 4px 18px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <strong style={{ color: fpsColor }}>FPS {fps.toFixed(0)}</strong>
        <span style={{ opacity: 0.6 }}>min {snap.fpsMin.toFixed(0)}</span>
        <button
          onClick={() => setHudVisible(false)}
          style={{
            background: "transparent",
            color: "#9ca3af",
            border: "none",
            cursor: "pointer",
            fontSize: 11,
          }}
          title="Fechar (Ctrl+Shift+P)"
        >
          ✕
        </button>
      </div>
      <div style={{ opacity: 0.7, marginBottom: 6 }}>
        frame {fmt(snap.frame.avg)}ms · p95 {fmt(snap.frame.p95)}ms · max {fmt(snap.frame.max)}ms
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ opacity: 0.55, textAlign: "left" }}>
            <th style={{ fontWeight: 400 }}>label</th>
            <th style={{ fontWeight: 400, textAlign: "right" }}>last</th>
            <th style={{ fontWeight: 400, textAlign: "right" }}>avg</th>
            <th style={{ fontWeight: 400, textAlign: "right" }}>max</th>
            <th style={{ fontWeight: 400, textAlign: "right" }}>n</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["render", snap.render],
              ["resolveEvent", snap.resolveEvent],
              ["cloneState", snap.cloneState],
              ["tick", snap.tick],
            ] as const
          ).map(([label, s]) => {
            const warn = label === "render" ? s.last > 16 : s.last > 32;
            return (
              <tr key={label} style={{ color: warn ? "#fbbf24" : undefined }}>
                <td>{label}</td>
                <td style={{ textAlign: "right" }}>{fmt(s.last, 2)}</td>
                <td style={{ textAlign: "right" }}>{fmt(s.avg, 2)}</td>
                <td style={{ textAlign: "right" }}>{fmt(s.max, 2)}</td>
                <td style={{ textAlign: "right", opacity: 0.5 }}>{s.n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ opacity: 0.45, marginTop: 6, fontSize: 10 }}>Ctrl+Shift+P para alternar</div>
    </div>
  );
}
