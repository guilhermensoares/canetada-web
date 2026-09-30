/**
 * Climate & Infrastructure module — drainage/flooding, sanitation (Marco do
 * Saneamento) and solid waste management.
 *
 * Runs once per monthly tick and produces:
 *   - flood damage during the rainy season (Dec–Mar) if drainage capacity
 *     is overwhelmed by impermeabilization
 *   - sanitation tariff revenue and operating cost split by governance model
 *     (state, concession, PPP)
 *   - disease-outbreak risk (dengue / leptospirose) when sewage coverage is
 *     low and rains are heavy — surges health expenses and drags happiness
 *   - waste-management cost + pollution delta by regime (dump, landfill,
 *     cooperativa de reciclagem)
 */
import type { GameState } from "./types";

/* ---------- Types ---------- */

export type SanitationModel = "state" | "concession" | "ppp";
export type WasteMode = "dump" | "landfill" | "recycling";

export interface DrainageState {
  /** Storm-drain segments built (micro-drainage). Each = +8 capacity. */
  drainagePipes: number;
  /** Piscinões (macro-drainage reservoirs). Each = +18 capacity. */
  piscinoes: number;
  /** Rolling 0..100 flood risk index (last tick). */
  lastFloodRisk: number;
  /** Damage dealt by the last flood event, R$. 0 if no flood. */
  lastFloodDamage: number;
  /** Whether last tick actually produced a flood event. */
  lastFlooded: boolean;
}

export interface SanitationState {
  model: SanitationModel;
  /** 0..100 — households with treated water access. */
  waterCoverage: number;
  /** 0..100 — households connected to sewage treatment. */
  sewageCoverage: number;
  /** Player-set monthly capex, R$ (drives coverage growth). */
  monthlyInvestment: number;
  /** Tariff charged per household, R$/month. */
  tariff: number;
  /** SNIS — km de rede de água instalada. Cresce com investimento. */
  pipeNetworkKm: number;
  /** SNIS — perda de água na distribuição, %. Média BR ≈ 35%. */
  waterLossPct: number;
  /** Investimento mensal em Troca de Tubulação & Automação (R$). */
  pipeReplacementInvestment: number;
  /** Telemetria — SNIS. */
  lastWaterLostM3: number;
  lastHealthMultiplier: number;
  /** Acumulado desde o início do mandato (para o gráfico SNIS). */
  cumulativeInvestment: number;
  cumulativeIcuSavings: number;
  /** Telemetry — last tick. */
  lastTariffRevenue: number;
  lastOperatingCost: number;
  /** Outbreak flag (dengue/lepto) triggered last tick. */
  lastOutbreak: null | { disease: "dengue" | "leptospirose"; severity: number };
}


export interface WasteState {
  mode: WasteMode;
  /** 0..100 — reach of the collection network. */
  collectionCoverage: number;
  /** Recycling cooperatives supported (only meaningful in `recycling`). */
  cooperatives: number;
  /** Telemetry — last tick. */
  lastCost: number;
  lastPollutionDelta: number;
}

export interface ClimateState {
  drainage: DrainageState;
  sanitation: SanitationState;
  waste: WasteState;
}

/* ---------- Costs (exported for UI + tests) ---------- */

export const DRAINAGE_PIPE_COST = 180_000;
export const PISCINAO_COST = 450_000;
export const SANITATION_MODEL_SWITCH_COST = 220_000;
export const WASTE_MODE_SWITCH_COST = 160_000;
export const COOPERATIVE_COST = 90_000;

/* ---------- Defaults / migration ---------- */

export function defaultClimate(): ClimateState {
  return {
    drainage: {
      drainagePipes: 2,
      piscinoes: 0,
      lastFloodRisk: 0,
      lastFloodDamage: 0,
      lastFlooded: false,
    },
    sanitation: {
      model: "state",
      waterCoverage: 78,
      sewageCoverage: 52,
      monthlyInvestment: 40_000,
      tariff: 45,
      pipeNetworkKm: 320,
      waterLossPct: 35,
      pipeReplacementInvestment: 0,
      lastWaterLostM3: 0,
      lastHealthMultiplier: 1,
      cumulativeInvestment: 0,
      cumulativeIcuSavings: 0,
      lastTariffRevenue: 0,
      lastOperatingCost: 0,
      lastOutbreak: null,
    },

    waste: {
      mode: "landfill",
      collectionCoverage: 82,
      cooperatives: 0,
      lastCost: 0,
      lastPollutionDelta: 0,
    },
  };
}

