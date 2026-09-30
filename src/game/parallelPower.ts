/**
 * Parallel Power module — "Governança Territorial Paralela".
 *
 * Simulates the emergence of criminal factions (facções) and militias
 * (milícias) in areas neglected by the state. When basic services
 * (security, transport, sanitation, education) fall short, the parallel
 * power fills the vacuum: informal transport, "gás da comunidade",
 * protection fees, and a parallel order that suppresses petty crime
 * while corroding tax revenue, police integrity and electoral freedom.
 *
 * Player has three intervention doctrines:
 *   - "blindEye"        (vista grossa)           — cheap but corruption grows
 *   - "ostensive"       (operações ostensivas)   — spikes damage & casualties
 *   - "socialUrbanism"  (urbanismo social)       — slow, expensive, sustainable
 *
 * The module is additive: it plugs into the monthly tick, folds fiscal
 * losses into the ledger and applies an electoral penalty proportional
 * to the number of "blocked zones" (areas where campaign activity is
 * forbidden by the parallel authority).
 */

import type { GameState } from "./types";
import type { Stratum } from "./spatialJustice";

/* ---------- Types ---------- */

export type EnforcementDoctrine = "blindEye" | "ostensive" | "socialUrbanism";

/** Which archetype dominates the parallel power. */
export type FactionArchetype = "faccao" | "milicia" | "hybrid";

export interface ParallelPolicy {
  doctrine: EnforcementDoctrine;
  /** Monthly investment in social urbanism (praças, iluminação, cultura). 0..100. */
  socialInvestment: number;
}

/** Per-stratum territorial control (0..100). */
export type TerritoryMap = Record<Stratum, number>;

export interface OperationLog {
  monthIndex: number; // s.year*12 + s.month
  casualties: number;
  controlReduced: number;
  stratum: Stratum;
}

export interface ParallelPowerState {
  policy: ParallelPolicy;
  archetype: FactionArchetype;

  /** Territorial control per socio-spatial stratum (0..100). */
  control: TerritoryMap;
  /** Aggregate control weighted by population share (0..100). */
  aggregateControl: number;

  /** True when a faction has crossed the emergence threshold at least once. */
  emerged: boolean;

  /** Number of strata with control >= 60 — used for electoral interference. */
  blockedZones: number;

  /** Last month's fiscal impact (negative = revenue diverted to extortion). */
  lastRevenueDelta: number;
  /** Last month's operating cost of interventions (ops or social urbanism). */
  lastProgramCost: number;
  /** Extortion / protection racket revenue captured by the faction (R$). */
  lastExtortion: number;
  /** Civilian casualties this month (ostensive operations backlash). */
  lastCasualties: number;
  /** Corruption pressure added to police & institutions this month. */
  lastCorruptionPush: number;

  /** History of the last few ostensive operations (bounded). */
  operations: OperationLog[];
  /** Cooldown until next ostensive operation is allowed (in months). */
  opsCooldown: number;

  /** Long-tail "disruption months" — where schools/services are paralyzed
   *  by open confrontation (per stratum). Ticks down every month. */
  disruption: TerritoryMap;
}

/* ---------- Constants & helpers ---------- */

const EMPTY_TERRITORY: TerritoryMap = { core: 0, middle: 0, periphery: 0, informal: 0 };
const STRATA: Stratum[] = ["core", "middle", "periphery", "informal"];

