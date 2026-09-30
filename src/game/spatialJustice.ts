/**
 * Spatial (in)justice & social mobility module.
 *
 * The city map is partitioned into four socio-spatial strata based on
 * building mix, hazard exposure and distance to the geographic centre:
 *   - "core"       — central, well-serviced (baixa injustiça espacial)
 *   - "middle"     — mid-ring residential/commercial
 *   - "periphery"  — distant residential + industrial fringe
 *   - "informal"   — favela / hazard tiles
 *
 * For each stratum we derive commute burden, infrastructure access and
 * a resulting social-mobility score (0..100). A city-wide mobility gap
 * (max-min across strata) surfaces the injustice and feeds tiny nudges
 * back into the aggregate simulation (unemployment bias, happiness).
 */

import type { GameState, BuildingKind } from "./types";

export type Stratum = "core" | "middle" | "periphery" | "informal";

export interface StratumMetrics {
  id: Stratum;
  population: number;
  /** Avg one-way commute time to city core, in minutes. */
  commuteMinutes: number;
  /** 0..100 coverage of sanitation + water + energy for the stratum. */
  infraAccess: number;
  /** 0..100 access to schools/UBS/creches within a walkable radius. */
  serviceAccess: number;
  /** Penalty (0..30) on child-development trajectory. Higher = worse. */
  childPenalty: number;
  /** Composite social-mobility score (0..100, higher is better). */
  mobility: number;
}

export interface SpatialJusticeState {
  strata: Record<Stratum, StratumMetrics>;
  /** Max mobility − min mobility across strata (higher = more unjust). */
  mobilityGap: number;
  /** Population-weighted city mobility index (0..100). */
  cityMobility: number;
}

const EMPTY_STRATUM = (id: Stratum): StratumMetrics => ({
  id, population: 0, commuteMinutes: 30,
  infraAccess: 50, serviceAccess: 50, childPenalty: 0, mobility: 50,
});

export function initialSpatialJustice(): SpatialJusticeState {
  return {
    strata: {
      core: EMPTY_STRATUM("core"),
      middle: EMPTY_STRATUM("middle"),
      periphery: EMPTY_STRATUM("periphery"),
      informal: EMPTY_STRATUM("informal"),
    },
    mobilityGap: 0,
    cityMobility: 50,
  };
}

export function ensureSpatialJustice(s: GameState): void {
  if (!s.mobility) s.mobility = initialSpatialJustice();
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const SERVICE_KINDS: BuildingKind[] = ["school", "school_private", "hospital", "university", "fire_station"];
const HOUSING_KINDS: BuildingKind[] = ["house_s", "house_m", "house_l", "tower"];
const FAVELA_KINDS: BuildingKind[] = ["favela_s", "favela_m", "favela_l"];

interface TileClass {
  stratum: Stratum;
  people: number;
}

/** Classify each tile into a stratum and estimate residents. */
function classifyTile(
  s: GameState, i: number, cx: number, cy: number,
): TileClass | null {
  const b = s.builtBuildings[i];
  if (!b) return null;
  const size = s.mapSize;
  const x = i % size;
  const y = Math.floor(i / size);
  const dist = Math.hypot(x - cx, y - cy);
  const maxDist = Math.hypot(cx, cy);
  const rel = dist / (maxDist || 1); // 0..1 (centre → edge)

  const hazard = s.landUse?.hazardMask?.[i] === true;

  if (FAVELA_KINDS.includes(b)) {
    const people = b === "favela_l" ? 220 : b === "favela_m" ? 130 : 70;
    return { stratum: "informal", people };
  }
  if (!HOUSING_KINDS.includes(b)) return null;
  const people = b === "tower" ? 480 : b === "house_l" ? 180 : b === "house_m" ? 90 : 40;

  if (hazard) return { stratum: "informal", people };
  if (rel < 0.28) return { stratum: "core", people };
  if (rel < 0.62) return { stratum: "middle", people };
  return { stratum: "periphery", people };
}

/** Count service buildings within `radius` tiles of any (x,y) in the stratum. */
function averageServiceAccess(
  s: GameState, tiles: number[], radius = 4,
): number {
  if (tiles.length === 0) return 40;
  const size = s.mapSize;
  const services: { x: number; y: number }[] = [];
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const b = s.builtBuildings[i];
    if (b && SERVICE_KINDS.includes(b)) {
      services.push({ x: i % size, y: Math.floor(i / size) });
    }
  }
  if (services.length === 0) return 5;
  let total = 0;
  for (const idx of tiles) {
    const x = idx % size, y = Math.floor(idx / size);
    let nearby = 0;
    for (const svc of services) {
      if (Math.hypot(svc.x - x, svc.y - y) <= radius) nearby++;
    }
    total += Math.min(100, nearby * 22);
  }
  return total / tiles.length;
}

