/**
 * Frota brasileira — classe do bairro + paleta de cores real + amostragem.
 *
 * Regras:
 *  - Cada agente escolhe seu MODELO com base na classe do TILE onde spawnou,
 *    e retém esse modelo pela rota inteira (um Compass pode visitar a periferia).
 *  - Paleta brasileira: 80% neutro (branco/prata/cinza/preto), 10% vermelho/vinho,
 *    10% azul/outras. Aplicada via tint no canvas (multiply). Sprites `fixedWhite`
 *    (Uno Escada, Siena APP, EV, frota de firma) ignoram a paleta.
 */
import type { GameState, ZoneKind } from "./types";
import type { VehicleSpriteId } from "@/assets/vehicles";
import { VEHICLE_SPRITES } from "@/assets/vehicles";

export type VehicleClass = "low" | "mid" | "high" | "service";

export const FLEET_MODELS: Record<VehicleClass, VehicleSpriteId[]> = {
  low:  ["gol_quadrado", "celta", "palio_g1", "clio_2001", "uno_quadrado", "kwid", "peugeot_206"],
  mid:  ["onix", "hb20", "polo", "siena_app", "strada_moderna", "kwid", "peugeot_206"],
  high: ["compass_suv", "hilux", "dolphin_ev", "corolla_exec"],
  service: ["uno_escada", "strada_firma", "bongo_entrega"],
};

/* ---------------- Paleta brasileira real ---------------- */

const NEUTRAL_COLORS = ["#f5f5f5", "#c9ccd1", "#8a8f96", "#2a2c30"] as const;
const RED_COLORS = ["#a41f2a", "#6f1620", "#c92a35"] as const; // vermelho / vinho
const OTHER_COLORS = ["#2b5da8", "#1e6e56", "#4a2f6b", "#c98a2b"] as const; // azul + eventual outra

/** Sorteia cor obedecendo 80% neutro / 10% vermelho/vinho / 10% outros. */
export function rollBrazilianColor(rng: () => number): string {
  const r = rng();
  if (r < 0.80) return NEUTRAL_COLORS[Math.floor(rng() * NEUTRAL_COLORS.length)];
  if (r < 0.90) return RED_COLORS[Math.floor(rng() * RED_COLORS.length)];
  return OTHER_COLORS[Math.floor(rng() * OTHER_COLORS.length)];
}

/* ---------------- Classificação do bairro ---------------- */

/** Peso 3×3 ao redor do tile — mais tolerante a "furos" no zoneamento. */
function neighborhoodStats(state: GameState, tx: number, ty: number) {
  const size = state.mapSize;
  const clamp = (v: number) => Math.max(0, Math.min(size - 1, v));
  let res = 0, com = 0, ind = 0, zeis = 0, rural = 0, none = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const i = clamp(ty + dy) * size + clamp(tx + dx);
      const z: ZoneKind = state.zones[i] ?? "none";
      if (z === "residential") res++;
      else if (z === "commercial") com++;
      else if (z === "industrial") ind++;
      else if (z === "zeis") zeis++;
      else if (z === "rural") rural++;
      else none++;
    }
  }
  return { res, com, ind, zeis, rural, none };
}

/**
 * Classifica o bairro a partir do tile onde o agente spawnou.
 *
 * - ZEIS ou dominância rural → `low` (periferia / autoconstrução).
 * - Industrial forte OU comercial forte com pouca residencial → `service` (firmas).
 * - Comercial forte com residencial denso → `high` (centro nobre).
 * - Residencial + comercial vizinho → `mid` (bairro padrão).
 * - Só residencial isolado → `low` por default (subúrbio antigo).
 */
export function neighborhoodClass(state: GameState, tx: number, ty: number): VehicleClass {
  const s = neighborhoodStats(state, Math.round(tx), Math.round(ty));
  if (s.zeis >= 2) return "low";
  if (s.ind >= 3) return "service";
  if (s.com >= 4 && s.res <= 2) return "service";
  if (s.com >= 3 && s.res >= 3) return "high";
  if (s.res >= 4 && s.com >= 1) return "mid";
  if (s.res >= 3) return "mid";
  if (s.rural >= 3) return "low";
  // Área ainda não zoneada — assume periferia/rural pra manter frota antiga na maior parte do mapa.
  return "low";
}

/* ---------------- Amostragem de modelo ---------------- */

export interface VehiclePick {
  spriteId: VehicleSpriteId;
  /** Cor para tint (ignorada se sprite for fixedWhite). */
  tint: string;
  /** Multiplicador de velocidade. Uno Escada ganha +20% (rule bônus). */
  speedMul: number;
  /** true se pertence à frota de serviço/firma. */
  isService: boolean;
  vClass: VehicleClass;
}

export function pickVehicle(vClass: VehicleClass, rng: () => number): VehiclePick {
  const pool = FLEET_MODELS[vClass];
  const spriteId = pool[Math.floor(rng() * pool.length)];
  const spec = VEHICLE_SPRITES[spriteId];
  const tint = spec.fixedWhite ? "#ffffff" : rollBrazilianColor(rng);
  const isService = vClass === "service";
  const speedMul = spriteId === "uno_escada" ? 1.2 : 1.0; // "sempre atrasado, sempre voando"
  return { spriteId, tint, speedMul, isService, vClass };
}
