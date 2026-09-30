import type { GameState, PolicyKey, SustainabilityKey, TaxKey, NewsItem, ActiveEvent, GameEventChoice, ZoneKind, ZoneTool, BuildingKind, BuildingOwner, StateBuildKind, RevenueBreakdown, ExpenseBreakdown } from "./types";
import { mark as __perfMark } from "./perf";
import { defaultJourney as __defaultJourney, updateCoherence as __updateCoherence } from "./journey";
import { pickEvent } from "./events";
import { getDifficultyProfile } from "./difficulty";

/** Grace window (in-game months) after the tour ends where random events are
 *  ramped in and media pile-ons are suppressed, so new players aren't
 *  bombarded before they've had time to open panels. */
export const POST_TOUR_GRACE_MONTHS = 6;

/** Full months elapsed since the tour finished, or null if legacy save / tour
 *  never happened. Cheap arithmetic, safe to call every tick. */
export function monthsSincePostTour(s: GameState): number | null {
  if (!s.tourEndedAt) return null;
  return (s.year - s.tourEndedAt.year) * 12 + (s.month - s.tourEndedAt.month);
}

/** True during the ramp-up window right after the tour ends. */
export function inPostTourGrace(s: GameState): boolean {
  const m = monthsSincePostTour(s);
  return m !== null && m < POST_TOUR_GRACE_MONTHS;
}
import { generateEvent } from "./proceduralEvents";
import { randomSeed, seededRng } from "./rng";
import { findPreset } from "./presets";
import { DEFAULT_MAYOR, type Mayor } from "./mayor";
import { applyPoliticianPerks } from "./politicianPresets";
import {
  MAP_SIZE,
  computeAttractiveness,
  growCity,
  growFavelas,
  countFavelas,
  isZoneableTileKind,
  snapshotZoningFromSeed,
  computeHazardMask,
  tickLandUse,
  regularizeFavelaStep,
} from "./zoning";
import { generateBaseMap } from "./mapGen";
import { ensureRoads, roadUpkeep } from "./roads";
import {
  defaultPolitics,
  ensurePolitics,
  tickPolitics,
  policyEffectiveness,
  canIssueDebt,
} from "./politics";
import { ensureLegislature, tickLegislature, legislativeScore } from "./legislature";
import { ensureNegotiation, tickNegotiation } from "./negotiation";
import { ensureCampaign, tickCampaign } from "./campaign";
import {
  findScale,
  findScenario,
  MAX_PLAYABLE_MAP_SIZE,
  scaleBaseState,
  applySandbox,
  type SandboxOverrides,
} from "./scenarios";


import { defaultTransport, ensureTransport, tickTransport } from "./transport";
import { defaultClimate, ensureClimate, tickClimate } from "./climate";
import { initialInformality, ensureInformality, tickInformality } from "./informality";
import { initialSpatialJustice, ensureSpatialJustice, tickSpatialJustice } from "./spatialJustice";
import { initialEducation, ensureEducation, tickEducation } from "./intergenerational";
import { initialHousing, ensureHousing, tickHousing } from "./housing";
import { initialDemography, ensureDemography, tickDemography } from "./demography";
import { ensureWellbeing, tickWellbeing } from "./wellbeing";
import { ensureParallelPower, tickParallelPower, parallelElectionPenalty } from "./parallelPower";
import { tickDisasters, ensureDisasters } from "./disasters";
import { tickMassEvents, ensureMassEvents } from "./massEvents";
import { ensureOversight, tickOversight, defaultOversight } from "./oversight";
import { ensureLandConflict, tickLandConflict } from "./landConflict";
import { ensureMedia, tickMedia } from "./media";
import { ensureVideosphere, tickVideosphereMonth } from "./videosphere";
import { ensurePoliceShow, tickPoliceShowMonthly, tickPoliceShowDaily } from "./policeShow";
import { ensureZapZap, tickZapZapDaily, tickZapZapMonthly } from "./zapzap";
import { ensurePiuPiu, tickPiuPiuHour, tickPiuPiuMonth } from "./piupiu";
import { tickCovertOpsMonth } from "./covertOps";
import { ensureCascade, maybeSpawnBusCascade } from "./cascade";
import { ensureAdvisors, tickAdvisorsMonthly } from "./advisors";
import { ensureInbox, tickInboxMonthly } from "./inbox";
import { ensureCorruption, tickCorruptionMonthly } from "./corruption";
import { evaluateLRF, computeCoreBudget } from "./economicEngine";
import type { CoreBudget } from "./economicEngine";
import { defaultBidding, ensureBidding, tickBiddingMonth } from "./bidding";
import { autoZonePass, placeAwardedWork } from "./autoGrowth";

const EMPTY_REV: RevenueBreakdown = { incomeTax: 0, propertyTax: 0, businessTax: 0, outorga: 0, iptuProgressive: 0, transfers: 0, farebox: 0, sanitationTariff: 0 };
const EMPTY_EXP: ExpenseBreakdown = { education: 0, health: 0, security: 0, transport: 0, sustainability: 0, infra: 0, debtInterest: 0, transitSubsidy: 0, sanitation: 0, waste: 0, climateDamage: 0, housing: 0 };


export const STORAGE_KEY = "mayor2026_save_v1";

export interface InitOptions {
  seed?: string;
  presetId?: string;
  mayor?: Mayor;
  scaleId?: string;
  scenarioId?: string;
  sandbox?: SandboxOverrides;
  /** Start in SimCity-2000-style progressive-unlock mode. */
  growthMode?: boolean;
  /** "sandbox" (default) or "mayor" — autonomous growth + biddings. */
  mode?: "sandbox" | "mayor";
  /** Difficulty selected in the Modo Gerador picker. Defaults to "normal". */
  difficulty?: import("./difficulty").DifficultyLevel;
}

/** Village-scale starter numbers used when growthMode is enabled. Applied
 *  BEFORE sandbox overrides so the player can still tweak them explicitly. */
const GROWTH_MODE_START = {
  population: 2_500,
  businesses: 25,
  treasury: 250_000,
  debt: 0,
  unemployment: 8,
  happiness: 55,
  approval: 50,
  waterCapacity: 40,
  energyCapacity: 60,
  waterDemand: 20,
  energyDemand: 30,
} as const;

