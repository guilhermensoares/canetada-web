import type { GameState, GameEventDef, GameEventChoice } from "./types";

/**
 * Procedural event generator.
 *
 * Combines:
 *   - Archetypes (weighted by current city state)
 *   - Severity tier (minor / major / critical) → scales cost and effects
 *   - Context tokens (districts, companies, numbers) → varied narrative
 *
 * Text is produced inline as "PT||EN" strings and rendered via t() which
 * detects the "||" separator, so no dictionary key is needed per event.
 */

type RNG = () => number;

const DISTRICTS = [
  "Centro", "Vila Nova", "Jardim Aurora", "Portal Norte", "Alto da Serra",
  "Beira-Rio", "Setor Industrial", "Bosque Sul", "Cidade Alta", "Parque das Águas",
];
const DISTRICTS_EN = [
  "Downtown", "New Village", "Aurora Gardens", "North Gate", "Highland",
  "Riverside", "Industrial Zone", "South Woods", "Uptown", "Waters Park",
];
const COMPANIES = ["TechNova", "AgroSul", "MetalBrasa", "HidroMax", "LogiVia", "PetroGrão", "BioVerde", "UrbanRail"];

type Severity = "minor" | "major" | "critical";
const SEV_SCALE: Record<Severity, number> = { minor: 0.6, major: 1, critical: 1.7 };

function pick<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function pickIdx(rng: RNG, len: number): number {
  return Math.floor(rng() * len);
}
function money(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}
function costLabel(base: number): string {
  return `-${money(base)}`;
}

interface Archetype {
  id: string;
  kind: "info" | "warning" | "danger" | "success";
  /** Weight given current state; return 0 to skip. */
  weight: (s: GameState) => number;
  build: (s: GameState, sev: Severity, rng: RNG) => GameEventDef;
}

/* ---------- helpers to build a two-choice event ---------- */

function twoChoice(
  id: string,
  kind: Archetype["kind"],
  title: [string, string],
  desc: [string, string],
  choices: [GameEventChoice, GameEventChoice],
): GameEventDef {
  return {
    id,
    kind,
    weight: 1,
    titleKey: `${title[0]}||${title[1]}`,
    descriptionKey: `${desc[0]}||${desc[1]}`,
    choices: choices.map((c) => ({
      ...c,
      labelKey: c.labelKey,
      resultKey: c.resultKey,
    })),
  };
}

/* ---------- archetypes ---------- */

