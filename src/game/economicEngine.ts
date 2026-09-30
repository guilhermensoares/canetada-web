/**
 * Motor econômico e tributário — inspirado nos dados orçamentários do
 * Tesouro Nacional (SICONFI/FINBRA). Funções puras: recebem entradas
 * numéricas ou o estado read-only, devolvem valores calculados sem
 * mutação. O acoplamento com o resto do jogo é feito em `logic.ts` e
 * `useGame.ts`, que aplicam o resultado ao estado global (reducer).
 *
 * Referências de calibração (arquivos anexos do usuário):
 *   - Finanças Públicas Municipais — Receitas e Gastos Reais
 *   - Índice de Receita Nominal por Tipos
 *   - Relatório Metodologia do Déficit Habitacional (FJP)
 * As alíquotas e mixes seguem a média histórica FINBRA 2019–2024.
 */
import type { GameState, RevenueBreakdown, ExpenseBreakdown } from "./types";

/** Composição da receita municipal por porte populacional (SICONFI/FINBRA). */
export interface RevenueMix {
  /** Parcela originada de arrecadação própria (IPTU/ISS/ITBI/IR/Taxas). */
  ownShare: number;
  /** Parcela originada de transferências constitucionais (FPM/ICMS/FUNDEB/SUS). */
  transferShare: number;
}

/**
 * Composição alvo da receita municipal em função do porte populacional.
 * Pequenos municípios dependem fortemente de FPM; grandes têm base
 * própria mais robusta (IPTU/ISS). Interpolação linear entre os pontos
 * de referência definidos no enunciado (SICONFI):
 *   pop < 50k  → 20% própria / 80% transferências
 *   pop > 500k → 60% própria / 40% transferências
 */
export function computeRevenueMix(population: number): RevenueMix {
  const p = Math.max(0, population);
  let ownShare: number;
  if (p <= 50_000) ownShare = 0.20;
  else if (p >= 500_000) ownShare = 0.60;
  else {
    const t = (p - 50_000) / (500_000 - 50_000);
    ownShare = 0.20 + t * 0.40;
  }
  return { ownShare, transferShare: 1 - ownShare };
}

/** Rótulo de porte para uso em UI (não interfere no cálculo). */
export function classifyCityScale(
  population: number,
): "pequeno" | "medio" | "grande" | "metropole" {
  if (population < 50_000) return "pequeno";
  if (population < 200_000) return "medio";
  if (population < 500_000) return "grande";
  return "metropole";
}

/**
 * Estima o valor mensal de transferências (FPM/ICMS/SUS/FUNDEB) para
 * atingir o mix alvo, dado o total arrecadado por fontes próprias.
 * Retorna sempre ≥ 0 — cidades pequenas com base própria fraca
 * ainda recebem repasse cheio.
 */
export function targetTransfersFromOwn(ownRevenue: number, population: number): number {
  const mix = computeRevenueMix(population);
  if (mix.ownShare <= 0) return 0;
  const totalTarget = ownRevenue / mix.ownShare;
  return Math.max(0, Math.round(totalTarget * mix.transferShare));
}

/* ============================================================================
 * Lei de Responsabilidade Fiscal (LRF) — Art. 20, III, b
 * Limite de gasto com pessoal do Executivo municipal: 54% da RCL.
 * Alerta (Art. 59, §1º, II) em 90% do limite → 48,6%.
 * Prudencial (Art. 22) em 95% do limite → 51,3%.
 * ========================================================================== */

export const LRF_LIMITS = {
  /** Limite máximo legal — infração formal e bloqueio de investimentos. */
  hard: 0.54,
  /** Limite prudencial: veda reajustes e novas contratações. */
  prudencial: 0.513,
  /** Alerta do TCE — sinal amarelo. */
  alert: 0.486,
} as const;

