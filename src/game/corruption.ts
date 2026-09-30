/**
 * Módulo: Corrupção e Ilícitos Administrativos.
 *
 * Introduz mecânicas ilícitas (rachadinha, empresa de fachada / superfaturamento,
 * propina para P-CENTRO) que o jogador pode usar para alimentar um "Fundo Pessoal
 * de Campanha" (caixa 2). Toda ação acumula "heat" (calor investigativo) que
 * eleva o risco no Ministério Público e, caso denunciada, gera escândalo
 * midiático, apreensão parcial do caixa 2, salto de mpRisk e impeachment.
 *
 * Design:
 *  - Depende da Lealdade/Honestidade do assessor da pasta (state.advisors).
 *    Lealdade alta bloqueia o ato (o assessor recusa/denuncia).
 *  - Cada ilícito paga em fluxo (rachadinha) ou em lump-sum (fachada).
 *  - Cargos fantasmas degradam a eficiência do departamento (encaminhado como
 *    penalidade de aprovação/felicidade dos moradores atendidos por aquela pasta).
 *  - Shell contracts atrasam a obra (dobro do tempo, marcado no ledger) e
 *    aumentam a probabilidade de falha estrutural — reforçando o risco de
 *    desastre (integra com disasters via `structuralRisk`).
 *  - Propinas ao P-CENTRO gastam do slush e devolvem "governabilidade": boost
 *    imediato na aprovação legislativa (integra com legislature/negotiation).
 */

import type { GameState, NewsItem } from "./types";
import type { PortfolioId } from "./advisors";

export interface GhostPosition {
  id: string;
  portfolio: PortfolioId;
  /** Fluxo mensal desviado para o caixa 2 (R$). */
  monthly: number;
  /** Meses ativos (para narrativa). */
  ageMonths: number;
  /** Nome fictício para dar textura ao painel. */
  alias: string;
}

export interface ShellContract {
  id: string;
  portfolio: PortfolioId;
  projectName: string;
  /** Valor "verdadeiro" da obra (R$). */
  baseValue: number;
  /** 0..0.40 — parcela superfaturada. */
  overpricePct: number;
  /** Meses restantes até a obra ser entregue (o dobro do previsto). */
  monthsRemaining: number;
  /** Total drenado para o caixa 2 (ao aprovar). */
  slushPaid: number;
  /** Cria risco estrutural crescente na obra entregue (0..1). */
  structuralRisk: number;
}

export interface BribeRecord {
  id: string;
  month: number;
  year: number;
  amount: number;
  purpose: string;
}

export type InvestigationPhase =
  | "clean"      // heat baixo — MP não olha
  | "attention"  // MP monitora (radar)
  | "probe"      // inquérito civil aberto
  | "raid"       // busca & apreensão em curso
  | "indicted";  // denúncia oferecida à Câmara

export interface PleaBargainPrompt {
  /** Assessor selecionado para pressão. */
  portfolio: PortfolioId;
  advisorName: string;
  loyalty: number;
  /** Custo em caixa 2 para bancar advogado top. */
  legalFee: number;
  /** Dia/mês em que a oferta expira. */
  createdMonth: number;
  createdYear: number;
}

export interface CorruptionState {
  /** Caixa 2 — Fundo Pessoal de Campanha. Nunca aparece no ledger oficial. */
  slushFund: number;
  /** 0..100 — pressão investigativa cumulativa. */
  heat: number;
  /** Denúncias formalizadas (para narrativa). */
  denunciations: number;
  ghosts: GhostPosition[];
  shells: ShellContract[];
  bribes: BribeRecord[];
  /** Últimos eventos internos (log curto). */
  events: string[];
  /** Marca que o jogador já foi exposto pelo menos uma vez neste mandato. */
  everExposed: boolean;
  /** Fase da investigação — barra "Atenção do MP". */
  phase: InvestigationPhase;
  /** Prompt ativo de delação premiada (nulo se nenhuma). */
  plea: PleaBargainPrompt | null;
  /** Total de operações PF ao longo do mandato (para relatório final). */
  raidsSuffered: number;
  /** Cutscene de cassação já disparada. */
  ousted: boolean;
}

