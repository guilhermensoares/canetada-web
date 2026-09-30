import type { BuildingKind, GameState, ZoneKind } from "./types";
import { generateMap, generateBaseMap } from "./mapGen";
import { mulberry32, hashSeed } from "./rng";

export const MAP_SIZE = 18;

/* ---------------- Attractiveness ---------------- */

/**
 * City attractiveness (0..100) — the master signal that decides what kind of
 * buildings zones grow into. High attractiveness attracts towers and offices;
 * low attractiveness produces cheap shacks and small shops.
 */
export function computeAttractiveness(s: GameState): number {
  const policyAvg =
    (s.policies.education + s.policies.health + s.policies.security + s.policies.transport) / 4;
  const taxBurden = s.taxes.income + s.taxes.property * 0.6 + s.taxes.business * 0.5;
  const waterGap = Math.max(0, s.waterDemand - s.infra.waterCapacity);
  const energyGap = Math.max(0, s.energyDemand - s.infra.energyCapacity);

  let score = 40;
  score += (s.happiness - 55) * 0.35;
  score += (s.approval - 50) * 0.15;
  score += (policyAvg - 50) * 0.25;
  score -= (taxBurden - 20) * 0.4;
  score -= s.inflation > 4 ? (s.inflation - 4) * 1.3 : 0;
  score -= s.unemployment > 8 ? (s.unemployment - 8) * 0.6 : 0;
  score -= (waterGap + energyGap) * 0.15;
  score += s.treasury < 0 ? -8 : 0;
  // Air quality: clean cities pull higher-end residential (towers, large houses).
  const air = s.environment?.airQuality ?? 70;
  score += (air - 55) * 0.25;
  return clamp(Math.round(score), 0, 100);
}

/* ---------------- Building selection per zone ---------------- */

interface BuildingRoll {
  kinds: BuildingKind[];
  weights: number[];
}

function residentialRoll(attr: number): BuildingRoll {
  // Low attractiveness → mostly small houses. High → medium/large/towers.
  // High-attractiveness residential areas occasionally spawn a PRIVATE school.
  if (attr < 30) return { kinds: ["house_s", "house_m", "tree"], weights: [0.7, 0.25, 0.05] };
  if (attr < 55) return { kinds: ["house_s", "house_m", "house_l"], weights: [0.4, 0.45, 0.15] };
  if (attr < 75)
    return { kinds: ["house_m", "house_l", "tower", "school_private"], weights: [0.38, 0.38, 0.2, 0.04] };
  return { kinds: ["house_l", "tower", "tower", "school_private"], weights: [0.28, 0.48, 0.18, 0.06] };
}

function commercialRoll(attr: number): BuildingRoll {
  if (attr < 35) return { kinds: ["shop", "shop", "house_s"], weights: [0.6, 0.3, 0.1] };
  if (attr < 60) return { kinds: ["shop", "office"], weights: [0.55, 0.45] };
  if (attr < 80) return { kinds: ["shop", "office", "tower"], weights: [0.25, 0.5, 0.25] };
  return { kinds: ["office", "tower"], weights: [0.4, 0.6] };
}

function industrialRoll(attr: number): BuildingRoll {
  if (attr < 40) return { kinds: ["factory", "factory", "tree"], weights: [0.6, 0.25, 0.15] };
  return { kinds: ["factory"], weights: [1] };
}

function ruralRoll(attr: number): BuildingRoll {
  void attr;
  return { kinds: ["farm", "barn", "tree", "house_s"], weights: [0.4, 0.2, 0.3, 0.1] };
}

/**
 * ZEIS (Zonas Especiais de Interesse Social) grow ONLY low-density housing.
 * Towers/luxury are forbidden regardless of attractiveness — the whole point
 * of the instrument is to hold land at social-housing density.
 */
function zeisRoll(attr: number): BuildingRoll {
  if (attr < 40) return { kinds: ["house_s", "house_s", "tree"], weights: [0.6, 0.3, 0.1] };
  return { kinds: ["house_s", "house_m"], weights: [0.55, 0.45] };
}

