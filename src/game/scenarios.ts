/**
 * City scales & economic scenarios.
 *
 * Two orthogonal knobs the player picks at "New Game":
 *   • CityScale   → physical size of the municipality (map + base population).
 *   • Scenario    → macro-economic climate (revenue, inflation, unemployment).
 *
 * All modifiers are pure numeric multipliers applied by logic.ts, so the
 * simulation engine remains the same regardless of the chosen scale/scenario.
 */

import type { GameState } from "./types";

/* ---------------- City scale ---------------- */

export type CityScaleId = "small" | "medium" | "large" | "metropolis";

export interface CityScale {
  id: CityScaleId;
  labelKey: string;
  descKey: string;
  /** Square edge of the isometric grid. */
  mapSize: number;
  /** Multiplier applied to base population/businesses/treasury/infra. */
  scale: number;
}

// Tamanhos jogáveis para navegador. As versões antigas usavam 600–1800 tiles
// por lado (até 3,2 milhões de células), o que deixava a thread principal
// presa em geração, serialização e renderização mesmo com culling. Mantemos a
// sensação de cidade grande via densidade/população, mas com uma grade que cabe
// em Canvas 2D em tempo real.
export const CITY_SCALES: CityScale[] = [
 { id: "small",      labelKey: "scale_small",      descKey: "scale_small_desc",      mapSize: 72,  scale: 0.55 },
 { id: "medium",     labelKey: "scale_medium",     descKey: "scale_medium_desc",     mapSize: 96,  scale: 1.0  },
 { id: "large",      labelKey: "scale_large",      descKey: "scale_large_desc",      mapSize: 128, scale: 1.9  },
 { id: "metropolis", labelKey: "scale_metropolis", descKey: "scale_metropolis_desc", mapSize: 160, scale: 3.2  },
];

export const MAX_PLAYABLE_MAP_SIZE = 160;

export function findScale(id?: string): CityScale {
  return CITY_SCALES.find((s) => s.id === id) ?? CITY_SCALES[1];
}

/* ---------------- Economic scenario ---------------- */

export type ScenarioId = "recession" | "stability" | "boom" | "hyperinflation";

export interface EconomyModifiers {
  /** Multiplier on total tax revenue (income + property + business). */
  revenueMult: number;
  /** Additive baseline pressure on unemployment target (percentage points). */
  unempBias: number;
  /** Additive baseline pressure on monthly inflation drift. */
  inflationBias: number;
  /** Monthly debt interest rate (used instead of hard-coded 0.008). */
  debtInterestRate: number;
  /** Multiplier on business-growth delta each month. */
  businessGrowthMult: number;
  /** Multiplier on happiness gain from a positive fiscal balance. */
  balanceHappinessMult: number;
}

export interface EconomicScenario {
  id: ScenarioId;
  labelKey: string;
  descKey: string;
  emoji: string;
  accent: "success" | "warning" | "danger" | "info";
  modifiers: EconomyModifiers;
  /** Starting-state overrides applied on top of the city preset. */
  startOverrides?: Partial<Pick<GameState, "inflation" | "unemployment" | "happiness">>;
}

export const NEUTRAL_MODIFIERS: EconomyModifiers = {
  revenueMult: 1,
  unempBias: 0,
  inflationBias: 0,
  debtInterestRate: 0.008,
  businessGrowthMult: 1,
  balanceHappinessMult: 1,
};