export function ensureClimate(s: GameState): void {
  const holder = s as unknown as { climate?: ClimateState };
  if (!holder.climate || !holder.climate.drainage || !holder.climate.sanitation || !holder.climate.waste) {
    holder.climate = defaultClimate();
    return;
  }
  // Backfill SNIS fields on legacy saves.
  const san = holder.climate.sanitation as SanitationState;
  if (san.pipeNetworkKm == null)             san.pipeNetworkKm = 320;
  if (san.waterLossPct == null)              san.waterLossPct = 35;
  if (san.pipeReplacementInvestment == null) san.pipeReplacementInvestment = 0;
  if (san.lastWaterLostM3 == null)           san.lastWaterLostM3 = 0;
  if (san.lastHealthMultiplier == null)      san.lastHealthMultiplier = 1;
  if (san.cumulativeInvestment == null)      san.cumulativeInvestment = 0;
  if (san.cumulativeIcuSavings == null)      san.cumulativeIcuSavings = 0;
}

export function setPipeReplacementInvestment(s: GameState, value: number): void {
  ensureClimate(s);
  s.climate.sanitation.pipeReplacementInvestment = Math.max(0, Math.min(200_000, Math.round(value)));
}


/* ---------- Player actions ---------- */

export function buildDrainagePipe(s: GameState): boolean {
  ensureClimate(s);
  if (s.treasury < DRAINAGE_PIPE_COST) return false;
  s.treasury -= DRAINAGE_PIPE_COST;
  s.climate.drainage.drainagePipes += 1;
  return true;
}

export function buildPiscinao(s: GameState): boolean {
  ensureClimate(s);
  if (s.treasury < PISCINAO_COST) return false;
  s.treasury -= PISCINAO_COST;
  s.climate.drainage.piscinoes += 1;
  return true;
}

export function setSanitationModel(s: GameState, model: SanitationModel): boolean {
  ensureClimate(s);
  if (s.climate.sanitation.model === model) return false;
  if (s.treasury < SANITATION_MODEL_SWITCH_COST) return false;
  s.treasury -= SANITATION_MODEL_SWITCH_COST;
  s.climate.sanitation.model = model;
  return true;
}

export function setSanitationInvestment(s: GameState, value: number): void {
  ensureClimate(s);
  s.climate.sanitation.monthlyInvestment = Math.max(0, Math.min(400_000, Math.round(value)));
}

export function setSanitationTariff(s: GameState, value: number): void {
  ensureClimate(s);
  s.climate.sanitation.tariff = Math.max(0, Math.min(200, Math.round(value)));
}

export function setWasteMode(s: GameState, mode: WasteMode): boolean {
  ensureClimate(s);
  if (s.climate.waste.mode === mode) return false;
  if (s.treasury < WASTE_MODE_SWITCH_COST) return false;
  s.treasury -= WASTE_MODE_SWITCH_COST;
  s.climate.waste.mode = mode;
  return true;
}

export function fundCooperative(s: GameState): boolean {
  ensureClimate(s);
  if (s.treasury < COOPERATIVE_COST) return false;
  s.treasury -= COOPERATIVE_COST;
  s.climate.waste.cooperatives += 1;
  // Funding a coop while dumping doesn't do much — but doesn't fail.
  return true;
}

/* ---------- Monthly tick ---------- */

export interface ClimateTickOutput {
  /** Sanitation tariff revenue collected this tick. */
  tariffRevenue: number;
  /** Sum of sanitation + waste operating cost this tick. */
  operatingCost: number;
  /** Direct damage to the treasury from flooding (already applied). */
  floodDamage: number;
  /** Pollution delta from waste regime + flood aftermath. */
  pollutionDelta: number;
  /** Happiness delta produced by this module. */
  happinessDelta: number;
  /** Extra emergency health spending triggered by disease outbreaks. */
  healthEmergency: number;
}

/** True when the calendar month is in the Brazilian rainy season (Dec–Mar). */
function isRainySeason(month: number): boolean {
  return month === 12 || month <= 3;
}

/** 0..1 rain intensity, peaks in January/February. */
function rainIntensity(month: number, rng: () => number): number {
  if (!isRainySeason(month)) return 0.15 + rng() * 0.1; // occasional drizzle
  const peak = month === 1 || month === 2 ? 1.0 : 0.7;
  return Math.max(0, Math.min(1, peak * (0.65 + rng() * 0.45)));
}