const FAKE_NAMES = [
  "João da Silva", "Maria Oliveira", "Pedro Souza", "Ana Costa",
  "Carlos Ribeiro", "Fernanda Alves", "Roberto Lima", "Luciana Pinto",
  "Márcio Duarte", "Beatriz Neves", "Sandro Machado", "Cláudia Martins",
];

const PROJECT_NAMES = [
  "Ampliação da Linha Roxa do Metrô",
  "Complexo Hospitalar Zona Leste",
  "Viaduto do Anhangaí",
  "Corredor BRT Radial Sul",
  "Escola Técnica Municipal",
  "Estação Elevatória de Esgoto",
];

export function defaultCorruption(): CorruptionState {
  return {
    slushFund: 0,
    heat: 0,
    denunciations: 0,
    ghosts: [],
    shells: [],
    bribes: [],
    events: [],
    everExposed: false,
    phase: "clean",
    plea: null,
    raidsSuffered: 0,
    ousted: false,
  };
}

export function ensureCorruption(s: GameState): void {
  const anyS = s as GameState & { corruption?: CorruptionState };
  if (!anyS.corruption) anyS.corruption = defaultCorruption();
  else {
    // Migração leve para saves antigos.
    const c = anyS.corruption as Partial<CorruptionState> & CorruptionState;
    if (!c.phase) c.phase = "clean";
    if (c.plea === undefined) c.plea = null;
    if (c.raidsSuffered === undefined) c.raidsSuffered = 0;
    if (c.ousted === undefined) c.ousted = false;
  }
}


const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Honestidade = 100 - lealdade… não. Aqui usamos a própria lealdade como
 *  proxy inversa: assessores de baixa lealdade toparão desviar. */
export function corruptibility(loyalty: number): number {
  // 0..1. loyalty=30 ⇒ 0.7 (topa fácil); loyalty=80 ⇒ 0.2.
  return clamp((100 - loyalty) / 100, 0, 1);
}

function log(c: CorruptionState, msg: string) {
  c.events.unshift(msg);
  if (c.events.length > 24) c.events.length = 24;
}

/* ---------------- Ghost positions (rachadinha) ---------------- */

export function canCreateGhost(s: GameState, portfolio: PortfolioId): { ok: boolean; reason?: string } {
  const advisor = s.advisors?.hired?.[portfolio];
  if (!advisor) return { ok: false, reason: "Sem assessor na pasta." };
  if (advisor.loyalty >= 70) return { ok: false, reason: "Assessor íntegro demais — recusaria e denunciaria." };
  return { ok: true };
}

export function createGhost(s: GameState, portfolio: PortfolioId): GameState {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  const check = canCreateGhost(s, portfolio);
  if (!check.ok) return s;
  const advisor = s.advisors!.hired![portfolio]!;
  // Base salário mensal desviado varia com escala da folha do assessor.
  const monthly = Math.round(advisor.salary * (0.12 + corruptibility(advisor.loyalty) * 0.10));
  const alias = FAKE_NAMES[c.ghosts.length % FAKE_NAMES.length];
  c.ghosts.push({
    id: `ghost-${Date.now().toString(36)}-${c.ghosts.length}`,
    portfolio,
    monthly,
    ageMonths: 0,
    alias,
  });
  // Custo político imediato: assessor perde 5 de lealdade (agora sabe do esquema).
  advisor.loyalty = clamp(advisor.loyalty - 5, 0, 100);
  c.heat = clamp(c.heat + 3, 0, 100);
  log(c, `Rachadinha aberta: ${alias} nomeado na pasta ${portfolio}.`);
  return s;
}

export function removeGhost(s: GameState, id: string): GameState {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  const g = c.ghosts.find((x) => x.id === id);
  if (!g) return s;
  c.ghosts = c.ghosts.filter((x) => x.id !== id);
  c.heat = clamp(c.heat - 1, 0, 100);
  log(c, `Cargo fantasma ${g.alias} exonerado silenciosamente.`);
  return s;
}

/* ---------------- Shell contracts (empresa de fachada) ---------------- */

