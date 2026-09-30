/**
 * Socio-environmental disasters & urban resilience module.
 *
 * Models the Brazilian summer rainfall cycle (Dec–Mar) and its impact on
 * informal hillside/riverbank occupations. Each risk area is classified A–D
 * following a simplified Defesa Civil scale:
 *   A = baixo, B = médio, C = alto, D = muito alto.
 *
 * A 30-day rolling rainfall accumulator drives the landslide trigger. When
 * accumulated rainfall exceeds `landslideThresholdMm` (default 200 mm) and
 * category C/D areas are populated, a disaster event is spawned. The player
 * then manages the crisis in real time via three actions (evacuate, open
 * shelters, coordinate donations) whose composite response score determines
 * the political, fiscal and legal fallout.
 */

import type { GameState, NewsItem } from "./types";
import { t } from "./i18n";

/* ---------------- Types ---------------- */

export type RiskCategory = "A" | "B" | "C" | "D";
export type RiskKind = "hillside" | "riverbank";

export interface RiskArea {
  id: string;
  nameKey: string;      // display label
  kind: RiskKind;
  households: number;   // families still living there
  category: RiskCategory;
  containment: number;  // 0..100 (retaining walls, drainage, geotech)
  relocated: number;    // families removed cumulatively
  revolt: number;       // 0..100, lingering resentment from forced removals
}

export interface DisasterEvent {
  id: string;
  month: number; year: number;
  areaId: string;
  areaNameKey: string;
  kind: RiskKind;
  severity: number;   // 0..100 raw hazard intensity
  households: number; // families at risk when triggered
  // Crisis-mgmt state (mutated by player actions while active)
  evacuated: number;
  shelterCapacity: number;
  donationsCoordinated: boolean;
  actionsUsed: string[];
  // Outcome (filled at resolution)
  active: boolean;
  victims: number;
  displaced: number;
  responseScore: number; // 0..100
  outcome?: "handled" | "mismanaged" | "tragedy";
}

export interface DisasterState {
  areas: RiskArea[];
  /** Rolling 30-day rainfall accumulator (mm). */
  rainAccumMm: number;
  /** Landslide trigger threshold (mm) — configurable. */
  landslideThresholdMm: number;
  /** Monthly passive containment budget (R$). */
  monthlyContainmentBudget: number;
  activeEvent?: DisasterEvent;
  history: DisasterEvent[];
  /** 0..100 — grows with mismanaged crises, drives lawsuits. */
  legalRisk: number;
  /** Remaining months of federal grant penalty. */
  federalPenaltyMonths: number;
  /** Remaining months of legal cost stream. */
  legalCostMonths: number;
  lastFederalPenalty: number;
  lastLegalCost: number;
  lastRainMm: number;
}

export interface DisasterTickOutput {
  approvalDelta: number;
  happinessDelta: number;
  treasuryDelta: number;
  news: Omit<NewsItem, "id" | "day" | "month" | "year">[];
}

/* ---------------- Init ---------------- */

const CATEGORY_ORDER: Record<RiskCategory, number> = { A: 1, B: 2, C: 3, D: 4 };

function seedAreas(): RiskArea[] {
  return [
    { id: "morro-cruz",   nameKey: "dsr.area.morroCruz",   kind: "hillside",  households: 140, category: "D", containment:  8, relocated: 0, revolt: 0 },
    { id: "vila-encosta", nameKey: "dsr.area.vilaEncosta", kind: "hillside",  households: 110, category: "C", containment: 22, relocated: 0, revolt: 0 },
    { id: "beira-rio",    nameKey: "dsr.area.beiraRio",    kind: "riverbank", households:  95, category: "C", containment: 15, relocated: 0, revolt: 0 },
    { id: "varzea",       nameKey: "dsr.area.varzea",      kind: "riverbank", households:  70, category: "B", containment: 30, relocated: 0, revolt: 0 },
  ];
}