export interface LRFReport {
  /** Receita Corrente Líquida (12 meses, projetada a partir do último mês). */
  rcl: number;
  /** Gasto anualizado com pessoal (folha do executivo). */
  personnel: number;
  /** Razão pessoal/RCL em [0..1]. */
  ratio: number;
  /** Fase do semáforo LRF. */
  stage: "clean" | "alert" | "prudencial" | "infracao";
  /** Verdadeiro quando a razão excede 54% — bloqueia novos investimentos. */
  infracaoFiscal: boolean;
}

/**
 * Receita Corrente Líquida a partir do último mês fechado. Exclui
 * receitas de capital (não modeladas aqui) e projeta 12 meses.
 */
export function computeRCL(rev: RevenueBreakdown): number {
  const monthly =
    rev.incomeTax +
    rev.propertyTax +
    rev.businessTax +
    rev.iptuProgressive +
    rev.transfers +
    rev.farebox +
    rev.sanitationTariff;
  // Outorga onerosa é receita de capital (art. 32 LC 101) → não entra na RCL.
  return Math.max(0, Math.round(monthly * 12));
}

/**
 * Estimativa de gasto com pessoal (folha do executivo). Convenção do
 * simulador: 60% do custeio de educação/saúde/segurança/transporte é
 * remuneração de servidores; o restante é insumo/terceirização.
 * Encargos e inativos do RPPS entram como 20% adicional.
 */
export function estimatePersonnelExpense(exp: ExpenseBreakdown): number {
  const wageBase =
    exp.education * 0.62 +
    exp.health * 0.60 +
    exp.security * 0.65 +
    exp.transport * 0.35 +
    exp.sanitation * 0.40 +
    exp.waste * 0.40;
  const chargesAndRetirees = wageBase * 0.20;
  return Math.max(0, Math.round((wageBase + chargesAndRetirees) * 12));
}

/** Avalia o gasto com pessoal contra a RCL e classifica a fase LRF. */
export function evaluateLRF(state: GameState): LRFReport {
  const rcl = computeRCL(state.lastRevenueBreakdown);
  const personnel = estimatePersonnelExpense(state.lastExpensesBreakdown);
  const ratio = rcl > 0 ? personnel / rcl : 0;
  const stage: LRFReport["stage"] =
    ratio >= LRF_LIMITS.hard ? "infracao"
    : ratio >= LRF_LIMITS.prudencial ? "prudencial"
    : ratio >= LRF_LIMITS.alert ? "alert"
    : "clean";
  return { rcl, personnel, ratio, stage, infracaoFiscal: stage === "infracao" };
}

/** Categorias de ação bloqueadas pela infração à LRF (art. 23 §3º). */
export type FiscalGate = "capital_expansion" | "public_works" | "road_build" | "urbanization";

/**
 * Retorna verdadeiro se a ação de investimento pode ser executada.
 * Reajustes de política tributária, cortes de despesa e pagamento de
 * dívida continuam liberados — o objetivo é forçar o ajuste fiscal.
 */
export function canInvest(state: GameState, _gate: FiscalGate): boolean {
  return !state.fiscal?.infracaoFiscal;
}

/* ============================================================================
 * Núcleo orçamentário mensal — função pura reutilizada pelo tick() e pela
 * projeção "ao vivo" exibida no painel de políticas. Manter aqui garante que
 * o HUD e a simulação nunca divirjam.
 * ========================================================================== */

/** Custo unitário de custeio: R$/habitante por ponto de política (0..100).
 *  Calibrado para caber na RCL resultante do mix próprio+transferências
 *  (SICONFI): com todas as pastas em 50, o custeio consome ~55% da receita. */
export const POLICY_UNIT_COST = 0.33;
export const SUSTAINABILITY_UNIT_COST = {
  renewables: 0.44,
  emissions: 0.33,
  greenTransit: 0.37,
} as const;
export const INFRA_UNIT_COST = { water: 44, energy: 33 } as const;

export interface CoreBudget {
  incomeTax: number;
  propertyTax: number;
  businessTax: number;
  transfers: number;
  revenue: number;
  education: number;
  health: number;
  security: number;
  transport: number;
  sustainability: number;
  infra: number;
  debtInterest: number;
  expenses: number;
  balance: number;
  peripheryMiddleClass: number;
  humanCapitalIndex: number;
}