export function canLaunchShell(s: GameState, portfolio: PortfolioId): { ok: boolean; reason?: string } {
  const advisor = s.advisors?.hired?.[portfolio];
  if (!advisor) return { ok: false, reason: "Sem assessor na pasta." };
  if (advisor.loyalty >= 60) return { ok: false, reason: "Assessor recusaria intermediar 'laranja'." };
  if (portfolio !== "works" && portfolio !== "finance" && portfolio !== "mobility") {
    return { ok: false, reason: "Fraude em licitação exige pasta de Obras, Finanças ou Mobilidade." };
  }
  return { ok: true };
}

/**
 * Aprova uma licitação direcionada. O tesouro paga o valor superfaturado
 * imediatamente (obra entra "em andamento"); a parcela superfaturada é
 * transferida para o slush. Obra leva o dobro do tempo.
 */
export function launchShell(
  s: GameState,
  portfolio: PortfolioId,
  baseValue: number,
  overpricePct: number,
): GameState {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  const check = canLaunchShell(s, portfolio);
  if (!check.ok) return s;
  const over = clamp(overpricePct, 0.05, 0.40);
  const base = Math.max(500_000, Math.round(baseValue));
  const inflated = Math.round(base * (1 + over));
  if (s.treasury < inflated) return s;

  const slushCut = Math.round(base * over * 0.70); // parte do sobrepreço vira caixa 2
  s.treasury -= inflated;
  s.lastExpenses = (s.lastExpenses ?? 0) + inflated;
  s.lastExpensesBreakdown.infra = (s.lastExpensesBreakdown.infra ?? 0) + inflated;
  c.slushFund += slushCut;

  const advisor = s.advisors!.hired![portfolio]!;
  advisor.loyalty = clamp(advisor.loyalty - 8, 0, 100);

  const projectName = PROJECT_NAMES[c.shells.length % PROJECT_NAMES.length];
  c.shells.push({
    id: `shell-${Date.now().toString(36)}-${c.shells.length}`,
    portfolio,
    projectName,
    baseValue: base,
    overpricePct: over,
    monthsRemaining: 24, // dobrado
    slushPaid: slushCut,
    structuralRisk: over * 0.9, // 40% sobrepreço ⇒ 36% de risco estrutural na obra
  });

  c.heat = clamp(c.heat + 8 + over * 20, 0, 100);
  log(c, `Licitação direcionada para "${projectName}" (+${Math.round(over * 100)}% sobrepreço).`);

  // Consequência estrutural imediata: eleva risco no módulo de desastres.
  const dis = (s as unknown as { disasters?: { structuralRisk?: number } }).disasters;
  if (dis) dis.structuralRisk = clamp((dis.structuralRisk ?? 0) + over * 5, 0, 100);

  return s;
}

/* ---------------- Bribes — P-CENTRO ---------------- */

export function canBribeCouncil(s: GameState): { ok: boolean; reason?: string } {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  if (c.slushFund < 200_000) return { ok: false, reason: "Caixa 2 insuficiente (mín. R$ 200k)." };
  const articulator = s.advisors?.hired?.articulation;
  if (!articulator) return { ok: false, reason: "Sem assessor de Articulação (necessário para intermediar)." };
  return { ok: true };
}

/**
 * Distribui propina a vereadores do P-CENTRO em troca de governabilidade.
 * Aumenta pontualmente a aprovação legislativa; consome caixa 2; sobe heat.
 */
export function bribeCouncil(s: GameState, amount: number): GameState {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  const check = canBribeCouncil(s);
  if (!check.ok) return s;
  const spend = Math.max(200_000, Math.min(amount, c.slushFund));
  c.slushFund -= spend;
  c.bribes.push({
    id: `bribe-${Date.now().toString(36)}`,
    month: s.month, year: s.year,
    amount: spend,
    purpose: "Compra de governabilidade (P-CENTRO)",
  });

  // Boost tangível na governabilidade legislativa.
  const negot = (s as unknown as { legislature?: { govSupport?: number } }).legislature;
  if (negot && typeof negot.govSupport === "number") {
    negot.govSupport = clamp(negot.govSupport + spend / 60_000, 0, 100);
  }
  s.approval = clamp(s.approval + 2, 0, 100);

  c.heat = clamp(c.heat + 4 + spend / 500_000, 0, 100);
  log(c, `Propina distribuída ao P-CENTRO: R$ ${(spend / 1000).toFixed(0)}k.`);
  return s;
}