export const ECONOMIC_SCENARIOS: EconomicScenario[] = [
  {
    id: "recession",
    labelKey: "scen_recession", descKey: "scen_recession_desc",
    emoji: "📉", accent: "warning",
    modifiers: {
      revenueMult: 0.78,
      unempBias: 4.5,
      inflationBias: 0.05,
      debtInterestRate: 0.012,
      businessGrowthMult: 0.55,
      balanceHappinessMult: 1.3,
    },
    startOverrides: { unemployment: 12, inflation: 5.2 },
  },
  {
    id: "stability",
    labelKey: "scen_stability", descKey: "scen_stability_desc",
    emoji: "⚖️", accent: "info",
    modifiers: { ...NEUTRAL_MODIFIERS },
  },
  {
    id: "boom",
    labelKey: "scen_boom", descKey: "scen_boom_desc",
    emoji: "🚀", accent: "success",
    modifiers: {
      revenueMult: 1.22,
      unempBias: -2.5,
      inflationBias: 0.08,
      debtInterestRate: 0.006,
      businessGrowthMult: 1.5,
      balanceHappinessMult: 0.9,
    },
    startOverrides: { unemployment: 4.5, inflation: 4.0, happiness: 68 },
  },
  {
    id: "hyperinflation",
    labelKey: "scen_hyper", descKey: "scen_hyper_desc",
    emoji: "🔥", accent: "danger",
    modifiers: {
      revenueMult: 0.7,
      unempBias: 3,
      inflationBias: 0.9,
      debtInterestRate: 0.028,
      businessGrowthMult: 0.7,
      balanceHappinessMult: 1.1,
    },
    startOverrides: { inflation: 12.5, unemployment: 10 },
  },
];

export function findScenario(id?: string): EconomicScenario {
  return ECONOMIC_SCENARIOS.find((s) => s.id === id) ?? ECONOMIC_SCENARIOS[1];
}

/**
 * Escala intrínseca de uma cidade pré-definida, inferida da população do preset.
 * Cidades pré-definidas NÃO devem ter tamanho editável pelo jogador — cada uma
 * tem seu mapa e características fixas. Apenas o modo Sandbox permite customizar
 * escala/dificuldade/recursos.
 */
export function intrinsicScaleForPopulation(pop: number): CityScaleId {
  if (pop < 25_000) return "small";
  if (pop < 80_000) return "medium";
  if (pop < 160_000) return "large";
  return "metropolis";
}

/** Cenário econômico intrínseco derivado da dificuldade do preset (1..5). */
export function intrinsicScenarioForDifficulty(d: number): ScenarioId {
  if (d <= 1) return "boom";
  if (d <= 3) return "stability";
  if (d <= 4) return "recession";
  return "hyperinflation";
}

/* ---------------- Sandbox overrides ---------------- */

/**
 * Raw player-editable starting variables. Any field left undefined falls back
 * to the (scaled) preset value. Applied AFTER scale + scenario, so the player
 * always wins.
 */
export interface SandboxOverrides {
  population?: number;
  treasury?: number;
  debt?: number;
  inflation?: number;
  unemployment?: number;
  happiness?: number;
  businesses?: number;
  taxIncome?: number;
  taxProperty?: number;
  taxBusiness?: number;
}

/** Scale numeric fields of a base state by `f`. Mutates in place. */
export function scaleBaseState(base: GameState, f: number): void {
  if (f === 1) return;
  base.population = Math.round(base.population * f);
  base.businesses = Math.max(20, Math.round(base.businesses * f));
  base.treasury = Math.round(base.treasury * f);
  base.debt = Math.round(base.debt * f);
  base.infra.waterCapacity = Math.round(base.infra.waterCapacity * f);
  base.infra.energyCapacity = Math.round(base.infra.energyCapacity * f);
}

export function applySandbox(base: GameState, o?: SandboxOverrides): void {
  if (!o) return;
  if (typeof o.population === "number") base.population = Math.max(500, Math.round(o.population));
  if (typeof o.treasury === "number") base.treasury = Math.round(o.treasury);
  if (typeof o.debt === "number") base.debt = Math.max(0, Math.round(o.debt));
  if (typeof o.inflation === "number") base.inflation = clamp(o.inflation, 0.5, 25);
  if (typeof o.unemployment === "number") base.unemployment = clamp(o.unemployment, 0.5, 40);
  if (typeof o.happiness === "number") base.happiness = clamp(o.happiness, 0, 100);
  if (typeof o.businesses === "number") base.businesses = Math.max(20, Math.round(o.businesses));
  if (typeof o.taxIncome === "number") base.taxes.income = clamp(o.taxIncome, 0, 40);
  if (typeof o.taxProperty === "number") base.taxes.property = clamp(o.taxProperty, 0, 20);
  if (typeof o.taxBusiness === "number") base.taxes.business = clamp(o.taxBusiness, 0, 30);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
