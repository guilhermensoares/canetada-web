import { useCallback, useEffect, useRef, useState } from "react";
import { MOOD_PLAYLIST, type Mood, type Track } from "@/game/soundtrack";

const LS_KEY = "canetada.music.v1";
/** Crossfade padrão entre faixas — longo o suficiente para não soar abrupto. */
const FADE_MS = 6000;
/** Transição mais longa e suave ao mudar de clima (menu → jogo, calmo → crise). */
const MOOD_FADE_MS = 8000;
/**
 * Tempo mínimo no ar por faixa. As faixas têm ~30s, então elas dão loop
 * até completar esse tempo antes de encadear a próxima.
 */
const MIN_TRACK_MS = 420_000;

interface Prefs { muted: boolean; volume: number }

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return { muted: false, volume: 0.5 };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return {
        muted: !!p.muted,
        volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : 0.5,
      };
    }
  } catch { /* ignore */ }
  return { muted: false, volume: 0.5 };
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Gerenciador de trilha adaptativa: mantém dois <audio> e faz crossfade
 * entre faixas / climas. Respeita a política de autoplay dos navegadores —
 * só começa após o primeiro gesto do usuário (clique/tecla/toque).
 */
export function useSoundtrack(mood: Mood) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [current, setCurrent] = useState<Track | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const currentRef = useRef<Track | null>(null);
  currentRef.current = current;

  const activeRef = useRef<HTMLAudioElement | null>(null);
  const idleRef = useRef<HTMLAudioElement | null>(null);
  const moodRef = useRef<Mood>(mood);
  const queueRef = useRef<Track[]>([]);
  const fadeRafRef = useRef<number | null>(null);
  /** Quando a faixa atual entrou no ar (para garantir o tempo mínimo). */
  const startedAtRef = useRef(0);
  /** Evita disparar duas transições ao mesmo tempo. */
  const advancingRef = useRef(false);


  // ── setup dos elementos de áudio ────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = new Audio();
    const b = new Audio();
    for (const el of [a, b]) {
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.volume = 0;
    }
    activeRef.current = a;
    idleRef.current = b;
    return () => {
      if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
      for (const el of [a, b]) { el.pause(); el.src = ""; }
      activeRef.current = null;
      idleRef.current = null;
    };
  }, []);

  // ── desbloqueio por gesto do usuário ────────────────────────────────
  useEffect(() => {
    if (unlocked || typeof window === "undefined") return;
    const unlock = () => setUnlocked(true);
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [unlocked]);

  const targetVolume = useCallback(
    (track: Track | null) => (prefsRef.current.muted || !track ? 0 : prefsRef.current.volume * track.gain),
    [],
  );

  /** Crossfade com curva de potência constante: sobe o `next`, desce o `prev`. */
  const crossfadeTo = useCallback((track: Track, fadeMs = FADE_MS) => {
    const from = activeRef.current;
    const to = idleRef.current;
    if (!from || !to) return;

    to.src = track.url;
    to.currentTime = 0;
    to.volume = 0;
    // Faixas curtas (~30s) dão loop até atingir o tempo mínimo no ar.
    to.loop = true;
    startedAtRef.current = performance.now();
    advancingRef.current = false;
    const play = to.play();
    if (play) play.catch(() => { /* autoplay bloqueado — tenta no próximo gesto */ });

    const startFrom = from.volume;
    const endTo = targetVolume(track);
    const t0 = performance.now();
    if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / fadeMs);
      // equal-power: evita a "barriga" de volume no meio da transição
      to.volume = Math.min(1, Math.max(0, endTo * Math.sin((k * Math.PI) / 2)));
      from.volume = Math.min(1, Math.max(0, startFrom * Math.cos((k * Math.PI) / 2)));
      if (k < 1) {
        fadeRafRef.current = requestAnimationFrame(step);
      } else {
        from.pause();
        from.src = "";
        fadeRafRef.current = null;
      }
    };
    fadeRafRef.current = requestAnimationFrame(step);

    activeRef.current = to;
    idleRef.current = from;
    setCurrent(track);
  }, [targetVolume]);

  /** Próxima faixa da playlist do mood atual (embaralhada, sem repetir seguido). */
  const nextTrack = useCallback((forMood: Mood, avoid?: Track | null): Track => {
    if (queueRef.current.length === 0) {
      const list = MOOD_PLAYLIST[forMood];
      queueRef.current = list.length > 1 ? shuffle(list) : list.slice();
      if (avoid && queueRef.current.length > 1 && queueRef.current[0].url === avoid.url) {
        queueRef.current.push(queueRef.current.shift()!);
      }
    }
    return queueRef.current.shift()!;
  }, []);

  const advance = useCallback((fadeMs = FADE_MS) => {
    crossfadeTo(nextTrack(moodRef.current, currentRef.current), fadeMs);
  }, [crossfadeTo, nextTrack]);

  // ── troca de mood ───────────────────────────────────────────────────
  useEffect(() => {
    if (!unlocked) return;
    const changed = moodRef.current !== mood;
    moodRef.current = mood;
    const playing = activeRef.current && !activeRef.current.paused;
    if (changed) {
      queueRef.current = [];
      // Se a faixa atual também pertence ao novo clima, mantém tocando:
      // a transição menu → jogo fica contínua, sem corte.
      const cur = currentRef.current;
      if (playing && cur && MOOD_PLAYLIST[mood].some((t) => t.url === cur.url)) return;
      advance(MOOD_FADE_MS);
      return;
    }
    if (!playing) advance(MOOD_FADE_MS);
  }, [mood, unlocked, advance]);



  // ── loop até o tempo mínimo, depois encadeia na virada da faixa ─────
  useEffect(() => {
    const els = [activeRef.current, idleRef.current].filter(Boolean) as HTMLAudioElement[];

    const onTime = (ev: Event) => {
      const el = ev.currentTarget as HTMLAudioElement;
      if (el !== activeRef.current || advancingRef.current) return;
      const dur = el.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      // ainda não cumpriu o tempo mínimo → deixa o loop rolar
      if (performance.now() - startedAtRef.current < MIN_TRACK_MS) return;
      // já cumpriu: espera chegar perto do fim para trocar sem cortar a frase
      // já cumpriu: começa o crossfade antes do fim, para a troca ser suave
      const lead = Math.min(FADE_MS / 1000, dur * 0.6) + 0.25;
      if (dur - el.currentTime > lead) return;
      advancingRef.current = true;
      el.loop = false;
      advance();
    };
    // fallback: se o loop falhar em algum navegador, encadeia no fim mesmo
    const onEnded = (ev: Event) => {
      const el = ev.currentTarget as HTMLAudioElement;
      if (el !== activeRef.current || advancingRef.current) return;
      advancingRef.current = true;
      advance();
    };

    els.forEach((el) => {
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("ended", onEnded);
    });
    return () => els.forEach((el) => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    });
  }, [advance, current, unlocked]);

  // ── volume / mute ───────────────────────────────────────────────────
  useEffect(() => {
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    const el = activeRef.current;
    if (el && !fadeRafRef.current) el.volume = targetVolume(current);
    if (prefs.muted) { activeRef.current?.pause(); }
    else if (unlocked && activeRef.current?.paused && activeRef.current.src) {
      activeRef.current.play()?.catch(() => { /* ignore */ });
    }
  }, [prefs, current, targetVolume, unlocked]);

  // ── pausa quando a aba sai de foco ──────────────────────────────────
  useEffect(() => {
    const onVis = () => {
      const el = activeRef.current;
      if (!el || !el.src) return;
      if (document.hidden) el.pause();
      else if (!prefsRef.current.muted && unlocked) el.play()?.catch(() => { /* ignore */ });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [unlocked]);

  return {
    current,
    muted: prefs.muted,
    volume: prefs.volume,
    playing: !!current && !prefs.muted && unlocked,
    toggleMute: () => setPrefs((p) => ({ ...p, muted: !p.muted })),
    setVolume: (v: number) => setPrefs((p) => ({ ...p, muted: false, volume: Math.min(1, Math.max(0, v)) })),
    skip: () => { if (unlocked) advance(); },
  };
}