/**
 * Recompute mobility metrics from the current map & city indicators.
 * Mutates `s.mobility` and returns tiny bias values folded into `tick`.
 */
export function tickSpatialJustice(s: GameState): {
  unemploymentBias: number;
  happinessDelta: number;
} {
  ensureSpatialJustice(s);
  const size = s.mapSize;
  const cx = (size - 1) / 2, cy = (size - 1) / 2;

  const buckets: Record<Stratum, { pop: number; tiles: number[]; distSum: number }> = {
    core:      { pop: 0, tiles: [], distSum: 0 },
    middle:    { pop: 0, tiles: [], distSum: 0 },
    periphery: { pop: 0, tiles: [], distSum: 0 },
    informal:  { pop: 0, tiles: [], distSum: 0 },
  };

  for (let i = 0; i < s.builtBuildings.length; i++) {
    const cls = classifyTile(s, i, cx, cy);
    if (!cls) continue;
    const x = i % size, y = Math.floor(i / size);
    const bucket = buckets[cls.stratum];
    bucket.pop += cls.people;
    bucket.tiles.push(i);
    bucket.distSum += Math.hypot(x - cx, y - cy);
  }

  // City-wide infra baselines from existing state.
  const waterCov = clamp((s.infra.waterCapacity / Math.max(1, s.waterDemand)) * 100, 0, 100);
  const energyCov = clamp((s.infra.energyCapacity / Math.max(1, s.energyDemand)) * 100, 0, 100);
  const san = s.climate?.sanitation
    ? (s.climate.sanitation.waterCoverage + s.climate.sanitation.sewageCoverage) / 2
    : 60;
  const sanCov = san;
  const baseInfra = (waterCov + energyCov + sanCov) / 3;

  // Transport quality: unmet share hurts everyone but the periphery most.
  const totalCommuters = Math.max(1, s.transport?.totalCommuters ?? s.population * 0.42);
  const unmet = clamp((s.transport?.unmet ?? 0) / totalCommuters, 0, 1);

  const strata: Stratum[] = ["core", "middle", "periphery", "informal"];
  const out = s.mobility.strata;

  for (const key of strata) {
    const bucket = buckets[key];
    const m = out[key];
    m.population = bucket.pop;

    // Commute time — scales with average distance and transport gap.
    const avgDist = bucket.tiles.length ? bucket.distSum / bucket.tiles.length : 0;
    const distanceMinutes = avgDist * 4.2; // ~4 min per tile
    const transportPenalty =
      key === "periphery" ? unmet * 55 :
      key === "informal"  ? unmet * 70 :
      key === "middle"    ? unmet * 25 :
                            unmet * 10;
    m.commuteMinutes = Math.round(distanceMinutes + transportPenalty);

    // Infra: informal/periphery lose 12-30 pp; core keeps most of baseline.
    const infraLoss =
      key === "informal"  ? 35 :
      key === "periphery" ? 18 :
      key === "middle"    ? 6  :
                            0;
    m.infraAccess = Math.round(clamp(baseInfra - infraLoss, 0, 100));

    // Services measured directly from map proximity.
    m.serviceAccess = Math.round(averageServiceAccess(s, bucket.tiles));

    // Child development penalty: worst infra + worst services + hazard tiles.
    const infraFactor = (100 - m.infraAccess) * 0.15;
    const serviceFactor = (100 - m.serviceAccess) * 0.12;
    m.childPenalty = Math.round(clamp(infraFactor + serviceFactor, 0, 30));

    // Mobility score composite. Long commutes crush ascension; services & infra lift it.
    const commutePenalty = Math.max(0, m.commuteMinutes - 60) * 0.35;
    const educationLift = s.policies.education * 0.18;
    const healthLift = s.policies.health * 0.10;
    m.mobility = Math.round(clamp(
      55 + (m.infraAccess - 60) * 0.3 + (m.serviceAccess - 50) * 0.25
        - commutePenalty - m.childPenalty * 0.8 + educationLift + healthLift,
      5, 95,
    ));
  }

  // City rollup.
  const totalPop = strata.reduce((a, k) => a + out[k].population, 0) || 1;
  s.mobility.cityMobility = Math.round(
    strata.reduce((a, k) => a + out[k].mobility * out[k].population, 0) / totalPop,
  );
  const scores = strata.filter((k) => out[k].population > 0).map((k) => out[k].mobility);
  s.mobility.mobilityGap = scores.length
    ? Math.round(Math.max(...scores) - Math.min(...scores))
    : 0;

  // Injustice feedback — kept small to preserve tuning of other subsystems.
  return {
    unemploymentBias: (s.mobility.mobilityGap - 25) * 0.006, // ±0..0.4 pp
    happinessDelta: (s.mobility.cityMobility - 55) * 0.02,   // ±0..0.9
  };
}
