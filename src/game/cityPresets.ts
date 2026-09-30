/**
 * cityPresets.ts
 * ----------------------------------------------------------------
 * Configurações iniciais das 6 cidades jogáveis da Região
 * Metropolitana da Grande Santo Paulo (inspiração: Capital + ABC).
 *
 * Este arquivo é a fonte-de-verdade para METADADOS SOCIOURBANOS
 * das cidades (envelhecimento, base industrial, transporte,
 * risco de informalidade, congestionamento). Os overrides
 * numéricos da simulação (impostos, políticas, tesouro, etc.)
 * vivem em `./presets.ts` e são consumidos por `logic.ts` via
 * `findPreset()`. Os IDs abaixo são idênticos aos de `presets.ts`
 * para que a UI possa cruzar as duas tabelas 1:1.
 * ----------------------------------------------------------------
 */

export type TransitType = "metro_rail_heavy" | "bus_only" | "rail_dependent";

export type IndustrialBase =
  | "chemical"
  | "automotive"
  | "petrochemical"
  | "corporate_services"
  | "retail_services"
  | "logistics"
  | "auto_parts"
  | "tech_innovation"
  | "informal_commerce";

export interface City {
  id: string;
  name: string;
  slogan: string;
  initialBudget: number;
  population: number;
  /** Índice de envelhecimento populacional, 0 (jovem) a 100 (idoso). */
  agingIndex: number;
  /** Setores dominantes da economia local. */
  industrialBaseType: IndustrialBase[];
  transitType: TransitType;
  /** Risco de expansão de favelas / ocupações informais, 0.0 a 1.0. */
  informalSettlementRisk: number;
  /** Congestionamento veicular basal, 0.0 (fluido) a 1.0 (parado). */
  trafficCongestionBase: number;
}

export const CITIES: City[] = [
  {
    id: "santo_paulo",
    name: "Santo Paulo",
    slogan: "O coração pulsante da metrópole.",
    initialBudget: -220_000,
    population: 240_000,
    agingIndex: 48,
    industrialBaseType: ["corporate_services", "retail_services", "tech_innovation", "informal_commerce"],
    transitType: "metro_rail_heavy",
    informalSettlementRisk: 0.72,
    trafficCongestionBase: 0.88,
  },
  {
    id: "santo_caetano_norte",
    name: "Santo Caetano do Norte",
    slogan: "O berço da indústria e da inovação.",
    initialBudget: 1_450_000,
    population: 16_500,
    agingIndex: 78,
    industrialBaseType: ["corporate_services", "tech_innovation", "retail_services"],
    transitType: "bus_only",
    informalSettlementRisk: 0.08,
    trafficCongestionBase: 0.42,
  },
  {
    id: "santo_bernardo_field",
    name: "Santo Bernardo do Field",
    slogan: "A força do trabalho e do progresso.",
    initialBudget: 480_000,
    population: 118_000,
    agingIndex: 44,
    industrialBaseType: ["automotive", "auto_parts", "logistics"],
    transitType: "bus_only",
    informalSettlementRisk: 0.66,
    trafficCongestionBase: 0.78,
  },
  {
    id: "sao_andre",
    name: "São André",
    slogan: "O futuro se constrói aqui.",
    initialBudget: 620_000,
    population: 62_000,
    agingIndex: 62,
    industrialBaseType: ["retail_services", "auto_parts", "corporate_services"],
    transitType: "rail_dependent",
    informalSettlementRisk: 0.38,
    trafficCongestionBase: 0.58,
  },
  {
    id: "noitedema",
    name: "Noitedema",
    slogan: "Onde a tradição encontra a modernidade.",
    initialBudget: 180_000,
    population: 92_000,
    agingIndex: 40,
    industrialBaseType: ["chemical", "logistics", "informal_commerce"],
    transitType: "bus_only",
    informalSettlementRisk: 0.85,
    trafficCongestionBase: 0.70,
  },
  {
    id: "bemua",
    name: "Bemuá",
    slogan: "O polo que impulsiona a região.",
    initialBudget: 260_000,
    population: 78_000,
    agingIndex: 36,
    industrialBaseType: ["petrochemical", "logistics"],
    transitType: "rail_dependent",
    informalSettlementRisk: 0.74,
    trafficCongestionBase: 0.55,
  },
];

export function findCity(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}

/** IDs da região, na ordem canônica de exibição. */
export const METRO_CITY_IDS: readonly string[] = CITIES.map((c) => c.id);