function rollBuilding(zone: ZoneKind, attr: number, rng: () => number): BuildingKind | null {
  const roll =
    zone === "residential" ? residentialRoll(attr)
    : zone === "commercial" ? commercialRoll(attr)
    : zone === "industrial" ? industrialRoll(attr)
    : zone === "rural" ? ruralRoll(attr)
    : zone === "zeis" ? zeisRoll(attr)
    : null;
  if (!roll) return null;
  const r = rng();
  let acc = 0;
  for (let i = 0; i < roll.kinds.length; i++) {
    acc += roll.weights[i];
    if (r < acc) return roll.kinds[i];
  }
  return roll.kinds[roll.kinds.length - 1];
}

/* ---------------- Growth tick ---------------- */

/**
 * Every monthly tick, a few zoned-empty tiles develop into buildings selected
 * by attractiveness. Applies the **Outorga Onerosa** whenever a tower is
 * placed on residential/commercial land: developers pay the city
 * `landPolicy.outorgaPrice` for the extra construction potential (FAR). Higher
 * prices discourage tower placement, mimicking market response. ZEIS never
 * pay outorga because they cannot host towers.
 *
 * Mutates state. Returns count of buildings placed.
 */
export function growCity(s: GameState, rng: () => number): number {
  const attr = s.attractiveness;
  const budget = 3 + Math.floor(attr / 20);
  const baseProb = 0.25 + attr * 0.006; // 0.25..0.85
  const outorgaPrice = Math.max(0, s.landPolicy?.outorgaPrice ?? 0);
  // Higher outorga price → developers less willing to buy FAR → fewer towers.
  const towerKeepProb = clamp(1 - (outorgaPrice / 500_000) * 0.7, 0.3, 1);

  const candidates: number[] = [];
  for (let i = 0; i < s.zones.length; i++) {
    if (s.zones[i] === "none") continue;
    if (s.builtBuildings[i]) continue;
    candidates.push(i);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  let placed = 0;
  for (const idx of candidates) {
    if (placed >= budget) break;
    if (rng() >= baseProb) continue;
    const zone = s.zones[idx];
    let kind = rollBuilding(zone, attr, rng);
    if (!kind) continue;
    // Outorga: if a tower would be placed on res/com land and the market
    // rejects the FAR price, downgrade to the tier below instead.
    if (kind === "tower" && (zone === "residential" || zone === "commercial")) {
      if (rng() >= towerKeepProb) {
        kind = zone === "residential" ? "house_l" : "office";
      } else if (outorgaPrice > 0) {
        s.treasury += outorgaPrice;
        s.landUse.outorgaSold += 1;
        s.landUse.outorgaRevenue += outorgaPrice;
      }
    }
    s.builtBuildings[idx] = kind;
    s.buildingOwners[idx] = "private";
    s.landUse.speculationAge[idx] = 0;
    placed++;
  }
  return placed;
}

/* ---------------- Painting ---------------- */

/**
 * Return true if a tile at world index can receive a zone / building (grass or
 * park). Water, roads and plaza are locked to the terrain.
 */
export function isZoneableTileKind(kind: string): boolean {
  return kind === "grass" || kind === "park" || kind === "dirt" || kind === "industrial";
}

/* ---------------- Snapshot / migration ---------------- */

/**
 * Build the initial zones + buildings arrays from a full seed-generated map.
 * Called when a new game starts, or when a legacy save is loaded without any
 * zoning fields.
 */
export function snapshotZoningFromSeed(state: GameState): {
  zones: ZoneKind[];
  builtBuildings: (BuildingKind | null)[];
} {
  const size = state.mapSize || MAP_SIZE;
  const map = generateMap(state, size);
  const zones: ZoneKind[] = new Array(size * size).fill("none");
  const builtBuildings: (BuildingKind | null)[] = new Array(size * size).fill(null);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const t = map.tiles[i];
      if (t.building && (t.kind === "grass" || t.kind === "dirt" || t.kind === "industrial")) {
        builtBuildings[i] = t.building;
        zones[i] = inferZone(t.building);
      }
    }
  }
  return { zones, builtBuildings };
}

function inferZone(b: BuildingKind): ZoneKind {
  switch (b) {
    case "house_s":
    case "house_m":
    case "house_l":
    case "tower":
    case "favela_s":
    case "favela_m":
    case "favela_l":
      return "residential";
    case "shop":
    case "office":
      return "commercial";
    case "factory":
      return "industrial";
    case "farm":
    case "barn":
      return "rural";
    default:
      return "none";
  }
}

