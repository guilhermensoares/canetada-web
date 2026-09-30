/**
 * Housing Demography module (inspired by Fundação João Pinheiro / FJP).
 *
 * Splits population into three income brackets (baixa/média/alta renda based
 * on Salário Mínimo brackets), computes:
 *   - housing demand per bracket
 *   - formal supply available to low income (ZEIS + social housing served)
 *   - Déficit Habitacional  (unmet low-income demand)
 *   - Índice de Inadequação (share living in favelas / hazard-informal units)
 *
 * When the low-income deficit persists and ZEIS/social programs don't absorb
 * it, spawnInformalSettlement() places favela_s tiles on hazard/edge land —
 * the same mechanic favelaPressure uses, but demand-driven.
 *
 * When informal rent (proxy for periphery/informal rent index) exceeds 30 %
 * of a low-income household budget, approval drops and downtown occupation
 * risk (landConflict) rises.
 */

import type { GameState, BuildingKind } from "./types";
import { isFavela } from "./zoning";

export interface IncomeBrackets {
  /** Population 0–2 SM (baixa renda). */
  low: number;
  /** Population 2–5 SM (classe média). */
  middle: number;
  /** Population > 5 SM (alta renda). */
  high: number;
}

export interface DemographyState {
  brackets: IncomeBrackets;
  /** Household size used to translate people → dwellings (BR ~3.1). */
  householdSize: number;
  /** Unmet low-income dwellings (Déficit Habitacional). */
  housingDeficit: number;
  /** 0..100 — Índice de Inadequação Urbana (share in favelas/hazard). */
  inadequacyIndex: number;
  /** Rent-to-income ratio for the low-income bracket, 0..1+. */
  rentBurdenLow: number;
  /** Consecutive months of rent burden above 30 %. */
  burdenStreak: number;
  /** Informal settlements auto-spawned last month. */
  spawnedLastMonth: number;
}

export function initialDemography(): DemographyState {
  return {
    brackets: { low: 0, middle: 0, high: 0 },
    householdSize: 3.1,
    housingDeficit: 0,
    inadequacyIndex: 0,
    rentBurdenLow: 0,
    burdenStreak: 0,
    spawnedLastMonth: 0,
  };
}

export function ensureDemography(s: GameState): void {
  if (!s.demography) s.demography = initialDemography();
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Split total population into 3 income brackets from macro indicators. */
export function computeIncomeBrackets(s: GameState): IncomeBrackets {
  const skilled = s.education
    ? s.education.cohorts.technical + s.education.cohorts.higher
    : 0.13;
  const unemp = Math.max(0, s.unemployment) / 100;
  const income = (s.housing?.incomeIndex ?? 100) / 100;

  // Baseline BR profile (~55/32/13); shift by education, unemployment, income.
  let highShare = clamp(0.10 + skilled * 0.55 + (income - 1) * 0.15, 0.04, 0.45);
  let lowShare  = clamp(0.60 + unemp * 1.2 - skilled * 0.6 - (income - 1) * 0.25, 0.20, 0.85);
  let midShare  = clamp(1 - highShare - lowShare, 0.10, 0.75);
  const sum = highShare + lowShare + midShare;
  highShare /= sum; lowShare /= sum; midShare /= sum;

  const pop = Math.max(0, s.population);
  return {
    low:    Math.round(pop * lowShare),
    middle: Math.round(pop * midShare),
    high:   Math.round(pop * highShare),
  };
}

/** Count ZEIS zoned tiles (reserve capacity for low-income formal housing). */
function countZeisCapacity(s: GameState): number {
  let n = 0;
  for (let i = 0; i < s.zones.length; i++) if (s.zones[i] === "zeis") n++;
  // Each ZEIS tile can host ~120 low-income residents if built out.
  return n * 120;
}

/** Population currently living in informal/hazardous settlements. */
function inadequateResidents(s: GameState): number {
  const size = s.mapSize;
  const hz = s.landUse?.hazardMask ?? [];
  let total = 0;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const b = s.builtBuildings[i] as BuildingKind | null;
    if (!b) continue;
    const hazard = hz[i] === true;
    if (isFavela(b)) {
      total += b === "favela_l" ? 220 : b === "favela_m" ? 130 : 70;
    } else if (hazard && (b === "house_s" || b === "house_m")) {
      total += b === "house_m" ? 90 : 40;
    }
    void size;
  }
  return total;
}

/**
 * Spawn `count` informal settlements (favela_s) on preferred hazard/edge
 * tiles. Returns actual number placed.
 */