export function initialDisasters(): DisasterState {
  return {
    areas: seedAreas(),
    rainAccumMm: 0,
    landslideThresholdMm: 200,
    monthlyContainmentBudget: 0,
    history: [],
    legalRisk: 0,
    federalPenaltyMonths: 0,
    legalCostMonths: 0,
    lastFederalPenalty: 0,
    lastLegalCost: 0,
    lastRainMm: 0,
  };
}

export function ensureDisasters(s: GameState): DisasterState {
  const holder = s as GameState & { disasters?: DisasterState };
  if (!holder.disasters) holder.disasters = initialDisasters();
  // Backfill new fields on legacy saves.
  if (!Array.isArray(holder.disasters.areas)) holder.disasters.areas = seedAreas();
  return holder.disasters;
}

/* ---------------- Rainfall model ---------------- */

/** Approx mm of rainfall for the calendar month (matches climate.rainIntensity peaks). */
function monthlyRainMm(month: number, rng: () => number): number {
  const rainy = month === 12 || month <= 3;
  if (!rainy) return 20 + rng() * 40;          // 20–60mm dry season
  const peak = month === 1 || month === 2;
  const base = peak ? 220 : 140;               // Jan/Feb peaks
  return base + rng() * 120;                   // heavy variability
}

/* ---------------- Actions ---------------- */

/** Player invests in containment works (walls, drainage, geotech). */
export function investContainment(s: GameState, areaId: string): GameState {
  const d = ensureDisasters(s);
  const a = d.areas.find((x) => x.id === areaId);
  if (!a) return s;
  const cost = 500_000;
  if (s.treasury < cost) return s;
  s.treasury -= cost;
  a.containment = Math.min(100, a.containment + 15);
  // Successful engineering slowly downgrades the risk category.
  if (a.containment >= 85 && a.category === "D") a.category = "C";
  else if (a.containment >= 65 && a.category === "C") a.category = "B";
  return s;
}

/** Forced relocation of a batch of families to distant housing. */
export function relocateHouseholds(s: GameState, areaId: string, batch = 20): GameState {
  const d = ensureDisasters(s);
  const a = d.areas.find((x) => x.id === areaId);
  if (!a || a.households <= 0) return s;
  const n = Math.min(batch, a.households);
  const cost = n * 80_000; // conjunto habitacional per family
  if (s.treasury < cost) return s;
  s.treasury -= cost;
  a.households -= n;
  a.relocated += n;
  a.revolt = Math.min(100, a.revolt + 10 + (a.category === "D" ? 6 : 0));
  // Community disintegration hits city-wide happiness.
  s.happiness = Math.max(0, s.happiness - 2);
  s.approval  = Math.max(0, s.approval  - 3);
  return s;
}

export function setLandslideThreshold(s: GameState, mm: number): GameState {
  const d = ensureDisasters(s);
  d.landslideThresholdMm = Math.max(80, Math.min(400, Math.round(mm)));
  return s;
}

export function setContainmentBudget(s: GameState, budget: number): GameState {
  const d = ensureDisasters(s);
  d.monthlyContainmentBudget = Math.max(0, Math.min(2_000_000, Math.round(budget)));
  return s;
}

/* ----- Real-time crisis actions ----- */

export function crisisEvacuate(s: GameState): GameState {
  const d = ensureDisasters(s);
  const e = d.activeEvent;
  if (!e || !e.active || e.actionsUsed.includes("evacuate")) return s;
  const cost = 200_000;
  if (s.treasury < cost) return s;
  s.treasury -= cost;
  e.evacuated = Math.min(e.households, e.evacuated + Math.round(e.households * 0.55));
  e.actionsUsed.push("evacuate");
  return s;
}

export function crisisOpenShelter(s: GameState): GameState {
  const d = ensureDisasters(s);
  const e = d.activeEvent;
  if (!e || !e.active || e.actionsUsed.includes("shelter")) return s;
  const cost = 400_000;
  if (s.treasury < cost) return s;
  s.treasury -= cost;
  e.shelterCapacity += 220;
  e.actionsUsed.push("shelter");
  return s;
}