export function initialState(
  cityName = "Nova Aurora",
  optsOrSeed?: string | InitOptions,
  presetIdArg?: string,
  mayorArg?: Mayor,
): GameState {
  // Backwards-compatible signature: (cityName, seed, presetId, mayor).
  const opts: InitOptions =
    typeof optsOrSeed === "string" || typeof optsOrSeed === "undefined"
      ? { seed: optsOrSeed, presetId: presetIdArg, mayor: mayorArg }
      : optsOrSeed;

  const scale = findScale(opts.scaleId);
  const scenario = findScenario(opts.scenarioId);
  const mapSize = scale.mapSize;

  const base: GameState = {
    cityName,
    lang: "pt",
    mayor: opts.mayor ?? DEFAULT_MAYOR,
    seed: opts.seed && opts.seed.trim() ? opts.seed.trim() : randomSeed(),

    rngCursor: 0,
    day: 1,
    month: 1,
    year: 2026,
    speed: 1,
    population: 42_000,
    happiness: 62,
    approval: 55,
    unemployment: 7.4,
    businesses: 320,
    inflation: 3.2,
    treasury: 850_000,
    debt: 0,
    lastRevenue: 0,
    lastExpenses: 0,
    lastRevenueBreakdown: { ...EMPTY_REV },
    lastExpensesBreakdown: { ...EMPTY_EXP },
    scenarioId: scenario.id,
    scaleId: scale.id,
    policies: { education: 50, health: 50, security: 50, transport: 40 },
    sustainability: { renewables: 15, emissions: 10, greenTransit: 15 },
    environment: { pollution: 28, airQuality: 72 },
    taxes: { income: 12, property: 6, business: 10 },
    infra: { waterCapacity: 200, energyCapacity: 300 },
    waterDemand: 160,
    energyDemand: 240,
    news: [],
    activeEvent: null,
    mapSize,
    zones: new Array(mapSize * mapSize).fill("none" as ZoneKind),
    builtBuildings: new Array(mapSize * mapSize).fill(null),
    buildingOwners: new Array(mapSize * mapSize).fill(null),
    attractiveness: 50,
    favelaUrbanized: 0,
    politics: defaultPolitics(2026),
    landUse: {
      hazardMask: [],
      speculationAge: new Array(mapSize * mapSize).fill(0),
      formalized: new Array(mapSize * mapSize).fill(false),
      outorgaSold: 0, outorgaRevenue: 0,
      vazioTiles: 0, vazioRevenue: 0,
      regularized: 0, hazardFavelas: 0,
    },
    landPolicy: { outorgaPrice: 80_000, progressiveIptu: false, regularizationRate: 0 },
    transport: defaultTransport(),
    climate: defaultClimate(),
    informal: initialInformality(),
    mobility: initialSpatialJustice(),
    education: initialEducation(),
    housing: initialHousing(),
    demography: initialDemography(),
    parallelPower: undefined,
    disasters: undefined,
    massEvents: undefined,
    oversight: defaultOversight(),
    journey: __defaultJourney(),
  };
  const preset = opts.presetId ? findPreset(opts.presetId) : undefined;
  if (preset) {
    Object.assign(base, preset.overrides);
    if (cityName && cityName !== "Nova Aurora") base.cityName = cityName;
  } else if (cityName) {
    base.cityName = cityName;
  }
  // Apply city-scale multiplier to numeric baselines (pop, biz, treasury, infra).
  scaleBaseState(base, scale.scale);
  // Apply economic scenario overrides to happiness/inflation/unemployment.
  if (scenario.startOverrides) Object.assign(base, scenario.startOverrides);
  // Persona perks apply after city preset so the caricature's fingerprint
  // always shows through (e.g. Marina's sustainability, Zuza's welfare tilt).
  if (opts.mayor?.personaId) {
    applyPoliticianPerks(base, opts.mayor.personaId);
  }
  // Growth-mode reset: shrink the seeded city down to a village so the player
  // starts (nearly) from scratch. Runs BEFORE sandbox so explicit sandbox
  // numbers still win.
  if (opts.growthMode) {
    base.growthMode = true;
    base.population = GROWTH_MODE_START.population;
    base.businesses = GROWTH_MODE_START.businesses;
    base.treasury = GROWTH_MODE_START.treasury;
    base.debt = GROWTH_MODE_START.debt;
    base.unemployment = GROWTH_MODE_START.unemployment;
    base.happiness = GROWTH_MODE_START.happiness;
    base.approval = GROWTH_MODE_START.approval;
    base.infra.waterCapacity = GROWTH_MODE_START.waterCapacity;
    base.infra.energyCapacity = GROWTH_MODE_START.energyCapacity;
    base.waterDemand = GROWTH_MODE_START.waterDemand;
    base.energyDemand = GROWTH_MODE_START.energyDemand;
  }
  // Sandbox overrides win over everything else — the player is explicit.
  applySandbox(base, opts.sandbox);
  // Snapshot the seed-generated starter city into the zoning arrays.
  const snap = snapshotZoningFromSeed(base);
  base.zones = snap.zones;
  base.builtBuildings = snap.builtBuildings;
  base.buildingOwners = snap.builtBuildings.map(inferOwner);
  base.landUse.hazardMask = computeHazardMask(base);
  base.landUse.speculationAge = new Array(base.mapSize * base.mapSize).fill(0);
  base.landUse.formalized = new Array(base.mapSize * base.mapSize).fill(false);
  base.attractiveness = computeAttractiveness(base);
  ensureLegislature(base);
  // Modo de jogo: sandbox padrão, mayor com licitações + crescimento autônomo.
  base.mode = opts.mode ?? "sandbox";
  base.difficulty = opts.difficulty ?? "normal";
  base.bidding = defaultBidding();
  base.bidPoolBias = { corruptionMean: 0.35, delayMean: 0.35, priceMult: 1, qualityBias: 0 };
  return base;
}

/**
 * Ensure any legacy save is upgraded with zoning fields before use.
 */
export function ensureZoning(s: GameState): GameState {
  if (!s.mapSize) s.mapSize = MAP_SIZE;
  // Migração de saves antigos: algumas versões criavam mapas 600–1800 por
  // lado, gerando milhões de células e travando o navegador já na abertura.
  // Para recuperar esses saves, mantemos os dados da cidade e regeneramos
  // apenas a malha visual em um tamanho jogável.
  if (s.mapSize > MAX_PLAYABLE_MAP_SIZE) {
    const nextSize = Math.min(findScale(s.scaleId).mapSize, MAX_PLAYABLE_MAP_SIZE);
    s.mapSize = nextSize;
    const snap = snapshotZoningFromSeed(s);
    s.zones = snap.zones;
    s.builtBuildings = snap.builtBuildings;
    s.buildingOwners = snap.builtBuildings.map(inferOwner);
    s.landUse = {
      ...(s.landUse ?? {}),
      hazardMask: computeHazardMask(s),
      speculationAge: new Array(nextSize * nextSize).fill(0),
      formalized: new Array(nextSize * nextSize).fill(false),
      outorgaSold: s.landUse?.outorgaSold ?? 0,
      outorgaRevenue: s.landUse?.outorgaRevenue ?? 0,
      vazioTiles: s.landUse?.vazioTiles ?? 0,
      vazioRevenue: s.landUse?.vazioRevenue ?? 0,
      regularized: s.landUse?.regularized ?? 0,
      hazardFavelas: s.landUse?.hazardFavelas ?? 0,
    };
  }
  if (!Array.isArray(s.zones) || s.zones.length !== s.mapSize * s.mapSize) {
    const snap = snapshotZoningFromSeed(s);
    s.zones = snap.zones;
    s.builtBuildings = snap.builtBuildings;
  }
  if (!Array.isArray(s.buildingOwners) || s.buildingOwners.length !== s.builtBuildings.length) {
    s.buildingOwners = s.builtBuildings.map(inferOwner);
  }
  if (typeof s.attractiveness !== "number") s.attractiveness = computeAttractiveness(s);
  if (typeof s.favelaUrbanized !== "number") s.favelaUrbanized = 0;
  ensureRoads(s);
  if (!s.sustainability) s.sustainability = { renewables: 0, emissions: 0, greenTransit: 0 };
  if (!s.environment) s.environment = { pollution: 30, airQuality: 70 };
  ensurePolitics(s);
  ensureLegislature(s);
  ensureNegotiation(s);
  Object.assign(s, ensureCampaign(s));
  ensureBidding(s);
  if (!s.mode) s.mode = "sandbox";
  if (!s.landPolicy) s.landPolicy = { outorgaPrice: 80_000, progressiveIptu: false, regularizationRate: 0 };
  if (!s.landUse || !Array.isArray(s.landUse.hazardMask) || s.landUse.hazardMask.length !== s.mapSize * s.mapSize) {
    s.landUse = {
      hazardMask: computeHazardMask(s),
      speculationAge: new Array(s.mapSize * s.mapSize).fill(0),
      formalized: new Array(s.mapSize * s.mapSize).fill(false),
      outorgaSold: 0, outorgaRevenue: 0,
      vazioTiles: 0, vazioRevenue: 0,
      regularized: 0, hazardFavelas: 0,
    };
  }
  if (!s.lastRevenueBreakdown) s.lastRevenueBreakdown = { ...EMPTY_REV };
  if (!s.lastExpensesBreakdown) s.lastExpensesBreakdown = { ...EMPTY_EXP };
  if (!s.scenarioId) s.scenarioId = "stability";
  if (!s.scaleId) s.scaleId = "medium";
  ensureTransport(s);
  ensureClimate(s);
  ensureInformality(s);
  ensureSpatialJustice(s);
  ensureEducation(s);
  ensureHousing(s);
  ensureWellbeing(s);
  ensureOversight(s);
  ensureZapZap(s);
  return s;
}

/** Infer legacy building ownership: civic/utility = state, everything else = private. */
export function inferOwner(b: BuildingKind | null): BuildingOwner | null {
  if (!b) return null;
  switch (b) {
    case "school":
    case "hospital":
    case "water_plant":
    case "power_plant":
    case "fire_station":
    case "university":
      return "state";
    case "favela_s":
    case "favela_m":
    case "favela_l":
      return "private";
    default:
      return "private";
  }
}

/* ---------------- Player construction ---------------- */

export interface BuildDef {
  cost: number;
  /** Instant on-place effects applied to state (bounded by clamps). */
  apply: (s: GameState) => void;
  labelKey: string;
}

export const BUILD_DEFS: Record<StateBuildKind, BuildDef> = {
  fire_station: {
    cost: 200_000,
    labelKey: "build_fire_station",
    apply: (s) => {
      s.policies.security = clamp(s.policies.security + 6, 0, 100);
      s.happiness = clamp(s.happiness + 1.5, 0, 100);
    },
  },
  hospital: {
    cost: 350_000,
    labelKey: "build_hospital",
    apply: (s) => {
      s.policies.health = clamp(s.policies.health + 7, 0, 100);
      s.happiness = clamp(s.happiness + 2, 0, 100);
    },
  },
  school: {
    cost: 180_000,
    labelKey: "build_school",
    apply: (s) => {
      s.policies.education = clamp(s.policies.education + 5, 0, 100);
    },
  },
  university: {
    cost: 500_000,
    labelKey: "build_university",
    apply: (s) => {
      s.policies.education = clamp(s.policies.education + 10, 0, 100);
      s.businesses += 8;
      s.approval = clamp(s.approval + 2, 0, 100);
    },
  },
  water_plant: {
    cost: 300_000,
    labelKey: "build_water_plant",
    apply: (s) => {
      s.infra.waterCapacity += 50;
    },
  },
  power_plant: {
    cost: 400_000,
    labelKey: "build_power_plant",
    apply: (s) => {
      s.infra.energyCapacity += 80;
    },
  },
};

