/**
 * Sistema de Gestão de Assessores.
 *
 * O prefeito contrata até 5 assessores diretos (um por pasta). Cada assessor
 * tem Capacidade Técnica (1..5★), Lealdade (0..100), Alinhamento partidário
 * e Potencial de crescimento. A pasta gera conselhos cuja qualidade depende
 * do Overall; assessores com baixa lealdade podem vazar informações (MP+) ou
 * desviar recursos. Assessores promissores que evoluem podem ser assediados
 * por partidos rivais e trocar de lado ou lançarem-se candidatos.
 */

import type { GameState, NewsItem } from "./types";
import { seededRng } from "./rng";
import { archetypesForPortfolio, ADVISOR_ARCHETYPES, archetypeIdeology, PARTY_IDEOLOGY } from "./advisorArchetypes";
import { findPolitician } from "./politicianPresets";

export type PortfolioId =
  | "health"
  | "works"
  | "finance"
  | "mobility"
  | "articulation";

export type PartyAlignment = "PLab" | "PDR" | "PSOB" | "P-CENTRO" | "TEC";

export interface Advisor {
  id: string;
  name: string;
  portfolio: PortfolioId;
  /** 1..5 estrelas — Capacidade Técnica. Cresce com XP. */
  overall: number;
  /** 0..100 — Lealdade/Honestidade. */
  loyalty: number;
  /** Alinhamento partidário. */
  party: PartyAlignment;
  /** Custo mensal (R$/mês, escala municipal). */
  salary: number;
  /** 0..100 — potencial de crescimento residual (diminui a cada evolução). */
  potential: number;
  /** 0..100 — XP acumulado; ao passar de 100 ganha 1★. */
  xp: number;
  /** Idade em anos (afeta narrativa e potencial). */
  age: number;
  /** Meses no cargo. */
  monthsInOffice: number;
  /** Se true, um partido rival está assediando (janela até 3 meses). */
  poached?: { by: PartyAlignment; monthsLeft: number };
  /** Marcador: assessor traiu (deixou o cargo ou vazou); apenas para histórico. */
  betrayed?: boolean;
  /** Opcional: id do arquétipo satírico usado (se veio de um preset). */
  archetypeId?: string;
  /** Bio curta (satírica ou genérica). */
  bio?: string;
  /** Rótulos curtos ("Populista", "Técnica", "Marketeiro"…). */
  traits?: string[];
  /** Posição ideológica do assessor (-1 esquerda .. +1 direita). */
  ideology?: number;
  /** Afinidade com o prefeito atual (-1 opostos .. +1 idênticos). Usada
   *  pela UI (badge) e como fonte de risco de sabotagem/deslealdade. */
  affinity?: number;
}

export interface AdviceEntry {
  id: string;
  portfolio: PortfolioId;
  month: number;
  year: number;
  quality: "poor" | "standard" | "expert";
  text: string;
}

export interface AdvisorState {
  hired: Partial<Record<PortfolioId, Advisor>>;
  /** Pool de candidatos disponíveis para contratação (rotativo). */
  roster: Advisor[];
  /** Log de conselhos recentes (últimos 24). */
  advice: AdviceEntry[];
  /** Log curto de eventos (assédio, promoções, escândalos). */
  events: string[];
  /** Mês/ano do último refresh do roster. */
  lastRefresh?: { month: number; year: number };
  /** Histórico de recomendações — quando surgiram, métrica-gatilho e desfecho. */
  history?: AdviceHistoryEntry[];
}

export type MetricDirection = "higher_better" | "lower_better";

export interface MetricSnapshot {
  /** Chave estável (ex.: "happiness", "congestion"). */
  key: string;
  /** Rótulo em PT-BR para exibição. */
  label: string;
  /** Valor no momento em que a recomendação foi registrada. */
  value: number;
  /** Direção da métrica: se maior é melhor ou menor é melhor. */
  direction: MetricDirection;
  /** Sufixo opcional (%, R$M, pts). */
  unit?: string;
}

export type AdviceOutcome = "improved" | "worsened" | "unchanged";

export interface AdviceHistoryEntry {
  id: string;
  portfolio: PortfolioId;
  severity: AdviceSeverity;
  headline: string;
  action: string;
  /** Métrica que motivou a recomendação (snapshot no momento da abertura). */
  metric: MetricSnapshot;
  openedAt: { month: number; year: number };
  /** Preenchido quando a recomendação sai de cena (severidade cai a "ok"
   *  ou é substituída por outra do mesmo portfolio). */
  closedAt?: { month: number; year: number };
  /** Valor da mesma métrica no fechamento — permite comparar delta. */
  metricAtClose?: number;
  /** Desfecho: melhora, piora ou sem mudança material. */
  outcome?: AdviceOutcome;
}

export const PORTFOLIOS: PortfolioId[] = [
  "health",
  "works",
  "finance",
  "mobility",
  "articulation",
];

export const PORTFOLIO_LABEL: Record<PortfolioId, string> = {
  health: "Saúde",
  works: "Obras / Urbanismo",
  finance: "Finanças",
  mobility: "Mobilidade",
  articulation: "Articulação Política",
};

const PARTIES: PartyAlignment[] = ["PLab", "PDR", "PSOB", "P-CENTRO", "TEC"];

