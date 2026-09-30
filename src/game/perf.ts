// Lightweight perf tracker for FPS + labeled timings.
// Consumers push samples via mark(); PerfHUD reads via snapshot().
export type PerfLabel = "render" | "resolveEvent" | "cloneState" | "tick";

type Ring = { data: number[]; idx: number; size: number };

function makeRing(size = 60): Ring {
  return { data: [], idx: 0, size };
}

function push(r: Ring, v: number) {
  if (r.data.length < r.size) r.data.push(v);
  else {
    r.data[r.idx] = v;
    r.idx = (r.idx + 1) % r.size;
  }
}

function stats(r: Ring) {
  const n = r.data.length;
  if (!n) return { avg: 0, max: 0, last: 0, p95: 0, n: 0 };
  let sum = 0;
  let max = 0;
  for (const v of r.data) {
    sum += v;
    if (v > max) max = v;
  }
  const sorted = [...r.data].sort((a, b) => a - b);
  const p95 = sorted[Math.min(n - 1, Math.floor(n * 0.95))];
  const last = r.data.length < r.size ? r.data[r.data.length - 1] : r.data[(r.idx - 1 + r.size) % r.size];
  return { avg: sum / n, max, last, p95, n };
}

const timings: Record<PerfLabel, Ring> = {
  render: makeRing(120),
  resolveEvent: makeRing(30),
  cloneState: makeRing(30),
  tick: makeRing(60),
};

const frameTimes = makeRing(120); // ms between frames
let lastFrameTs = 0;

export function markFrame(now: number) {
  if (lastFrameTs > 0) push(frameTimes, now - lastFrameTs);
  lastFrameTs = now;
}

export function mark(label: PerfLabel, ms: number) {
  push(timings[label], ms);
}

export function time<T>(label: PerfLabel, fn: () => T): T {
  const t0 = performance.now();
  const r = fn();
  mark(label, performance.now() - t0);
  return r;
}

export function snapshot() {
  const ft = stats(frameTimes);
  const fps = ft.avg > 0 ? 1000 / ft.avg : 0;
  const fpsMin = ft.max > 0 ? 1000 / ft.max : 0;
  return {
    fps,
    fpsMin,
    frame: ft,
    render: stats(timings.render),
    resolveEvent: stats(timings.resolveEvent),
    cloneState: stats(timings.cloneState),
    tick: stats(timings.tick),
  };
}

// Toggle via localStorage or hotkey (Ctrl+Shift+P).
const KEY = "perfHudVisible";
export function isHudVisible(): boolean {
  if (typeof window === "undefined") return false;
  const v = window.localStorage.getItem(KEY);
  return v === null ? true : v === "1";
}
export function setHudVisible(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v ? "1" : "0");
  window.dispatchEvent(new Event("perfhud:toggle"));
}
