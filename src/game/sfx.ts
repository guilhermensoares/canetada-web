// ──────────────────────────────────────────────────────────────────────
// Efeitos sonoros do Canetada, sintetizados em WebAudio (sem assets).
//
// Paleta sonora: "gabinete público" — cliques secos de caneta/papel,
// campainha de repartição para avisos, carimbo grave para decretos,
// buzzer curto para erro e um jingle mínimo para conquistas.
// ──────────────────────────────────────────────────────────────────────

export type SfxName =
  | "click"        // botão comum
  | "tap"          // interação leve (toggle, aba, hover-press)
  | "open"         // abrir painel/modal
  | "close"        // fechar painel/modal
  | "stamp"        // CANETADO! / decreto assinado
  | "coin"         // dinheiro entrando / receita
  | "spend"        // dinheiro saindo / custo
  | "alert"        // aviso importante (crise, PiuPiu, desastre)
  | "message"      // nova mensagem (ZapZap / e-mail do gabinete)
  | "error"        // ação bloqueada / recusa
  | "success"      // ação concluída
  | "achievement"; // conquista desbloqueada

interface Prefs { muted: boolean; volume: number }

const STORAGE_KEY = "canetada.sfx";
const DEFAULTS: Prefs = { muted: false, volume: 0.6 };

let prefs: Prefs = DEFAULTS;
const subs = new Set<() => void>();

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return {
        muted: !!p.muted,
        volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : DEFAULTS.volume,
      };
    }
  } catch { /* ignore */ }
  return DEFAULTS;
}

function persist() {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

let loaded = false;
function ensurePrefs() {
  if (!loaded && typeof window !== "undefined") { prefs = loadPrefs(); loaded = true; }
  return prefs;
}

export function getSfxPrefs(): Prefs { return ensurePrefs(); }
export function setSfxMuted(m: boolean) { ensurePrefs(); prefs = { ...prefs, muted: m }; persist(); subs.forEach((f) => f()); }
export function setSfxVolume(v: number) {
  ensurePrefs();
  prefs = { muted: false, volume: Math.min(1, Math.max(0, v)) };
  persist();
  subs.forEach((f) => f());
}
export function subscribeSfx(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

// ── contexto de áudio ─────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Chamar após o primeiro gesto do usuário para destravar o áudio. */
export function unlockSfx() { audio(); }

// ── blocos de síntese ─────────────────────────────────────────────────
interface ToneOpts {
  freq: number;
  /** frequência final (glissando). */
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  /** ataque em segundos. */
  attack?: number;
}

function tone(o: ToneOpts) {
  const ac = audio();
  if (!ac || !master) return;
  const t0 = ac.currentTime + (o.delay ?? 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to && o.to !== o.freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
  const peak = (o.gain ?? 0.3) * prefs.volume;
  const atk = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

/** Ruído filtrado — usado para papel, carimbo e cliques secos. */
function noise(opts: { dur: number; gain?: number; delay?: number; freq?: number; q?: number; type?: BiquadFilterType }) {
  const ac = audio();
  if (!ac || !master) return;
  const t0 = ac.currentTime + (opts.delay ?? 0);
  const len = Math.max(1, Math.floor(ac.sampleRate * opts.dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = opts.type ?? "bandpass";
  filt.frequency.value = opts.freq ?? 1800;
  filt.Q.value = opts.q ?? 1;
  const g = ac.createGain();
  const peak = (opts.gain ?? 0.2) * prefs.volume;
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  src.connect(filt).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + opts.dur + 0.02);
}

// ── receitas por efeito ───────────────────────────────────────────────
const RECIPES: Record<SfxName, () => void> = {
  click: () => {
    noise({ dur: 0.045, freq: 2600, q: 3, gain: 0.16 });
    tone({ freq: 440, to: 320, dur: 0.05, type: "square", gain: 0.06 });
  },
  tap: () => {
    noise({ dur: 0.03, freq: 3600, q: 4, gain: 0.1 });
  },
  open: () => {
    noise({ dur: 0.16, freq: 1200, q: 0.7, gain: 0.1, type: "lowpass" });
    tone({ freq: 320, to: 560, dur: 0.14, type: "triangle", gain: 0.12 });
  },
  close: () => {
    noise({ dur: 0.14, freq: 900, q: 0.7, gain: 0.09, type: "lowpass" });
    tone({ freq: 520, to: 260, dur: 0.13, type: "triangle", gain: 0.11 });
  },
  stamp: () => {
    // impacto de carimbo: thud grave + estalo de papel + eco curto
    tone({ freq: 150, to: 55, dur: 0.22, type: "sine", gain: 0.4, attack: 0.002 });
    noise({ dur: 0.09, freq: 900, q: 0.6, gain: 0.32, type: "lowpass" });
    noise({ dur: 0.12, freq: 2400, q: 2, gain: 0.12, delay: 0.02 });
    tone({ freq: 110, to: 60, dur: 0.18, type: "square", gain: 0.08, delay: 0.05 });
  },
  coin: () => {
    tone({ freq: 1046, dur: 0.09, type: "triangle", gain: 0.16 });
    tone({ freq: 1568, dur: 0.16, type: "triangle", gain: 0.14, delay: 0.06 });
  },
  spend: () => {
    tone({ freq: 660, to: 300, dur: 0.18, type: "triangle", gain: 0.16 });
    noise({ dur: 0.1, freq: 1400, q: 1.4, gain: 0.08, delay: 0.02 });
  },
  alert: () => {
    // campainha dupla de repartição, tensa
    tone({ freq: 740, dur: 0.18, type: "square", gain: 0.14 });
    tone({ freq: 620, dur: 0.26, type: "square", gain: 0.14, delay: 0.16 });
  },
  message: () => {
    tone({ freq: 880, dur: 0.1, type: "sine", gain: 0.15 });
    tone({ freq: 1320, dur: 0.14, type: "sine", gain: 0.13, delay: 0.08 });
  },
  error: () => {
    tone({ freq: 200, to: 120, dur: 0.22, type: "sawtooth", gain: 0.16 });
    tone({ freq: 150, to: 90, dur: 0.24, type: "square", gain: 0.1, delay: 0.03 });
  },
  success: () => {
    tone({ freq: 523, dur: 0.11, type: "triangle", gain: 0.14 });
    tone({ freq: 784, dur: 0.16, type: "triangle", gain: 0.13, delay: 0.09 });
  },
  achievement: () => {
    // mini fanfarra de metais (arpejo maior)
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) =>
      tone({ freq: f, dur: i === notes.length - 1 ? 0.4 : 0.14, type: "triangle", gain: 0.14, delay: i * 0.085 }),
    );
    noise({ dur: 0.3, freq: 4000, q: 0.8, gain: 0.05, delay: 0.25 });
  },
};

// Evita empilhar o mesmo efeito quando eventos disparam em rajada.
const lastPlayed = new Map<SfxName, number>();
const MIN_GAP: Partial<Record<SfxName, number>> = {
  click: 40, tap: 40, message: 220, alert: 500, coin: 90, error: 200,
};

export function playSfx(name: SfxName) {
  ensurePrefs();
  if (prefs.muted || typeof window === "undefined") return;
  const now = performance.now();
  const gap = MIN_GAP[name] ?? 60;
  const last = lastPlayed.get(name) ?? -Infinity;
  if (now - last < gap) return;
  lastPlayed.set(name, now);
  try { RECIPES[name](); } catch { /* áudio indisponível */ }
}