export function canBuild(state: GameState, kind: StateBuildKind, x: number, y: number): boolean {
  const size = state.mapSize;
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  const i = y * size + x;
  if (state.builtBuildings[i]) return false;
  const base = generateBaseMap(state, size).tiles[i];
  if (!isZoneableTileKind(base.kind)) return false;
  return state.treasury >= BUILD_DEFS[kind].cost;
}

export function buildStructure(
  state: GameState,
  kind: StateBuildKind,
  x: number,
  y: number,
): GameState {
  if (!canBuild(state, kind, x, y)) return state;
  const s = structuredClone(state);
  const i = y * s.mapSize + x;
  const def = BUILD_DEFS[kind];
  s.treasury -= def.cost;
  s.builtBuildings[i] = kind;
  s.buildingOwners[i] = "state";
  // Clear any zone under a civic building — it becomes state land.
  s.zones[i] = "none";
  def.apply(s);
  pushNews(s, {
    kind: "success",
    titleKey: `Construção estatal: ${kind}||State build: ${kind}`,
    detail: `-${formatMoney(def.cost)}`,
  });
  s.attractiveness = computeAttractiveness(s);
  return s;
}

export const DAYS_PER_MONTH = 30;

/**
 * Advance one day. Every DAYS_PER_MONTH days, run the monthly simulation.
 */
export function dayTick(prev: GameState): GameState {
  const nextDay = prev.day + 1;
  if (nextDay > DAYS_PER_MONTH) {
    // Run full month simulation, which also rolls month/year forward.
    const s = tick(prev);
    s.day = 1;
    // Daily "Hora da Verdade" tick after monthly refresh too.
    applyPoliceShowDaily(s);
    return s;
  }
  const next = { ...prev, day: nextDay };
  applyPoliceShowDaily(next);
  return next;
}

