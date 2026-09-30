export type Lang = "pt" | "en";

export type PolicyKey = "education" | "health" | "security" | "transport";
export type SustainabilityKey = "renewables" | "emissions" | "greenTransit";
export type TaxKey = "income" | "property" | "business";
export type ResourceKey = "water" | "energy";

/* ---------- Map primitives ---------- */

export type TileKind =
  | "grass"
  | "road_h"
  | "road_v"
  | "road_x"
  | "water"
  | "park"
  | "plaza"
  | "dirt"          // terreno seco / periferia / vazio urbano
  | "industrial";   // chão de concreto/óleo do cinturão industrial

export type BuildingKind =
  | "house_s"
  | "house_m"
  | "house_l"
  | "shop"
  | "office"
  | "tower"
  | "factory"
  | "water_plant"
  | "power_plant"
  | "school"
  | "school_private"
  | "university"
  | "hospital"
  | "fire_station"
  | "tree"
  | "farm"
  | "barn"
  | "favela_s"
  | "favela_m"
  | "favela_l"
  /** Praça de bairro com chafariz / calçada portuguesa (marcador cívico). */
  | "praca"
  /** Marco/monumento do centro cívico. */
  | "marco_central";

/** Who owns a placed building. State = built by the player. Private = grown procedurally. */
export type BuildingOwner = "state" | "private";

/** Kinds the player can directly construct (all state-owned). */
export type StateBuildKind =
  | "fire_station"
  | "hospital"
  | "school"
  | "university"
  | "water_plant"
  | "power_plant";

/** Zoning designation the player paints onto grass tiles. */
export type ZoneKind =
  | "none"
  | "residential"
  | "commercial"
  | "industrial"
  | "rural"
  /** Zona Especial de Interesse Social — reserved for low-income housing; blocks luxury towers, no outorga. */
  | "zeis";

/** UI tool selection for the zoning brush. `off` = no painting. */
export type ZoneTool = ZoneKind | "eraser" | "off";

/** UI tool selection for the build cursor. `off` = not building. */
export type BuildTool = StateBuildKind | "off";

export interface Policies {
  education: number; // 0..100 funding level
  health: number;
  security: number;
  transport: number;
}

/**
 * Sustainability program funding levels (0..100). Separate from base Policies
 * so happiness/attractiveness formulas remain stable and environmental effects
 * can be reasoned about in isolation.
 */
export interface Sustainability {
  /** Push utilities toward renewables — cuts power-plant emissions. */
  renewables: number;
  /** Emission controls on factories — cuts industrial pollution, raises costs. */
  emissions: number;
  /** Clean public transit — cuts population-driven pollution. */
  greenTransit: number;
}

export interface Environment {
  /** 0..100 — current pollution level of the city. Higher is worse. */
  pollution: number;
  /** 0..100 — air quality index. Derived and smoothed. */
  airQuality: number;
}

export interface Taxes {
  income: number; // 0..40 %
  property: number; // 0..20 %
  business: number; // 0..30 %
}

export interface Infrastructure {
  waterCapacity: number; // units/month capacity
  energyCapacity: number; // units/month capacity
}

export interface NewsItem {
  id: string;
  day?: number;
  month: number;
  year: number;
  kind: "info" | "success" | "warning" | "danger";
  titleKey: string;
  detail?: string;
  /** Optional visual flag — highlighted headlines get a special treatment
   *  in the ticker (glow, star, no-scroll-away). Used for once-in-a-mandate
   *  narrative beats like the 2030 World Cup easter egg. */
  highlight?: boolean;
}

export interface GameEventChoice {
  labelKey: string;
  cost?: number; // treasury cost
  effects: Partial<{
    happiness: number;
    approval: number;
    population: number;
    businesses: number;
    treasury: number;
    unemployment: number;
    inflation: number;
    waterCapacity: number;
    energyCapacity: number;
    debt: number;
  }>;
  resultKey: string;
  /**
   * Optional ideology tag on the choice, -1 (far left) .. +1 (far right).
   * Used by `journey.updateCoherence` to score alignment against the
   * mayor persona's ideology. Omit for neutral / technical choices.
   */
  ideologyLean?: number;
}