const ARCHETYPES: Archetype[] = [
  // 1. Infrastructure failure — water/energy stress
  {
    id: "infra_failure",
    kind: "danger",
    weight: (s) => {
      const water = s.waterDemand / Math.max(1, s.infra.waterCapacity);
      const energy = s.energyDemand / Math.max(1, s.infra.energyCapacity);
      return Math.max(water, energy) > 0.85 ? 2.2 : 0.4;
    },
    build: (s, sev, rng) => {
      const isWater = s.waterDemand / s.infra.waterCapacity >= s.energyDemand / s.infra.energyCapacity;
      const scale = SEV_SCALE[sev];
      const cost = Math.round(70_000 * scale);
      const capBoost = isWater ? Math.round(30 * scale) : Math.round(50 * scale);
      const d = pickIdx(rng, DISTRICTS.length);
      const tag = isWater
        ? [`Colapso hídrico em ${DISTRICTS[d]}`, `Water outage in ${DISTRICTS_EN[d]}`] as [string, string]
        : [`Sobrecarga elétrica em ${DISTRICTS[d]}`, `Grid overload in ${DISTRICTS_EN[d]}`] as [string, string];
      const desc = isWater
        ? [
            `Reservatórios operam no limite. Moradores relatam falta de água.`,
            `Reservoirs at their limit. Residents report shortages.`,
          ] as [string, string]
        : [
            `Subestação sobrecarregada provoca quedas. Empresas paralisadas.`,
            `Overloaded substation causes blackouts. Businesses halted.`,
          ] as [string, string];
      return twoChoice("infra_failure", "danger", tag, desc, [
        {
          labelKey: `Obras emergenciais (${costLabel(cost)})||Emergency works (${costLabel(cost)})`,
          resultKey: `Serviço restabelecido em dias.||Service restored within days.`,
          cost,
          effects: isWater
            ? { waterCapacity: capBoost, happiness: 3, approval: 4 }
            : { energyCapacity: capBoost, businesses: 6, approval: 4 },
        },
        {
          labelKey: `Adiar decisão||Delay the decision`,
          resultKey: `Crise se aprofunda.||Crisis deepens.`,
          effects: {
            happiness: -Math.round(8 * scale),
            approval: -Math.round(10 * scale),
            businesses: isWater ? 0 : -Math.round(15 * scale),
          },
        },
      ]);
    },
  },

  // 2. Labor strike — pressured by unemployment or low policy funding
  {
    id: "labor_strike",
    kind: "warning",
    weight: (s) => (s.unemployment > 9 || s.policies.transport < 40 ? 1.6 : 0.9),
    build: (s, sev, rng) => {
      const sector = pick(rng, [
        ["motoristas de ônibus", "bus drivers"],
        ["agentes de saúde", "health workers"],
        ["professores", "teachers"],
        ["garis", "sanitation crews"],
      ]);
      const scale = SEV_SCALE[sev];
      const cost = Math.round(90_000 * scale);
      return twoChoice("labor_strike", "warning",
        [`Greve dos ${sector[0]}`, `${sector[1]} strike`],
        [
          `Sindicato exige reajuste após meses de negociação.`,
          `Union demands raises after months of talks.`,
        ],
        [
          {
            labelKey: `Conceder reajuste (${costLabel(cost)})||Grant raise (${costLabel(cost)})`,
            resultKey: `Serviços retomam normalmente.||Services resume.`,
            cost,
            effects: { happiness: Math.round(4 * scale), approval: Math.round(3 * scale) },
          },
          {
            labelKey: `Manter posição||Hold the line`,
            resultKey: `Impasse desgasta o governo.||Standoff wears down the mayor.`,
            effects: {
              happiness: -Math.round(7 * scale),
              approval: -Math.round(9 * scale),
              unemployment: Math.round(0.4 * scale * 10) / 10,
            },
          },
        ]);
    },
  },

  // 3. Corporate investment offer
  {
    id: "corp_offer",
    kind: "info",
    weight: (s) => (s.taxes.business < 20 && s.approval > 35 ? 1.3 : 0.6),
    build: (s, sev, rng) => {
      const co = pick(rng, COMPANIES);
      const d = pickIdx(rng, DISTRICTS.length);
      const scale = SEV_SCALE[sev];
      const jobs = Math.round(80 * scale);
      const bizGain = Math.round(30 * scale);
      const incentive = Math.round(50_000 * scale);
      return twoChoice("corp_offer", "info",
        [`${co} avalia ${DISTRICTS[d]}`, `${co} eyes ${DISTRICTS_EN[d]}`],
        [
          `A empresa promete gerar cerca de ${jobs} empregos, mas pede incentivo fiscal.`,
          `Company promises roughly ${jobs} jobs but wants a tax break.`,
        ],
        [
          {
            labelKey: `Aprovar incentivo (${costLabel(incentive)})||Approve incentive (${costLabel(incentive)})`,
            resultKey: `${co} inicia obras.||${co} breaks ground.`,
            cost: incentive,
            effects: {
              businesses: bizGain,
              unemployment: -Math.round(0.8 * scale * 10) / 10,
              approval: Math.round(2 * scale),
            },
          },
          {
            labelKey: `Recusar||Decline`,
            resultKey: `${co} escolhe cidade vizinha.||${co} picks a rival city.`,
            effects: { approval: -Math.round(3 * scale), businesses: -Math.round(4 * scale) },
          },
        ]);
    },
  },

  // 4. Public health outbreak — triggered by low health funding
  {
    id: "health_outbreak",
    kind: "danger",
    weight: (s) => (s.policies.health < 55 ? 1.8 : 0.7),
    build: (s, sev, rng) => {
      const disease = pick(rng, [
        ["dengue", "dengue"],
        ["gripe H3", "H3 flu"],
        ["gastroenterite", "gastroenteritis"],
      ]);
      const scale = SEV_SCALE[sev];
      const cost = Math.round(80_000 * scale);
      return twoChoice("health_outbreak", "danger",
        [`Surto de ${disease[0]}`, `${disease[1]} outbreak`],
        [
          `Postos de saúde lotados. Especialistas pedem campanha imediata.`,
          `Clinics overwhelmed. Experts urge immediate response.`,
        ],
        [
          {
            labelKey: `Mobilização sanitária (${costLabel(cost)})||Health mobilization (${costLabel(cost)})`,
            resultKey: `Casos sob controle em semanas.||Cases contained within weeks.`,
            cost,
            effects: { happiness: Math.round(4 * scale), approval: Math.round(5 * scale) },
          },
          {
            labelKey: `Somente comunicado oficial||Public advisory only`,
            resultKey: `Surto se alastra pela cidade.||Outbreak spreads city-wide.`,
            effects: {
              happiness: -Math.round(9 * scale),
              approval: -Math.round(8 * scale),
              population: -Math.round(120 * scale),
            },
          },
        ]);
    },
  },

  // 5. Corruption probe — triggered by low approval or high spending
  {
    id: "corruption",
    kind: "warning",
    weight: (s) => (s.approval < 50 ? 1.4 : 0.8),
    build: (_s, sev, rng) => {
      const dept = pick(rng, [
        ["Secretaria de Obras", "Public Works"],
        ["Secretaria de Transporte", "Transport Dept."],
        ["Fundação Cultural", "Cultural Foundation"],
      ]);
      const scale = SEV_SCALE[sev];
      const amount = Math.round(120_000 * scale);
      return twoChoice("corruption", "warning",
        [`Suspeita na ${dept[0]}`, `Probe at ${dept[1]}`],
        [
          `Imprensa aponta indícios de desvio de R$ ${money(amount)}.`,
          `Press alleges misuse of $${money(amount)} in funds.`,
        ],
        [
          {
            labelKey: `Abrir investigação independente||Open independent probe`,
            resultKey: `Transparência restaura confiança.||Transparency restores trust.`,
            effects: { approval: Math.round(6 * scale), happiness: Math.round(2 * scale) },
          },
          {
            labelKey: `Negar e processar imprensa||Deny and sue the press`,
            resultKey: `Escândalo explode nas redes.||Scandal explodes online.`,
            effects: {
              approval: -Math.round(14 * scale),
              happiness: -Math.round(5 * scale),
            },
          },
        ]);
    },
  },

  // 6. Migration wave
  {
    id: "migration",
    kind: "info",
    weight: (s) => (s.happiness > 55 ? 1.2 : 0.6),
    build: (_s, sev, rng) => {
      const scale = SEV_SCALE[sev];
      const families = Math.round(400 * scale);
      const cost = Math.round(60_000 * scale);
      const origin = pick(rng, [
        ["do interior", "from the countryside"],
        ["da região metropolitana", "from the metro area"],
        ["de outro estado", "from another state"],
      ]);
      return twoChoice("migration", "info",
        [`Onda migratória ${origin[0]}`, `Migration wave ${origin[1]}`],
        [
          `Cerca de ${families} famílias buscam moradia na cidade.`,
          `About ${families} families seek housing.`,
        ],
        [
          {
            labelKey: `Programa de acolhimento (${costLabel(cost)})||Welcome program (${costLabel(cost)})`,
            resultKey: `População cresce de forma integrada.||City grows with integration.`,
            cost,
            effects: {
              population: families * 3,
              approval: Math.round(3 * scale),
              happiness: Math.round(2 * scale),
            },
          },
          {
            labelKey: `Restringir acesso||Restrict access`,
            resultKey: `Imagem da cidade é manchada.||City image suffers.`,
            effects: { approval: -Math.round(5 * scale), happiness: -Math.round(3 * scale) },
          },
        ]);
    },
  },

  // 7. Natural disaster
  {
    id: "disaster",
    kind: "danger",
    weight: () => 0.9,
    build: (_s, sev, rng) => {
      const [ev_pt, ev_en] = pick(rng, [
        ["Enchente", "Flood"],
        ["Deslizamento", "Landslide"],
        ["Tempestade de granizo", "Hailstorm"],
        ["Ventania destrutiva", "Windstorm"],
      ]);
      const d = pickIdx(rng, DISTRICTS.length);
      const scale = SEV_SCALE[sev];
      const cost = Math.round(100_000 * scale);
      return twoChoice("disaster", "danger",
        [`${ev_pt} em ${DISTRICTS[d]}`, `${ev_en} in ${DISTRICTS_EN[d]}`],
        [
          `Defesa Civil pede recursos para socorro imediato.`,
          `Civil defense requests immediate relief funds.`,
        ],
        [
          {
            labelKey: `Liberar fundo emergencial (${costLabel(cost)})||Release emergency fund (${costLabel(cost)})`,
            resultKey: `Danos contidos, moradores agradecem.||Damage contained, residents grateful.`,
            cost,
            effects: { happiness: Math.round(4 * scale), approval: Math.round(6 * scale) },
          },
          {
            labelKey: `Prometer estudo técnico||Promise a technical study`,
            resultKey: `Popularidade despenca.||Approval tanks.`,
            effects: {
              happiness: -Math.round(10 * scale),
              approval: -Math.round(12 * scale),
              population: -Math.round(60 * scale),
            },
          },
        ]);
    },
  },

  // 8. Inflation shock
  {
    id: "inflation_shock",
    kind: "warning",
    weight: (s) => (s.inflation > 5 ? 1.5 : 0.5),
    build: (_s, sev) => {
      const scale = SEV_SCALE[sev];
      const cost = Math.round(60_000 * scale);
      return twoChoice("inflation_shock", "warning",
        [`Alta no custo de vida`, `Cost-of-living surge`],
        [
          `Preços de alimentos e combustíveis disparam. Consumidores pressionam.`,
          `Food and fuel prices spike. Consumers pressure city hall.`,
        ],
        [
          {
            labelKey: `Vale-alimentação municipal (${costLabel(cost)})||City food voucher (${costLabel(cost)})`,
            resultKey: `Alívio temporário, humor melhora.||Temporary relief, mood improves.`,
            cost,
            effects: { happiness: Math.round(5 * scale), approval: Math.round(4 * scale), inflation: -0.3 },
          },
          {
            labelKey: `Não intervir||Do nothing`,
            resultKey: `Insatisfação cresce.||Discontent grows.`,
            effects: { happiness: -Math.round(6 * scale), approval: -Math.round(5 * scale) },
          },
        ]);
    },
  },

  // 9. Cultural / positive
  {
    id: "cultural",
    kind: "info",
    weight: (s) => (s.treasury > 300_000 ? 1 : 0.4),
    build: (_s, sev, rng) => {
      const [ev_pt, ev_en] = pick(rng, [
        ["Festival gastronômico", "Food festival"],
        ["Feira de tecnologia", "Tech fair"],
        ["Mostra de cinema", "Film showcase"],
        ["Copa amadora", "Amateur cup"],
      ]);
      const scale = SEV_SCALE[sev];
      const cost = Math.round(35_000 * scale);
      return twoChoice("cultural", "info",
        [ev_pt, ev_en],
        [
          `Produtores locais propõem parceria para atrair turismo.`,
          `Local producers propose a partnership to attract tourism.`,
        ],
        [
          {
            labelKey: `Patrocinar (${costLabel(cost)})||Sponsor (${costLabel(cost)})`,
            resultKey: `Turismo aquece a economia.||Tourism warms the economy.`,
            cost,
            effects: {
              happiness: Math.round(5 * scale),
              approval: Math.round(2 * scale),
              businesses: Math.round(8 * scale),
            },
          },
          {
            labelKey: `Ignorar||Ignore`,
            resultKey: `Oportunidade perdida.||Opportunity missed.`,
            effects: { happiness: -1 },
          },
        ]);
    },
  },

  // 10. Debt / creditor pressure
  {
    id: "creditor",
    kind: "warning",
    weight: (s) => (s.debt > 500_000 ? 1.6 : 0.2),
    build: (s, sev) => {
      const scale = SEV_SCALE[sev];
      const payment = Math.min(s.debt, Math.round(150_000 * scale));
      return twoChoice("creditor", "warning",
        [`Pressão dos credores`, `Creditor pressure`],
        [
          `Agências avaliam rebaixar o rating fiscal da cidade.`,
          `Rating agencies threaten to downgrade the city.`,
        ],
        [
          {
            labelKey: `Antecipar pagamento (${costLabel(payment)})||Pay down debt (${costLabel(payment)})`,
            resultKey: `Rating estabilizado.||Rating stabilized.`,
            cost: payment,
            effects: { debt: -payment, approval: 2 },
          },
          {
            labelKey: `Renegociar prazos||Renegotiate terms`,
            resultKey: `Juros sobem no médio prazo.||Interest rises in the medium term.`,
            effects: { debt: Math.round(60_000 * scale), inflation: 0.2 },
          },
        ]);
    },
  },
];

