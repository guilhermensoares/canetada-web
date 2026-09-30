/**
 * Procedural city generator — Modo Gerador de Cidades.
 *
 * Takes a human-readable seed string and derives a fully reproducible city:
 * name, population, economic scenario, fiscal starting point and tax rates.
 * Same seed ⇒ same city, always. Different seed ⇒ different city.
 *
 * The output is expressed as (scaleId, scenarioId, SandboxOverrides, name) so
 * it flows through the exact same start pipeline as the Sandbox mode — no new
 * plumbing needed downstream.
 */

import { hashSeed, mulberry32 } from "./rng";
import type { CityScaleId, ScenarioId, SandboxOverrides } from "./scenarios";

/** Brazilian-flavored name fragments. Mix & match for endless combos. */
const PREFIX = [
  "Vila", "Nova", "Santo", "Santa", "São", "Porto", "Serra", "Campo", "Alto",
  "Baixa", "Jardim", "Ribeirão", "Recanto", "Morro", "Boa", "Grande",
];
const CORE = [
  "Aurora", "Esperança", "Progresso", "das Palmeiras", "do Sertão", "da Mata",
  "Bandeirantes", "Guararema", "Iguaçu", "Piratininga", "Tijuca", "Ipiranga",
  "Cananéia", "Pindorama", "Caeté", "Tapajós", "do Vale", "das Águas",
  "Ceará-Mirim", "Itapecerica", "Paraíba", "Guaporé",
];
const SUFFIX = [
  "", "", "", "do Norte", "do Sul", "de Cima", "de Baixo", "Velho", "Novo",
  "do Oeste",
];

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickName(rng: () => number): string {
  const parts = [pick(rng, PREFIX), pick(rng, CORE), pick(rng, SUFFIX)];
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export interface GeneratedCity {
  name: string;
  scaleId: CityScaleId;
  scenarioId: ScenarioId;
  sandbox: SandboxOverrides;
  /** 1..5 — mirrors preset difficulty for UI badges. */
  difficulty: number;
}

/** Deterministic generator. Same seed → identical GeneratedCity. */
export function generateCityFromSeed(seed: string): GeneratedCity {
  // Fresh, self-contained RNG — never touches game state cursor.
  const rng = mulberry32(hashSeed(`city:${seed || "SEED"}`));

  // Population: log-uniform between 8k and 480k, so small towns are as likely
  // as metros without exploding the mean.
  const pop = Math.round(Math.exp(rng() * (Math.log(480_000) - Math.log(8_000)) + Math.log(8_000)));

  const scaleId: CityScaleId =
    pop < 25_000 ? "small" :
    pop < 80_000 ? "medium" :
    pop < 160_000 ? "large" : "metropolis";

  // Scenario weighted: stability common, recession/boom medium, hyperinflation rare.
  const r = rng();
  const scenarioId: ScenarioId =
    r < 0.15 ? "boom" :
    r < 0.65 ? "stability" :
    r < 0.92 ? "recession" : "hyperinflation";

  // Difficulty maps roughly from scenario + fiscal stress.
  const baseDiff =
    scenarioId === "boom" ? 1 :
    scenarioId === "stability" ? 2 :
    scenarioId === "recession" ? 4 : 5;

  // Treasury and debt scale with population but with wide variance.
  const treasuryPerCap = 8 + rng() * 30;                 // R$ 8–38 per resident
  const treasury = Math.round(pop * treasuryPerCap);
  const debtPerCap = rng() * 60;                          // R$ 0–60 per resident
  const debt = Math.round(pop * debtPerCap);

  // Macro indicators, correlated to scenario.
  const scenarioBias =
    scenarioId === "boom" ? { infl: 3, unemp: 5, hap: 72 } :
    scenarioId === "stability" ? { infl: 4.5, unemp: 8, hap: 62 } :
    scenarioId === "recession" ? { infl: 7, unemp: 13, hap: 48 } :
                                 { infl: 18, unemp: 17, hap: 38 };

  const inflation = +(scenarioBias.infl + (rng() - 0.5) * 3).toFixed(1);
  const unemployment = +(scenarioBias.unemp + (rng() - 0.5) * 4).toFixed(1);
  const happiness = Math.round(scenarioBias.hap + (rng() - 0.5) * 12);

  // Businesses proportional to pop, with rng jitter.
  const businesses = Math.max(30, Math.round(pop * (0.006 + rng() * 0.008)));

  // Taxes: sane defaults, small variance so no two cities feel identical.
  const taxIncome = +(10 + rng() * 6).toFixed(1);        // 10–16 %
  const taxProperty = +(4 + rng() * 4).toFixed(1);       // 4–8 %
  const taxBusiness = +(8 + rng() * 6).toFixed(1);       // 8–14 %

  const difficulty = Math.max(1, Math.min(5, baseDiff + (debtPerCap > 45 ? 1 : 0)));

  return {
    name: pickName(rng),
    scaleId,
    scenarioId,
    difficulty,
    sandbox: {
      population: pop,
      treasury,
      debt,
      inflation: Math.max(0.5, inflation),
      unemployment: Math.max(0.5, unemployment),
      happiness: Math.max(0, Math.min(100, happiness)),
      businesses,
      taxIncome,
      taxProperty,
      taxBusiness,
    },
  };
}