/* ---------------- Favelas (organic growth) ---------------- */

const FAVELA_KINDS: BuildingKind[] = ["favela_s", "favela_m", "favela_l"];

export function isFavela(b: BuildingKind | null | undefined): boolean {
  return b === "favela_s" || b === "favela_m" || b === "favela_l";
}

export function countFavelas(s: GameState): { count: number; small: number; medium: number; large: number } {
  let count = 0, small = 0, medium = 0, large = 0;
  for (const b of s.builtBuildings) {
    if (b === "favela_s") { small++; count++; }
    else if (b === "favela_m") { medium++; count++; }
    else if (b === "favela_l") { large++; count++; }
  }
  return { count, small, medium, large };
}

/**
 * Favela pressure score (0..~100). High values → favelas surge; low values →
 * favelas can be integrated. Combines housing shortage, cost of living, poor
 * public services and infra gaps.
 */
export function favelaPressure(s: GameState): number {
  const housingDeficit = Math.max(0, s.population / Math.max(1, occupiedHousingCapacity(s)) - 1);
  const jobless = Math.max(0, s.unemployment - 6);
  const infraFail = Math.max(0, s.waterDemand / s.infra.waterCapacity - 1) * 40
                  + Math.max(0, s.energyDemand / s.infra.energyCapacity - 1) * 30;
  const socialGap = Math.max(0, 55 - (s.policies.health + s.policies.education + s.policies.security) / 3);
  const inflationHit = Math.max(0, s.inflation - 4) * 2.5;
  return clamp(
    housingDeficit * 30 + jobless * 3.2 + infraFail + socialGap * 0.7 + inflationHit,
    0,
    100,
  );
}

function occupiedHousingCapacity(s: GameState): number {
  // Rough dwelling capacity per building kind (people).
  let cap = 0;
  for (const b of s.builtBuildings) {
    if (b === "house_s") cap += 180;
    else if (b === "house_m") cap += 380;
    else if (b === "house_l") cap += 720;
    else if (b === "tower") cap += 1800;
    else if (b === "favela_s") cap += 260;
    else if (b === "favela_m") cap += 520;
    else if (b === "favela_l") cap += 900;
  }
  return Math.max(1, cap);
}

/**
 * Neighbor-aware favela spawning. Favelas prefer:
 *  - grass tiles adjacent to industrial zones (pollution/edge lots)
 *  - unzoned tiles adjacent to overcrowded residential areas
 *  - unzoned edge tiles when housing is severely short (invasion pattern)
 * Existing favelas can level up (s → m → l) when pressure remains high.
 */