const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Diego", "Eliane", "Fábio", "Gustavo", "Helena",
  "Igor", "Juliana", "Kleber", "Larissa", "Marcos", "Nádia", "Otávio",
  "Patrícia", "Renato", "Sônia", "Thiago", "Ubiratan", "Vera", "Wagner",
];
const LAST_NAMES = [
  "Alves", "Barbosa", "Cavalcanti", "Duarte", "Espíndola", "Fontes",
  "Guimarães", "Holanda", "Iório", "Junqueira", "Klabin", "Lobato",
  "Machado", "Nogueira", "Oliveira", "Pacheco", "Queiroz", "Rocha",
  "Sampaio", "Tavares", "Uchoa", "Vasconcelos",
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

let idCounter = 1;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** Salário mensal como função de overall, pasta e partido. */
export function salaryFor(overall: number, portfolio: PortfolioId, party: PartyAlignment): number {
  const base = 9_000 * overall;
  const portfMult = portfolio === "finance" ? 1.25 : portfolio === "articulation" ? 1.15 : 1;
  const partyMult = party === "TEC" ? 1.15 : 1; // técnicos "notório saber" custam mais
  return Math.round(base * portfMult * partyMult);
}

/* ---------------- Afinidade ideológica ---------------- */

/** Afinidade -1..+1 entre duas posições ideológicas (-1..+1). */
export function computeAffinity(mayorIdeo: number, advisorIdeo: number): number {
  const delta = Math.abs(mayorIdeo - advisorIdeo); // 0..2
  return Math.max(-1, Math.min(1, 1 - delta));
}

/** Resolve a ideologia do prefeito a partir do state (persona ou 0 neutro). */
export function mayorIdeology(s: Pick<GameState, "mayor">): number {
  const pid = s.mayor?.personaId;
  return pid ? findPolitician(pid)?.ideology ?? 0 : 0;
}

/**
 * Aplica afinidade à lealdade inicial de um candidato. Alinhados ganham
 * até +30 pts; opostos perdem até -45 pts (assimétrico: rivais políticos são
 * mais destrutivos do que aliados são reforçadores). Também grava
 * `ideology` e `affinity` no assessor para a UI e para o cálculo de
 * sabotagem nas recomendações.
 */
function applyAffinity(cand: Advisor, mayorIdeo: number, advisorIdeo: number): void {
  const aff = computeAffinity(mayorIdeo, advisorIdeo);
  const shift = aff >= 0 ? Math.round(aff * 30) : Math.round(aff * 45);
  cand.ideology = advisorIdeo;
  cand.affinity = aff;
  cand.loyalty = clamp(cand.loyalty + shift, 0, 100);
}

function makeCandidate(portfolio: PortfolioId, rng: () => number, mayorIdeo = 0): Advisor {
  // 60% dos candidatos saem de arquétipos temáticos (satíricos + genéricos)
  // quando há arquétipo compatível com a pasta; 40% são gerados do zero.
  const pool = archetypesForPortfolio(portfolio);
  if (pool.length > 0 && rng() < 0.6) {
    return makeArchetypeCandidate(pick(pool, rng), portfolio, rng, mayorIdeo);
  }
  // Distribuição enviesada para 2–3 estrelas; 5★ raros.
  const roll = rng();
  const overall =
    roll < 0.30 ? 1 :
    roll < 0.65 ? 2 :
    roll < 0.88 ? 3 :
    roll < 0.98 ? 4 : 5;
  // Jovens promissores: overall baixo + potencial alto.
  const age = 26 + Math.floor(rng() * 40); // 26..65
  const potential = overall >= 4
    ? Math.round(20 + rng() * 40)          // veteranos: pouco espaço
    : Math.round(45 + rng() * 55);         // jovens: até 100
  const loyalty = Math.round(35 + rng() * 55);
  const party = pick(PARTIES, rng);
  const name = `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`;
  const cand: Advisor = {
    id: nextId("adv"),
    name,
    portfolio,
    overall,
    loyalty,
    party,
    salary: salaryFor(overall, portfolio, party),
    potential,
    xp: 0,
    age,
    monthsInOffice: 0,
    traits: ["Sem histórico"],
  };
  // Candidato genérico: ideologia herdada só do partido; ainda entra na
  // matemática de afinidade — assim um técnico de PLab estranha um prefeito
  // radicalmente à direita, mesmo sem paródia explícita.
  applyAffinity(cand, mayorIdeo, PARTY_IDEOLOGY[party] ?? 0);
  return cand;
}

function rangeRoll(range: [number, number], rng: () => number): number {
  const [lo, hi] = range;
  return Math.round(lo + rng() * (hi - lo));
}

/** Gera candidato a partir de um arquétipo pré-desenhado. */
function makeArchetypeCandidate(
  arch: import("./advisorArchetypes").AdvisorArchetype,
  portfolio: PortfolioId,
  rng: () => number,
  mayorIdeo = 0,
): Advisor {
  const overall = rangeRoll(arch.overallRange, rng);
  const loyalty = rangeRoll(arch.loyaltyRange, rng);
  const potential = rangeRoll(arch.potentialRange, rng);
  const age = rangeRoll(arch.ageRange, rng);
  const salaryBase = salaryFor(overall, portfolio, arch.party);
  const cand: Advisor = {
    id: nextId("adv"),
    name: arch.name,
    portfolio,
    overall,
    loyalty,
    party: arch.party,
    salary: Math.round(salaryBase * (arch.salaryMult ?? 1)),
    potential,
    xp: 0,
    age,
    monthsInOffice: 0,
    archetypeId: arch.id,
    bio: arch.bio,
    traits: [...arch.traits],
  };
  applyAffinity(cand, mayorIdeo, archetypeIdeology(arch));
  return cand;
}

function refreshRoster(
  state: AdvisorState,
  rng: () => number,
  month: number,
  year: number,
  mayorIdeo = 0,
) {
  const roster: Advisor[] = [];
  for (const p of PORTFOLIOS) {
    // 4 candidatos por pasta (era 3) — dá mais escolha ao jogador.
    for (let i = 0; i < 4; i++) roster.push(makeCandidate(p, rng, mayorIdeo));
  }
  state.roster = roster;
  state.lastRefresh = { month, year };
}

export function initialAdvisors(seed = "advisors"): AdvisorState {
  const rng = seededRng(seed, { rngCursor: 0 } as GameState);
  const st: AdvisorState = { hired: {}, roster: [], advice: [], events: [] };
  refreshRoster(st, rng, 1, 2026);
  return st;
}

export function ensureAdvisors(s: GameState): AdvisorState {
  if (!s.advisors) s.advisors = initialAdvisors(s.seed || "advisors");
  // Migração leve de saves antigos.
  const a = s.advisors!;
  a.hired ??= {};
  a.roster ??= [];
  a.advice ??= [];
  a.events ??= [];
  return a;
}

/* ---------------- Ações ---------------- */

export function hireAdvisor(s: GameState, candidateId: string, portfolio: PortfolioId): void {
  const st = ensureAdvisors(s);
  const cand = st.roster.find((c) => c.id === candidateId && c.portfolio === portfolio);
  if (!cand) return;
  // Substitui titular anterior sem multa (poderíamos cobrar).
  st.hired[portfolio] = { ...cand, monthsInOffice: 0 };
  st.roster = st.roster.filter((c) => c.id !== candidateId);
  st.events.unshift(`Contratado(a) ${cand.name} (${cand.overall}★) para ${PORTFOLIO_LABEL[portfolio]}.`);
  st.events = st.events.slice(0, 20);
}

export function fireAdvisor(s: GameState, portfolio: PortfolioId): void {
  const st = ensureAdvisors(s);
  const cur = st.hired[portfolio];
  if (!cur) return;
  // Multa rescisória: 2× salário.
  s.treasury -= cur.salary * 2;
  st.events.unshift(`Demitido(a) ${cur.name} de ${PORTFOLIO_LABEL[portfolio]} (multa R$${(cur.salary * 2).toLocaleString("pt-BR")}).`);
  delete st.hired[portfolio];
  st.events = st.events.slice(0, 20);
}

/** Investir em capacitação (curso, viagem técnica). Ganha XP e lealdade. */
export function trainAdvisor(s: GameState, portfolio: PortfolioId): void {
  const st = ensureAdvisors(s);
  const a = st.hired[portfolio];
  if (!a) return;
  const cost = 40_000 + a.overall * 12_000;
  if (s.treasury < cost) return;
  s.treasury -= cost;
  a.xp = clamp(a.xp + 25 + Math.round(a.potential / 5), 0, 100);
  a.loyalty = clamp(a.loyalty + 6, 0, 100);
  st.events.unshift(`Capacitação de ${a.name} — +XP e lealdade.`);
  st.events = st.events.slice(0, 20);
}

/** Reter assessor cobiçado com bônus e promoção simbólica. */
export function retainAdvisor(s: GameState, portfolio: PortfolioId): void {
  const st = ensureAdvisors(s);
  const a = st.hired[portfolio];
  if (!a?.poached) return;
  const bonus = a.salary * 3;
  if (s.treasury < bonus) return;
  s.treasury -= bonus;
  a.loyalty = clamp(a.loyalty + 15, 0, 100);
  a.salary = Math.round(a.salary * 1.08);
  a.poached = undefined;
  st.events.unshift(`${a.name} recusou proposta rival: bônus de retenção pago.`);
  st.events = st.events.slice(0, 20);
}

/** Deixar o assessor sair (ele muda de partido / vira candidato). */
export function releasePoached(s: GameState, portfolio: PortfolioId): void {
  const st = ensureAdvisors(s);
  const a = st.hired[portfolio];
  if (!a?.poached) return;
  st.events.unshift(`${a.name} deixou o governo e migrou para ${a.poached.by}.`);
  a.betrayed = true;
  delete st.hired[portfolio];
  st.events = st.events.slice(0, 20);
  // Impacto reputacional leve.
  s.approval = clamp(s.approval - 2, 0, 100);
}

/* ---------------- Geração de conselhos ---------------- */

export type AdviceSeverity = "critical" | "warning" | "info" | "ok";

export interface Recommendation {
  portfolio: PortfolioId;
  severity: AdviceSeverity;
  headline: string;
  rationale: string;
  action: string;
  priority: number;
  /** Métrica-gatilho — usada pelo histórico para medir se houve melhora. */
  metric: MetricSnapshot;
}

const SEV_ORDER: Record<AdviceSeverity, number> = { critical: 3, warning: 2, info: 1, ok: 0 };

export function buildRecommendation(s: GameState, portfolio: PortfolioId): Recommendation {
  const st = ensureAdvisors(s);
  const a = st.hired[portfolio];
  const overall = a?.overall ?? 0;
  const m = readMetrics(s, portfolio);
  const base = diagnosePortfolio(portfolio, m, s);
  if (!a) {
    return {
      ...base,
      portfolio,
      headline: `Pasta sem titular — ${base.headline}`,
      rationale: `${base.rationale} Contrate um assessor para acompanhar esta pasta com dados.`,
      action: "Contratar assessor",
      priority: Math.min(100, base.priority + 10),
    };
  }
  let headline = base.headline;
  let rationale = base.rationale;
  let action = base.action;
  let severity = base.severity;
  if (overall <= 2) {
    headline = degradeAdvice(portfolio, base);
    rationale = `Assessor de baixa capacidade (${overall}★): leitura imprecisa. ${rationale}`;
  } else if (overall >= 5) {
    rationale = `${rationale} Horizonte 24m: agir cedo reduz custo político em ~40%.`;
  }
  const aff = a.affinity ?? 0;
  const opposition = aff <= -0.4;
  if (a.loyalty < 25) {
    // Sabotagem: o assessor sugere o OPOSTO ou uma medida claramente danosa.
    // A UI mostra a recomendação com carimbo de alerta — cabe ao jogador
    // decidir se confia ou trocca de titular.
    headline = `⚠ Suspeita de sabotagem — ${base.headline}`;
    rationale =
      `Lealdade crítica (${a.loyalty}%)${opposition ? ", com forte divergência ideológica" : ""}. ` +
      `Fontes internas indicam que a orientação abaixo pode estar sendo manipulada para prejudicar a gestão. ${rationale}`;
    action = sabotageAction(portfolio, base.action);
    severity = severity === "ok" ? "warning" : severity;
  } else if (a.loyalty < 40 || opposition) {
    rationale += ` ⚠ Lealdade ${a.loyalty}%${
      opposition ? ` · afinidade ideológica ${(aff * 100).toFixed(0)}` : ""
    }: verifique a fonte antes de decidir.`;
  }
  return { portfolio, severity, headline, rationale, action, priority: base.priority, metric: base.metric };
}

/** Ação sugerida deliberadamente ruim para uma pasta — usada quando o
 *  assessor está em sabotagem (lealdade < 25). Mantém o tom institucional
 *  para reforçar que é uma "recomendação envenenada". */
function sabotageAction(p: PortfolioId, original: string): string {
  const table: Record<PortfolioId, string> = {
    health: "Cortar 15 pp da verba de Saúde e terceirizar UBS de bairros densos",
    mobility: "Aumentar tarifa em 20% e cortar linhas de vans regularizadas",
    works: "Suspender manutenção de piscinões antes do verão",
    finance: "Isentar grandes empresas de IPTU e cortar arrecadação em 12%",
    articulation: "Romper com a base aliada e desafiar a Câmara publicamente",
  };
  return table[p] ?? `Ignorar diagnóstico e manter o oposto: ${original}`;
}

/** Compat: string simples usada onde não precisamos do objeto completo. */
export function generateAdvice(s: GameState, portfolio: PortfolioId): string {
  const r = buildRecommendation(s, portfolio);
  return `${r.headline} — ${r.rationale}`;
}

/** Top-N recomendações do gabinete inteiro, ordenadas por severidade+prioridade. */
export function getTopRecommendations(s: GameState, limit = 3): Recommendation[] {
  const all = PORTFOLIOS.map((p) => buildRecommendation(s, p));
  return all
    .filter((r) => r.severity !== "ok")
    .sort((x, y) => (SEV_ORDER[y.severity] - SEV_ORDER[x.severity]) || (y.priority - x.priority))
    .slice(0, limit);
}

interface Metrics {
  approval: number;
  happiness: number;
  unemployment: number;
  inflation: number;
  treasury: number;
  congestion: number;
  crime: number;
}

function readMetrics(s: GameState, _p: PortfolioId): Metrics {
  return {
    approval: s.approval,
    happiness: s.happiness,
    unemployment: s.unemployment,
    inflation: s.inflation,
    treasury: s.treasury,
    congestion: s.transport?.split?.congestion ?? 40,
    crime: (s.politics?.institutional?.corruption ?? 30),
  };
}

/** Constrói MetricSnapshot padronizada. */
function snap(
  key: string, label: string, value: number,
  direction: MetricDirection, unit?: string,
): MetricSnapshot {
  return { key, label, value, direction, unit };
}

function diagnosePortfolio(
  p: PortfolioId,
  m: Metrics,
  s: GameState,
): Omit<Recommendation, "portfolio"> {
  switch (p) {
    case "health": {
      const happy = m.happiness;
      const healthFunding = s.policies?.health ?? 50;
      if (happy < 40 || healthFunding < 30) {
        return {
          severity: "critical",
          headline: "Rede de saúde saturada e felicidade em queda",
          rationale: `Felicidade ${Math.round(happy)}, verba de Saúde em ${healthFunding}%. Fila em UBS deve estourar em 60 dias.`,
          action: "Elevar Saúde para ≥55% e abrir 2 UBS em bairros densos",
          priority: 90,
          metric: snap("happiness", "Felicidade", happy, "higher_better", "pts"),
        };
      }
      if (healthFunding < 50) {
        return {
          severity: "warning",
          headline: "Cobertura de APS abaixo do recomendado",
          rationale: `Saúde em ${healthFunding}%. Margem para prevenção baixa antes do verão.`,
          action: "Subir verba de Saúde em +10 pp",
          priority: 55,
          metric: snap("policy.health", "Verba de Saúde", healthFunding, "higher_better", "%"),
        };
      }
      return {
        severity: "info",
        headline: "Saúde estável — reforçar prevenção",
        rationale: `Saúde ${healthFunding}%, felicidade ${Math.round(happy)}. Espaço para telemedicina.`,
        action: "Manter verba e investir em capacitação",
        priority: 20,
        metric: snap("happiness", "Felicidade", happy, "higher_better", "pts"),
      };
    }
    case "works": {
      const hazardFav = s.landUse?.hazardFavelas ?? 0;
      const vazio = s.landUse?.vazioTiles ?? 0;
      if (hazardFav > 20) {
        return {
          severity: "critical",
          headline: "Ocupações em área de risco expostas à próxima chuva",
          rationale: `${hazardFav} tiles de favela em encostas/APP. Chuva de verão pode causar deslizamento.`,
          action: "Ativar Regularização + drenagem prioritária",
          priority: 92,
          metric: snap("hazardFavelas", "Favelas em área de risco", hazardFav, "lower_better", "tiles"),
        };
      }
      if (vazio > 30) {
        return {
          severity: "warning",
          headline: "Especulação imobiliária travando cidade",
          rationale: `${vazio} lotes vazios zonados. IPTU progressivo destrava e gera receita.`,
          action: "Ligar IPTU progressivo em vazios",
          priority: 60,
          metric: snap("vazioTiles", "Lotes vazios", vazio, "lower_better", "tiles"),
        };
      }
      return {
        severity: "info",
        headline: "Obras: janela para infraestrutura preventiva",
        rationale: "Sem gargalos agudos. Drenagem antes do verão tem payback rápido.",
        action: "Programar drenagem em bacia crítica",
        priority: 25,
        metric: snap("hazardFavelas", "Favelas em área de risco", hazardFav, "lower_better", "tiles"),
      };
    }
    case "finance": {
      const inf = m.inflation;
      const cash = m.treasury;
      if (cash < 0) {
        return {
          severity: "critical",
          headline: "Caixa negativo — risco fiscal imediato",
          rationale: `Tesouro em R$${Math.round(cash/1e6)}M. Cada mês sem ajuste eleva juros e MP.`,
          action: "Cortar 5% de despesa discricionária e renegociar contratos",
          priority: 95,
          metric: snap("treasury", "Tesouro", cash, "higher_better", "R$"),
        };
      }
      if (inf > 6) {
        return {
          severity: "warning",
          headline: `Inflação em ${inf.toFixed(1)}% pressiona tarifas`,
          rationale: "Reajustes automáticos vão bater na aprovação. Segurar 60 dias suaviza o pico.",
          action: "Congelar tarifas por 2 meses",
          priority: 65,
          metric: snap("inflation", "Inflação", inf, "lower_better", "%"),
        };
      }
      if (cash > 0 && cash < 50_000_000) {
        return {
          severity: "info",
          headline: "Caixa apertado — reforçar arrecadação",
          rationale: `Tesouro R$${Math.round(cash/1e6)}M. Refis de ISS amplia base sem tocar alíquota.`,
          action: "Abrir Refis focado em ISS",
          priority: 45,
          metric: snap("treasury", "Tesouro", cash, "higher_better", "R$"),
        };
      }
      return {
        severity: "ok",
        headline: "Finanças saudáveis",
        rationale: `Caixa R$${Math.round(cash/1e6)}M, inflação ${inf.toFixed(1)}%.`,
        action: "Constituir reserva de contingência",
        priority: 10,
        metric: snap("treasury", "Tesouro", cash, "higher_better", "R$"),
      };
    }
    case "mobility": {
      const cong = m.congestion;
      if (cong > 70) {
        return {
          severity: "critical",
          headline: "Congestionamento colapsando a cidade",
          rationale: `Índice ${Math.round(cong)}. Ônibus perdem 30% de velocidade — receita e aprovação caem.`,
          action: "Implantar faixa exclusiva no corredor mais carregado",
          priority: 88,
          metric: snap("congestion", "Congestionamento", cong, "lower_better", "idx"),
        };
      }
      if (cong > 55) {
        return {
          severity: "warning",
          headline: "Congestionamento subindo",
          rationale: `Índice ${Math.round(cong)}. Ganho médio de faixa exclusiva: -8pp em 90 dias.`,
          action: "Priorizar faixa exclusiva + revisão de linhas",
          priority: 55,
          metric: snap("congestion", "Congestionamento", cong, "lower_better", "idx"),
        };
      }
      return {
        severity: "info",
        headline: "Mobilidade equilibrada",
        rationale: `Congestionamento ${Math.round(cong)}. Bom momento para integração tarifária.`,
        action: "Estudar integração ônibus-metrô",
        priority: 20,
        metric: snap("congestion", "Congestionamento", cong, "lower_better", "idx"),
      };
    }
    case "articulation": {
      const approval = m.approval;
      const seats = (s.politics as unknown as { council?: { pctSupport?: number } })?.council?.pctSupport ?? 40;
      if (seats < 35) {
        return {
          severity: "critical",
          headline: "Base na Câmara insuficiente para governar",
          rationale: `Apoio ${Math.round(seats)}%. Qualquer PL importante trava. Risco de CPI aumenta.`,
          action: "Ceder 1 pasta ao P-CENTRO para reconstruir base",
          priority: 90,
          metric: snap("councilSupport", "Apoio na Câmara", seats, "higher_better", "%"),
        };
      }
      if (approval < 40) {
        return {
          severity: "warning",
          headline: "Baixa aprovação enfraquece negociação",
          rationale: `Aprovação ${Math.round(approval)}%. Vereadores cobram mais para votar com o governo.`,
          action: "Anunciar 2 obras visíveis em bairros populares",
          priority: 60,
          metric: snap("approval", "Aprovação", approval, "higher_better", "%"),
        };
      }
      return {
        severity: "info",
        headline: "Janela para reforma tributária local",
        rationale: `Apoio ${Math.round(seats)}%, aprovação ${Math.round(approval)}%. Coalizão ampla viabiliza pauta em 6 meses.`,
        action: "Iniciar articulação de coalizão ampla",
        priority: 25,
        metric: snap("councilSupport", "Apoio na Câmara", seats, "higher_better", "%"),
      };
    }
  }
}

function degradeAdvice(p: PortfolioId, base: Omit<Recommendation, "portfolio">): string {
  const poor: Record<PortfolioId, string> = {
    health: "Pinta o posto de verde que a felicidade sobe",
    works: "Asfaltar a praça central resolve tudo",
    finance: "Pega mais empréstimo, juros a gente vê depois",
    mobility: "Compra uns ônibus antigos usados",
    articulation: "Ignora a Câmara que passa",
  };
  return `${poor[p]} (na real, priorize: ${base.action.toLowerCase()})`;
}

/* ---------------- Histórico de recomendações ---------------- */

const HISTORY_CAP = 60;
/** Delta relativo mínimo para dizer que a métrica "melhorou" ou "piorou". */
const MATERIAL_DELTA = 0.05;

function outcomeFor(m: MetricSnapshot, valueThen: number, valueNow: number): AdviceOutcome {
  const base = Math.max(1, Math.abs(valueThen));
  const rel = (valueNow - valueThen) / base;
  const better = m.direction === "higher_better" ? rel > MATERIAL_DELTA : rel < -MATERIAL_DELTA;
  const worse  = m.direction === "higher_better" ? rel < -MATERIAL_DELTA : rel > MATERIAL_DELTA;
  return better ? "improved" : worse ? "worsened" : "unchanged";
}

/**
 * Atualiza o histórico de recomendações do mês corrente.
 *  - Abre uma nova entrada quando um portfolio passa a ter recomendação não-"ok"
 *    diferente da última em aberto (headline distinta).
 *  - Fecha a entrada aberta quando a recomendação some (severidade "ok") ou é
 *    substituída por outra do mesmo portfolio, medindo delta da métrica-gatilho.
 * Chamada 1×/mês dentro de tickAdvisorsMonthly.
 */
export function recordAdviceHistory(s: GameState): void {
  const st = ensureAdvisors(s);
  st.history ??= [];
  const now = { month: s.month, year: s.year };

  for (const p of PORTFOLIOS) {
    const rec = buildRecommendation(s, p);
    const openEntry = st.history.find((h) => h.portfolio === p && !h.closedAt);
    const isActive = rec.severity !== "ok";

    if (!isActive) {
      if (openEntry) {
        openEntry.closedAt = now;
        openEntry.metricAtClose = rec.metric.value;
        openEntry.outcome = outcomeFor(openEntry.metric, openEntry.metric.value, rec.metric.value);
      }
      continue;
    }

    // Mesma recomendação continua ativa — nada a fazer.
    if (openEntry && openEntry.headline === rec.headline) continue;

    // Fecha a anterior (se houver) medindo delta.
    if (openEntry) {
      openEntry.closedAt = now;
      openEntry.metricAtClose = rec.metric.value;
      openEntry.outcome = outcomeFor(openEntry.metric, openEntry.metric.value, rec.metric.value);
    }
    // Abre nova.
    st.history.unshift({
      id: nextId("hist"),
      portfolio: p,
      severity: rec.severity,
      headline: rec.headline,
      action: rec.action,
      metric: { ...rec.metric },
      openedAt: now,
    });
  }

  if (st.history.length > HISTORY_CAP) st.history.length = HISTORY_CAP;
}

/** Getter defensivo (imutável) para a UI. */
export function getAdviceHistory(s: GameState): AdviceHistoryEntry[] {
  return s.advisors?.history ?? [];
}



export interface AdvisorsTickResult {
  expenses: number;
  approvalDelta: number;
  happinessDelta: number;
  treasuryDelta: number;
  mpRiskDelta: number;
  news: Omit<NewsItem, "id" | "month" | "year" | "day">[];
}

export function tickAdvisorsMonthly(s: GameState, rng: () => number): AdvisorsTickResult {
  const st = ensureAdvisors(s);
  const res: AdvisorsTickResult = {
    expenses: 0, approvalDelta: 0, happinessDelta: 0,
    treasuryDelta: 0, mpRiskDelta: 0, news: [],
  };

  // Registra o snapshot de recomendações do mês (histórico + medição de melhora).
  recordAdviceHistory(s);


  // Rota de candidatos: renova roster a cada 3 meses.
  const lr = st.lastRefresh;
  const stale = !lr || (s.year - lr.year) * 12 + (s.month - lr.month) >= 3;
  if (stale) refreshRoster(st, rng, s.month, s.year, mayorIdeology(s));

  const successful = s.approval >= 50 && s.treasury > 0 &&
    (!s.oversight || (s.oversight.mpRisk ?? 0) < 70);

  for (const p of PORTFOLIOS) {
    const a = st.hired[p];
    if (!a) {
      // Pasta vaga: penalidade leve de eficiência (representada como aprovação).
      res.approvalDelta -= 0.15;
      continue;
    }
    a.monthsInOffice += 1;
    res.expenses += a.salary;

    // Bônus de aprovação por assessor competente.
    res.approvalDelta += (a.overall - 3) * 0.15;
    res.happinessDelta += (a.overall - 3) * 0.05;

    // XP: cresce quando o governo está sendo bem tocado.
    if (successful) {
      const gain = 2 + Math.round(a.potential / 25);
      a.xp = clamp(a.xp + gain, 0, 100);
    } else {
      a.xp = clamp(a.xp - 1, 0, 100);
      // Lealdade cai um pouco em governos ruins.
      if (rng() < 0.3) a.loyalty = clamp(a.loyalty - 2, 0, 100);
    }

    // Evolução: 100 XP e potencial > 10 => +1★ (máx 5).
    if (a.xp >= 100 && a.overall < 5 && a.potential > 10) {
      a.overall += 1;
      a.xp = 0;
      a.potential = clamp(a.potential - 18, 0, 100);
      a.salary = Math.round(salaryFor(a.overall, a.portfolio, a.party) * 0.95); // desconto por lealdade
      st.events.unshift(`${a.name} evoluiu para ${a.overall}★ em ${PORTFOLIO_LABEL[a.portfolio]}.`);
      res.news.push({
        titleKey: `${a.name} vira "garoto prodígio" da gestão`,
        detail: `Promovido(a) a ${a.overall}★ na pasta ${PORTFOLIO_LABEL[a.portfolio]}.`,
        kind: "success",
      });
      // Alta visibilidade => risco de assédio.
      if (a.overall >= 4 && !a.poached && rng() < 0.55) {
        const by = pick(PARTIES.filter((x) => x !== a.party), rng);
        a.poached = { by, monthsLeft: 3 };
        st.events.unshift(`${by} tenta atrair ${a.name} com proposta.`);
        res.news.push({
          titleKey: `${by} assedia ${a.name}`,
          detail: `Assessor promissor está na mira. Retenha com bônus ou perca o quadro.`,
          kind: "warning",
        });
      }
    }

    // Assédio pendente decai; se expira sem retenção, ele sai.
    if (a.poached) {
      a.poached.monthsLeft -= 1;
      if (a.poached.monthsLeft <= 0) {
        res.news.push({
          titleKey: `${a.name} deixou a gestão`,
          detail: `Migrou para ${a.poached.by}. A pasta ${PORTFOLIO_LABEL[a.portfolio]} ficou vaga.`,
          kind: "danger",
        });
        a.betrayed = true;
        delete st.hired[a.portfolio];
        res.approvalDelta -= 1.5;
        continue;
      }
    }

    // Lealdade baixa: risco de corrupção/vazamento.
    if (a.loyalty < 40 && rng() < (40 - a.loyalty) / 400) {
      // Desvio: até 2% do orçamento (via multiplicador do salário).
      const skim = Math.round(a.salary * (2 + rng() * 6));
      res.treasuryDelta -= skim;
      res.mpRiskDelta += 3;
      res.news.push({
        titleKey: `Suspeita de desvio em ${PORTFOLIO_LABEL[a.portfolio]}`,
        detail: `Auditoria interna aponta R$${skim.toLocaleString("pt-BR")} sem comprovação. Fonte: ${a.name}.`,
        kind: "danger",
      });
      a.loyalty = clamp(a.loyalty - 5, 0, 100);
    } else if (a.loyalty < 55 && rng() < 0.03) {
      // Vazamento à imprensa.
      res.mpRiskDelta += 2;
      res.approvalDelta -= 0.6;
      res.news.push({
        titleKey: `Vazamento incomoda a Prefeitura`,
        detail: `Documento interno de ${PORTFOLIO_LABEL[a.portfolio]} apareceu na imprensa.`,
        kind: "warning",
      });
    }
  }

  return res;
}

/* ---------------- Gabinete inicial (setup no início do jogo) ---------------- */

/**
 * Constrói uma pool inicial de candidatos para a tela de "montagem de gabinete".
 * Retorna 6 candidatos por pasta, priorizando arquétipos temáticos.
 */
/**
 * Mapeia o `personaId` do prefeito (POLITICIAN_PRESETS) para os `id`s de
 * arquétipos de assessor que fazem paródia da MESMA figura real. Serve para
 * evitar imersão quebrada: se o jogador está de Zuza (paródia do Lula), o
 * arquétipo "Luizinho da Sirva" (também paródia do Lula) é filtrado do
 * gabinete. Só listar quando ambos apontam para a mesma pessoa real.
 */
const PERSONA_ARQ_CONFLICTS: Record<string, string[]> = {
  zuza: ["arq_luis_da_silva"],
  facir_bonossauro: ["arq_bonossauro"],
  zeitu_vargas: ["arq_getúlio"],
  jusselino: ["arq_juscelino"],
  collor_melão: ["arq_collor"],
  fhc_carvalho: ["arq_fhc"],
  dilmara: ["arq_dilmara"],
  vitinho_viana: ["arq_vitinho_viana"],
};

export function initialCabinetPool(
  seed: string,
  mayorPersonaId?: string,
): Record<PortfolioId, Advisor[]> {
  const rng = seededRng(seed + ":cabinet", { rngCursor: 0 } as GameState);
  const mayorIdeo = mayorPersonaId ? findPolitician(mayorPersonaId)?.ideology ?? 0 : 0;
  const out = {} as Record<PortfolioId, Advisor[]>;
  const usedNames = new Set<string>();
  const bannedArqIds = new Set<string>(
    mayorPersonaId ? (PERSONA_ARQ_CONFLICTS[mayorPersonaId] ?? []) : [],
  );
  for (const p of PORTFOLIOS) {
    const list: Advisor[] = [];
    const pool = archetypesForPortfolio(p).filter(
      (a) => !usedNames.has(a.name) && !bannedArqIds.has(a.id),
    );
    const shuffled = [...pool].sort(() => rng() - 0.5).slice(0, 4);
    for (const a of shuffled) {
      const cand = makeArchetypeCandidate(a, p, rng, mayorIdeo);
      list.push(cand);
      usedNames.add(cand.name);
    }
    let guard = 0;
    while (list.length < 6 && guard < 40) {
      guard += 1;
      const cand = makeCandidate(p, rng, mayorIdeo);
      if (usedNames.has(cand.name)) continue;
      list.push(cand);
      usedNames.add(cand.name);
    }
    out[p] = list;
  }
  return out;
}


/**
 * Aplica um gabinete pré-selecionado ao estado (usado logo após startGame).
 * Não cobra multa nem salário retroativo; primeiro salário sai no mês 2.
 */
export function setInitialCabinet(
  s: GameState,
  picks: Partial<Record<PortfolioId, Advisor>>,
): void {
  const st = ensureAdvisors(s);
  for (const p of PORTFOLIOS) {
    const a = picks[p];
    if (!a) continue;
    st.hired[p] = { ...a, monthsInOffice: 0, xp: 0 };
    st.events.unshift(`Gabinete inicial: ${a.name} (${a.overall}★) — ${PORTFOLIO_LABEL[p]}.`);
  }
  st.events = st.events.slice(0, 20);
}

/* ---------------- Pool global (livre atribuição) ---------------- */

/**
 * Candidato do pool global do gabinete inicial. Diferente de `Advisor`, o
 * `portfolio` aqui é apenas a pasta "primária" sugerida; o jogador decide
 * livremente onde alocar (respeitando `compatible`, que serve só como dica
 * visual — a atribuição é permitida em qualquer pasta).
 */
export interface CabinetCandidate extends Advisor {
  /** Pastas em que o candidato se destaca (usadas como filtro/hint). */
  compatible: PortfolioId[];
  /** Multiplicador salarial herdado do arquétipo (para recomputar salário
   *  quando o jogador atribui a pasta diferente). */
  _salaryMult?: number;
}

/**
 * Gera um roster global e único de candidatos para a montagem do gabinete.
 * Inclui todos os arquétipos permitidos (sem repetir nomes / respeitando
 * conflito com a persona do prefeito) + alguns candidatos genéricos.
 */
export function initialCabinetRoster(
  seed: string,
  mayorPersonaId?: string,
): CabinetCandidate[] {
  const rng = seededRng(seed + ":cabinet-roster", { rngCursor: 0 } as GameState);
  const mayorIdeo = mayorPersonaId ? findPolitician(mayorPersonaId)?.ideology ?? 0 : 0;
  const bannedArqIds = new Set<string>(
    mayorPersonaId ? (PERSONA_ARQ_CONFLICTS[mayorPersonaId] ?? []) : [],
  );
  const used = new Set<string>();
  const out: CabinetCandidate[] = [];

  const archs = ADVISOR_ARCHETYPES.filter((a) => !bannedArqIds.has(a.id));
  const shuffled = [...archs].sort(() => rng() - 0.5);
  for (const a of shuffled) {
    if (used.has(a.name)) continue;
    const primary = a.portfolios[0] ?? "articulation";
    const base = makeArchetypeCandidate(a, primary, rng, mayorIdeo);
    const cand: CabinetCandidate = {
      ...base,
      compatible: [...a.portfolios],
      _salaryMult: a.salaryMult,
    };
    out.push(cand);
    used.add(cand.name);
  }

  let guard = 0;
  const targetExtras = 8;
  let added = 0;
  while (added < targetExtras && guard < 60) {
    guard += 1;
    const p = PORTFOLIOS[Math.floor(rng() * PORTFOLIOS.length)];
    const cand = makeCandidate(p, rng, mayorIdeo) as CabinetCandidate;
    if (used.has(cand.name)) continue;
    cand.compatible = [p];
    out.push(cand);
    used.add(cand.name);
    added += 1;
  }
  return out;
}

/**
 * Reatribui um candidato do pool a uma pasta arbitrária, recomputando salário
 * (que depende da pasta) e devolvendo um `Advisor` pronto para ser aplicado.
 */
export function assignCandidateToPortfolio(
  c: CabinetCandidate,
  portfolio: PortfolioId,
): Advisor {
  const salary = Math.round(
    salaryFor(c.overall, portfolio, c.party) * (c._salaryMult ?? 1),
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { compatible: _c, _salaryMult: _m, ...rest } = c;
  return { ...rest, portfolio, salary };
}

