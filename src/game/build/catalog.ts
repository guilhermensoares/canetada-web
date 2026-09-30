// Cities: Skylines 2-inspired build catalog, sized for our current sim.
// F1 deliverable: pure data. No placement/simulation yet — consumed by BuildPalette.
//
// Keeps the existing WebP art from src/game/spriteRegistry.ts. We do NOT
// migrate to SC2000 pixel-art per user's decision to keep current visuals.

export type BuildCategory =
  | "road"
  | "zone"
  | "power"
  | "water"
  | "education"
  | "health"
  | "safety"
  | "parks"
  | "research";

export type NetworkKind = "power" | "water" | "sewage";

export type BuildingDef = {
  id: string;
  category: Exclude<BuildCategory, "road" | "zone">;
  nameKey: string; // i18n key; falls back to `label`
  label: { pt: string; en: string };
  desc: { pt: string; en: string };
  spriteId?: string; // key into spriteRegistry (art we already ship)
  footprint: [w: number, h: number]; // in tiles
  cost: number;
  upkeep: number; // per month
  capacity?: number; // students, patients, MW, m³/s...
  coverageRadius?: number; // in tiles, for services with a walkable/effect radius
  requires: {
    power?: number; // MW consumed
    water?: number; // m³/s consumed
    road: boolean;
  };
  produces?: Partial<Record<NetworkKind, number>>;
  pollution?: { air: number; noise: number };
  maxSlope: number; // 0..1 normalised slope tolerance vs heightmap
};

export type RoadDef = {
  id: string;
  category: "road";
  label: { pt: string; en: string };
  desc: { pt: string; en: string };
  widthTiles: 1 | 2 | 3 | 4;
  speedKph: number;
  capacityVph: number; // vehicles/hour per direction
  costPerTile: number;
  upkeepPerTile: number;
  noise: number;
  carriesPower: boolean; // CS2-style: utilities run under most streets
  carriesWater: boolean;
  color: string; // swatch for palette
};

export type ZoneDef = {
  id: string;
  category: "zone";
  kind: "residential" | "commercial" | "industrial" | "office";
  density: "low" | "medium" | "high";
  label: { pt: string; en: string };
  desc: { pt: string; en: string };
  color: string;
};

export type CatalogEntry = BuildingDef | RoadDef | ZoneDef;

// ---------- Roads (F1: 6 tiers, CS2 hierarchy) ----------

export const ROADS: RoadDef[] = [
  {
    id: "road_dirt",
    category: "road",
    label: { pt: "Trilha de Terra", en: "Dirt Track" },
    desc: {
      pt: "Acesso rural barato. Sem energia/água. Empoeira em dias secos.",
      en: "Cheap rural access. No utilities. Dusty in dry season.",
    },
    widthTiles: 1,
    speedKph: 30,
    capacityVph: 200,
    costPerTile: 4,
    upkeepPerTile: 0.1,
    noise: 0.05,
    carriesPower: false,
    carriesWater: false,
    color: "#8a6a3a",
  },
  {
    id: "road_local",
    category: "road",
    label: { pt: "Rua Local", en: "Local Street" },
    desc: {
      pt: "Pavimentada, uma faixa por sentido. Carrega energia e água.",
      en: "Paved two-lane. Carries power and water.",
    },
    widthTiles: 2,
    speedKph: 40,
    capacityVph: 600,
    costPerTile: 12,
    upkeepPerTile: 0.4,
    noise: 0.1,
    carriesPower: true,
    carriesWater: true,
    color: "#8a8a8a",
  },
  {
    id: "road_collector",
    category: "road",
    label: { pt: "Via Coletora", en: "Collector Road" },
    desc: {
      pt: "Duas faixas por sentido, sinalização básica.",
      en: "Two lanes each way, basic signals.",
    },
    widthTiles: 2,
    speedKph: 60,
    capacityVph: 1400,
    costPerTile: 22,
    upkeepPerTile: 0.9,
    noise: 0.2,
    carriesPower: true,
    carriesWater: true,
    color: "#6f6f78",
  },
  {
    id: "road_avenue",
    category: "road",
    label: { pt: "Avenida", en: "Avenue" },
    desc: {
      pt: "Canteiro central, corredor arterial urbano.",
      en: "Median-divided arterial corridor.",
    },
    widthTiles: 3,
    speedKph: 70,
    capacityVph: 2400,
    costPerTile: 38,
    upkeepPerTile: 1.6,
    noise: 0.35,
    carriesPower: true,
    carriesWater: true,
    color: "#4b5563",
  },
  {
    id: "road_brt",
    category: "road",
    label: { pt: "Corredor BRT", en: "BRT Corridor" },
    desc: {
      pt: "Avenida com faixa exclusiva para ônibus articulados.",
      en: "Avenue with dedicated articulated-bus lane.",
    },
    widthTiles: 4,
    speedKph: 60,
    capacityVph: 2600,
    costPerTile: 55,
    upkeepPerTile: 2.4,
    noise: 0.4,
    carriesPower: true,
    carriesWater: true,
    color: "#c2410c",
  },
  {
    id: "road_highway",
    category: "road",
    label: { pt: "Autoestrada", en: "Highway" },
    desc: {
      pt: "Fluxo livre, sem acesso direto às zonas. Não carrega utilidades.",
      en: "Free-flow, no direct zone access. No utilities.",
    },
    widthTiles: 4,
    speedKph: 110,
    capacityVph: 4200,
    costPerTile: 90,
    upkeepPerTile: 3.2,
    noise: 0.6,
    carriesPower: false,
    carriesWater: false,
    color: "#1f2937",
  },
];