export interface GameEventDef {
  id: string;
  titleKey: string;
  descriptionKey: string;
  kind: "info" | "warning" | "danger" | "success";
  choices: GameEventChoice[];
  weight: number;
}

export interface ActiveEvent {
  def: GameEventDef;
  triggeredAt: { month: number; year: number };
}

import type { Mayor } from "./mayor";
import type { PoliticsState } from "./politics";
import type { TransportState } from "./transport";
import type { ClimateState } from "./climate";

export interface GameState {
  cityName: string;
  lang: Lang;
  mayor: Mayor;


  /** Configurable seed for the procedural RNG. Reproducible with (seed, rngCursor). */
  seed: string;
  /** Number of PRNG draws consumed so far. Advanced on every simulated random event. */
  rngCursor: number;

  day: number; // 1..30
  month: number; // 1..12
  year: number;
  speed: 0 | 1 | 2 | 3; // 0 paused

  population: number;
  happiness: number; // 0..100
  approval: number; // 0..100
  unemployment: number; // 0..100 %
  businesses: number;
  inflation: number; // %

  treasury: number;
  debt: number;
  lastRevenue: number;
  lastExpenses: number;
  /** Per-source revenue breakdown from the most recent monthly tick. */
  lastRevenueBreakdown: RevenueBreakdown;
  /** Per-category expense breakdown from the most recent monthly tick. */
  lastExpensesBreakdown: ExpenseBreakdown;
  /** Active macroeconomic scenario id ("recession" | "stability" | ...). */
  scenarioId: string;
  /** Chosen city scale id ("small" | "medium" | "large"). */
  scaleId: string;
  /** SimCity-2000-style progression mode: administrative panels unlock as the
   *  city grows past population tiers. Off by default so scenario play keeps
   *  full access from day one. See src/game/progression.ts. */
  growthMode?: boolean;

  /** Interactive onboarding tour step.
   *  - `undefined`  → legacy save; tour is skipped (assume veteran).
   *  - `0..N`       → currently on that step; UI overlay is visible.
   *  - `>= 999`     → completed or skipped; overlay hidden.
   *  While the tour is running (0..N), the monthly event roll is suppressed
   *  so a new player is not hit with a scripted crisis in the first minute
   *  of play. See `dayTick()` in src/game/logic.ts. */
  tutorialStep?: number;

  /** When the tour finished (step reached 999). Used to grant a short grace
   *  period where random events and media pile-ons are dampened, so the
   *  player has time to actually try the panels the tour just introduced.
   *  See `inPostTourGrace()` in src/game/logic.ts. */
  tourEndedAt?: { month: number; year: number };

  /** Difficulty profile — currently set by the City Generator picker.
   *  Undefined ⇒ "normal" (used by presets/sandbox until they get their own
   *  UI). See src/game/difficulty.ts for the multiplier table. */
  difficulty?: import("./difficulty").DifficultyLevel;


  policies: Policies;
  sustainability: Sustainability;
  environment: Environment;
  taxes: Taxes;
  infra: Infrastructure;

  waterDemand: number;
  energyDemand: number;

  news: NewsItem[];
  activeEvent: ActiveEvent | null;

  /* ---------- Zoning / procedural city growth ---------- */
  /** Square edge length of the isometric grid. */
  mapSize: number;
  /** Zone designation per tile (row-major, length = mapSize²). */
  zones: ZoneKind[];
  /** Building placed on each tile, or null if empty. Parallel to `zones`. */
  builtBuildings: (BuildingKind | null)[];
  /** Ownership per tile (parallel to builtBuildings). */
  buildingOwners: (BuildingOwner | null)[];
  /** Player-built road overlay per tile (parallel to `zones`). */
  playerRoads?: (import("./roads").RoadKind | null)[];
  /** Derived score 0..100 that drives which buildings zones grow into. */
  attractiveness: number;
  /** How many favela tiles were urbanized (integrated) since campaign start. */
  favelaUrbanized: number;

  /** Political / administrative subsystem (council, groups, intergov, diplomacy, indices). */
  politics: PoliticsState;

