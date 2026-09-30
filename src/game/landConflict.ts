/**
 * Land Conflict & Gentrification — módulo específico:
 *  1) Ocupações de prédios/terrenos ociosos por movimentos de luta por moradia
 *     no centro (owner público ou privado). Player escolhe entre NEGOCIAR
 *     (desapropriação → habitação social) ou REINTEGRAÇÃO (tropa de choque).
 *  2) Valorização imobiliária desigual: obras públicas de grande porte
 *     (metrô, parque, hospital, universidade, BRT, piscinão) em bairros
 *     periféricos disparam ondas de gentrificação com defasagem de meses,
 *     que expulsam residentes para a informalidade e turbinam IPTU/ISS.
 *
 * O módulo é auto-contido: lê builtBuildings, transport (BRT/metro), climate
 * (piscinão) e housing (rent index), e devolve deltas para o tick mensal.
 */

import type { GameState, BuildingKind } from "./types";

/* ============================================================
 *  Types
 * ============================================================ */

export type OccupationOwner = "public" | "private";
export type OccupationStatus = "active" | "negotiated" | "evicted" | "abandoned";

export interface Occupation {
  id: string;
  /** Month/year the occupation started. */
  month: number;
  year: number;
  /** Approximate number of families squatting. */
  families: number;
  /** Owner of the abandoned building targeted. */
  ownerType: OccupationOwner;
  /** Tile index (row-major) if we tied it to a specific plot. */
  siteIdx?: number;
  status: OccupationStatus;
  /** Months since the occupation started, for pressure ramps. */
  ageMonths: number;
}

export interface DisplacementWave {
  id: string;
  triggerMonth: number;
  triggerYear: number;
  /** Countdown in months to the "peak" gentrification hit. */
  monthsUntilPeak: number;
  /** Ring targeted by the wave — periphery or informal. */
  stratum: "periphery" | "informal";
  /** Short human labels for the UI. */
  triggerLabelPt: string;
  triggerLabelEn: string;
  /** Families that will be pushed out at peak (approx). */
  familiesDisplaced: number;
  /** % rent spike at peak on the ring. */
  rentSpikePct: number;
  /** IPTU one-off catch-up at peak, R$. */
  iptuBonus: number;
  resolved: boolean;
}

export interface LandConflictState {
  occupations: Occupation[];
  waves: DisplacementWave[];
  /** Cumulative counters for the UI / metrics. */
  stats: {
    spawnedTotal: number;
    negotiated: number;
    evicted: number;
    familiesRehoused: number;
    familiesDisplacedByWaves: number;
    wavesFired: number;
  };
  /** Snapshot of "civic anchor" counts to detect NEW big investments. */
  lastAnchorSignature: string;
  /** Ensures unique ids across saves. */
  nextId: number;
}

export interface LandConflictTickResult {
  treasuryDelta: number;
  approvalDelta: number;
  happinessDelta: number;
  populationDelta: number;
  revenueDelta: number;
  mpRiskDelta: number;
  news: { kind: "info" | "warning" | "danger"; titleKey: string }[];
}

/* ============================================================
 *  Setup / migration
 * ============================================================ */

export function initialLandConflict(): LandConflictState {
  return {
    occupations: [],
    waves: [],
    stats: {
      spawnedTotal: 0,
      negotiated: 0,
      evicted: 0,
      familiesRehoused: 0,
      familiesDisplacedByWaves: 0,
      wavesFired: 0,
    },
    lastAnchorSignature: "",
    nextId: 1,
  };
}

export function ensureLandConflict(s: GameState): void {
  const g = s as GameState & { landConflict?: LandConflictState };
  if (!g.landConflict) g.landConflict = initialLandConflict();
}

/* ============================================================
 *  Helpers — geography
 * ============================================================ */

function ringOf(x: number, y: number, size: number): "core" | "middle" | "periphery" {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const maxDist = Math.hypot(cx, cy) || 1;
  const rel = Math.hypot(x - cx, y - cy) / maxDist;
  if (rel < 0.28) return "core";
  if (rel < 0.62) return "middle";
  return "periphery";
}

const ANCHOR_KINDS: ReadonlyArray<BuildingKind> = [
  "hospital", "university", "school", "water_plant", "power_plant",
];

/** Signature that encodes counts of "civic anchors" by ring. When it changes,
 *  we know new investments were planted. */
