/**
 * Housing market & gentrification module.
 *
 * Tracks a monthly rent index per socio-spatial stratum (reusing the
 * strata from `spatialJustice`) plus city-wide policy levers:
 *   - Rent-control cap: ceiling on monthly rent growth (0..8 % / month).
 *   - Social-housing subsidy: R$/month funding new affordable units,
 *     easing rent pressure in the core and middle rings.
 *
 * Rent grows with local attractiveness (services, transport, jobs,
 * spatial-mobility score) and with housing scarcity (tower/house supply
 * vs. population). When core/middle rent runs ahead of household income,
 * a *gentrification index* rises and part of the affected residents are
 * displaced — pushed to the periphery or into informal settlements, and
 * a share leaves the city (external migration).
 *
 * Everything is aggregate/state-level: no per-NPC agents, no new
 * building sprites. Panels expose the two levers and the resulting
 * rent + displacement metrics.
 */

import type { GameState } from "./types";

export type HousingStratum = "core" | "middle" | "periphery" | "informal";

export interface RentIndex {
  core: number;
  middle: number;
  periphery: number;
  informal: number;
}

export interface HousingPolicy {
  /** Monthly rent-growth ceiling in %, 0..8. 0 = strict freeze. */
  rentControlCap: number;
  /** R$/month funding social housing programs. Adds affordable capacity. */
  socialSubsidy: number;
}

export interface HousingState {
  /** Rent index per stratum, 100 = baseline at city start. */
  rent: RentIndex;
  /** Households on the waiting list for social housing. */
  socialQueue: number;
  /** Households displaced last month (moved down-stratum). */
  displacedLastMonth: number;
  /** External emigrants last month due to unaffordability. */
  emigratedLastMonth: number;
  /** Gentrification index 0..100. */
  gentrificationIndex: number;
  /** Player-set policy. */
  policy: HousingPolicy;
  /** Household income index, 100 = baseline. */
  incomeIndex: number;
}

export function initialHousing(): HousingState {
  return {
    rent: { core: 100, middle: 100, periphery: 100, informal: 100 },
    socialQueue: 0,
    displacedLastMonth: 0,
    emigratedLastMonth: 0,
    gentrificationIndex: 20,
    policy: { rentControlCap: 3.5, socialSubsidy: 40_000 },
    incomeIndex: 100,
  };
}

export function ensureHousing(s: GameState): void {
  if (!s.housing) s.housing = initialHousing();
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Count housing units per stratum (rough capacity proxy). */
function housingCapacityPerStratum(s: GameState): Record<HousingStratum, number> {
  const cap: Record<HousingStratum, number> = { core: 0, middle: 0, periphery: 0, informal: 0 };
  const size = s.mapSize;
  const cx = (size - 1) / 2, cy = (size - 1) / 2;
  const maxDist = Math.hypot(cx, cy) || 1;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const b = s.builtBuildings[i];
    if (!b) continue;
    const x = i % size, y = Math.floor(i / size);
    const rel = Math.hypot(x - cx, y - cy) / maxDist;
    const hazard = s.landUse?.hazardMask?.[i] === true;
    let units = 0;
    if      (b === "tower")    units = 480;
    else if (b === "house_l")  units = 180;
    else if (b === "house_m")  units = 90;
    else if (b === "house_s")  units = 40;
    else if (b === "favela_l") units = 220;
    else if (b === "favela_m") units = 130;
    else if (b === "favela_s") units = 70;
    if (units === 0) continue;
    if (b.startsWith("favela") || hazard) cap.informal += units;
    else if (rel < 0.28) cap.core += units;
    else if (rel < 0.62) cap.middle += units;
    else cap.periphery += units;
  }
  return cap;
}

export interface HousingTickResult {
  costDelta: number;
  happinessDelta: number;
  populationDelta: number;
  favelaPressureBonus: number;
  news?: string;
}