/** Move do caixa 2 para orçamento clandestino de mídia (PiuPiu bots). */
export function fundBotsFromSlush(s: GameState, amount: number): GameState {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  const spend = Math.max(50_000, Math.min(amount, c.slushFund));
  if (c.slushFund < 50_000) return s;
  c.slushFund -= spend;
  c.heat = clamp(c.heat + 2, 0, 100);
  const ops = (s as unknown as { covertOps?: { budgetPool?: number } }).covertOps;
  if (ops) ops.budgetPool = (ops.budgetPool ?? 0) + spend;
  log(c, `R$ ${(spend / 1000).toFixed(0)}k transferidos para operações digitais.`);
  return s;
}

/* ---------------- Monthly tick ---------------- */

export interface CorruptionTickOut {
  approvalDelta: number;
  happinessDelta: number;
  mpRiskDelta: number;
  news: NewsItem[];
}

export function tickCorruptionMonthly(s: GameState, rng: () => number): CorruptionTickOut {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  const out: CorruptionTickOut = { approvalDelta: 0, happinessDelta: 0, mpRiskDelta: 0, news: [] };

  // 1) Fluxo de rachadinhas para o caixa 2.
  let ghostFlow = 0;
  for (const g of c.ghosts) {
    ghostFlow += g.monthly;
    g.ageMonths += 1;
  }
  c.slushFund += ghostFlow;
  // Cada cargo fantasma degrada a percepção de serviços da pasta afetada.
  const ghostPenalty = c.ghosts.length * 0.4;
  out.happinessDelta -= ghostPenalty;
  out.approvalDelta -= ghostPenalty * 0.5;

  // 2) Andamento das obras faccciosas — cada mês reduz o restante; ao terminar,
  //    aplica risco estrutural residual em disasters.
  for (const sh of c.shells) {
    sh.monthsRemaining = Math.max(0, sh.monthsRemaining - 1);
    if (sh.monthsRemaining === 0 && sh.structuralRisk > 0) {
      const dis = (s as unknown as { disasters?: { structuralRisk?: number } }).disasters;
      if (dis) dis.structuralRisk = clamp((dis.structuralRisk ?? 0) + sh.structuralRisk * 6, 0, 100);
      log(c, `Obra "${sh.projectName}" entregue com material inferior — risco estrutural elevado.`);
      sh.structuralRisk = 0;
    }
  }
  // Remove obras concluídas do painel após 6 meses.
  c.shells = c.shells.filter((sh) => sh.monthsRemaining > 0 || sh.structuralRisk > 0);

  // 3) Escoamento gradual do heat (a memória investigativa esfria).
  c.heat = clamp(c.heat - 1.2, 0, 100);
  // Heat cresce todo mês proporcional aos ativos.
  c.heat = clamp(
    c.heat + c.ghosts.length * 0.8 + c.shells.length * 1.5,
    0,
    100,
  );

  // 4) Encaminha heat para o Ministério Público (integração leve).
  out.mpRiskDelta += c.heat * 0.08;

  // 5) Atualiza a fase de investigação (barra "Atenção do MP").
  const prevPhase = c.phase;
  const hasSchemes = c.ghosts.length > 0 || c.shells.length > 0 || c.bribes.length > 0;
  c.phase = derivePhase(c.heat, hasSchemes, c.everExposed);
  if (c.phase !== prevPhase && c.phase !== "clean") {
    const label: Record<InvestigationPhase, string> = {
      clean: "arquiva",
      attention: "monitora movimentações do gabinete",
      probe: "abre inquérito civil contra o(a) prefeito(a)",
      raid: "cumpre mandados de busca e apreensão na prefeitura",
      indicted: "oferece denúncia à Câmara Municipal",
    };
    out.news.push({
      id: `mp-phase-${Date.now()}`,
      day: s.day, month: s.month, year: s.year,
      kind: c.phase === "attention" ? "warning" : "danger",
      titleKey: `Ministério Público ${label[c.phase]}||Public prosecutor ${label[c.phase]}`,
      detail: `Nível investigativo: ${c.phase.toUpperCase()}. Heat=${c.heat.toFixed(0)}.`,
    });
    log(c, `Fase investigativa: ${c.phase}.`);
  }

  // 6) Denúncia — probabilidade cresce com heat + magnitude.
  const magnitude = c.ghosts.length * 0.01 + c.shells.length * 0.02;
  const pDetect = c.heat / 1400 + magnitude;
  if (rng() < pDetect && hasSchemes) {
    c.denunciations += 1;
    c.everExposed = true;
    const seized = Math.round(c.slushFund * 0.5);
    c.slushFund -= seized;
    out.approvalDelta -= 12;
    out.happinessDelta -= 5;
    out.mpRiskDelta += 25;
    const ov = (s as unknown as { oversight?: { impeachmentRisk?: number } }).oversight;
    if (ov && typeof ov.impeachmentRisk === "number") {
      ov.impeachmentRisk = clamp(ov.impeachmentRisk + 15, 0, 100);
    }
    out.news.push({
      id: `corr-${Date.now()}`,
      day: s.day, month: s.month, year: s.year,
      kind: "danger",
      titleKey: "MP mira gabinete: 'esquema de fantasmas' vem à tona",
      detail: `Operação apreende R$ ${(seized / 1000).toFixed(0)}k, indicia ${c.ghosts.length + c.shells.length} envolvidos.`,
    });
    if (c.ghosts.length > 0) c.ghosts.shift();
    c.heat = clamp(c.heat - 30, 0, 100);
    log(c, `⚠️ Denúncia formalizada — caixa 2 parcialmente apreendido.`);
  }

  // 7) Raid matinal — quando a fase escala para "raid" e ainda não há delação aberta.
  if (c.phase === "raid" && !c.plea && hasSchemes) {
    // 55% de chance por mês de a PF bater à porta.
    if (rng() < 0.55) {
      const raidOut = triggerMorningRaid(s, rng);
      out.approvalDelta += raidOut.approvalDelta;
      out.happinessDelta += raidOut.happinessDelta;
      out.mpRiskDelta += raidOut.mpRiskDelta;
      out.news.push(...raidOut.news);
    }
  }

  // 8) Expiração automática de plea não respondido (o assessor decide por conta própria).
  if (c.plea) {
    const monthsWaiting =
      (s.year - c.plea.createdYear) * 12 + (s.month - c.plea.createdMonth);
    if (monthsWaiting >= 1) {
      // Silêncio do prefeito é lido como abandono — assessor decide sozinho.
      const auto = resolveDelacao(s, "ignore");
      out.news.push(...auto.news);
      out.approvalDelta += auto.approvalDelta;
      out.mpRiskDelta += auto.mpRiskDelta;
    }
  }

  return out;
}