function anchorSignature(s: GameState): { sig: string; peripheryAnchors: number; label?: { pt: string; en: string } } {
  const size = s.mapSize;
  const counts: Record<string, number> = { core: 0, middle: 0, periphery: 0 };
  let peripheryAnchors = 0;
  let lastLabel: { pt: string; en: string } | undefined;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const b = s.builtBuildings[i];
    if (!b || !ANCHOR_KINDS.includes(b)) continue;
    if (s.buildingOwners[i] !== "state") continue;
    const x = i % size, y = Math.floor(i / size);
    const r = ringOf(x, y, size);
    counts[r] = (counts[r] ?? 0) + 1;
    if (r === "periphery") {
      peripheryAnchors += 1;
      lastLabel = anchorLabel(b);
    }
  }
  // Add mass-transit + climate infra as pseudo-anchors from other modules.
  const brt = s.transport?.brtCorridors ?? 0;
  const metro = s.transport?.metroStations ?? 0;
  const piscinoes = s.climate?.drainage?.piscinoes ?? 0;
  const sig = `${counts.core}|${counts.middle}|${counts.periphery}|${brt}|${metro}|${piscinoes}`;
  return { sig, peripheryAnchors: peripheryAnchors + brt + metro + piscinoes, label: lastLabel };
}

function anchorLabel(b: BuildingKind): { pt: string; en: string } {
  switch (b) {
    case "hospital":    return { pt: "hospital municipal", en: "municipal hospital" };
    case "university":  return { pt: "universidade pública", en: "public university" };
    case "school":      return { pt: "escola de referência", en: "flagship school" };
    case "water_plant": return { pt: "ETA de porte", en: "large water plant" };
    case "power_plant": return { pt: "subestação de energia", en: "power substation" };
    default:            return { pt: "grande obra", en: "major public work" };
  }
}

/* ============================================================
 *  Occupation spawn logic
 * ============================================================ */