/** Recompute rents, displacement, gentrification. */
export function tickHousing(s: GameState): HousingTickResult {
  ensureHousing(s);
  const H = s.housing;

  // ── Income index (baseline 100). Higher cohorts + low unemployment lift it.
  const skilledShare = s.education
    ? s.education.cohorts.technical + s.education.cohorts.higher
    : 0.13;
  const targetIncome = clamp(
    85 + skilledShare * 90 - Math.max(0, s.unemployment - 6) * 2.0 - s.inflation * 0.6,
    50, 180,
  );
  H.incomeIndex = clamp(H.incomeIndex + (targetIncome - H.incomeIndex) * 0.15, 40, 200);

  // ── Attractiveness per stratum from existing mobility + services.
  const mob = s.mobility?.strata;
  const attract: Record<HousingStratum, number> = {
    core: mob ? mob.core.mobility : 65,
    middle: mob ? mob.middle.mobility : 55,
    periphery: mob ? mob.periphery.mobility : 42,
    informal: mob ? mob.informal.mobility : 28,
  };

  // ── Scarcity per stratum: capacity vs residents.
  const cap = housingCapacityPerStratum(s);
  const strata: HousingStratum[] = ["core", "middle", "periphery", "informal"];
  const totalCap = strata.reduce((a, k) => a + cap[k], 1);
  const demandShare: Record<HousingStratum, number> = { core: 0.18, middle: 0.34, periphery: 0.36, informal: 0.12 };
  const scarcity: Record<HousingStratum, number> = { core: 0, middle: 0, periphery: 0, informal: 0 };
  for (const k of strata) {
    const desired = s.population * demandShare[k];
    scarcity[k] = clamp(desired / Math.max(1, cap[k] || totalCap * 0.05), 0.4, 3.2);
  }

  // ── Rent movement.
  const capPct = clamp(H.policy.rentControlCap, 0, 8) / 100;    // per-month ceiling
  const subsidyRelief = clamp(H.policy.socialSubsidy / 200_000, 0, 0.6);
  for (const k of strata) {
    // Target growth rate: pressure from scarcity + attractiveness − relief.
    const pressure = (scarcity[k] - 1) * 0.05 + (attract[k] - 55) / 900;
    const relief =
      k === "core"      ? subsidyRelief * 0.05 :
      k === "middle"    ? subsidyRelief * 0.03 :
                          0;
    let growth = pressure - relief;
    // Rent control clamps *positive* growth; deflation is allowed.
    if (growth > capPct) growth = capPct;
    if (growth < -0.02) growth = -0.02;
    H.rent[k] = clamp(H.rent[k] * (1 + growth), 30, 400);
  }

  // ── Gentrification index: core+middle rent vs income index.
  const rentPressure = ((H.rent.core + H.rent.middle) / 2) / H.incomeIndex * 100;
  const targetGI = clamp((rentPressure - 95) * 1.6, 0, 100);
  H.gentrificationIndex = Math.round(clamp(
    H.gentrificationIndex + (targetGI - H.gentrificationIndex) * 0.25, 0, 100,
  ));

  // ── Displacement & emigration.
  let displaced = 0, emigrated = 0;
  if (H.gentrificationIndex > 45) {
    const affected = (cap.core + cap.middle) * (H.gentrificationIndex - 45) / 300;
    displaced = Math.round(clamp(affected, 0, s.population * 0.01));
    // Half of the displaced end up in informal settlements → adds favela pressure.
    // A quarter emigrate; the rest crowd the periphery.
    emigrated = Math.round(displaced * 0.25);
  }
  H.displacedLastMonth = displaced;
  H.emigratedLastMonth = emigrated;

  // ── Social housing subsidy converts queue → served households.
  const served = Math.min(H.socialQueue, Math.round(H.policy.socialSubsidy / 1_800));
  H.socialQueue = Math.max(0, H.socialQueue - served + Math.round(displaced * 0.4));

  // ── Feedback into the simulation.
  const costDelta = Math.round(H.policy.socialSubsidy);
  // Happiness: unaffordable rent hurts; served waiting list helps.
  const rentBurden = clamp((rentPressure - 100) * 0.06, -1, 4);
  const happinessDelta = -rentBurden + (served > 0 ? 0.4 : 0) - (H.gentrificationIndex > 65 ? 1.2 : 0);

  return {
    costDelta,
    happinessDelta,
    populationDelta: -emigrated,
    // Extra pressure the favela module reads to spawn informal housing.
    favelaPressureBonus: clamp(displaced / Math.max(500, s.population * 0.005), 0, 3),
    news: H.gentrificationIndex > 70 ? "gentrification_alert" : undefined,
  };
}

// ── Actions ────────────────────────────────────────────────────────

export function setHousingPolicy(s: GameState, patch: Partial<HousingPolicy>): GameState {
  ensureHousing(s);
  const next = structuredClone(s);
  const p = next.housing.policy;
  if (patch.rentControlCap !== undefined) p.rentControlCap = clamp(patch.rentControlCap, 0, 8);
  if (patch.socialSubsidy !== undefined) p.socialSubsidy = clamp(Math.round(patch.socialSubsidy), 0, 500_000);
  return next;
}