export interface CoreBudgetInputs {
  revenueMult: number;
  debtInterestRate: number;
  roadUpkeep: number;
}

/**
 * Calcula receita e despesa correntes do mês a partir do estado.
 * Não muta nada — o tick aplica o resultado.
 */
export function computeCoreBudget(s: GameState, io: CoreBudgetInputs): CoreBudget {
  const economyHealth = Math.min(140, Math.max(30,
    100 - s.unemployment * 3 - s.inflation * 2 + s.happiness * 0.2,
  )) / 100;
  const perCapitaIncome = 2600 * economyHealth;

  const peripheryMob = s.mobility?.strata?.periphery?.mobility ?? 55;
  const regularizedTiles = s.landUse?.regularized ?? 0;
  const skilledShare = (() => {
    const c = s.education?.cohorts;
    if (!c) return 0.25;
    const total = c.basic + c.secondary + c.technical + c.higher || 1;
    return (c.technical + c.higher) / total;
  })();

  // Capital humano/logístico: média móvel do investimento em educação e
  // transporte. Converge lentamente (4%/mês) para o nível dos sliders, então
  // manter investimento alto amplia a base tributária ao longo do mandato.
  const targetHC = s.policies.education * 0.6 + s.policies.transport * 0.4;
  const prevHC = s.humanCapitalIndex ?? targetHC;
  const humanCapitalIndex = Math.round((prevHC + (targetHC - prevHC) * 0.04) * 10) / 10;

  const peripheryMiddleClass = Math.min(1.6, Math.max(0.7,
    1 + (peripheryMob - 55) * 0.004
      + Math.min(regularizedTiles, 40) * 0.003
      + (skilledShare - 0.25) * 0.4
      + (humanCapitalIndex - 50) * 0.005, // ±0,25 — retorno do investimento
  ));

  const incomeTax = s.population * perCapitaIncome * (s.taxes.income / 100) * 0.08 * io.revenueMult;
  const propertyTax = s.population * 40 * (s.taxes.property / 100) * io.revenueMult * peripheryMiddleClass;
  const businessTax = s.businesses * 9000 * (s.taxes.business / 100) * 0.5 * io.revenueMult * peripheryMiddleClass;
  const own = incomeTax + propertyTax + businessTax;
  const transfers = targetTransfersFromOwn(own, s.population);
  const revenue = Math.round(own + transfers);

  const u = POLICY_UNIT_COST;
  const education = s.policies.education * s.population * u;
  const health = s.policies.health * s.population * u;
  const security = s.policies.security * s.population * u;
  const transport = s.policies.transport * s.population * u;
  const sust = s.sustainability ?? { renewables: 0, emissions: 0, greenTransit: 0 };
  const sustainability =
    sust.renewables * s.population * SUSTAINABILITY_UNIT_COST.renewables +
    sust.emissions * s.population * SUSTAINABILITY_UNIT_COST.emissions +
    sust.greenTransit * s.population * SUSTAINABILITY_UNIT_COST.greenTransit;
  const infra =
    s.infra.waterCapacity * INFRA_UNIT_COST.water +
    s.infra.energyCapacity * INFRA_UNIT_COST.energy +
    io.roadUpkeep;
  const debtInterest = s.debt * io.debtInterestRate;
  const expenses = Math.round(education + health + security + transport + sustainability + infra + debtInterest);

  return {
    incomeTax: Math.round(incomeTax),
    propertyTax: Math.round(propertyTax),
    businessTax: Math.round(businessTax),
    transfers: Math.round(transfers),
    revenue,
    education: Math.round(education),
    health: Math.round(health),
    security: Math.round(security),
    transport: Math.round(transport),
    sustainability: Math.round(sustainability),
    infra: Math.round(infra),
    debtInterest: Math.round(debtInterest),
    expenses,
    balance: revenue - expenses,
    peripheryMiddleClass: Math.round(peripheryMiddleClass * 100) / 100,
    humanCapitalIndex,
  };
}