function pickAbandonedSite(s: GameState, rng: () => number): { idx: number; owner: OccupationOwner } | null {
  // Prefer tiles where zoning is commercial/residential but no building grew
  // OR a hazard tile with a shy footprint — this proxies as an "abandoned
  // downtown plot / ocioso" without demanding new bookkeeping.
  const candidates: { idx: number; owner: OccupationOwner }[] = [];
  const size = s.mapSize;
  for (let i = 0; i < s.zones.length; i++) {
    const z = s.zones[i];
    if (z !== "commercial" && z !== "residential") continue;
    if (s.builtBuildings[i]) continue;
    const x = i % size, y = Math.floor(i / size);
    const ring = ringOf(x, y, size);
    if (ring !== "core" && ring !== "middle") continue;
    // Speculation age creates the "ocioso" flavor.
    const age = s.landUse?.speculationAge?.[i] ?? 0;
    if (age < 2) continue;
    candidates.push({ idx: i, owner: rng() < 0.5 ? "public" : "private" });
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

function pressureToSpawn(s: GameState): number {
  // 0..1 probability per month.
  const rentCore = s.housing?.rent?.core ?? 100;
  const vazios = s.landUse?.vazioTiles ?? 0;
  const housingQueue = s.housing?.socialQueue ?? 0;
  const unemp = s.unemployment ?? 8;
  const base = 0.03;
  const rentBoost = Math.max(0, rentCore - 108) * 0.006;
  const vazioBoost = Math.min(vazios, 12) * 0.008;
  const queueBoost = Math.min(housingQueue / 4000, 1) * 0.08;
  const unempBoost = Math.max(0, unemp - 7) * 0.005;
  return Math.min(0.32, base + rentBoost + vazioBoost + queueBoost + unempBoost);
}

/* ============================================================
 *  Player actions
 * ============================================================ */

/** Negotiation: expropriate the building and convert into social housing.
 *  Costs treasury, spends political capital modestly, boosts approval and
 *  reduces the social-housing queue. */
export function negotiateOccupation(s: GameState, id: string): GameState {
  ensureLandConflict(s);
  const g = s as GameState & { landConflict: LandConflictState };
  const occ = g.landConflict.occupations.find((o) => o.id === id && o.status === "active");
  if (!occ) return s;

  const perFamily = occ.ownerType === "public" ? 3_800 : 6_400;
  const cost = Math.round(perFamily * occ.families + 80_000);
  if (s.treasury < cost) return s;

  s.treasury -= cost;
  s.lastExpenses += cost;
  s.lastExpensesBreakdown.housing = (s.lastExpensesBreakdown.housing ?? 0) + cost;

  occ.status = "negotiated";
  g.landConflict.stats.negotiated += 1;
  g.landConflict.stats.familiesRehoused += occ.families;

  // Convert the plot into a formalized (favela-urbanized) reference and add
  // affordable capacity to the housing module.
  if (occ.siteIdx != null) {
    if (s.landUse?.formalized) s.landUse.formalized[occ.siteIdx] = true;
  }
  s.favelaUrbanized = (s.favelaUrbanized ?? 0) + Math.round(occ.families / 40);
  if (s.housing) {
    s.housing.socialQueue = Math.max(0, s.housing.socialQueue - occ.families);
    // Reduces core rent pressure marginally by adding housing supply.
    s.housing.rent.core = Math.max(60, s.housing.rent.core - 0.4);
  }
  s.approval = Math.min(100, s.approval + 3);
  s.happiness = Math.min(100, s.happiness + 2);

  return s;
}

/** Reintegração de posse: força policial, custo político alto, risco jurídico. */
export function evictOccupation(s: GameState, id: string): GameState {
  ensureLandConflict(s);
  const g = s as GameState & { landConflict: LandConflictState };
  const occ = g.landConflict.occupations.find((o) => o.id === id && o.status === "active");
  if (!occ) return s;

  const cost = Math.round(45_000 + occ.families * 220);
  if (s.treasury < cost) return s;

  s.treasury -= cost;
  s.lastExpenses += cost;
  s.lastExpensesBreakdown.security = (s.lastExpensesBreakdown.security ?? 0) + cost;

  occ.status = "evicted";
  const g2 = s as GameState & { landConflict: LandConflictState };
  g2.landConflict.stats.evicted += 1;

  // Political and social fallout.
  s.approval = Math.max(0, s.approval - 5);
  s.happiness = Math.max(0, s.happiness - 3);
  if (s.housing) {
    // Displaced families crowd into informal settlements.
    s.housing.socialQueue += occ.families;
    s.housing.gentrificationIndex = Math.min(
      100,
      s.housing.gentrificationIndex + 1,
    );
  }
  // Legal exposure: bumps MP risk if oversight module is present.
  if (s.oversight) {
    s.oversight.mpRisk = Math.min(100, s.oversight.mpRisk + 6);
  }
  // Corruption/media perception dings the coalition mood.
  // Media/transparency perception dings the coalition mood.
  if (s.politics?.institutional) {
    s.politics.institutional.transparency = Math.max(
      0,
      (s.politics.institutional.transparency ?? 55) - 3,
    );
  }
  return s;
}

/* ============================================================
 *  Monthly tick
 * ============================================================ */

export function tickLandConflict(s: GameState, rng: () => number): LandConflictTickResult {
  ensureLandConflict(s);
  const g = s as GameState & { landConflict: LandConflictState };
  const L = g.landConflict;

  const out: LandConflictTickResult = {
    treasuryDelta: 0,
    approvalDelta: 0,
    happinessDelta: 0,
    populationDelta: 0,
    revenueDelta: 0,
    mpRiskDelta: 0,
    news: [],
  };

  /* ---- 1) Spawn / age occupations ---- */
  // Age active occupations and apply ongoing pressure.
  for (const occ of L.occupations) {
    if (occ.status !== "active") continue;
    occ.ageMonths += 1;
    // Ongoing occupations wear down approval slowly and irritate the media.
    out.happinessDelta -= 0.15;
    if (occ.ageMonths >= 3) out.approvalDelta -= 0.2;
    if (occ.ageMonths >= 6 && occ.ownerType === "private") {
      out.mpRiskDelta += 0.6;
    }
  }
  // Clean up resolved ones older than 12 months to keep list small.
  if (L.occupations.length > 24) {
    L.occupations = L.occupations
      .filter((o) => o.status === "active" || o.ageMonths < 12)
      .slice(-24);
  }

  // Spawn new occupation?
  const activeCount = L.occupations.filter((o) => o.status === "active").length;
  if (activeCount < 4 && rng() < pressureToSpawn(s)) {
    const site = pickAbandonedSite(s, rng);
    if (site) {
      const families = 30 + Math.floor(rng() * 90);
      const occ: Occupation = {
        id: `occ-${L.nextId++}`,
        month: s.month,
        year: s.year,
        families,
        ownerType: site.owner,
        siteIdx: site.idx,
        status: "active",
        ageMonths: 0,
      };
      L.occupations.push(occ);
      L.stats.spawnedTotal += 1;
      out.news.push({
        kind: "warning",
        titleKey:
          site.owner === "public"
            ? `Ocupação: movimento por moradia entra em prédio público ocioso (${families} famílias)||Occupation: housing movement takes over an idle public building (${families} families)`
            : `Ocupação: prédio privado abandonado no centro é ocupado (${families} famílias)||Occupation: an abandoned downtown private building is occupied (${families} families)`,
      });
    }
  }

  /* ---- 2) Displacement waves triggered by big civic investment ---- */
  const anchor = anchorSignature(s);
  if (L.lastAnchorSignature === "") {
    L.lastAnchorSignature = anchor.sig;
  } else if (anchor.sig !== L.lastAnchorSignature) {
    // Something new was built. Compare only the periphery segment cheaply:
    // if peripheryAnchors grew, schedule a wave targeted at that ring.
    const prevPeriphery = Number((L.lastAnchorSignature.split("|")[2] ?? 0));
    const nowPeriphery = Number((anchor.sig.split("|")[2] ?? 0));
    const prevInfra = L.lastAnchorSignature.split("|").slice(3).reduce((a, v) => a + Number(v), 0);
    const nowInfra = anchor.sig.split("|").slice(3).reduce((a, v) => a + Number(v), 0);
    if (nowPeriphery > prevPeriphery || nowInfra > prevInfra) {
      const label = anchor.label ?? {
        pt: nowInfra > prevInfra ? "eixo de transporte de massa" : "grande obra",
        en: nowInfra > prevInfra ? "mass-transit corridor" : "major public work",
      };
      const wave: DisplacementWave = {
        id: `wave-${L.nextId++}`,
        triggerMonth: s.month,
        triggerYear: s.year,
        monthsUntilPeak: 8 + Math.floor(rng() * 4),
        stratum: rng() < 0.75 ? "periphery" : "informal",
        triggerLabelPt: label.pt,
        triggerLabelEn: label.en,
        familiesDisplaced: 120 + Math.floor(rng() * 220),
        rentSpikePct: 8 + Math.floor(rng() * 8),
        iptuBonus: 180_000 + Math.floor(rng() * 220_000),
        resolved: false,
      };
      L.waves.push(wave);
      out.news.push({
        kind: "info",
        titleKey: `Investimento em ${label.pt} atrai capital privado — atenção à especulação||Investment in ${label.en} attracts private capital — watch for speculation`,
      });
    }
    L.lastAnchorSignature = anchor.sig;
  }

  // Progress open waves.
  for (const w of L.waves) {
    if (w.resolved) continue;
    w.monthsUntilPeak -= 1;
    if (w.monthsUntilPeak > 0) continue;
    // Peak: apply displacement, rent spike, IPTU catch-up.
    w.resolved = true;
    L.stats.wavesFired += 1;
    L.stats.familiesDisplacedByWaves += w.familiesDisplaced;

    if (s.housing) {
      s.housing.rent[w.stratum] = Math.min(
        400,
        s.housing.rent[w.stratum] * (1 + w.rentSpikePct / 100),
      );
      s.housing.gentrificationIndex = Math.min(
        100,
        s.housing.gentrificationIndex + 6,
      );
      s.housing.displacedLastMonth += w.familiesDisplaced;
      s.housing.socialQueue += Math.round(w.familiesDisplaced * 0.6);
    }
    out.revenueDelta += w.iptuBonus;
    out.treasuryDelta += w.iptuBonus;
    out.approvalDelta -= 2;
    out.happinessDelta -= 2.5;
    out.news.push({
      kind: "warning",
      titleKey: `Gentrificação: valorização em torno de ${w.triggerLabelPt} expulsa ~${w.familiesDisplaced} famílias||Gentrification: land-value spike around ${w.triggerLabelEn} pushes out ~${w.familiesDisplaced} families`,
    });
  }
  // Trim resolved waves so the panel stays legible.
  if (L.waves.length > 20) {
    L.waves = L.waves.slice(-20);
  }

  return out;
}