const DEFAULT_POLICY: ParallelPolicy = {
  doctrine: "blindEye",
  socialInvestment: 20,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/* ---------- Init / migration ---------- */

export function initialParallelPower(): ParallelPowerState {
  return {
    policy: { ...DEFAULT_POLICY },
    archetype: "hybrid",
    control: { ...EMPTY_TERRITORY },
    aggregateControl: 0,
    emerged: false,
    blockedZones: 0,
    lastRevenueDelta: 0,
    lastProgramCost: 0,
    lastExtortion: 0,
    lastCasualties: 0,
    lastCorruptionPush: 0,
    operations: [],
    opsCooldown: 0,
    disruption: { ...EMPTY_TERRITORY },
  };
}

export function ensureParallelPower(s: GameState): void {
  if (!s.parallelPower) {
    s.parallelPower = initialParallelPower();
    return;
  }
  const p = s.parallelPower;
  if (!p.policy) p.policy = { ...DEFAULT_POLICY };
  if (typeof p.policy.socialInvestment !== "number") p.policy.socialInvestment = DEFAULT_POLICY.socialInvestment;
  if (!p.policy.doctrine) p.policy.doctrine = DEFAULT_POLICY.doctrine;
  if (!p.control) p.control = { ...EMPTY_TERRITORY };
  if (!p.disruption) p.disruption = { ...EMPTY_TERRITORY };
  for (const k of STRATA) {
    if (typeof p.control[k] !== "number") p.control[k] = 0;
    if (typeof p.disruption[k] !== "number") p.disruption[k] = 0;
  }
  if (!Array.isArray(p.operations)) p.operations = [];
  if (typeof p.opsCooldown !== "number") p.opsCooldown = 0;
  if (typeof p.archetype !== "string") p.archetype = "hybrid";
  if (typeof p.aggregateControl !== "number") p.aggregateControl = 0;
  if (typeof p.blockedZones !== "number") p.blockedZones = 0;
  if (typeof p.emerged !== "boolean") p.emerged = p.aggregateControl > 15;
}

/* ---------- Service-deficit calculation ---------- */

/**
 * Returns a per-stratum "service deficit" score (0..100). Larger values mean
 * the state is failing that stratum — this is what parallel power feeds on.
 * Periphery and informal strata are structurally more exposed.
 */
function serviceDeficit(s: GameState): TerritoryMap {
  const sec  = 100 - clamp(s.policies.security, 0, 100);
  const tra  = 100 - clamp(s.policies.transport, 0, 100);
  const edu  = 100 - clamp(s.policies.education, 0, 100);
  const heal = 100 - clamp(s.policies.health, 0, 100);
  const informalShare = s.informal?.informalWorkers ?? 40;
  const sanCoverage   = s.climate?.sanitation?.sewageCoverage ?? 60;
  const sanGap        = 100 - clamp(sanCoverage, 0, 100);
  const gentrify      = s.housing?.gentrificationIndex ?? 0;

  // Weighted base index per stratum. Bias towards the periphery/informal.
  const coreBase       = sec * 0.35 + tra * 0.2 + gentrify * 0.15 + heal * 0.15 + edu * 0.15;
  const middleBase     = sec * 0.4  + tra * 0.25 + heal * 0.15 + edu * 0.15 + sanGap * 0.05;
  const peripheryBase  = sec * 0.35 + tra * 0.2 + sanGap * 0.15 + edu * 0.15 + heal * 0.10 + informalShare * 0.05;
  const informalBase   = sec * 0.3  + sanGap * 0.25 + heal * 0.15 + tra * 0.15 + edu * 0.10 + informalShare * 0.05;

  return {
    core:      clamp(coreBase * 0.35, 0, 100),
    middle:    clamp(middleBase * 0.55, 0, 100),
    periphery: clamp(peripheryBase * 0.9, 0, 100),
    informal:  clamp(informalBase * 1.0, 0, 100),
  };
}

/** Weights each stratum by rough population share to derive an aggregate. */
function aggregate(control: TerritoryMap): number {
  return clamp(
    control.core * 0.15 + control.middle * 0.30 + control.periphery * 0.35 + control.informal * 0.20,
    0, 100,
  );
}

/* ---------- Tick ---------- */

export interface ParallelPowerTickOutput {
  revenueDelta: number;
  programCost: number;
  approvalDelta: number;
  happinessDelta: number;
  corruptionDelta: number;
  news:
    | "faccao_surge"
    | "milicia_surge"
    | "operations_success"
    | "operations_backlash"
    | "electoral_lockdown"
    | "territory_reclaimed"
    | "none";
}

export function tickParallelPower(s: GameState): ParallelPowerTickOutput {
  ensureParallelPower(s);
  const p = s.parallelPower!;
  const pol = p.policy;

  const deficit = serviceDeficit(s);

  // Policy resistance shrinks control growth.
  //   Social urbanism gives a per-stratum decay stronger in periphery/informal.
  //   Ostensive doctrine gives a small permanent drag but is mostly event-driven.
  //   Blind eye adds no resistance at all.
  const socialDecay = pol.socialInvestment * 0.08; // up to 8 pp/month erosion at max
  const doctrineDrag =
    pol.doctrine === "ostensive"      ? 1.5 :
    pol.doctrine === "socialUrbanism" ? 0.8 : 0;

  // Stratum-specific growth deltas.
  const growth: TerritoryMap = { ...EMPTY_TERRITORY };
  for (const k of STRATA) {
    const pressure   = (deficit[k] - 25) * 0.12;        // above 25 deficit → growth
    const resistance = socialDecay * (k === "periphery" || k === "informal" ? 1.0 : 0.35)
                     + doctrineDrag * (k === "periphery" || k === "informal" ? 0.7 : 1.1);
    const noise = 0; // deterministic — main RNG lives in the surge news trigger below
    growth[k] = pressure - resistance + noise;

    p.control[k] = clamp(p.control[k] + growth[k], 0, 100);
    p.disruption[k] = Math.max(0, p.disruption[k] - 1);
  }

  p.aggregateControl = Math.round(aggregate(p.control));
  p.blockedZones = STRATA.reduce((n, k) => n + (p.control[k] >= 60 ? 1 : 0), 0);

  // Emergence threshold — first time aggregate crosses 15, faction chooses an archetype.
  let news: ParallelPowerTickOutput["news"] = "none";
  if (!p.emerged && p.aggregateControl >= 15) {
    p.emerged = true;
    // Militia flavour when institutional corruption or blocked periphery is high.
    const corruption = s.politics?.institutional?.corruption ?? 20;
    if (corruption > 55 || p.control.middle > p.control.informal) {
      p.archetype = "milicia";
      news = "milicia_surge";
    } else {
      p.archetype = "faccao";
      news = "faccao_surge";
    }
  }

  /* ---- Ostensive-operations backlash decay ---- */
  if (p.opsCooldown > 0) p.opsCooldown = Math.max(0, p.opsCooldown - 1);

  /* ---- Financial impact ---- */
  //   Extortion revenue: population × (aggregateControl%) × R$ 2 avg.
  const population = s.population ?? 0;
  const extortion  = Math.round(population * (p.aggregateControl / 100) * 2);
  p.lastExtortion  = extortion;

  //   Tax leakage: same base as informal evasion, additive.
  const evadable =
    (s.lastRevenueBreakdown?.incomeTax   ?? 0) +
    (s.lastRevenueBreakdown?.propertyTax ?? 0) +
    (s.lastRevenueBreakdown?.businessTax ?? 0);
  const leakage = Math.round(evadable * (p.aggregateControl / 100) * 0.35);
  const revenueDelta = -leakage;

  //   Program cost: social urbanism is expensive; ostensive doctrine adds a
  //   monthly enforcement premium; blind eye has no monthly cost.
  const perCap = population / 1000;
  let programCost = 0;
  if (pol.doctrine === "socialUrbanism") {
    programCost = Math.round(pol.socialInvestment * 220 * perCap);
  } else if (pol.doctrine === "ostensive") {
    programCost = Math.round(180 * perCap);
  }

  /* ---- Approval / happiness / corruption feedback ---- */
  let approvalDelta   = 0;
  let happinessDelta  = 0;
  let corruptionDelta = 0;

  // Base drag from parallel power controlling turf.
  approvalDelta  -= p.aggregateControl * 0.03;
  happinessDelta -= p.aggregateControl * 0.02;

  //   Parallel order: some petty-crime relief where control is high — clamps
  //   the happiness drag. Modelled as a partial rebate.
  const orderRebate = Math.min(4, p.aggregateControl * 0.02);
  happinessDelta += orderRebate;

  //   Doctrine-specific feedback loops.
  if (pol.doctrine === "blindEye") {
    corruptionDelta += 0.35 + p.aggregateControl * 0.02;
  } else if (pol.doctrine === "ostensive") {
    corruptionDelta += 0.15; // less coop, but still some
    // Casualties/disruption already applied in `runOperation`, small tail here.
    approvalDelta -= 0.4;
  } else {
    corruptionDelta -= 0.15; // integrity gains from long-term programme
  }

  // Blocked-zone electoral rumble — small monthly approval drag while active.
  if (p.blockedZones > 0) {
    approvalDelta -= p.blockedZones * 0.25;
  }

  p.lastRevenueDelta   = revenueDelta;
  p.lastProgramCost    = programCost;
  p.lastCasualties     = 0; // reset — casualties are only produced by explicit ops
  p.lastCorruptionPush = corruptionDelta;

  return { revenueDelta, programCost, approvalDelta, happinessDelta, corruptionDelta, news };
}

/* ---------- Player actions ---------- */

/** Change the doctrine. Cheap; no direct cost. */
export function setDoctrine(s: GameState, doctrine: EnforcementDoctrine): void {
  ensureParallelPower(s);
  s.parallelPower!.policy.doctrine = doctrine;
}

/** Adjust the social-urbanism monthly investment slider (0..100). */
export function setSocialInvestment(s: GameState, value: number): void {
  ensureParallelPower(s);
  s.parallelPower!.policy.socialInvestment = clamp(Math.round(value), 0, 100);
}

/**
 * Trigger a discrete ostensive operation. Costs treasury up front, drops
 * territorial control in the most-controlled stratum, but produces
 * casualties, halts services in that stratum for 3 months and burns approval.
 * Cooldown: 3 months.
 */
export function runOperation(s: GameState): {
  ok: boolean;
  reason?: "cooldown" | "no_target" | "no_funds";
  casualties?: number;
  stratum?: Stratum;
} {
  ensureParallelPower(s);
  const p = s.parallelPower!;
  if (p.opsCooldown > 0) return { ok: false, reason: "cooldown" };

  // Pick most-controlled stratum with control >= 25.
  let target: Stratum | null = null;
  let hi = 25;
  for (const k of STRATA) {
    if (p.control[k] > hi) { hi = p.control[k]; target = k; }
  }
  if (!target) return { ok: false, reason: "no_target" };

  const cost = 1_200_000;
  if ((s.treasury ?? 0) < cost) return { ok: false, reason: "no_funds" };

  s.treasury -= cost;
  s.lastExpenses = (s.lastExpenses ?? 0) + cost;
  s.lastExpensesBreakdown.security = (s.lastExpensesBreakdown.security ?? 0) + cost;

  const reduction = 18 + Math.round((p.control[target] - 25) * 0.25);
  p.control[target] = clamp(p.control[target] - reduction, 0, 100);
  p.disruption[target] = Math.max(p.disruption[target], 3);

  // Civilian casualties scale with pre-op control.
  const casualties = 2 + Math.round(hi * 0.12);
  p.lastCasualties += casualties;
  p.operations.unshift({
    monthIndex: s.year * 12 + s.month,
    casualties,
    controlReduced: reduction,
    stratum: target,
  });
  if (p.operations.length > 8) p.operations.length = 8;

  // Hard approval + happiness hit.
  s.approval = clamp((s.approval ?? 0) - 6, 0, 100);
  s.happiness = clamp((s.happiness ?? 0) - 5, 0, 100);
  // Police corruption ticks up from operational grey areas.
  if (s.politics?.institutional) {
    s.politics.institutional.corruption = clamp(s.politics.institutional.corruption + 2, 0, 100);
  }

  p.opsCooldown = 3;
  p.aggregateControl = Math.round(aggregate(p.control));
  p.blockedZones = STRATA.reduce((n, k) => n + (p.control[k] >= 60 ? 1 : 0), 0);
  return { ok: true, casualties, stratum: target };
}

/**
 * Electoral penalty applied to a staged election vote share, proportional
 * to the number of blocked zones. Returns the number to subtract from the
 * pending voteShare. Also adds a scarier hit if aggregate control is high.
 */
export function parallelElectionPenalty(s: GameState): number {
  ensureParallelPower(s);
  const p = s.parallelPower!;
  return p.blockedZones * 3.5 + (p.aggregateControl > 60 ? 5 : 0);
}