export function growFavelas(s: GameState, rng: () => number): number {
  const pressure = favelaPressure(s);
  if (pressure < 22) return 0; // healthy cities: no new favelas
  const size = s.mapSize;
  const budget = 1 + Math.floor(pressure / 25);   // 1..5 attempts per month
  const spawnProb = clamp(0.15 + (pressure - 22) * 0.012, 0.15, 0.85);
  const upgradeProb = clamp(0.08 + (pressure - 22) * 0.006, 0.08, 0.5);

  const seedMap = snapshotZoningFromSeed(s); // reuse to know base tile kinds
  const baseKinds: string[] = new Array(size * size);
  for (let i = 0; i < baseKinds.length; i++) {
    baseKinds[i] = seedMap.builtBuildings[i] ? "grass" : "grass"; // conservative; painter checks below
  }

  const isAdj = (idx: number, pred: (n: number) => boolean): boolean => {
    const x = idx % size, y = Math.floor(idx / size);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (pred(ny * size + nx)) return true;
    }
    return false;
  };

  // Collect existing favela indices for potential upgrades.
  const favelaIdx: number[] = [];
  for (let i = 0; i < s.builtBuildings.length; i++) if (isFavela(s.builtBuildings[i])) favelaIdx.push(i);

  // Collect spawn candidates. Hazard tiles (APPs, encostas) are always eligible
  // when pressure is high — informal settlements historically occupy the land
  // no one else wants precisely because it is dangerous.
  const spawnable: number[] = [];
  const hazardCandidates: number[] = [];
  const hz = s.landUse?.hazardMask ?? [];
  for (let i = 0; i < s.builtBuildings.length; i++) {
    if (s.builtBuildings[i]) continue;
    if (s.buildingOwners[i] === "state") continue;
    const nearIndustry = isAdj(i, (n) => s.zones[n] === "industrial" || s.builtBuildings[n] === "factory");
    const nearResidential = isAdj(i, (n) => s.zones[n] === "residential" || s.zones[n] === "zeis" || (s.builtBuildings[n] === "house_s"));
    const zoneOk =
      s.zones[i] === "none" ||
      s.zones[i] === "residential" ||
      s.zones[i] === "industrial" ||
      s.zones[i] === "zeis";
    if (!zoneOk) continue;
    if (hz[i]) hazardCandidates.push(i);
    else if (nearIndustry || nearResidential) spawnable.push(i);
  }
  for (let i = spawnable.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [spawnable[i], spawnable[j]] = [spawnable[j], spawnable[i]];
  }
  for (let i = hazardCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [hazardCandidates[i], hazardCandidates[j]] = [hazardCandidates[j], hazardCandidates[i]];
  }
  // Under high pressure, prefer hazard tiles first — this is where APP
  // invasions happen. Otherwise keep the classic near-industry/residential mix.
  const ordered = pressure > 55 ? [...hazardCandidates, ...spawnable] : [...spawnable, ...hazardCandidates];

  let placed = 0;
  // 1) Upgrade a few existing favelas first (organic densification).
  for (const idx of favelaIdx) {
    if (placed >= budget) break;
    if (rng() >= upgradeProb) continue;
    const cur = s.builtBuildings[idx];
    if (cur === "favela_s") { s.builtBuildings[idx] = "favela_m"; placed++; }
    else if (cur === "favela_m") { s.builtBuildings[idx] = "favela_l"; placed++; }
  }
  // 2) Spawn new favelas — hazard tiles first when pressure is high.
  for (const idx of ordered) {
    if (placed >= budget) break;
    if (rng() >= spawnProb) continue;
    s.builtBuildings[idx] = "favela_s";
    s.buildingOwners[idx] = "private";
    if (s.zones[idx] === "none") s.zones[idx] = "residential";
    placed++;
  }
  return placed;
}

/* ---------------- Hazard mask (APPs, encostas) ---------------- */

/**
 * Deterministic hazard mask from the city seed: tiles adjacent to water bodies
 * (áreas de preservação permanente ao longo de córregos) plus a handful of
 * steep "encosta" clusters scattered by the seed. Informal settlements are
 * biased toward these tiles when housing pressure is high.
 */
export function computeHazardMask(s: GameState): boolean[] {
  const size = s.mapSize;
  const mask = new Array(size * size).fill(false) as boolean[];
  const base = generateBaseMap(s, size);
  // 1) Buffer around water bodies (1-tile APP).
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (base.tiles[i].kind !== "water") continue;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (base.tiles[ni].kind === "grass") mask[ni] = true;
      }
    }
  }
  // 2) 2–4 seed-driven "encosta" clusters, 3–5 tiles each.
  const rng = mulberry32(hashSeed(s.seed + "|hazard"));
  const clusters = 2 + Math.floor(rng() * 3);
  for (let c = 0; c < clusters; c++) {
    const cx = Math.floor(rng() * size);
    const cy = Math.floor(rng() * size);
    const radius = 1 + Math.floor(rng() * 2);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius + 1) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (base.tiles[ni].kind === "grass") mask[ni] = true;
      }
    }
  }
  return mask;
}

export function isHazard(s: GameState, i: number): boolean {
  return !!s.landUse?.hazardMask?.[i];
}

/* ---------------- Speculation, vazios urbanos, IPTU progressivo ---------------- */

/**
 * Monthly land-use bookkeeping: ages speculative tiles, counts vazios, collects
 * IPTU progressivo (if active). Called once per month from the game tick.
 * Returns the number of speculative tiles this month.
 */