// ---------- Zones (RCI + office, densities) ----------

export const ZONES: ZoneDef[] = [
  {
    id: "zone_r_low",
    category: "zone",
    kind: "residential",
    density: "low",
    label: { pt: "Residencial Baixa", en: "Low-Density Residential" },
    desc: { pt: "Casas geminadas e sobrados.", en: "Detached houses and duplexes." },
    color: "#22c55e",
  },
  {
    id: "zone_r_med",
    category: "zone",
    kind: "residential",
    density: "medium",
    label: { pt: "Residencial Média", en: "Mid-Density Residential" },
    desc: { pt: "Prédios de 4-8 andares, corredor comum.", en: "4-8 storey walk-ups." },
    color: "#16a34a",
  },
  {
    id: "zone_r_high",
    category: "zone",
    kind: "residential",
    density: "high",
    label: { pt: "Residencial Alta", en: "High-Density Residential" },
    desc: { pt: "Torres residenciais com elevador.", en: "Residential towers." },
    color: "#166534",
  },
  {
    id: "zone_c_low",
    category: "zone",
    kind: "commercial",
    density: "low",
    label: { pt: "Comércio Local", en: "Low-Density Commercial" },
    desc: { pt: "Padarias, mercadinhos, salão de cabeleireiro.", en: "Corner shops and services." },
    color: "#3b82f6",
  },
  {
    id: "zone_c_high",
    category: "zone",
    kind: "commercial",
    density: "high",
    label: { pt: "Comércio Adensado", en: "High-Density Commercial" },
    desc: { pt: "Galerias, shoppings, grandes redes.", en: "Malls and big-box retail." },
    color: "#1d4ed8",
  },
  {
    id: "zone_i_light",
    category: "zone",
    kind: "industrial",
    density: "low",
    label: { pt: "Indústria Leve", en: "Light Industry" },
    desc: { pt: "Galpões, oficinas, logística last-mile.", en: "Warehouses and light manufacturing." },
    color: "#eab308",
  },
  {
    id: "zone_i_heavy",
    category: "zone",
    kind: "industrial",
    density: "high",
    label: { pt: "Indústria Pesada", en: "Heavy Industry" },
    desc: { pt: "Fundições, químicas — polui e paga bem em ISS/IPTU.", en: "Foundries and chemicals — pollutes but pays." },
    color: "#a16207",
  },
  {
    id: "zone_office",
    category: "zone",
    kind: "office",
    density: "medium",
    label: { pt: "Escritórios", en: "Office" },
    desc: { pt: "Coworking, escritórios, serviços B2B.", en: "Offices and B2B services." },
    color: "#8b5cf6",
  },
];