/* ---------------- Investigation phase & raid ---------------- */

function derivePhase(
  heat: number,
  hasSchemes: boolean,
  everExposed: boolean,
): InvestigationPhase {
  if (!hasSchemes && heat < 15) return "clean";
  if (heat >= 88 && everExposed) return "indicted";
  if (heat >= 72) return "raid";
  if (heat >= 45) return "probe";
  if (heat >= 20) return "attention";
  return "clean";
}

/** Rótulo curto para UI. */
export function investigationLabel(phase: InvestigationPhase, lang: "pt" | "en" = "pt"): string {
  const map: Record<InvestigationPhase, [string, string]> = {
    clean:     ["Sem alertas", "No alerts"],
    attention: ["Monitoramento", "Under watch"],
    probe:     ["Inquérito", "Formal probe"],
    raid:      ["Busca & apreensão", "Search & seizure"],
    indicted:  ["Denúncia à Câmara", "Indicted"],
  };
  return map[phase][lang === "pt" ? 0 : 1];
}

export interface RaidOut {
  approvalDelta: number;
  happinessDelta: number;
  mpRiskDelta: number;
  news: NewsItem[];
}

/**
 * Evento matutino: PF cumpre mandados na prefeitura.
 * - Apreende 35% do caixa 2.
 * - Reduz 50% dos seguidores oficiais no PiuPiu.
 * - Cria prompt de delação premiada com o assessor de menor lealdade envolvido.
 * - Sobe impeachmentRisk.
 */