export function tickLandUse(s: GameState): {
  vazioTiles: number;
  iptuRevenue: number;
  hazardFavelas: number;
} {
  const ages = s.landUse.speculationAge;
  const hz = s.landUse.hazardMask;
  let vazioTiles = 0;
  for (let i = 0; i < s.zones.length; i++) {
    const z = s.zones[i];
    const speculative =
      (z === "residential" || z === "commercial") &&
      !s.builtBuildings[i] &&
      s.buildingOwners[i] !== "state";
    if (speculative) {
      ages[i] = Math.min(120, (ages[i] ?? 0) + 1);
      if (ages[i] >= 6) vazioTiles++;
    } else if (ages[i]) {
      ages[i] = 0;
    }
  }
  let iptuRevenue = 0;
  if (s.landPolicy.progressiveIptu && vazioTiles > 0) {
    // 1 500 per vazio/month, escalates by tile age.
    for (let i = 0; i < ages.length; i++) {
      if (ages[i] >= 6) iptuRevenue += 1500 + Math.min(24, ages[i] - 6) * 250;
    }
    s.treasury += iptuRevenue;
    s.landUse.vazioRevenue += iptuRevenue;
  }
  // Count favelas sitting on hazard tiles for KPI display.
  let hazardFavelas = 0;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const b = s.builtBuildings[i];
    if ((b === "favela_s" || b === "favela_m" || b === "favela_l") && hz?.[i]) hazardFavelas++;
  }
  s.landUse.vazioTiles = vazioTiles;
  s.landUse.hazardFavelas = hazardFavelas;
  return { vazioTiles, iptuRevenue, hazardFavelas };
}

/**
 * Regularização Fundiária: monthly step that upgrades one favela into formal
 * housing when the player funds `regularizationRate > 0`. Hazard-zone favelas
 * cost 1.8x and take slower — mirroring the reality of relocation from APPs.
 * Returns true if a tile was regularized this month.
 */
export function regularizeFavelaStep(s: GameState, rng: () => number): boolean {
  const rate = s.landPolicy.regularizationRate;
  if (rate <= 0) return false;
  // Monthly budget consumed regardless of success (staff, surveys, papers).
  const monthlyCost = Math.round(rate * 1200);
  if (s.treasury < monthlyCost) return false;
  s.treasury -= monthlyCost;

  const chance = 0.15 + rate * 0.008; // 15%..95% at rate=100
  if (rng() >= chance) return false;

  // Pick a favela — prefer non-hazard first, hazard when rate is high enough.
  const nonHazard: number[] = [];
  const hazard: number[] = [];
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const b = s.builtBuildings[i];
    if (b !== "favela_s" && b !== "favela_m" && b !== "favela_l") continue;
    if (s.landUse.hazardMask[i]) hazard.push(i);
    else nonHazard.push(i);
  }
  const pool = nonHazard.length && rate < 70 ? nonHazard : (nonHazard.length ? [...nonHazard, ...hazard] : hazard);
  if (!pool.length) return false;
  const idx = pool[Math.floor(rng() * pool.length)];
  const tier = s.builtBuildings[idx];
  const hazardTile = s.landUse.hazardMask[idx];
  // Extra one-off cost paid on success.
  const extra = (tier === "favela_l" ? 260_000 : tier === "favela_m" ? 160_000 : 90_000) * (hazardTile ? 1.8 : 1);
  if (s.treasury < extra) return false;
  s.treasury -= extra;

  if (hazardTile) {
    // APP/encosta: cannot legally consolidate → tile is cleared, families relocated.
    s.builtBuildings[idx] = null;
    s.buildingOwners[idx] = null;
    s.zones[idx] = "none";
  } else if (tier === "favela_l") {
    s.builtBuildings[idx] = "house_l";
    s.buildingOwners[idx] = "private";
    s.zones[idx] = "residential";
  } else if (tier === "favela_m") {
    s.builtBuildings[idx] = "house_m";
    s.buildingOwners[idx] = "private";
    s.zones[idx] = "residential";
  } else {
    s.builtBuildings[idx] = "house_s";
    s.buildingOwners[idx] = "private";
    s.zones[idx] = "residential";
  }
  s.landUse.formalized[idx] = true;
  s.landUse.regularized += 1;
  s.happiness = Math.min(100, s.happiness + (hazardTile ? 1.2 : 2.5));
  s.approval = Math.min(100, s.approval + (hazardTile ? 1.5 : 3));
  return true;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
