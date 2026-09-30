/**
 * Wellbeing & Public Health indicators.
 *
 * Correlates transport, environment and land use with citizen wellbeing:
 * 1. Commute stress (avg minutes/day) → happiness + productivity multiplier
 * 2. Air pollution (PM2.5 / CO2 proxy) → respiratory cases → UBS load
 * 3. Noise pollution → real-estate devaluation + insomnia/anxiety
 * 4. Urban heat island → energy demand + thermal discomfort
 *
 * Deterministic: reads current GameState, writes into GameState.wellbeing
 * and applies side-effects on happiness/health cost/energy demand.
 */
import type { GameState } from "./types";

export interface WellbeingState {
  /** Avg minutes/day per commuter (round-trip). */
  commuteMinutes: number;
  /** Hours lost per resident per month (aggregate stress proxy). */
  hoursLostPerCap: number;
  /** Productivity multiplier applied to ISS/economy (0.85..1.10). */
  productivityMult: number;

  /** PM2.5 index (µg/m³, WHO limit 15). */
  pm25: number;
  /** Estimated CO2 traffic-corridor concentration (arbitrary index 0..100). */
  co2Index: number;
  /** Respiratory cases per 1k residents this month. */
  respiratoryCases: number;
  /** Extra UBS/UPA health cost this month (R$). */
  healthOverloadCost: number;

  /** Average noise on arterials, dB(A). */
  noiseDb: number;
  /** % of real-estate value discount from noise (0..15). */
  noisePenaltyPct: number;
  /** Insomnia/anxiety prevalence 0..100 (%). */
  insomniaRate: number;

  /** Urban heat island delta °C over reference. */
  heatIslandC: number;
  /** Extra energy demand (kWh proxy) triggered by heat. */
  heatEnergyDelta: number;
  /** Thermal comfort index 0..100 (100 = ideal). */
  thermalComfort: number;
}

export function initialWellbeing(): WellbeingState {
  return {
    commuteMinutes: 55,
    hoursLostPerCap: 18,
    productivityMult: 1.0,
    pm25: 14,
    co2Index: 32,
    respiratoryCases: 3.2,
    healthOverloadCost: 0,
    noiseDb: 62,
    noisePenaltyPct: 2,
    insomniaRate: 12,
    heatIslandC: 1.4,
    heatEnergyDelta: 0,
    thermalComfort: 70,
  };
}

export function ensureWellbeing(s: GameState): void {
  const bag = s as unknown as { wellbeing?: WellbeingState };
  if (!bag.wellbeing) bag.wellbeing = initialWellbeing();
}

/**
 * Recompute wellbeing indicators from the current tick's transport/env/land signals.
 * Should be called AFTER tickTransport and the environment recompute in logic.ts.
 * Returns side-effect deltas that logic.ts must apply.
 */