  /** Per-tile land-use signals & counters (Plano Diretor / speculation / hazards). */
  landUse: LandUseState;
  /** Player-tunable land-use policy levers (Outorga, IPTU progressivo, regularização). */
  landPolicy: LandPolicy;

  /** Transport module — commuter simulation, concessions, informal, mass transit. */
  transport: TransportState;

  /** Climate & infrastructure — drainage, sanitation (Marco), waste management. */
  climate: ClimateState;

  /** Informal-economy layer — vendors, evasion, formalization programs. */
  informal: import("./informality").InformalityState;

  /** Spatial-justice & social-mobility index per socio-spatial stratum. */
  mobility: import("./spatialJustice").SpatialJusticeState;

  /** Intergenerational education/income cycle & brain-drain dynamics. */
  education: import("./intergenerational").EducationState;

  /** Housing market rents, social-housing programs and gentrification. */
  housing: import("./housing").HousingState;

  /** FJP-style housing demography — income brackets, deficit, inadequação. */
  demography?: import("./demography").DemographyState;

  /** Peripheral middle-class fiscal multiplier (0.75..1.35). Reflects how well
   *  periphery mobility, regularização and skilled cohorts widen the IPTU/ISS
   *  base. Values > 1 mean a local middle class is forming. */
  peripheryMiddleClass?: number;

  /** Índice de capital humano/logístico acumulado (0..100). Média móvel do
   *  investimento em educação e transporte — alimenta a base de ISS/IPTU
   *  com defasagem, representando o retorno lento do investimento social. */
  humanCapitalIndex?: number;

  /** Public-health & quality-of-life indicators derived from transport/env. */
  wellbeing?: import("./wellbeing").WellbeingState;

  /** Parallel territorial power — factions/milícias in neglected areas. */
  parallelPower?: import("./parallelPower").ParallelPowerState;

  /** Socio-environmental disasters — landslides, flash floods, crisis mgmt. */
  disasters?: import("./disasters").DisasterState;

  /** Mass events & cultural economy — tourism, cleaning, class reputation. */
  massEvents?: import("./massEvents").MassEventsState;

  /** Restrições jurídicas: MP, TCE, Câmara (impeachment). */
  oversight?: import("./oversight").OversightState;

  /** Conflito fundiário: ocupações no centro e ondas de gentrificação. */
  landConflict?: import("./landConflict").LandConflictState;

  /** Mídia & opinião pública — veículos, manchetes, efeito manada. */
  media?: import("./media").MediaState;

  /** YouTubi — vlogs, podcasts e reacts de influencers políticos satíricos. */
  videosphere?: import("./videosphere").VideosphereState;

  /** Mídia digital informal — grupo de ZapZap, fake news, coord. de comunicação. */
  zapzap?: import("./zapzap").ZapZapState;

  /** Campanha eleitoral: coligações, promessas, debates, pesquisas. */
  campaign?: import("./campaign").CampaignState;

  /** PiuPiu — rede social satírica (X/Twitter), trending topics, picos de cancelamento. */
  piupiu?: import("./piupiu").PiuPiuState;

  /** Operações Clandestinas de Comunicação — fazendas de bots e influenciadores pagos. */
  covertOps?: import("./covertOps").CovertOpsState;

  /** Gestão de assessores diretos (5 pastas: Saúde, Obras, Finanças, Mobilidade, Articulação). */
  advisors?: import("./advisors").AdvisorState;

  /** Caixa de e-mails do gabinete — relatórios dos assessores pedindo autorização. */
  inbox?: import("./inbox").InboxState;


  /** Corrupção & ilícitos administrativos — rachadinha, fachada, propina P-CENTRO. */
  corruption?: import("./corruption").CorruptionState;

  /** Motor econômico/tributário SICONFI: RCL, folha e semáforo LRF. */
  fiscal?: import("./economicEngine").LRFReport;