function applyPoliceShowDaily(s: GameState): void {
  ensurePoliceShow(s);
  ensureZapZap(s);
  const rng = seededRng(s.seed || "seed", s);
  const r = tickPoliceShowDaily(s, { float: () => rng() });
  if (r.approvalDelta)  s.approval  = clamp(s.approval  + r.approvalDelta,  0, 100);
  if (r.happinessDelta) s.happiness = clamp(s.happiness + r.happinessDelta, 0, 100);
  if (r.mpRiskDelta && s.oversight) {
    s.oversight.mpRisk = clamp(s.oversight.mpRisk + r.mpRiskDelta, 0, 100);
  }
  if (r.treasuryDelta) s.treasury += r.treasuryDelta;
  for (const item of r.news) pushNews(s, item);
  // Daily ZapZap spawn — new chat message pops in at variable rate.
  tickZapZapDaily(s, { float: () => rng() });
  // PiuPiu: 4 "horas de jogo" por dia real de simulação.
  ensurePiuPiu(s);
  for (let i = 0; i < 4; i++) tickPiuPiuHour(s, rng);
  // Cascade: gatilho de "ônibus no viaduto" em dias de chuva forte (Dez–Mar).
  ensureCascade(s);
  const rainy = s.month === 12 || s.month <= 3;
  if (rainy && rng() < 0.012) {
    maybeSpawnBusCascade(s, rng);
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function pushNews(state: GameState, item: Omit<NewsItem, "id" | "month" | "year" | "day">) {
  const n: NewsItem = {
    id: `${state.year}-${state.month}-${state.day}-${Math.random().toString(36).slice(2, 7)}`,
    day: state.day,
    month: state.month,
    year: state.year,
    ...item,
  };
  state.news = [n, ...state.news].slice(0, 80);
}

/**
 * Advance the simulation one month.
 */
export function tick(prev: GameState): GameState {
  const s: GameState = structuredClone(prev);
  // Ensure legacy saves without seed metadata are upgraded in-place.
  if (!s.seed) s.seed = randomSeed();
  if (typeof s.rngCursor !== "number") s.rngCursor = 0;
  const rng = seededRng(s.seed, s);


  // 1) Demand scales with population + businesses
  s.waterDemand = Math.round(s.population * 0.004 + s.businesses * 0.15);
  s.energyDemand = Math.round(s.population * 0.005 + s.businesses * 0.35);

  // Active macro-economic scenario modifiers (revenue, interest, growth, etc.).
  const econ = findScenario(s.scenarioId).modifiers;

  // 2) Receita e despesa correntes — núcleo único compartilhado com o HUD
  //    (`computeCoreBudget`), incluindo os repasses constitucionais
  //    (FPM/ICMS/FUNDEB/SUS) que faltavam no caixa.
  const budget = computeCoreBudget(s, {
    revenueMult: econ.revenueMult,
    debtInterestRate: econ.debtInterestRate,
    roadUpkeep: roadUpkeep(s),
  });
  s.peripheryMiddleClass = budget.peripheryMiddleClass;
  s.humanCapitalIndex = budget.humanCapitalIndex;

  const sust = s.sustainability ?? { renewables: 0, emissions: 0, greenTransit: 0 };
  const revenue = budget.revenue;
  const expenses = budget.expenses;

  s.lastRevenue = revenue;
  s.lastExpenses = expenses;
  s.lastRevenueBreakdown = {
    incomeTax: budget.incomeTax,
    propertyTax: budget.propertyTax,
    businessTax: budget.businessTax,
    // outorga / iptu / farebox / sanitation folded in below.
    outorga: 0,
    iptuProgressive: 0,
    transfers: budget.transfers,
    farebox: 0,
    sanitationTariff: 0,
  };
  s.lastExpensesBreakdown = {
    education: budget.education,
    health: budget.health,
    security: budget.security,
    transport: budget.transport,
    sustainability: budget.sustainability,
    infra: budget.infra,
    debtInterest: budget.debtInterest,
    transitSubsidy: 0,
    sanitation: 0,
    waste: 0,
    climateDamage: 0,
    housing: 0,
  };
  s.treasury += revenue - expenses;


  // 4) Happiness dynamics
  const policyAvg =
    (s.policies.education + s.policies.health + s.policies.security + s.policies.transport) / 4;
  const taxBurden = s.taxes.income + s.taxes.property * 0.6 + s.taxes.business * 0.5;
  const waterGap = Math.max(0, s.waterDemand - s.infra.waterCapacity);
  const energyGap = Math.max(0, s.energyDemand - s.infra.energyCapacity);

  // Environment: recompute pollution from actual sources on the map, blend
  // toward equilibrium so changes feel gradual and legible.
  const envPrev = s.environment ?? { pollution: 30, airQuality: 70 };
  let factories = 0, powerPlants = 0, trees = 0, parksProxy = 0;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const b = s.builtBuildings[i];
    if (b === "factory") factories++;
    else if (b === "power_plant") powerPlants++;
    else if (b === "tree") trees++;
    else if (b === "farm" || b === "barn") parksProxy++;
  }
  // Base pollution generation (0..100 units before caps):
  //   industry: 2.4/unit, power plants: 3.0/unit, population traffic: pop/8k.
  const industrialPoll = factories * 2.4;
  const powerPoll = powerPlants * 3.0 * (1 - sust.renewables / 130);
  const trafficPoll = (s.population / 8000) * (1 - sust.greenTransit / 140);
  const emissionsMult = 1 - sust.emissions / 140;
  const generation = industrialPoll * emissionsMult + Math.max(0, powerPoll) + Math.max(0, trafficPoll);
  // Natural absorption: trees, farms, transport policy (fewer cars).
  const absorption = trees * 0.35 + parksProxy * 0.18 + s.policies.transport * 0.02 + 6;
  const targetPollution = clamp(30 + generation - absorption, 0, 100);
  const nextPollution = clamp(envPrev.pollution + (targetPollution - envPrev.pollution) * 0.25, 0, 100);
  const nextAir = clamp(100 - nextPollution, 0, 100);
  s.environment = { pollution: nextPollution, airQuality: nextAir };

  // Policy contribution to happiness is throttled by governability: with a
  // fragile coalition the mayor's spending doesn't translate into results.
  const govMult = policyEffectiveness(s);
  let happinessDelta = (policyAvg - 50) * 0.06 * govMult - (taxBurden - 20) * 0.12;
  happinessDelta -= (waterGap + energyGap) * 0.05;
  happinessDelta -= s.inflation > 5 ? (s.inflation - 5) * 0.4 : 0;
  happinessDelta -= s.unemployment > 8 ? (s.unemployment - 8) * 0.3 : 0;
  // Air quality is a felt, everyday indicator: bad air hurts, clean air soothes.
  happinessDelta += (nextAir - 55) * 0.04;
  s.happiness = clamp(s.happiness + happinessDelta, 0, 100);

  // 5) Approval — slower moving, influenced by happiness and finances
  let approvalDelta = (s.happiness - s.approval) * 0.08;
  if (s.treasury < 0) approvalDelta -= 3;
  if (revenue - expenses > 0) approvalDelta += 0.3;
  // Pollution scandal drag on approval.
  if (nextPollution > 65) approvalDelta -= (nextPollution - 65) * 0.05;
  s.approval = clamp(s.approval + approvalDelta, 0, 100);

  // 6) Unemployment — improves with businesses and education, worsens with high biz tax.
  //    Scenario bias shifts the target (recession: +, boom: -).
  const jobCapacity = s.businesses * 22 * (0.8 + s.policies.education / 250);
  const targetUnemp = clamp(
    100 - (jobCapacity / s.population) * 100 + econ.unempBias,
    1.5,
    35,
  );
  s.unemployment = clamp(s.unemployment + (targetUnemp - s.unemployment) * 0.25, 1, 40);

  // 7) Businesses — attracted by low biz tax, transport, education; repelled by
  //    bad infra. Aggressive sustainability regulation raises compliance costs
  //    on industry (business growth drag) but a *cleaner* city attracts
  //    higher-value firms (net-positive if air is genuinely good).
  const sustBurden = (sust.emissions + sust.renewables) / 100; // 0..2
  const bizDeltaRaw =
    (30 - s.taxes.business) * 0.4 +
    (s.policies.transport - 50) * 0.08 +
    (s.policies.education - 50) * 0.05 -
    (waterGap + energyGap) * 0.05 +
    (s.happiness - 50) * 0.03 -
    sustBurden * 1.4 +
    (nextAir > 70 ? (nextAir - 70) * 0.06 : 0);
  const bizDelta = bizDeltaRaw * econ.businessGrowthMult;
  s.businesses = Math.max(20, Math.round(s.businesses + bizDelta));

  // 8) Inflation — random walk influenced by deficit + scenario bias.
  const deficit = expenses - revenue;
  s.inflation = clamp(
    s.inflation + (deficit > 0 ? 0.15 : -0.1) + econ.inflationBias + (rng() - 0.5) * 0.4,
    0.5,
    25,
  );

  // 9) Population — grows/shrinks with happiness & jobs
  const popDelta =
    ((s.happiness - 55) * 12) +
    ((10 - s.unemployment) * 40) -
    (waterGap + energyGap) * 6;
  s.population = Math.max(1000, Math.round(s.population + popDelta));

  // 10) Advance calendar
  s.month += 1;
  if (s.month > 12) {
    s.month = 1;
    s.year += 1;
  }

  pushNews(s, {
    kind: revenue - expenses >= 0 ? "success" : "warning",
    titleKey: "news_report",
    detail: `${formatMoney(revenue)} → ${formatMoney(expenses)}`,
  });

  if (waterGap > 0) pushNews(s, { kind: "warning", titleKey: "news_low_water" });
  if (energyGap > 0) pushNews(s, { kind: "warning", titleKey: "news_low_energy" });

  if (s.treasury < -400_000) {
    pushNews(s, { kind: "danger", titleKey: "news_bankruptcy" });
  }

  // 10.5) Easter egg — "Não se faz Copa do Mundo com Hospital".
  //       Se a saúde estiver bem ruim (política < 25) mas a aprovação
  //       estiver de mediana para boa (55..78), há uma pequena chance
  //       mensal, durante a janela da Copa 2030, do Brasil ser campeão.
  //       Dispara no máximo uma vez por campanha. A conquista secreta
  //       correspondente é avaliada a partir de `s.copa2030.won`.
  if (
    !s.copa2030?.won &&
    s.year >= 2030 && s.year <= 2031 &&
    s.policies.health < 25 &&
    s.approval >= 55 && s.approval <= 78 &&
    rng() < 0.08
  ) {
    s.copa2030 = { won: true, wonAt: { month: s.month, year: s.year } };
    s.happiness = clamp(s.happiness + 8, 0, 100);
    s.approval = clamp(s.approval + 6, 0, 100);
    pushNews(s, {
      kind: "success",
      titleKey: "news_copa_2030",
      highlight: true,
      detail:
        "BRASIL HEXA! Enquanto a fila do SUS engrossa, a Seleção levanta a taça da Copa do Mundo de 2030. A cidade vira uma festa só — hospitais lotados, mas com a TV ligada.",
    });
  }


  // 11) Random events — ~1 in 3 months if none active.
  //     70% procedurally generated based on current city state,
  //     30% hand-crafted from the fixed pool for narrative anchors.
  //     ⚠️ Suppressed while the onboarding tour is running so a brand-new
  //     player is not hit with a scripted crisis before they've even had a
  //     chance to open the panels. `tutorialStep` is `undefined` on legacy
  //     saves (treat as veteran) and `>= 999` once the tour is done.
  const tourActive =
    typeof s.tutorialStep === "number" && s.tutorialStep < 999;
  const graceMonths = monthsSincePostTour(s);
  const inGrace = graceMonths !== null && graceMonths < POST_TOUR_GRACE_MONTHS;
  const __diff = getDifficultyProfile(s.difficulty);
  // Ramp the event chance back up over the grace window instead of a hard
  // gate: month 0 after the tour = 15% of normal, climbing linearly to 100%.
  const graceMult = inGrace
    ? 0.15 + 0.85 * (graceMonths! / POST_TOUR_GRACE_MONTHS)
    : 1;
  const __eventChance = Math.min(0.95, 0.20 * __diff.eventChanceMult * graceMult);
  if (!tourActive && !s.activeEvent && rng() < __eventChance) {
    const def = rng() < 0.7 ? generateEvent(s, rng) : pickEvent(rng);
    const evt: ActiveEvent = { def, triggeredAt: { month: s.month, year: s.year } };
    s.activeEvent = evt;
    s.speed = 0;
  }


  // 12) Attractiveness + zoning-driven growth
  s.attractiveness = computeAttractiveness(s);
  // 12a) Mayor mode: auto-paint zones + advance public-work biddings before
  //      the standard growCity pass consumes those new zones.
  if (s.mode === "mayor") {
    autoZonePass(s, rng);
    const completedWorks = tickBiddingMonth(s, rng);
    for (const w of completedWorks) placeAwardedWork(s, w, rng);
  }
  const outorgaBefore = s.landUse.outorgaRevenue;
  const grown = growCity(s, rng);
  const outorgaDelta = s.landUse.outorgaRevenue - outorgaBefore;
  if (outorgaDelta > 0) {
    s.lastRevenueBreakdown.outorga = Math.round(outorgaDelta);
    s.lastRevenue += Math.round(outorgaDelta);
  }
  if (grown > 0) {
    pushNews(s, {
      kind: "info",
      titleKey: `Zonas se desenvolveram (${grown} novos edifícios)||Zones developed (${grown} new buildings)`,
    });
  }

  // 13) Favelas — organic settlements react to housing/jobs/services pressure.
  //     They surge under stress and can be integrated later via urbanization.
  const favelasBefore = countFavelas(s).count;
  const spawnedFavelas = growFavelas(s, rng);
  if (spawnedFavelas > 0) {
    pushNews(s, {
      kind: "warning",
      titleKey: `Novas comunidades surgem (${spawnedFavelas})||New informal settlements emerge (${spawnedFavelas})`,
    });
  }

  // 13b) Land-use bookkeeping: age vazios urbanos, collect IPTU progressivo if enabled.
  const landTick = tickLandUse(s);
  if (landTick.iptuRevenue > 0) {
    s.lastRevenueBreakdown.iptuProgressive = Math.round(landTick.iptuRevenue);
    s.lastRevenue += Math.round(landTick.iptuRevenue);
    pushNews(s, {
      kind: "info",
      titleKey: `IPTU progressivo arrecadou R$ ${Math.round(landTick.iptuRevenue).toLocaleString("pt-BR")}||Progressive IPTU collected R$ ${Math.round(landTick.iptuRevenue).toLocaleString("en-US")}`,
    });
  }
  // 13c) Regularização fundiária (Plano Diretor lever).
  if (regularizeFavelaStep(s, rng)) {
    pushNews(s, {
      kind: "success",
      titleKey: `Uma comunidade foi regularizada||A community was regularized`,
    });
  }
  const fav = countFavelas(s);
  // Impact of favelas on city indicators (recomputed every tick so it scales
  // dynamically with the count and size). Effects intentionally mixed:
  //   + cheap labor pool lowers unemployment
  //   + adds informal housing capacity (reflected via population equilibrium)
  //   - lowers happiness, approval and attractiveness
  //   - increases water/energy demand (unmetered hookups)
  //   - stresses health/security services
  const favBurden = fav.small * 1 + fav.medium * 2 + fav.large * 3.5;
  if (favBurden > 0) {
    s.unemployment = clamp(s.unemployment - favBurden * 0.05, 1, 40);
    s.happiness = clamp(s.happiness - favBurden * 0.15, 0, 100);
    s.approval = clamp(s.approval - favBurden * 0.08, 0, 100);
    s.waterDemand += Math.round(favBurden * 2.2);
    s.energyDemand += Math.round(favBurden * 1.6);
    s.attractiveness = clamp(s.attractiveness - favBurden * 0.4, 0, 100);
  }
  void favelasBefore;

  // 13d) Transport module: commuter split, farebox vs subsidy, satisfaction.
  const transit = tickTransport(s, rng);
  if (transit.farebox > 0) {
    s.lastRevenueBreakdown.farebox = transit.farebox;
    s.lastRevenue += transit.farebox;
    s.treasury += transit.farebox;
  }
  if (transit.subsidy > 0) {
    s.lastExpensesBreakdown.transitSubsidy = transit.subsidy;
    s.lastExpenses += transit.subsidy;
    s.treasury -= transit.subsidy;
  }
  s.happiness = clamp(s.happiness + transit.happinessDelta, 0, 100);
  if (transit.pollutionDelta !== 0) {
    s.environment.pollution = clamp(s.environment.pollution + transit.pollutionDelta, 0, 100);
    s.environment.airQuality = clamp(100 - s.environment.pollution, 0, 100);
  }
  if (transit.healthCost > 0) {
    s.lastExpensesBreakdown.transitSubsidy = (s.lastExpensesBreakdown.transitSubsidy ?? 0) + transit.healthCost;
    s.lastExpenses += transit.healthCost;
    s.treasury -= transit.healthCost;
  }
  if (transit.accidents >= 25) {
    pushNews(s, {
      kind: "warning",
      titleKey: `${transit.accidents} acidentes graves de moto no mês||${transit.accidents} serious motorcycle accidents this month`,
    });
  }
  if (s.transport.split.congestion >= 80) {
    pushNews(s, {
      kind: "warning",
      titleKey: `Congestionamento crítico (${s.transport.split.congestion}%): ônibus preso no trânsito||Critical congestion (${s.transport.split.congestion}%): buses stuck in traffic`,
    });
  }
  if (s.transport.unmet > s.transport.totalCommuters * 0.15 && s.transport.totalCommuters > 0) {
    pushNews(s, {
      kind: "warning",
      titleKey: `Transporte insuficiente: ${Math.round((s.transport.unmet / s.transport.totalCommuters) * 100)}% ficaram sem opção||Transport gap: ${Math.round((s.transport.unmet / s.transport.totalCommuters) * 100)}% of commuters unserved`,
    });
  }

  // 13e) Climate & infrastructure: drainage/flooding, sanitation (Marco),
  //      solid waste. Ledger, pollution, happiness, disease outbreaks.
  const climate = tickClimate(s, rng);
  if (climate.tariffRevenue > 0) {
    s.lastRevenueBreakdown.sanitationTariff = climate.tariffRevenue;
    s.lastRevenue += climate.tariffRevenue;
  }
  const sanCost = s.climate.sanitation.lastOperatingCost;
  const wasteCost = s.climate.waste.lastCost;
  if (sanCost > 0) {
    s.lastExpensesBreakdown.sanitation = sanCost;
    s.lastExpenses += sanCost;
  }
  if (wasteCost > 0) {
    s.lastExpensesBreakdown.waste = wasteCost;
    s.lastExpenses += wasteCost;
  }
  const climateCharge = climate.floodDamage + climate.healthEmergency;
  if (climateCharge > 0) {
    s.lastExpensesBreakdown.climateDamage = climateCharge;
    s.lastExpenses += climateCharge;
  }
  s.happiness = clamp(s.happiness + climate.happinessDelta, 0, 100);
  if (climate.pollutionDelta !== 0) {
    s.environment.pollution = clamp(s.environment.pollution + climate.pollutionDelta, 0, 100);
    s.environment.airQuality = clamp(100 - s.environment.pollution, 0, 100);
  }
  if (s.climate.drainage.lastFlooded) {
    pushNews(s, {
      kind: "danger",
      titleKey: `Enchente atinge a cidade (dano ${formatMoney(climate.floodDamage)})||Flood hits the city (damage ${formatMoney(climate.floodDamage)})`,
    });
  }
  if (s.climate.sanitation.lastOutbreak) {
    const o = s.climate.sanitation.lastOutbreak;
    pushNews(s, {
      kind: "warning",
      titleKey: o.disease === "dengue"
        ? `Surto de dengue sobrecarrega o SUS||Dengue outbreak strains the health system`
        : `Surto de leptospirose após alagamentos||Leptospirosis outbreak after floods`,
    });
  }
  // 13f) Informal economy — vendors, evasion, formalização (MEI), integração.
  const inf = tickInformality(s);
  if (inf.revenueDelta !== 0) {
    s.lastRevenue += inf.revenueDelta;
    s.treasury += inf.revenueDelta;
  }
  if (inf.programCost > 0) {
    s.lastExpenses += inf.programCost;
    s.treasury -= inf.programCost;
  }

  // 13g) Spatial justice — recompute strata metrics & fold small bias.
  const spatial = tickSpatialJustice(s);
  s.unemployment = clamp(s.unemployment + spatial.unemploymentBias, 0, 30);
  s.happiness = clamp(s.happiness + spatial.happinessDelta, 0, 100);

  // 13h) Intergenerational education cycle & brain drain.
  const edu = tickEducation(s);
  if (edu.costDelta > 0) {
    s.lastExpenses += edu.costDelta;
    s.treasury -= edu.costDelta;
    s.lastExpensesBreakdown.education = (s.lastExpensesBreakdown.education ?? 0) + edu.costDelta;
  }
  if (edu.populationDelta !== 0) {
    s.population = Math.max(0, s.population + edu.populationDelta);
  }
  if (edu.unemploymentDelta !== 0) {
    s.unemployment = clamp(s.unemployment + edu.unemploymentDelta, 0, 30);
  }
  if (edu.happinessDelta !== 0) {
    s.happiness = clamp(s.happiness + edu.happinessDelta, 0, 100);
  }
  if (edu.news === "brain_drain_alert") {
    pushNews(s, {
      kind: "warning",
      titleKey: `Fuga de cérebros: ${s.education.lastBrainDrain.toLocaleString("pt-BR")} qualificados migraram||Brain drain: ${s.education.lastBrainDrain.toLocaleString("en-US")} skilled residents left`,
    });
  }

  // 13i) Housing market & gentrification.
  const hou = tickHousing(s);
  if (hou.costDelta > 0) {
    s.lastExpenses += hou.costDelta;
    s.treasury -= hou.costDelta;
    s.lastExpensesBreakdown.housing = (s.lastExpensesBreakdown.housing ?? 0) + hou.costDelta;
  }
  if (hou.populationDelta !== 0) s.population = Math.max(0, s.population + hou.populationDelta);
  if (hou.happinessDelta !== 0) s.happiness = clamp(s.happiness + hou.happinessDelta, 0, 100);
  if (hou.news === "gentrification_alert") {
    pushNews(s, {
      kind: "warning",
      titleKey: `Gentrificação acelera no centro (${s.housing.gentrificationIndex})||Gentrification accelerates downtown (${s.housing.gentrificationIndex})`,
    });
  }

  // 13i-bis) FJP-style Housing Demography — income brackets, deficit, inadequação.
  ensureDemography(s);
  const demo = tickDemography(s, rng);
  if (demo.approvalDelta !== 0) s.approval = clamp(s.approval + demo.approvalDelta, 0, 100);
  if (demo.happinessDelta !== 0) s.happiness = clamp(s.happiness + demo.happinessDelta, 0, 100);
  if (demo.spawned > 0) {
    pushNews(s, {
      kind: "warning",
      titleKey: `Déficit habitacional gerou ${demo.spawned} novo(s) assentamento(s) informal(is)||Housing deficit spawned ${demo.spawned} new informal settlement(s)`,
    });
  } else if (demo.news === "rent_burden_alert") {
    pushNews(s, {
      kind: "warning",
      titleKey: `Aluguel consome ${Math.round(s.demography!.rentBurdenLow * 100)}% da renda dos mais pobres||Rent eats ${Math.round(s.demography!.rentBurdenLow * 100)}% of low-income budgets`,
    });
  } else if (demo.news === "deficit_alert") {
    pushNews(s, {
      kind: "warning",
      titleKey: `Déficit habitacional: ${s.demography!.housingDeficit.toLocaleString("pt-BR")} moradias||Housing deficit: ${s.demography!.housingDeficit.toLocaleString("en-US")} dwellings`,
    });
  }

  const wb = tickWellbeing(s);
  if (wb.happinessDelta !== 0) s.happiness = clamp(s.happiness + wb.happinessDelta, 0, 100);
  if (wb.healthCost > 0) {
    s.lastExpenses += wb.healthCost;
    s.treasury -= wb.healthCost;
    s.lastExpensesBreakdown.health = (s.lastExpensesBreakdown.health ?? 0) + wb.healthCost;
  }
  if (wb.energyDemandDelta > 0) {
    s.energyDemand = Math.max(0, (s.energyDemand ?? 0) + Math.round(wb.energyDemandDelta / 50));
  }
  if (s.wellbeing) {
    if (s.wellbeing.pm25 > 35) {
      pushNews(s, {
        kind: "warning",
        titleKey: `Alerta de qualidade do ar: PM2.5 em ${s.wellbeing.pm25} µg/m³||Air-quality alert: PM2.5 at ${s.wellbeing.pm25} µg/m³`,
      });
    }
    if (s.wellbeing.commuteMinutes > 110) {
      pushNews(s, {
        kind: "warning",
        titleKey: `Trânsito extremo: ${s.wellbeing.commuteMinutes} min/dia em deslocamento||Extreme commute: ${s.wellbeing.commuteMinutes} min/day on the road`,
      });
    }
    if (s.wellbeing.heatIslandC >= 5) {
      pushNews(s, {
        kind: "warning",
        titleKey: `Ilha de calor +${s.wellbeing.heatIslandC.toFixed(1)}°C sobrecarrega a rede elétrica||Heat-island +${s.wellbeing.heatIslandC.toFixed(1)}°C strains the grid`,
      });
    }
  }









  // 13k) Parallel territorial power — factions/milícias fill service gaps.
  const pp = tickParallelPower(s);
  if (pp.revenueDelta !== 0) {
    s.lastRevenue += pp.revenueDelta;
    s.treasury += pp.revenueDelta;
  }
  if (pp.programCost > 0) {
    s.lastExpenses += pp.programCost;
    s.treasury -= pp.programCost;
    s.lastExpensesBreakdown.security = (s.lastExpensesBreakdown.security ?? 0) + pp.programCost;
  }
  if (pp.approvalDelta !== 0) s.approval = clamp(s.approval + pp.approvalDelta, 0, 100);
  if (pp.happinessDelta !== 0) s.happiness = clamp(s.happiness + pp.happinessDelta, 0, 100);
  if (pp.corruptionDelta !== 0 && s.politics?.institutional) {
    s.politics.institutional.corruption = clamp(
      s.politics.institutional.corruption + pp.corruptionDelta, 0, 100,
    );
  }
  if (pp.news === "faccao_surge") {
    pushNews(s, {
      kind: "danger",
      titleKey: `Facção assume o controle da periferia||A faction takes control of the periphery`,
    });
  } else if (pp.news === "milicia_surge") {
    pushNews(s, {
      kind: "danger",
      titleKey: `Milícia domina bairros abandonados pelo Estado||Militia dominates districts abandoned by the state`,
    });
  }

  // 13l) Socio-environmental disasters — rainfall, landslides, crisis mgmt.
  ensureDisasters(s);
  const dOut = tickDisasters(s, rng);
  if (dOut.approvalDelta)  s.approval  = clamp(s.approval  + dOut.approvalDelta,  0, 100);
  if (dOut.happinessDelta) s.happiness = clamp(s.happiness + dOut.happinessDelta, 0, 100);
  if (dOut.treasuryDelta < 0) {
    s.lastExpenses += -dOut.treasuryDelta;
    s.lastExpensesBreakdown.security =
      (s.lastExpensesBreakdown.security ?? 0) + (-dOut.treasuryDelta);
  }
  for (const item of dOut.news) pushNews(s, item);
  if (s.parallelPower && s.parallelPower.blockedZones >= 2 && s.month === 9) {
    pushNews(s, {
      kind: "warning",
      titleKey: `${s.parallelPower.blockedZones} zonas proíbem comícios — interferência eleitoral||${s.parallelPower.blockedZones} zones forbid rallies — electoral interference`,
    });
  }

  // 13m) Mass events & cultural economy — tourism, cleaning, class reputation.
  ensureMassEvents(s);
  const mOut = tickMassEvents(s, rng);
  if (mOut.revenue > 0) {
    s.lastRevenue += mOut.revenue;
    s.lastRevenueBreakdown.businessTax =
      (s.lastRevenueBreakdown.businessTax ?? 0) + mOut.revenue;
  }
  if (mOut.expenses > 0) {
    s.lastExpenses += mOut.expenses;
    s.lastExpensesBreakdown.sustainability =
      (s.lastExpensesBreakdown.sustainability ?? 0) + mOut.expenses;
  }
  if (mOut.approvalDelta)  s.approval  = clamp(s.approval  + mOut.approvalDelta,  0, 100);
  if (mOut.happinessDelta) s.happiness = clamp(s.happiness + mOut.happinessDelta, 0, 100);
  for (const item of mOut.news) pushNews(s, item);

  // 13n) Restrições jurídicas — MP, TCE, comissão processante na Câmara.
  ensureOversight(s);
  const ov = tickOversight(s, rng);
  if (ov.treasuryDelta !== 0) {
    s.treasury += ov.treasuryDelta;
    if (ov.treasuryDelta < 0) s.lastExpenses += -ov.treasuryDelta;
  }
  if (ov.frozenFraction > 0) {
    // Bloqueio judicial "carimba" parte da receita — sai do caixa neste mês.
    const freeze = Math.round(Math.max(0, s.lastRevenue) * ov.frozenFraction);
    s.treasury -= freeze;
    s.lastExpenses += freeze;
  }
  if (ov.approvalDelta)  s.approval  = clamp(s.approval  + ov.approvalDelta,  0, 100);
  if (ov.happinessDelta) s.happiness = clamp(s.happiness + ov.happinessDelta, 0, 100);
  for (const item of ov.news) pushNews(s, item);
  if (ov.removedFromOffice) {
    s.speed = 0;
    s.approval = clamp(s.approval - 25, 0, 100);
    // Mark the arc as ended by impeachment so the Konami "second chance"
    // rewind stays disabled and the picker/hall flow knows the reason.
    if (!s.journey) {
      s.journey = { coherenceScore: 50, choicesMade: 0, taggedChoices: 0, keyDecisions: [], monthsLowCoherence: 0 };
    }
    s.journey.careerEnded = "impeached";
  }

  // 13o) Conflito fundiário — ocupações e ondas de gentrificação.
  ensureLandConflict(s);
  const lc = tickLandConflict(s, rng);
  if (lc.treasuryDelta !== 0) s.treasury += lc.treasuryDelta;
  if (lc.revenueDelta > 0) {
    s.lastRevenue += lc.revenueDelta;
    s.lastRevenueBreakdown.propertyTax =
      (s.lastRevenueBreakdown.propertyTax ?? 0) + lc.revenueDelta;
  }
  if (lc.approvalDelta)  s.approval  = clamp(s.approval  + lc.approvalDelta,  0, 100);
  if (lc.happinessDelta) s.happiness = clamp(s.happiness + lc.happinessDelta, 0, 100);
  if (lc.populationDelta) s.population = Math.max(0, s.population + lc.populationDelta);
  if (lc.mpRiskDelta && s.oversight) {
    s.oversight.mpRisk = clamp(s.oversight.mpRisk + lc.mpRiskDelta, 0, 100);
  }
  for (const item of lc.news) pushNews(s, item);

  // 13p) Mídia & opinião pública — manchetes por viés e efeito manada.
  ensureMedia(s);
  const med = tickMedia(s, { float: () => rng() });
  // Difficulty: amplify/soften NEGATIVE media swings only — easy modes let
  // rewards land at full strength, hard modes make bad press hurt more.
  const __mediaMult = __diff.reactionMult;
  const __mAppr = med.approvalDelta < 0 ? med.approvalDelta * __mediaMult : med.approvalDelta;
  const __mHap  = med.happinessDelta < 0 ? med.happinessDelta * __mediaMult : med.happinessDelta;
  if (__mAppr) s.approval  = clamp(s.approval  + __mAppr, 0, 100);
  if (__mHap)  s.happiness = clamp(s.happiness + __mHap,  0, 100);
  for (const item of med.news) pushNews(s, item);

  // 13q) "Hora da Verdade" — recomputa criminalidade por bairro mensalmente.
  ensurePoliceShow(s);
  tickPoliceShowMonthly(s, { float: () => rng() });

  // 13r) ZapZap — cobrança da Coordenadoria de Comunicação, desmentidos
  //      automáticos, escalada de desinformação e disparo de protestos virais.
  ensureZapZap(s);
  const zap = tickZapZapMonthly(s, { float: () => rng() });
  tickPiuPiuMonth(s);
  tickCovertOpsMonth(s, () => rng());
  // 13r.1) YouTubi — canais satíricos de vídeo publicam vlogs/podcasts.
  ensureVideosphere(s);
  const vs = tickVideosphereMonth(s, { float: () => rng() });
  const __vsMult = __diff.reactionMult;
  const __vsAppr = vs.approvalDelta < 0 ? vs.approvalDelta * __vsMult : vs.approvalDelta;
  const __vsHap  = vs.happinessDelta < 0 ? vs.happinessDelta * __vsMult : vs.happinessDelta;
  if (__vsAppr) s.approval  = clamp(s.approval  + __vsAppr, 0, 100);
  if (__vsHap)  s.happiness = clamp(s.happiness + __vsHap,  0, 100);
  if (zap.treasuryDelta) s.treasury += zap.treasuryDelta;
  if (zap.expenses) {
    s.lastExpenses += zap.expenses;
    s.lastExpensesBreakdown.security =
      (s.lastExpensesBreakdown.security ?? 0) + zap.expenses;
  }
  if (zap.approvalDelta)  s.approval  = clamp(s.approval  + zap.approvalDelta,  0, 100);
  if (zap.happinessDelta) s.happiness = clamp(s.happiness + zap.happinessDelta, 0, 100);
  for (const item of zap.news) pushNews(s, item);

  // 13s) Assessores diretos — salários, evolução, assédio, corrupção.
  ensureAdvisors(s);
  const adv = tickAdvisorsMonthly(s, () => rng());
  if (adv.expenses) {
    s.treasury -= adv.expenses;
    s.lastExpenses += adv.expenses;
    s.lastExpensesBreakdown.security =
      (s.lastExpensesBreakdown.security ?? 0) + Math.round(adv.expenses * 0.1);
    s.lastExpensesBreakdown.education =
      (s.lastExpensesBreakdown.education ?? 0) + Math.round(adv.expenses * 0.2);
    s.lastExpensesBreakdown.infra =
      (s.lastExpensesBreakdown.infra ?? 0) + Math.round(adv.expenses * 0.7);
  }
  if (adv.treasuryDelta) s.treasury += adv.treasuryDelta;
  if (adv.approvalDelta)  s.approval  = clamp(s.approval  + adv.approvalDelta,  0, 100);
  if (adv.happinessDelta) s.happiness = clamp(s.happiness + adv.happinessDelta, 0, 100);
  if (adv.mpRiskDelta && s.oversight) {
    s.oversight.mpRisk = clamp(s.oversight.mpRisk + adv.mpRiskDelta, 0, 100);
  }
  for (const item of adv.news) pushNews(s, item);

  // 13s.1) Caixa de e-mails — assessores pedem autorização por escrito e
  //        cobram resposta; pedidos vencidos custam aprovação e lealdade.
  ensureInbox(s);
  const box = tickInboxMonthly(s, () => rng());
  if (box.approvalDelta)  s.approval  = clamp(s.approval  + box.approvalDelta,  0, 100);
  if (box.happinessDelta) s.happiness = clamp(s.happiness + box.happinessDelta, 0, 100);
  for (const item of box.news) pushNews(s, item);

  // 13.b) Corrupção & ilícitos administrativos.
  ensureCorruption(s);
  const corr = tickCorruptionMonthly(s, rng);
  if (corr.approvalDelta)  s.approval  = clamp(s.approval  + corr.approvalDelta,  0, 100);
  if (corr.happinessDelta) s.happiness = clamp(s.happiness + corr.happinessDelta, 0, 100);
  if (corr.mpRiskDelta && s.oversight) {
    s.oversight.mpRisk = clamp(s.oversight.mpRisk + corr.mpRiskDelta, 0, 100);
  }
  for (const item of corr.news) pushNews(s, item);


  // 14) Political and institutional dynamics (coalitions, groups, intergov,
  //     diplomacy, indices, and staged election result).
  tickPolitics(s, rng);
  ensureLegislature(s);
  tickLegislature(s, rng);
  ensureNegotiation(s);
  tickNegotiation(s, rng);
  Object.assign(s, tickCampaign(ensureCampaign(s)));
  // Fold the legislative record and parallel-power interference into a
  // freshly staged election result.
  const pend = s.politics.election.pendingResult;
  if (pend) {
    const bonus = legislativeScore(s);
    const penalty = parallelElectionPenalty(s);
    pend.voteShare = Math.max(5, Math.min(95, pend.voteShare + bonus - penalty));
    pend.won = pend.voteShare >= 50 && s.politics.election.reelectionAllowed;
    if (penalty > 0) {
      pend.breakdown = {
        ...pend.breakdown,
        // Reuse the existing "corruption" slot as a negative signal channel
        // rather than widening the schema.
        corruption: (pend.breakdown.corruption ?? 0) - penalty,
      };
    }
  }

  // --- Caixa negativo vira dívida: linha de crédito emergencial (ARO) ---
  // Sem isso o tesouro despencava indefinidamente e `debt` ficava em 0,
  // tornando o número do HUD insignificante.
  if (s.treasury < 0) {
    const gap = -s.treasury;
    s.debt += gap;
    s.treasury = 0;
    if (gap > 0) {
      pushNews(s, {
        kind: "warning",
        titleKey:
          "Caixa zerado: prefeitura recorre a crédito emergencial (ARO) para fechar o mês.||" +
          "Treasury empty: city taps emergency credit to close the month.",
      });
    }
  }

  // --- Motor econômico/tributário: avalia LRF sobre a folha vs. RCL. ---
  const wasInfracao = !!s.fiscal?.infracaoFiscal;
  const lrf = evaluateLRF(s);
  s.fiscal = lrf;
  if (lrf.infracaoFiscal && !wasInfracao) {
    pushNews(s, {
      kind: "danger",
      titleKey:
        "Infração à LRF: folha > 54% da RCL — novos investimentos bloqueados." +
        "||LRF breach: payroll exceeds 54% of RCL — new investments blocked.",
    });
  } else if (!lrf.infracaoFiscal && wasInfracao) {
    pushNews(s, {
      kind: "success",
      titleKey:
        "Ajuste fiscal concluído — obras e concessões liberadas.||" +
        "Fiscal adjustment complete — capex and concessions unlocked.",
    });
  } else if (lrf.stage === "prudencial") {
    pushNews(s, {
      kind: "warning",
      titleKey:
        "Limite prudencial da LRF atingido (>51,3%).||" +
        "LRF prudential threshold reached (>51.3%).",
    });
  }

  return s;
}


/* ---------------- Zone painting ---------------- */

export function paintTile(state: GameState, x: number, y: number, tool: ZoneTool): GameState {
  if (tool === "off") return state;
  const size = state.mapSize;
  if (x < 0 || y < 0 || x >= size || y >= size) return state;
  const i = y * size + x;
  // Only allow painting on grass/park base tiles.
  const base = generateBaseMap(state, size).tiles[i];
  if (!isZoneableTileKind(base.kind)) return state;

  // Never let zone brushes touch state-owned buildings; they need explicit demolition.
  if (state.buildingOwners[i] === "state") return state;

  const zones = state.zones.slice();
  const built = state.builtBuildings.slice();
  const owners = state.buildingOwners.slice();
  if (tool === "eraser") {
    if (zones[i] === "none" && !built[i]) return state;
    zones[i] = "none";
    built[i] = null;
    owners[i] = null;
  } else {
    if (zones[i] === tool) return state;
    zones[i] = tool as ZoneKind;
    // Painting over a mismatched existing building clears it so the zone can regrow.
    if (built[i] && !matchesZone(built[i]!, tool as ZoneKind)) {
      built[i] = null;
      owners[i] = null;
    }
  }
  return { ...state, zones, builtBuildings: built, buildingOwners: owners };
}

function matchesZone(b: BuildingKind, z: ZoneKind): boolean {
  switch (z) {
    case "residential":
      return (
        b === "house_s" || b === "house_m" || b === "house_l" || b === "tower" || b === "school_private" ||
        b === "favela_s" || b === "favela_m" || b === "favela_l"
      );
    case "commercial":
      return b === "shop" || b === "office" || b === "tower";
    case "industrial":
      return b === "factory" || b === "favela_s" || b === "favela_m" || b === "favela_l";
    case "rural":
      return b === "farm" || b === "barn" || b === "tree" || b === "house_s";
    case "zeis":
      return (
        b === "house_s" || b === "house_m" ||
        b === "favela_s" || b === "favela_m" || b === "favela_l"
      );
    default:
      return true;
  }
}

/* ---------------- Urbanization program ---------------- */

/**
 * Cost per favela tile to integrate it into the formal city grid.
 * Larger settlements cost more but yield bigger happiness / approval gains.
 */
export const URBANIZE_COST = { favela_s: 120_000, favela_m: 220_000, favela_l: 380_000 } as const;

/**
 * Integrate the largest available favela into the formal urban grid.
 *   favela_l → house_l    (fully integrated block)
 *   favela_m → house_s    (partial upgrade)
 *   favela_s → cleared    (relocated to formal housing)
 * Deducts the tier's cost, applies morale/approval boost and records progress.
 */
export function urbanizeFavela(state: GameState): GameState {
  // Find the largest existing favela.
  let idx = -1;
  let tier: "favela_s" | "favela_m" | "favela_l" | null = null;
  for (let i = 0; i < state.builtBuildings.length; i++) {
    const b = state.builtBuildings[i];
    if (b === "favela_l") { idx = i; tier = "favela_l"; break; }
    if (b === "favela_m" && tier !== "favela_m") { idx = i; tier = "favela_m"; }
    else if (b === "favela_s" && tier === null) { idx = i; tier = "favela_s"; }
  }
  if (idx < 0 || !tier) return state;
  const cost = URBANIZE_COST[tier];
  if (state.treasury < cost) return state;

  const s = structuredClone(state);
  s.treasury -= cost;
  if (tier === "favela_l") {
    s.builtBuildings[idx] = "house_l";
    s.buildingOwners[idx] = "private";
    s.happiness = clamp(s.happiness + 4, 0, 100);
    s.approval = clamp(s.approval + 6, 0, 100);
  } else if (tier === "favela_m") {
    s.builtBuildings[idx] = "house_s";
    s.buildingOwners[idx] = "private";
    s.happiness = clamp(s.happiness + 2.5, 0, 100);
    s.approval = clamp(s.approval + 4, 0, 100);
  } else {
    s.builtBuildings[idx] = null;
    s.buildingOwners[idx] = null;
    s.zones[idx] = "residential";
    s.happiness = clamp(s.happiness + 1.5, 0, 100);
    s.approval = clamp(s.approval + 2, 0, 100);
  }
  s.favelaUrbanized += 1;
  pushNews(s, {
    kind: "success",
    titleKey: `Urbanização de favela concluída||Favela urbanization completed`,
    detail: `-${formatMoney(cost)}`,
  });
  s.attractiveness = computeAttractiveness(s);
  return s;
}

export function resolveEvent(prev: GameState, choiceIdx: number): GameState {
  if (!prev.activeEvent) return prev;
  const choice: GameEventChoice = prev.activeEvent.def.choices[choiceIdx];
  if (!choice) return prev;

  const __perfT0 = performance.now();
  // Shallow clone — resolver toca só primitivos + news + activeEvent.
  // structuredClone do GameState inteiro (heightmap, items, roads, agentes)
  // custava dezenas de ms e travava a UI ao clicar numa opção da notícia.
  const __cloneT0 = performance.now();
  const s: GameState = { ...prev };
  __perfMark("cloneState", performance.now() - __cloneT0);
  const e = choice.effects;
  // Difficulty: negative approval/happiness swings from a choice are scaled
  // by reactionMult. Rewards keep full magnitude so easy is truly easier.
  const __rMult = getDifficultyProfile(prev.difficulty).reactionMult;
  const __scaleNeg = (v: number | undefined) =>
    !v ? 0 : (v < 0 ? v * __rMult : v);
  if (choice.cost) s.treasury = prev.treasury - choice.cost;
  if (e.treasury) s.treasury = (s.treasury) + e.treasury;
  if (e.debt) s.debt = prev.debt + e.debt;
  if (e.happiness) s.happiness = clamp(prev.happiness + __scaleNeg(e.happiness), 0, 100);
  if (e.approval) s.approval = clamp(prev.approval + __scaleNeg(e.approval), 0, 100);
  if (e.population) s.population = Math.max(1000, prev.population + e.population);
  if (e.businesses) s.businesses = Math.max(20, prev.businesses + e.businesses);
  if (e.unemployment) s.unemployment = clamp(prev.unemployment + e.unemployment, 1, 40);
  if (e.inflation) s.inflation = clamp(prev.inflation + e.inflation, 0.5, 18);
  if (e.waterCapacity || e.energyCapacity) {
    s.infra = { ...prev.infra };
    if (e.waterCapacity) s.infra.waterCapacity += e.waterCapacity;
    if (e.energyCapacity) s.infra.energyCapacity += e.energyCapacity;
  }

  const newsItem: NewsItem = {
    id: `${s.year}-${s.month}-${s.day}-${Math.random().toString(36).slice(2, 7)}`,
    day: s.day,
    month: s.month,
    year: s.year,
    kind: prev.activeEvent.def.kind === "danger" ? "warning" : "info",
    titleKey: prev.activeEvent.def.titleKey,
    detail: choice.resultKey,
  };
  s.news = [newsItem, ...prev.news].slice(0, 80);

  // Journey — ideological coherence tracking.
  // Shallow-clone journey first so we don't mutate the prev state.
  s.journey = { ...(prev.journey ?? __defaultJourney()) };
  __updateCoherence(s, choice, prev.activeEvent.def.titleKey);

  s.activeEvent = null;
  s.speed = 1;
  __perfMark("resolveEvent", performance.now() - __perfT0);
  return s;
}

export function setPolicy(state: GameState, key: PolicyKey, value: number): GameState {
  return { ...state, policies: { ...state.policies, [key]: clamp(value, 0, 100) } };
}

export function setSustainability(
  state: GameState,
  key: SustainabilityKey,
  value: number,
): GameState {
  const sust = state.sustainability ?? { renewables: 0, emissions: 0, greenTransit: 0 };
  return { ...state, sustainability: { ...sust, [key]: clamp(value, 0, 100) } };
}

export function setTax(state: GameState, key: TaxKey, value: number): GameState {
  const caps = { income: 40, property: 20, business: 30 } as const;
  const prev = state.taxes[key];
  const next = clamp(value, 0, caps[key]);
  const s: GameState = { ...state, taxes: { ...state.taxes, [key]: next } };

  // Easter egg — jogando de Zuza, subir significativamente (≥ +2 p.p.) qualquer
  // imposto antes de setembro do ano corrente vira manchete satírica sobre
  // "o grosso" da arrecadação chegar cedo demais.
  if (
    !s.zuzaGrossoTax &&
    s.mayor?.personaId === "zuza" &&
    s.month < 9 &&
    next - prev >= 2
  ) {
    s.zuzaGrossoTax = { at: { month: s.month, year: s.year } };
    pushNews(s, {
      kind: "warning",
      titleKey: "news_zuza_grosso",
      highlight: true,
      detail:
        "Zuza sobe o imposto ainda no primeiro semestre e a oposição já monta o meme: \"O grosso entrou, mas ainda nem é setembro...\". Colunistas se dividem entre 'ousadia fiscal' e 'sinal de campanha antecipada'.",
    });
  }
  return s;
}

export function expandWater(state: GameState): GameState {
  if (state.treasury < 300_000) return state;
  const s = structuredClone(state);
  s.treasury -= 300_000;
  s.infra.waterCapacity += 50;
  pushNews(s, { kind: "success", titleKey: "news_water_up" });
  return s;
}

export function expandEnergy(state: GameState): GameState {
  if (state.treasury < 400_000) return state;
  const s = structuredClone(state);
  s.treasury -= 400_000;
  s.infra.energyCapacity += 80;
  pushNews(s, { kind: "success", titleKey: "news_energy_up" });
  return s;
}

export function takeLoan(state: GameState): GameState {
  // Issuing municipal debt requires the council to actually approve it: a
  // working majority and a minimum governability threshold.
  if (!canIssueDebt(state)) return state;
  const s = structuredClone(state);
  s.treasury += 250_000;
  s.debt += 250_000;
  pushNews(s, { kind: "info", titleKey: "news_debt" });
  return s;
}

export function payDebt(state: GameState): GameState {
  if (state.treasury < 100_000 || state.debt <= 0) return state;
  const s = structuredClone(state);
  s.treasury -= 100_000;
  s.debt = Math.max(0, s.debt - 100_000);
  pushNews(s, { kind: "success", titleKey: "news_pay_debt" });
  return s;
}

export function formatMoney(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatNumber(v: number): string {
  return v.toLocaleString("en-US");
}


/* ---------------- Projeção orçamentária ao vivo ---------------- */

/**
 * Projeta receita/despesa do mês corrente com os valores atuais dos sliders,
 * sem esperar a virada do mês. Usado pelo painel de políticas para que o
 * efeito de cada ajuste seja visível imediatamente.
 */
export function projectBudget(state: GameState): CoreBudget {
  const econ = findScenario(state.scenarioId).modifiers;
  return computeCoreBudget(state, {
    revenueMult: econ.revenueMult,
    debtInterestRate: econ.debtInterestRate,
    roadUpkeep: roadUpkeep(state),
  });
}