/* ---------- top-level API ---------- */

function chooseSeverity(rng: RNG, s: GameState): Severity {
  // Cities under stress get harsher events.
  const stress = stressScore(s);
  const roll = rng() * 100;
  if (roll < 55) return "minor";
  if (roll < 85 + Math.min(10, stress * 0.05)) return "major";
  return "critical";
}

/* ---------- introspection (debug view) ---------- */

export interface StressBreakdown {
  happiness: number;
  water: number;
  energy: number;
  inflation: number;
  total: number;
}

export function stressBreakdown(s: GameState): StressBreakdown {
  const happiness = (100 - s.happiness) * 0.4;
  const water = Math.max(0, s.waterDemand / s.infra.waterCapacity - 1) * 60;
  const energy = Math.max(0, s.energyDemand / s.infra.energyCapacity - 1) * 60;
  const inflation = Math.max(0, s.inflation - 4) * 5;
  return { happiness, water, energy, inflation, total: happiness + water + energy + inflation };
}

export function stressScore(s: GameState): number {
  return stressBreakdown(s).total;
}

export interface SeverityProbabilities {
  minor: number;
  major: number;
  critical: number;
}

export function severityProbabilities(s: GameState): SeverityProbabilities {
  const stress = stressScore(s);
  const majorCut = 85 + Math.min(10, stress * 0.05);
  const minor = 55;
  const major = majorCut - 55;
  const critical = 100 - majorCut;
  return { minor, major, critical };
}

export interface ArchetypeWeight {
  id: string;
  kind: Archetype["kind"];
  rawWeight: number;
  normalized: number;
}

export function archetypeWeights(s: GameState): ArchetypeWeight[] {
  const raws = ARCHETYPES.map((a) => Math.max(0.05, a.weight(s)));
  const total = raws.reduce((sum, w) => sum + w, 0);
  return ARCHETYPES.map((a, i) => ({
    id: a.id,
    kind: a.kind,
    rawWeight: raws[i],
    normalized: raws[i] / total,
  }));
}

export function generateEvent(state: GameState, rng: RNG = Math.random): GameEventDef {
  const weights = archetypeWeights(state);
  const total = weights.reduce((sum, w) => sum + w.rawWeight, 0);
  let r = rng() * total;
  let chosenIdx = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i].rawWeight;
    if (r <= 0) {
      chosenIdx = i;
      break;
    }
  }
  const sev = chooseSeverity(rng, state);
  return ARCHETYPES[chosenIdx].build(state, sev, rng);
}