export function spawnInformalSettlement(
  s: GameState,
  rng: () => number,
  count: number,
): number {
  if (count <= 0) return 0;
  const size = s.mapSize;
  const hz = s.landUse?.hazardMask ?? [];
  const hazardTiles: number[] = [];
  const edgeTiles: number[] = [];

  const cx = (size - 1) / 2, cy = (size - 1) / 2;
  const maxDist = Math.hypot(cx, cy) || 1;

  for (let i = 0; i < s.builtBuildings.length; i++) {
    if (s.builtBuildings[i]) continue;
    if (s.buildingOwners[i] === "state") continue;
    const zone = s.zones[i];
    if (zone === "commercial" || zone === "rural") continue;
    const x = i % size, y = Math.floor(i / size);
    const rel = Math.hypot(x - cx, y - cy) / maxDist;
    if (hz[i]) hazardTiles.push(i);
    else if (rel > 0.55) edgeTiles.push(i);
  }
  const shuffle = (arr: number[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };
  shuffle(hazardTiles); shuffle(edgeTiles);
  const ordered = [...hazardTiles, ...edgeTiles];
  let placed = 0;
  for (const idx of ordered) {
    if (placed >= count) break;
    s.builtBuildings[idx] = "favela_s";
    s.buildingOwners[idx] = "private";
    if (s.zones[idx] === "none") s.zones[idx] = "residential";
    placed++;
  }
  return placed;
}

export interface DemographyTickResult {
  approvalDelta: number;
  happinessDelta: number;
  occupationRiskDelta: number;
  spawned: number;
  news?: string;
}

export function tickDemography(
  s: GameState,
  rng: () => number,
): DemographyTickResult {
  ensureDemography(s);
  const D = s.demography!;

  // 1) Income brackets.
  D.brackets = computeIncomeBrackets(s);
  const householdSize = D.householdSize;

  // 2) Demand & supply for low income.
  const lowDwellingsDemand = Math.round(D.brackets.low / householdSize);
  const zeisCapacity = countZeisCapacity(s);                     // in residents
  const socialServed = s.housing?.socialQueue !== undefined
    ? Math.round((s.housing.policy.socialSubsidy ?? 0) / 1_800) * householdSize
    : 0;
  const formalLowSupply = Math.round((zeisCapacity + socialServed) / householdSize);
  const deficit = Math.max(0, lowDwellingsDemand - formalLowSupply - (s.housing?.socialQueue ?? 0) * 0);
  // We consider *unabsorbed* deficit after subtracting the informally
  // housed population — informal supply is inadequate, so it doesn't
  // reduce the deficit metric (FJP methodology).
  D.housingDeficit = deficit;

  // 3) Inadequacy Index (% of pop in favelas/hazard).
  const inadequate = inadequateResidents(s);
  D.inadequacyIndex = Math.round(clamp((inadequate / Math.max(1, s.population)) * 100, 0, 100));

  // 4) Rent burden for low income.
  // Baseline low-income household budget = 1.5 SM ≈ R$ 2.100. Rent is proxied
  // from the periphery/informal rent index (100 = R$ 700 reference).
  const rentIdx = s.housing
    ? (s.housing.rent.periphery * 0.5 + s.housing.rent.informal * 0.5)
    : 100;
  const monthlyRent = 700 * (rentIdx / 100);
  const budget = 2_100 * ((s.housing?.incomeIndex ?? 100) / 100);
  D.rentBurdenLow = clamp(monthlyRent / Math.max(1, budget), 0, 3);
  const burdened = D.rentBurdenLow > 0.30;
  D.burdenStreak = burdened ? D.burdenStreak + 1 : 0;

  // 5) Spawn informal settlements if deficit persists & ZEIS/social don't cover.
  let spawned = 0;
  if (deficit > lowDwellingsDemand * 0.05 && deficit > 400) {
    const desiredNew = Math.min(3, Math.ceil(deficit / 800));
    spawned = spawnInformalSettlement(s, rng, desiredNew);
  }
  D.spawnedLastMonth = spawned;

  // 6) Feedbacks.
  let approvalDelta = 0, happinessDelta = 0, occupationRiskDelta = 0;
  if (burdened) {
    const excess = (D.rentBurdenLow - 0.30) * 100;      // percentage points over 30 %
    approvalDelta -= clamp(0.6 + excess * 0.05, 0.6, 4);
    happinessDelta -= clamp(0.3 + excess * 0.03, 0.3, 2.5);
    occupationRiskDelta += clamp(1 + D.burdenStreak * 0.5, 1, 8);
  }
  if (D.inadequacyIndex > 25) {
    approvalDelta -= 0.4;
    happinessDelta -= 0.3;
  }

  // 7) News.
  let news: string | undefined;
  if (spawned > 0) news = "informal_spawned";
  else if (D.burdenStreak === 3) news = "rent_burden_alert";
  else if (D.housingDeficit > s.population * 0.05) news = "deficit_alert";

  // 8) Landconflict linkage — bump downtown occupation pressure when
  // rent burden persists (soft coupling: many modules use this counter).
  if (occupationRiskDelta > 0 && s.landConflict) {
    // landConflict has an internal pressure field; write via a safe property
    // if present, otherwise ignore.
    const lc = s.landConflict as { occupationPressure?: number };
    if (typeof lc.occupationPressure === "number") {
      lc.occupationPressure = clamp(lc.occupationPressure + occupationRiskDelta, 0, 100);
    }
  }

  return { approvalDelta, happinessDelta, occupationRiskDelta, spawned, news };
}
