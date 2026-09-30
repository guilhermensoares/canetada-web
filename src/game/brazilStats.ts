/**
 * Brazil City Stats — constantes-base do simulador econômico.
 *
 * Valores de referência (2024–2026) inspirados em SNIS, ANTP, DNIT, IBGE,
 * Ministério da Saúde/DATASUS e PNAD-C. Usados para calibrar custos de
 * infraestrutura, tarifas, atenção primária e informalidade laboral.
 *
 * Todos os valores em Reais (BRL) do ano corrente do jogo.
 */

export interface TarifaOnibus {
  /** Tarifa média cobrada do usuário (R$/passageiro). */
  tarifa: number;
  /** Subsídio médio pago pelo município por passageiro (R$/passageiro). */
  subsidioEstimado: number;
}

export interface BrazilCityStats {
  /** Custo médio por km de metrô no Brasil (R$/km). Ref.: L4/SP ~ R$ 400M/km. */
  custoMedioKmMetro: number;
  /** Custo médio por km de corredor BRT no Brasil (R$/km). */
  custoMedioKmBRT: number;
  /** Tarifa e subsídio médio por passageiro de ônibus urbano. */
  tarifaMediaOnibus: TarifaOnibus;
  /** Custo médio mensal de manutenção por UBS (R$/UBS/mês). */
  custoAtendimentoUBS: number;
  /** Taxa de informalidade laboral — % da PEA sem contribuição direta. */
  taxaInformalidadeTrabalho: number;
}

/**
 * Valores calibrados para o cenário-padrão do jogo (Brasil, 2026).
 * `as const` mantém a segurança de tipos sem perder inferência numérica.
 */
export const BRAZIL_CITY_STATS: BrazilCityStats = {
  custoMedioKmMetro: 400_000_000,   // R$ 400 milhões / km (túnel + estações)
  custoMedioKmBRT:    45_000_000,   // R$ 45 milhões / km (corredor + terminais)
  tarifaMediaOnibus: {
    tarifa:            4.80,        // R$ 4,80 por passageiro (média capital)
    subsidioEstimado:  2.20,        // R$ 2,20 subsídio municipal médio
  },
  custoAtendimentoUBS: 180_000,     // R$ 180 mil / UBS / mês (equipe + insumos)
  taxaInformalidadeTrabalho: 39.0,  // 39% da PEA (PNAD-C 2024)
};

/* ----------------- Helpers para uso no simulador ----------------- */

/** Custo total para construir N km de metrô. */
export function metroBuildCost(km: number): number {
  return Math.round(km * BRAZIL_CITY_STATS.custoMedioKmMetro);
}

/** Custo total para construir N km de BRT. */
export function brtBuildCost(km: number): number {
  return Math.round(km * BRAZIL_CITY_STATS.custoMedioKmBRT);
}

/**
 * Custo líquido de operação por passageiro-ônibus considerando subsídio.
 * (o município arca com o subsídio; o usuário paga a tarifa)
 */
export function busNetSubsidyPerPax(): number {
  return BRAZIL_CITY_STATS.tarifaMediaOnibus.subsidioEstimado;
}

/** Custo mensal para manter N UBSs em operação. */
export function ubsMonthlyCost(units: number): number {
  return Math.round(units * BRAZIL_CITY_STATS.custoAtendimentoUBS);
}

/**
 * Estima a parcela da população que NÃO gera receita direta de folha
 * (informais + desalentados), dada uma população economicamente ativa.
 */
export function informalWorkforce(pea: number): number {
  return Math.round(pea * (BRAZIL_CITY_STATS.taxaInformalidadeTrabalho / 100));
}