// ---------- Service buildings ----------

export const BUILDINGS: BuildingDef[] = [
  // Power
  {
    id: "pw_coal",
    category: "power",
    nameKey: "b_coal",
    label: { pt: "Usina a Carvão", en: "Coal Power Plant" },
    desc: { pt: "Barata, muita energia, muita fuligem.", en: "Cheap, high output, dirty." },
    spriteId: "industry_factory",
    footprint: [4, 4],
    cost: 12000,
    upkeep: 320,
    capacity: 400, // MW
    requires: { water: 2, road: true },
    produces: { power: 400 },
    pollution: { air: 0.9, noise: 0.6 },
    maxSlope: 0.15,
  },
  {
    id: "pw_gas",
    category: "power",
    nameKey: "b_gas",
    label: { pt: "Termelétrica a Gás", en: "Gas Power Plant" },
    desc: { pt: "Meio-termo entre custo e poluição.", en: "Mid cost, mid pollution." },
    spriteId: "industry_factory",
    footprint: [3, 3],
    cost: 18000,
    upkeep: 450,
    capacity: 300,
    requires: { water: 1, road: true },
    produces: { power: 300 },
    pollution: { air: 0.5, noise: 0.4 },
    maxSlope: 0.15,
  },
  {
    id: "pw_solar",
    category: "power",
    nameKey: "b_solar",
    label: { pt: "Parque Solar", en: "Solar Farm" },
    desc: { pt: "Limpa mas depende do dia e ocupa muito espaço.", en: "Clean, daytime-only, land-hungry." },
    spriteId: "industry_factory",
    footprint: [5, 5],
    cost: 22000,
    upkeep: 90,
    capacity: 180,
    requires: { road: true },
    produces: { power: 180 },
    pollution: { air: 0, noise: 0 },
    maxSlope: 0.1,
  },
  {
    id: "pw_wind",
    category: "power",
    nameKey: "b_wind",
    label: { pt: "Parque Eólico", en: "Wind Farm" },
    desc: { pt: "Barulhinho constante, adora litoral e cume.", en: "Coast/ridge friendly, low-hum noise." },
    spriteId: "industry_factory",
    footprint: [3, 6],
    cost: 26000,
    upkeep: 120,
    capacity: 140,
    requires: { road: true },
    produces: { power: 140 },
    pollution: { air: 0, noise: 0.2 },
    maxSlope: 0.25,
  },

  // Water
  {
    id: "wt_intake",
    category: "water",
    nameKey: "b_intake",
    label: { pt: "Captação de Água", en: "Water Intake" },
    desc: { pt: "Puxa da represa/rio. Precisa energia.", en: "Pumps from river/reservoir." },
    spriteId: "water_plant",
    footprint: [3, 3],
    cost: 9000,
    upkeep: 180,
    capacity: 8, // m³/s
    requires: { power: 30, road: true },
    produces: { water: 8 },
    pollution: { air: 0, noise: 0.1 },
    maxSlope: 0.1,
  },
  {
    id: "wt_sewage",
    category: "water",
    nameKey: "b_sewage",
    label: { pt: "Estação de Tratamento", en: "Sewage Treatment" },
    desc: { pt: "Devolve esgoto tratado ao rio.", en: "Treats sewage before outflow." },
    spriteId: "water_plant",
    footprint: [4, 3],
    cost: 14000,
    upkeep: 260,
    capacity: 10,
    requires: { power: 50, road: true },
    produces: { sewage: 10 },
    pollution: { air: 0.1, noise: 0.2 },
    maxSlope: 0.1,
  },

  // Education
  {
    id: "ed_elem",
    category: "education",
    nameKey: "b_elem",
    label: { pt: "Escola Fundamental", en: "Elementary School" },
    desc: { pt: "6-14 anos. Cobertura local.", en: "Ages 6-14. Neighbourhood-scale." },
    spriteId: "school",
    footprint: [2, 2],
    cost: 3200,
    upkeep: 140,
    capacity: 800,
    coverageRadius: 14,
    requires: { power: 8, water: 0.3, road: true },
    pollution: { air: 0, noise: 0.1 },
    maxSlope: 0.15,
  },
  {
    id: "ed_high",
    category: "education",
    nameKey: "b_high",
    label: { pt: "Escola de Ensino Médio", en: "High School" },
    desc: { pt: "15-17 anos. Cobre bairros vizinhos.", en: "Ages 15-17. Covers adjacent neighbourhoods." },
    spriteId: "school",
    footprint: [3, 3],
    cost: 6800,
    upkeep: 240,
    capacity: 1400,
    coverageRadius: 22,
    requires: { power: 14, water: 0.6, road: true },
    pollution: { air: 0, noise: 0.15 },
    maxSlope: 0.15,
  },
  {
    id: "ed_univ",
    category: "education",
    nameKey: "b_univ",
    label: { pt: "Universidade", en: "University" },
    desc: { pt: "Ensino superior. Atrai talento e brain gain.", en: "Higher-ed. Attracts talent, curbs brain drain." },
    spriteId: "university",
    footprint: [5, 4],
    cost: 22000,
    upkeep: 720,
    capacity: 4200,
    coverageRadius: 40,
    requires: { power: 40, water: 1.5, road: true },
    pollution: { air: 0, noise: 0.2 },
    maxSlope: 0.15,
  },

  // Health
  {
    id: "hl_clinic",
    category: "health",
    nameKey: "b_clinic",
    label: { pt: "UBS", en: "Clinic" },
    desc: { pt: "Atenção primária. Baixo custo, alta cobertura.", en: "Primary care. Cheap and wide-reaching." },
    spriteId: "hospital",
    footprint: [2, 2],
    cost: 4200,
    upkeep: 180,
    capacity: 900,
    coverageRadius: 16,
    requires: { power: 12, water: 0.5, road: true },
    pollution: { air: 0, noise: 0.05 },
    maxSlope: 0.15,
  },
  {
    id: "hl_hospital",
    category: "health",
    nameKey: "b_hospital",
    label: { pt: "Hospital", en: "Hospital" },
    desc: { pt: "Emergência 24h. Consome muita utilidade.", en: "24/7 ER. Utility-heavy." },
    spriteId: "hospital",
    footprint: [4, 4],
    cost: 18000,
    upkeep: 620,
    capacity: 2600,
    coverageRadius: 28,
    requires: { power: 50, water: 2, road: true },
    pollution: { air: 0.05, noise: 0.2 },
    maxSlope: 0.15,
  },

  // Safety
  {
    id: "sf_police",
    category: "safety",
    nameKey: "b_police",
    label: { pt: "Delegacia", en: "Police Station" },
    desc: { pt: "Cobre o entorno contra criminalidade.", en: "Coverage against crime in the surrounding area." },
    spriteId: "police",
    footprint: [2, 2],
    cost: 3800,
    upkeep: 160,
    capacity: 40,
    coverageRadius: 20,
    requires: { power: 10, water: 0.3, road: true },
    pollution: { air: 0, noise: 0.1 },
    maxSlope: 0.15,
  },
  {
    id: "sf_fire",
    category: "safety",
    nameKey: "b_fire",
    label: { pt: "Corpo de Bombeiros", en: "Fire Station" },
    desc: { pt: "Reduz danos por incêndio no raio de ação.", en: "Cuts fire damage in radius." },
    spriteId: "fire_station",
    footprint: [2, 2],
    cost: 4200,
    upkeep: 180,
    capacity: 6,
    coverageRadius: 22,
    requires: { power: 10, water: 0.4, road: true },
    pollution: { air: 0, noise: 0.1 },
    maxSlope: 0.15,
  },
  {
    id: "sf_post",
    category: "safety",
    nameKey: "b_post",
    label: { pt: "Agência dos Correios", en: "Post Office" },
    desc: { pt: "Serviço de correspondência local.", en: "Local mail service." },
    spriteId: "school",
    footprint: [1, 2],
    cost: 1600,
    upkeep: 60,
    capacity: 3000,
    coverageRadius: 18,
    requires: { power: 4, water: 0.1, road: true },
    pollution: { air: 0, noise: 0.05 },
    maxSlope: 0.2,
  },

  // Parks
  {
    id: "pk_praca",
    category: "parks",
    nameKey: "b_praca",
    label: { pt: "Praça", en: "Plaza" },
    desc: { pt: "Aumenta valor da terra e bem-estar.", en: "Boosts land value and wellbeing." },
    spriteId: "park",
    footprint: [2, 2],
    cost: 900,
    upkeep: 20,
    coverageRadius: 8,
    requires: { water: 0.1, road: true },
    pollution: { air: -0.05, noise: -0.1 },
    maxSlope: 0.2,
  },
  {
    id: "pk_parque",
    category: "parks",
    nameKey: "b_parque",
    label: { pt: "Parque Urbano", en: "Urban Park" },
    desc: { pt: "Pulmão do bairro. Cobre grande área.", en: "Neighbourhood lung." },
    spriteId: "park",
    footprint: [4, 4],
    cost: 4200,
    upkeep: 90,
    coverageRadius: 18,
    requires: { water: 0.4, road: true },
    pollution: { air: -0.15, noise: -0.2 },
    maxSlope: 0.2,
  },

  // Research
  {
    id: "rs_center",
    category: "research",
    nameKey: "b_research",
    label: { pt: "Centro de Pesquisa", en: "Research Center" },
    desc: { pt: "Destrava upgrades tecnológicos ao longo do jogo.", en: "Unlocks tech upgrades over time." },
    spriteId: "university",
    footprint: [3, 3],
    cost: 15000,
    upkeep: 380,
    capacity: 200,
    coverageRadius: 30,
    requires: { power: 30, water: 1, road: true },
    pollution: { air: 0, noise: 0.1 },
    maxSlope: 0.15,
  },
];