export function triggerMorningRaid(s: GameState, rng: () => number): RaidOut {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  const out: RaidOut = { approvalDelta: 0, happinessDelta: 0, mpRiskDelta: 0, news: [] };

  const seized = Math.round(c.slushFund * 0.35);
  c.slushFund -= seized;
  c.raidsSuffered += 1;
  c.everExposed = true;

  out.approvalDelta -= 18;
  out.happinessDelta -= 6;
  out.mpRiskDelta += 20;

  // Metade dos seguidores do prefeito no PiuPiu evaporam.
  const piupiu = (s as unknown as { piupiu?: { officialFollowers?: number } }).piupiu;
  if (piupiu && typeof piupiu.officialFollowers === "number") {
    piupiu.officialFollowers = Math.round(piupiu.officialFollowers * 0.5);
  }
  // Mídia tradicional (Rede Cubo) — desliga aprovação em 50% do valor atual.
  s.approval = clamp(s.approval * 0.5, 0, 100);

  // Oversight escala.
  const ov = (s as unknown as { oversight?: { impeachmentRisk?: number; mpRisk?: number } }).oversight;
  if (ov) {
    if (typeof ov.impeachmentRisk === "number") {
      ov.impeachmentRisk = clamp(ov.impeachmentRisk + 25, 0, 100);
    }
    if (typeof ov.mpRisk === "number") {
      ov.mpRisk = clamp(ov.mpRisk + 20, 0, 100);
    }
  }

  // Seleciona assessor "mais fraco" nas pastas envolvidas.
  const involvedPorts: PortfolioId[] = [
    ...c.ghosts.map((g) => g.portfolio),
    ...c.shells.map((sh) => sh.portfolio),
  ];
  const hired = s.advisors?.hired ?? {};
  let weakest: { portfolio: PortfolioId; name: string; loyalty: number } | null = null;
  for (const p of involvedPorts) {
    const a = hired[p];
    if (!a) continue;
    if (!weakest || a.loyalty < weakest.loyalty) {
      weakest = { portfolio: p, name: a.name, loyalty: a.loyalty };
    }
  }
  if (weakest) {
    // Advogado top custa 20% do que restou do caixa 2, mín. R$ 300k, máx. R$ 2M.
    const legalFee = clamp(Math.round(c.slushFund * 0.20), 300_000, 2_000_000);
    c.plea = {
      portfolio: weakest.portfolio,
      advisorName: weakest.name,
      loyalty: weakest.loyalty,
      legalFee,
      createdMonth: s.month,
      createdYear: s.year,
    };
  }

  out.news.push({
    id: `raid-${Date.now()}`,
    day: s.day, month: s.month, year: s.year,
    kind: "danger",
    titleKey: "🚨 PF cumpre mandados na prefeitura — gabinete é vasculhado||🚨 Federal Police raids City Hall",
    detail: weakest
      ? `${weakest.name} conduzido(a) coercitivamente. Delação premiada em aberto.`
      : `Documentos apreendidos, servidores conduzidos.`,
  });
  log(c, `🚔 Operação PF: R$ ${(seized / 1000).toFixed(0)}k apreendidos.`);
  // Suprime rng warning
  void rng;

  return out;
}

/* ---------------- Delação Premiada ---------------- */

export type PleaChoice = "lawyer" | "abandon" | "ignore";

/**
 * Resolve o prompt de delação:
 *  - "lawyer": paga advogado do caixa 2. Se o assessor é leal (>=60), assume culpa
 *    sozinho; senão o advogado atrasa, mas o assessor delata mesmo assim.
 *  - "abandon": prefeito abandona o assessor à própria sorte.
 *  - "ignore": timeout — assessor decide por conta própria (equivale a abandon).
 */
