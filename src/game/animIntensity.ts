/**
 * Intensidade global das animações do mapa (canvas de sprites).
 * Persistido em localStorage e observável via evento customizado.
 * Não afeta densidade/UI — apenas amplitude, FPS e nº de agentes móveis.
 */
import { useEffect, useState } from "react";

export type AnimIntensity = "light" | "normal" | "lively";

const KEY = "animIntensity";
const EVT = "animIntensityChange";

export interface AnimFactors {
  /** taxa alvo de quadros por segundo do loop de rendering */
  fps: number;
  /** multiplicador da quantidade de agentes móveis (carros/ônibus/pedestres) */
  agents: number;
  /** amplitude do "breathing" dos sprites */
  breath: number;
  /** amplitude do balanço de árvores */
  sway: number;
  /** amplitude do passo dos pedestres */
  walkBob: number;
}

export const FACTORS: Record<AnimIntensity, AnimFactors> = {
  light:  { fps: 20, agents: 0.45, breath: 0.35, sway: 0.35, walkBob: 0.4 },
  normal: { fps: 30, agents: 1.0,  breath: 1.0,  sway: 1.0,  walkBob: 1.0 },
  lively: { fps: 45, agents: 1.5,  breath: 1.5,  sway: 1.6,  walkBob: 1.3 },
};

export function getAnimIntensity(): AnimIntensity {
  if (typeof window === "undefined") return "normal";
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "lively" ? v : "normal";
}

export function setAnimIntensity(v: AnimIntensity) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v);
  window.dispatchEvent(new CustomEvent<AnimIntensity>(EVT, { detail: v }));
}

/** Hook: mantém o valor atualizado em resposta ao evento global. */
export function useAnimIntensity(): AnimIntensity {
  const [v, setV] = useState<AnimIntensity>(() => getAnimIntensity());
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<AnimIntensity>).detail;
      if (d) setV(d);
    };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return v;
}