/** Fraction of zoneable tiles that host buildings — proxy for impermeabilization. */
function impermeabilityRatio(s: GameState): number {
  let built = 0;
  let total = 0;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const z = s.zones[i];
    if (z && z !== "none") {
      total++;
      if (s.builtBuildings[i]) built++;
    }
  }
  if (total === 0) return 0;
  return built / total;
}

export function tickClimate(s: GameState, rng: () => number): ClimateTickOutput {
  ensureClimate(s);
  const C = s.climate;

  /* ------------- Drainage ------------- */
  const imperm = impermeabilityRatio(s); // 0..1
  const rain = rainIntensity(s.month, rng); // 0..1
  // Stormwater "load" — high impermeability + heavy rain overwhelms drainage.
  const load = (30 + imperm * 70) * rain; // 0..~100
  const capacity = 25 + C.drainage.drainagePipes * 8 + C.drainage.piscinoes * 18;
  const floodRisk = Math.max(0, Math.min(100, (load - capacity) + rain * 15));
  C.drainage.lastFloodRisk = Math.round(floodRisk);

  let floodDamage = 0;
  let floodHappiness = 0;
  let floodPollution = 0;
  const floodTriggered = floodRisk > 25 && rng() < Math.min(0.85, floodRisk / 100);
  C.drainage.lastFlooded = floodTriggered;
  if (floodTriggered) {
    // Damage scales with risk and population — bigger cities lose more.
    floodDamage = Math.round(s.population * (2 + floodRisk * 0.08));
    s.treasury -= floodDamage;
    // Businesses paralysed (a few close for the month).
    s.businesses = Math.max(20, s.businesses - Math.round(floodRisk / 15));
    floodHappiness = -(3 + floodRisk * 0.05);
    floodPollution = 1.2 + floodRisk * 0.03; // debris + sewage overflow
  }
  C.drainage.lastFloodDamage = floodDamage;

  /* ------------- Sanitation (SNIS) ------------- */
  const san = C.sanitation;
  // Coverage growth: driven by investment × model efficiency.
  const modelEff =
    san.model === "state" ? 0.7 :
    san.model === "concession" ? 1.15 :
    1.0; // ppp
  const investmentUnits = san.monthlyInvestment / 25_000; // R$25k = 1 growth unit
  const growth = investmentUnits * modelEff * 0.35;
  san.waterCoverage = Math.max(0, Math.min(100, san.waterCoverage + growth * 1.1));
  san.sewageCoverage = Math.max(0, Math.min(100, san.sewageCoverage + growth * 0.85));

  // SNIS — rede de água (km): cresce ~1 km a cada R$40k investidos, teto por população.
  const kmCap = 200 + s.population * 0.04;
  san.pipeNetworkKm = Math.min(kmCap, san.pipeNetworkKm + san.monthlyInvestment / 40_000);

  // SNIS — Troca de Tubulação & Automação: reduz perda de 35% até ~15%.
  // 100km de rede exige ~R$60k/mês para se manter; excesso reduz perda.
  const maintNeed = (san.pipeNetworkKm / 100) * 60_000;
  const replacementNet = san.pipeReplacementInvestment - maintNeed;
  const lossDrift = replacementNet > 0
    ? -Math.min(1.2, replacementNet / 80_000)      // reduz até 1.2 p.p./mês
    :  Math.min(0.6, -replacementNet / 120_000);   // degrada se sub-investir
  san.waterLossPct = Math.max(15, Math.min(55, san.waterLossPct + lossDrift));
  s.treasury -= Math.round(san.pipeReplacementInvestment);

  // Tariff revenue: households × coverage × tariff × retention × (1 - perda).
  const households = s.population / 3.2;
  const producedM3 = households * (san.waterCoverage / 100) * 12; // ~12 m³/mês por domicílio
  const lostM3 = producedM3 * (san.waterLossPct / 100);
  san.lastWaterLostM3 = Math.round(lostM3);
  const billableFactor = 1 - san.waterLossPct / 100;
  const grossTariff = households * (san.waterCoverage / 100) * san.tariff * 0.6 * billableFactor;
  const cityRetention =
    san.model === "state" ? 1.0 :
    san.model === "concession" ? 0.55 :
    0.75; // ppp
  const tariffRevenue = Math.round(grossTariff * cityRetention);
  san.lastTariffRevenue = tariffRevenue;

  // Operating cost: capex + operating overhead scaled por rede e cobertura.
  const opBase =
    san.model === "state" ? households * 2.4 :
    san.model === "concession" ? households * 1.2 :
    households * 1.7; // ppp
  const operatingSanitation = Math.round(san.monthlyInvestment + opBase);
  san.lastOperatingCost = operatingSanitation;
  s.treasury -= operatingSanitation;
  s.treasury += tariffRevenue;

  // SNIS — Cobertura de esgoto <60% → multiplicador de risco de epidemias
  // e sobrecarga do SUS Municipal (até +40%).
  const sewGap60 = Math.max(0, 60 - san.sewageCoverage); // 0..60
  const healthMult = 1 + Math.min(0.4, (sewGap60 / 60) * 0.4);
  san.lastHealthMultiplier = Number(healthMult.toFixed(2));

  // Disease outbreak: low sewage + rain season → dengue/leptospirose.
  san.lastOutbreak = null;
  let outbreakHappiness = 0;
  let healthEmergency = 0;
  const sanGap = Math.max(0, 75 - san.sewageCoverage); // starts biting under 75%
  const outbreakProb = sanGap * 0.004 * (1 + rain * 1.8) * healthMult;
  if (rng() < outbreakProb) {
    const rainy = isRainySeason(s.month);
    const disease: "dengue" | "leptospirose" = rainy && rng() < 0.55 ? "leptospirose" : "dengue";
    const severity = Math.round(sanGap * (0.6 + rng() * 0.9));
    san.lastOutbreak = { disease, severity };
    healthEmergency = Math.round(s.population * (0.6 + severity * 0.04) * healthMult);
    s.treasury -= healthEmergency;
    outbreakHappiness = -(2 + severity * 0.08);
    // Approval takes a direct hit too — visible SUS crisis.
    s.approval = Math.max(0, Math.min(100, s.approval - severity * 0.12));
  }

  // SNIS — telemetria acumulada (investimento total x economia de leitos de UTI).
  const totalSanCapex = san.monthlyInvestment + san.pipeReplacementInvestment;
  san.cumulativeInvestment += totalSanCapex;
  // Baseline hipotético: cidade com 35% perdas e 40% cobertura de esgoto (healthMult 1.4)
  // custaria ~ pop * 0.9 * 1.4 em atenção hospitalar recorrente. Economia = baseline - atual.
  const baselineIcu = s.population * 0.9 * 1.4;
  const currentIcu  = s.population * 0.9 * healthMult;
  const icuSaved = Math.max(0, Math.round(baselineIcu - currentIcu));
  san.cumulativeIcuSavings += icuSaved;



  /* ------------- Waste ------------- */
  const waste = C.waste;
  let wasteCost = 0;
  let wastePollution = 0;
  let wasteHappiness = 0;
  switch (waste.mode) {
    case "dump":
      wasteCost = Math.round(s.population * 0.6);
      wastePollution = 2.8;
      wasteHappiness = -1.4;
      break;
    case "landfill":
      wasteCost = Math.round(s.population * 1.4);
      wastePollution = 0.6;
      wasteHappiness = -0.2;
      break;
    case "recycling":
      wasteCost = Math.round(s.population * 2.2 + waste.cooperatives * 8_000);
      wastePollution = -0.5 - Math.min(1.2, waste.cooperatives * 0.12);
      wasteHappiness = 0.5 + Math.min(1.5, waste.cooperatives * 0.08);
      break;
  }
  // Collection coverage drifts toward a mode-dependent equilibrium.
  const covTarget = waste.mode === "recycling" ? 96 : waste.mode === "landfill" ? 88 : 65;
  waste.collectionCoverage = Math.max(0, Math.min(100, waste.collectionCoverage + (covTarget - waste.collectionCoverage) * 0.08));
  waste.lastCost = wasteCost;
  waste.lastPollutionDelta = Number(wastePollution.toFixed(2));
  s.treasury -= wasteCost;

  // Aggregate happiness contribution from this module.
  // Rewards for high sanitation coverage — visible quality of life.
  const sanitationBonus = ((san.waterCoverage + san.sewageCoverage) / 2 - 60) * 0.02;
  const happinessDelta = floodHappiness + outbreakHappiness + wasteHappiness + sanitationBonus;

  return {
    tariffRevenue,
    operatingCost: operatingSanitation + wasteCost,
    floodDamage,
    pollutionDelta: floodPollution + wastePollution,
    happinessDelta,
    healthEmergency,
  };
}