export function crisisCoordinateDonations(s: GameState): GameState {
  const d = ensureDisasters(s);
  const e = d.activeEvent;
  if (!e || !e.active || e.actionsUsed.includes("donations")) return s;
  const cost = 50_000;
  if (s.treasury < cost) return s;
  s.treasury -= cost;
  e.donationsCoordinated = true;
  e.actionsUsed.push("donations");
  return s;
}

/* ---------------- Monthly tick ---------------- */

export function tickDisasters(s: GameState, rng: () => number): DisasterTickOutput {
  const d = ensureDisasters(s);
  const out: DisasterTickOutput = {
    approvalDelta: 0, happinessDelta: 0, treasuryDelta: 0, news: [],
  };

  /* --- Rain accumulator (30-day rolling window). --- */
  const rain = monthlyRainMm(s.month, rng);
  d.lastRainMm = Math.round(rain);
  d.rainAccumMm = Math.round(d.rainAccumMm * 0.35 + rain);

  /* --- Passive containment investment. --- */
  if (d.monthlyContainmentBudget > 0 && s.treasury >= d.monthlyContainmentBudget) {
    s.treasury -= d.monthlyContainmentBudget;
    out.treasuryDelta -= d.monthlyContainmentBudget;
    // Prioritise highest-risk populated area.
    const target = [...d.areas]
      .filter((a) => a.households > 0)
      .sort((a, b) =>
        CATEGORY_ORDER[b.category] - CATEGORY_ORDER[a.category] ||
        a.containment - b.containment,
      )[0];
    if (target) {
      const gain = Math.min(6, d.monthlyContainmentBudget / 100_000);
      target.containment = Math.min(100, target.containment + gain);
    }
  }

  /* --- Revolt decay + reelection drag. --- */
  d.areas.forEach((a) => { a.revolt = Math.max(0, a.revolt - 1.5); });

  /* --- Ongoing legal / grant penalties from past mismanagement. --- */
  if (d.legalCostMonths > 0) {
    const cost = 400_000;
    s.treasury -= cost;
    out.treasuryDelta -= cost;
    d.lastLegalCost = cost;
    d.legalCostMonths -= 1;
  } else d.lastLegalCost = 0;
  if (d.federalPenaltyMonths > 0) {
    d.lastFederalPenalty = 500_000;
    s.treasury -= 500_000;
    out.treasuryDelta -= 500_000;
    d.federalPenaltyMonths -= 1;
  } else d.lastFederalPenalty = 0;

  /* --- Resolve any active event that has completed one month. --- */
  if (d.activeEvent && d.activeEvent.active) {
    resolveEvent(s, d, out);
  }

  /* --- Trigger new event when threshold exceeded. --- */
  if (!d.activeEvent?.active && d.rainAccumMm >= d.landslideThresholdMm) {
    const candidate = pickTriggerArea(d);
    if (candidate) {
      spawnEvent(s, d, candidate, rng, out);
    }
  }

  return out;
}

function pickTriggerArea(d: DisasterState): RiskArea | undefined {
  // Highest-category, lowest-containment populated area wins.
  return [...d.areas]
    .filter((a) => a.households > 0 && (a.category === "C" || a.category === "D"))
    .sort((a, b) =>
      CATEGORY_ORDER[b.category] - CATEGORY_ORDER[a.category] ||
      a.containment - b.containment,
    )[0];
}

function spawnEvent(
  s: GameState, d: DisasterState, area: RiskArea, rng: () => number,
  out: DisasterTickOutput,
) {
  const catWeight = area.category === "D" ? 1.0 : 0.65;
  const severity = Math.round(
    Math.min(100, 45 + catWeight * 40 * rng() + (100 - area.containment) * 0.25),
  );
  const event: DisasterEvent = {
    id: `${s.year}-${s.month}-${area.id}`,
    month: s.month, year: s.year,
    areaId: area.id, areaNameKey: area.nameKey, kind: area.kind,
    severity,
    households: area.households,
    evacuated: 0,
    shelterCapacity: 0,
    donationsCoordinated: false,
    actionsUsed: [],
    active: true,
    victims: 0, displaced: 0, responseScore: 0,
  };
  d.activeEvent = event;
  const areaPt = t("pt", area.nameKey, area.nameKey);
  const areaEn = t("en", area.nameKey, area.nameKey);
  out.news.push({
    kind: "danger",
    titleKey: area.kind === "hillside"
      ? `Deslizamento iminente em ${areaPt}||Imminent landslide at ${areaEn}`
      : `Enchente relâmpago em ${areaPt}||Flash flood at ${areaEn}`,
  });
}