  /* ---------- Modo de jogo ---------- */
  /** "sandbox" (padrão): jogador constrói/zonea. "mayor": crescimento automático + licitações. */
  mode?: "sandbox" | "mayor";
  /** Estado das licitações abertas / obras em andamento / histórico (só usado no modo mayor). */
  bidding?: import("./bidding").BiddingState;
  /** Viés do pool de empreiteiras da cidade selecionada (só usado no modo mayor). */
  bidPoolBias?: import("./bidding").BidPoolBias;

  /** Journey — coherence tracking + career-end flag for "Dois Mandatos" arc. */
  journey?: import("./journey").JourneyState;

  /** Konami "second chance" — snapshot taken 12 months before each election.
   *  Redeemable ONCE per election-loss via the Konami code (secret easter egg).
   *  The nested `snapshot` intentionally omits its own `secondChance` to
   *  prevent recursive nesting on serialize/restore. */
  secondChance?: {
    /** Rolled-back state (without its own secondChance field). Null after use. */
    snapshot: GameState | null;
    /** When the snapshot was recorded — UX only. */
    snapshotAt?: { year: number; month: number };
    /** Election year this snapshot targets. */
    electionYear?: number;
    /** True once consumed. Reset when a snapshot for a later election is taken. */
    used?: boolean;
  };

  /** Easter egg: Brazil winning the 2030 World Cup while the mayor lets
   *  public health rot. Fires at most once per campaign. */
  copa2030?: {
    won: boolean;
    wonAt?: { month: number; year: number };
  };

  /** Easter egg: after 5 crises envolvendo Dando Boura resolvidas com
   *  sucesso, o vlogger publica um vídeo "revelando" a própria altura. */
  dandoBoura?: {
    heightRevealed: boolean;
    at?: { month: number; year: number };
  };

  /** Easter egg: jogando de Zuza, aumentar significativamente algum imposto
   *  antes de setembro do calendário corrente. Fires no máximo uma vez. */
  zuzaGrossoTax?: {
    at: { month: number; year: number };
  };
}

/**
 * Per-tile land-use signals. All arrays are parallel to `zones` (length = mapSize²).
 */
export interface LandUseState {
  /** True on tiles inside APPs / hillside risk polygons (deterministic from seed). */
  hazardMask: boolean[];
  /**
   * Months a zoned residential/commercial tile has stayed empty without growing.
   * Reset to 0 when a building appears. Used to detect speculative retention.
   */
  speculationAge: number[];
  /** Favela tiles that have been regularized (mark for IPTU + services). */
  formalized: boolean[];
  /* ---- Cumulative campaign counters ---- */
  outorgaSold: number;
  outorgaRevenue: number;
  vazioTiles: number;      // current count of speculative empty tiles
  vazioRevenue: number;    // total IPTU progressivo collected
  regularized: number;     // favela tiles regularized so far
  hazardFavelas: number;   // current favela tiles sitting on hazard zones
}

/* ---------------- Fiscal breakdown ---------------- */

export interface RevenueBreakdown {
  incomeTax: number;
  propertyTax: number;
  businessTax: number;
  outorga: number;
  iptuProgressive: number;
  transfers: number;
  /** Transit farebox revenue (formal + legalized informal fares). */
  farebox: number;
  /** Sanitation tariff kept by the city (net of concession/PPP retention). */
  sanitationTariff: number;
}

export interface ExpenseBreakdown {
  education: number;
  health: number;
  security: number;
  transport: number;
  sustainability: number;
  infra: number;
  debtInterest: number;
  /** Transit operating subsidies: per-trip + fixed concession + enforcement. */
  transitSubsidy: number;
  /** Sanitation operating cost (investment + overhead + PPP fees). */
  sanitation: number;
  /** Solid-waste operations (collection + landfill/recycling). */
  waste: number;
  /** Flood damage + drainage capex spikes for the month. */
  climateDamage: number;
  /** Social housing subsidy operating cost. */
  housing: number;
}

/**
 * Land-use policy levers set by the player.
 */
export interface LandPolicy {
  /** Outorga Onerosa price per FAR unit (0..500 000). 0 disables the mechanism. */
  outorgaPrice: number;
  /** IPTU progressivo on vazios urbanos. */
  progressiveIptu: boolean;
  /** Monthly effort dedicated to regularização fundiária (0..100). */
  regularizationRate: number;
}