// ---------- Grouped view for the palette UI ----------

export type PaletteGroup = {
  id: BuildCategory;
  label: { pt: string; en: string };
  entries: CatalogEntry[];
};

export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: "road",
    label: { pt: "Ruas", en: "Roads" },
    entries: ROADS,
  },
  {
    id: "zone",
    label: { pt: "Zonas", en: "Zones" },
    entries: ZONES,
  },
  {
    id: "power",
    label: { pt: "Energia", en: "Power" },
    entries: BUILDINGS.filter((b) => b.category === "power"),
  },
  {
    id: "water",
    label: { pt: "Água", en: "Water" },
    entries: BUILDINGS.filter((b) => b.category === "water"),
  },
  {
    id: "education",
    label: { pt: "Educação", en: "Education" },
    entries: BUILDINGS.filter((b) => b.category === "education"),
  },
  {
    id: "health",
    label: { pt: "Saúde", en: "Health" },
    entries: BUILDINGS.filter((b) => b.category === "health"),
  },
  {
    id: "safety",
    label: { pt: "Segurança", en: "Safety" },
    entries: BUILDINGS.filter((b) => b.category === "safety"),
  },
  {
    id: "parks",
    label: { pt: "Parques", en: "Parks" },
    entries: BUILDINGS.filter((b) => b.category === "parks"),
  },
  {
    id: "research",
    label: { pt: "Pesquisa", en: "Research" },
    entries: BUILDINGS.filter((b) => b.category === "research"),
  },
];

export function isRoad(e: CatalogEntry): e is RoadDef {
  return e.category === "road";
}
export function isZone(e: CatalogEntry): e is ZoneDef {
  return e.category === "zone";
}
export function isBuilding(e: CatalogEntry): e is BuildingDef {
  return !isRoad(e) && !isZone(e);
}

export function entryCost(e: CatalogEntry): number {
  if (isRoad(e)) return e.costPerTile;
  if (isZone(e)) return 0;
  return e.cost;
}