function resolveEvent(s: GameState, d: DisasterState, out: DisasterTickOutput) {
  const e = d.activeEvent!;
  const area = d.areas.find((a) => a.id === e.areaId);
  if (!area) { e.active = false; return; }

  const evacRatio    = e.households > 0 ? e.evacuated / e.households : 1;
  const shelterRatio = Math.min(1, e.shelterCapacity / Math.max(1, e.households - e.evacuated));
  const donations    = e.donationsCoordinated ? 1 : 0;

  // Base mortality by category, tempered by containment and evacuation.
  const baseFatal = area.category === "D" ? 0.09 : area.category === "C" ? 0.04 : 0.02;
  const containMod = 1 - area.containment / 130;
  const evacMod    = 1 - evacRatio * 0.85;
  const sevMod     = e.severity / 100;

  e.victims   = Math.max(0, Math.round(e.households * baseFatal * containMod * evacMod * sevMod));
  e.displaced = Math.max(
    0, Math.round(e.households * (0.35 + sevMod * 0.4) * (1 - shelterRatio * 0.7)),
  );

  e.responseScore = Math.round(
    evacRatio * 40 + shelterRatio * 30 + donations * 20 + (area.containment / 100) * 10,
  );

  // Outcome bucket.
  if (e.responseScore >= 70 && e.victims === 0) e.outcome = "handled";
  else if (e.victims >= 5 || e.responseScore < 35) e.outcome = "tragedy";
  else e.outcome = "mismanaged";

  const areaPt = t("pt", e.areaNameKey, e.areaNameKey);
  const areaEn = t("en", e.areaNameKey, e.areaNameKey);

  // Fiscal / political consequences.
  if (e.outcome === "handled") {
    out.approvalDelta  += 3;
    out.happinessDelta += 1;
    out.news.push({
      kind: "success",
      titleKey: `Prefeitura evita mortes em ${areaPt}||City hall prevents deaths in ${areaEn}`,
    });
  } else if (e.outcome === "mismanaged") {
    out.approvalDelta  -= 6;
    out.happinessDelta -= 3;
    d.legalRisk = Math.min(100, d.legalRisk + 10);
    d.federalPenaltyMonths = Math.max(d.federalPenaltyMonths, 3);
    out.news.push({
      kind: "warning",
      titleKey: `Resposta lenta em ${areaPt} gera cobrança da imprensa||Slow response in ${areaEn} draws media backlash`,
    });
  } else {
    // Tragedy: national uproar.
    out.approvalDelta  -= 14;
    out.happinessDelta -= 8;
    d.legalRisk = Math.min(100, d.legalRisk + 25);
    d.federalPenaltyMonths = Math.max(d.federalPenaltyMonths, 8);
    d.legalCostMonths      = Math.max(d.legalCostMonths, 6);
    out.news.push({
      kind: "danger",
      titleKey: `Tragédia em ${areaPt}: ${e.victims} mortos, comoção nacional||Tragedy in ${areaEn}: ${e.victims} dead, national outcry`,
    });
  }

  // Displaced families need emergency housing (subtract from area).
  area.households = Math.max(0, area.households - e.victims - Math.round(e.displaced * 0.4));

  // Damage the treasury proportionally.
  const damage = 200_000 + e.severity * 15_000 + e.victims * 120_000;
  s.treasury -= damage;
  out.treasuryDelta -= damage;

  e.active = false;
  d.history = [e, ...d.history].slice(0, 12);
  d.rainAccumMm = Math.round(d.rainAccumMm * 0.25); // river/mud subsides
}