export function resolveDelacao(s: GameState, choice: PleaChoice): {
  approvalDelta: number;
  mpRiskDelta: number;
  news: NewsItem[];
} {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  const out = { approvalDelta: 0, mpRiskDelta: 0, news: [] as NewsItem[] };
  if (!c.plea) return out;
  const p = c.plea;
  const advisor = s.advisors?.hired?.[p.portfolio];

  let cooperates = false;
  let lawyerBought = false;

  if (choice === "lawyer") {
    if (c.slushFund < p.legalFee) {
      log(c, `Caixa 2 insuficiente para bancar defesa de ${p.advisorName}.`);
      cooperates = p.loyalty < 50;
    } else {
      c.slushFund -= p.legalFee;
      lawyerBought = true;
      // Advogado top blinda quem tem lealdade >= 60.
      cooperates = p.loyalty < 60 && Math.random() < (60 - p.loyalty) / 60;
    }
  } else {
    // abandon / ignore — advisor decide pela sua própria lealdade.
    cooperates = p.loyalty < 65;
  }

  const ov = (s as unknown as { oversight?: { impeachmentRisk?: number; mpRisk?: number } }).oversight;

  if (cooperates) {
    // Delação. Perde slush, sobe impeachment, some com o assessor (foi preso).
    const seized = Math.round(c.slushFund * 0.65);
    c.slushFund -= seized;
    out.approvalDelta -= 20;
    out.mpRiskDelta += 30;
    if (ov) {
      if (typeof ov.impeachmentRisk === "number") ov.impeachmentRisk = clamp(ov.impeachmentRisk + 35, 0, 100);
      if (typeof ov.mpRisk === "number") ov.mpRisk = clamp(ov.mpRisk + 25, 0, 100);
    }
    // Assessor é "afastado" — remove do gabinete e do esquema.
    if (advisor && s.advisors?.hired) {
      delete s.advisors.hired[p.portfolio];
    }
    c.ghosts = c.ghosts.filter((g) => g.portfolio !== p.portfolio);
    out.news.push({
      id: `plea-yes-${Date.now()}`,
      day: s.day, month: s.month, year: s.year,
      kind: "danger",
      titleKey: `${p.advisorName} fecha delação premiada — cita o(a) prefeito(a)||${p.advisorName} signs plea bargain — implicates mayor`,
      detail: `Nova apreensão de R$ ${(seized / 1000).toFixed(0)}k. Impeachment ganha tração.`,
    });
    log(c, `🕊️ ${p.advisorName} delatou (lealdade ${p.loyalty}).`);
  } else {
    // Assessor cala. Advogado custa caro, mas segura o processo.
    out.approvalDelta -= lawyerBought ? 4 : 8;
    out.mpRiskDelta += lawyerBought ? 5 : 10;
    if (ov?.impeachmentRisk !== undefined) {
      ov.impeachmentRisk = clamp(ov.impeachmentRisk + (lawyerBought ? 4 : 8), 0, 100);
    }
    // Assessor "loyal" ganha vínculo — sobe lealdade.
    if (advisor && lawyerBought) advisor.loyalty = clamp(advisor.loyalty + 8, 0, 100);
    out.news.push({
      id: `plea-no-${Date.now()}`,
      day: s.day, month: s.month, year: s.year,
      kind: lawyerBought ? "info" : "warning",
      titleKey: lawyerBought
        ? `Defesa contratada segura ${p.advisorName} — silêncio no depoimento||Top defense keeps ${p.advisorName} silent`
        : `${p.advisorName} assume culpa sozinho(a) — sem delação||${p.advisorName} takes the fall alone`,
      detail: lawyerBought
        ? `R$ ${(p.legalFee / 1000).toFixed(0)}k do caixa 2 destinados à banca de advocacia.`
        : `Lealdade ${p.loyalty} sustentou o silêncio, mas o desgaste político continua.`,
    });
    log(c, `🤐 ${p.advisorName} não delatou (lawyer=${lawyerBought}).`);
  }

  c.plea = null;
  return out;
}

/** Dismiss/close plea sem custo (usado ao ignorar o pop-up permanentemente). */
export function dismissPlea(s: GameState): GameState {
  ensureCorruption(s);
  const c = (s as GameState & { corruption: CorruptionState }).corruption;
  c.plea = null;
  return s;
}