export function tickWellbeing(s: GameState): {
  happinessDelta: number;
  healthCost: number;
  energyDemandDelta: number;
} {
  ensureWellbeing(s);
  const W = (s as unknown as { wellbeing: WellbeingState }).wellbeing;
  const T = s.transport;

  // --- 1. Commute stress ------------------------------------------------
  // Base one-way commute grows with congestion, unmet transit and moto share.
  const cong = T.split?.congestion ?? 30;
  const unmetRatio = T.totalCommuters > 0 ? T.unmet / T.totalCommuters : 0;
  const massShare = T.totalCommuters > 0
    ? (T.modes.brt.ridership + T.modes.metro.ridership) / T.totalCommuters
    : 0;
  const oneWay = 22 + cong * 0.55 + unmetRatio * 40 - massShare * 12;
  W.commuteMinutes = Math.round(Math.max(18, Math.min(160, oneWay * 2)));

  // Hours lost/month per capita (assuming 22 workdays).
  W.hoursLostPerCap = Math.round(((W.commuteMinutes - 40) / 60) * 22 * 10) / 10;

  // Productivity multiplier: >60 min/day starts hurting.
  const stressPenalty = Math.max(0, (W.commuteMinutes - 60) / 100); // 0..1
  W.productivityMult = Math.max(0.85, Math.min(1.10, 1.0 - stressPenalty * 0.15 + massShare * 0.05));

  // --- 2. Air pollution & respiratory disease ---------------------------
  // PM2.5 model: baseline 8 + traffic + industry - trees - active/mass transit.
  const carShare = T.split?.car ?? 0.25;
  const motoShare = T.split?.moto ?? 0.1;
  const activeShare = T.split?.active ?? 0.1;
  const trafficLoad = (carShare * 12 + motoShare * 6) * (1 + Math.max(0, cong - 40) / 100);
  const pollBase = s.environment?.pollution ?? 30;
  const trees = countBuildings(s, "tree") + countBuildings(s, "farm") * 0.4;
  const treeCredit = Math.min(10, trees * 0.08);
  W.pm25 = Math.round((8 + trafficLoad + pollBase * 0.15 - treeCredit - activeShare * 4) * 10) / 10;
  W.pm25 = Math.max(4, Math.min(90, W.pm25));
  W.co2Index = Math.round(Math.max(0, Math.min(100, pollBase * 0.6 + carShare * 60 + motoShare * 30)));

  // Respiratory case rate per 1k. WHO safe = 15 µg/m³.
  const pmExcess = Math.max(0, W.pm25 - 15);
  W.respiratoryCases = Math.round((2 + pmExcess * 0.35) * 10) / 10;

  // Extra UBS/UPA load: cost per 1k excess cases. Scales with population.
  const excessCases = (W.respiratoryCases - 2) * (s.population / 1000);
  W.healthOverloadCost = Math.max(0, Math.round(excessCases * 42));

  // --- 3. Noise pollution ----------------------------------------------
  // Base 55 dB + traffic + moto (loud) - cycleway/mass transit buffering.
  const cyclewayBuffer = Math.min(6, (T.cyclewayKm ?? 0) * 0.05);
  W.noiseDb = Math.round(
    55 + carShare * 14 + motoShare * 20 - massShare * 4 - cyclewayBuffer - treeCredit * 0.3,
  );
  W.noiseDb = Math.max(45, Math.min(92, W.noiseDb));

  // WHO residential limit 55 dB(A). Beyond that: property value discount.
  const noiseExcess = Math.max(0, W.noiseDb - 55);
  W.noisePenaltyPct = Math.round(Math.min(15, noiseExcess * 0.8) * 10) / 10;
  W.insomniaRate = Math.round(Math.min(45, 8 + noiseExcess * 0.9 + (cong - 40) * 0.1));

  // --- 4. Urban heat island --------------------------------------------
  // Delta °C: asphalt-heavy zones vs. tree cover.
  const built = countBuiltTiles(s);
  const density = built / Math.max(1, s.mapSize * s.mapSize);
  const greenRatio = trees / Math.max(1, built);
  W.heatIslandC = Math.round((density * 6 - greenRatio * 5 + 1.0) * 10) / 10;
  W.heatIslandC = Math.max(0, Math.min(7, W.heatIslandC));

  // Extra energy demand from AC use (proportional to heat delta & population).
  W.heatEnergyDelta = Math.round(W.heatIslandC * (s.population / 1500));

  // Thermal comfort: 100 - heat penalty - noise penalty.
  W.thermalComfort = Math.round(Math.max(0, Math.min(100,
    100 - W.heatIslandC * 8 - Math.max(0, W.noiseDb - 60) * 0.7,
  )));

  // --- Aggregate side-effects ------------------------------------------
  // Happiness: commute stress + respiratory + insomnia + heat discomfort.
  const commuteHap = -Math.max(0, (W.commuteMinutes - 60) / 100) * 1.2;
  const airHap = -Math.max(0, W.pm25 - 15) * 0.04;
  const noiseHap = -W.noisePenaltyPct * 0.05;
  const heatHap = -W.heatIslandC * 0.15;
  const happinessDelta = commuteHap + airHap + noiseHap + heatHap;

  return {
    happinessDelta,
    healthCost: W.healthOverloadCost,
    energyDemandDelta: W.heatEnergyDelta,
  };
}

function countBuildings(s: GameState, kind: string): number {
  let n = 0;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    if (s.builtBuildings[i] === kind) n++;
  }
  return n;
}

function countBuiltTiles(s: GameState): number {
  let n = 0;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    if (s.builtBuildings[i]) n++;
  }
  return n;
}
