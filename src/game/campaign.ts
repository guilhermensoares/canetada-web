/**
 * Campanha Eleitoral & Debates
 *
 * Cobre cinco eixos:
 *  1. Reputação/lealdade partidária que condiciona coligações (`coalitionOffers`).
 *  2. Insatisfação popular liberando "alianças inusitadas" (opposites attract).
 *  3. Promessas de campanha com custo fiscal diferido para o próximo mandato.
 *  4. IA de debate com estratégias (attack/defend/pivot/populist/technical) e
 *     resposta variada dependente do tema e do humor do eleitorado.
 *  5. Estado exposto para a UI: coligações, tempo de TV, projeção de pesquisa.
 *
 * Ativa-se automaticamente 6 meses antes do fim do mandato (mês 42 de 48).
 */

import type { GameState } from "./types";
import { PARTIES_TEMPLATE, TOTAL_SEATS, type PartyId } from "./politics";
import { POLITICIAN_PRESETS } from "./politicianPresets";

function mayorLean(state: GameState): number {
  const p = POLITICIAN_PRESETS.find(x => x.id === state.mayor.personaId);
  return p?.ideology ?? 0;
}
function rand(): number { return Math.random(); }
function monthsElapsed(state: GameState): number {
  const start = state.politics.election.termStartYear;
  return (state.year - start) * 12 + (state.month - 1);
}

/* -------------------- Types -------------------- */

export type DebateTopic =
  | "economy" | "security" | "health" | "education"
  | "transport" | "housing" | "corruption" | "environment";

export type DebateStrategy =
  | "attack"     // ataca o mandato atual
  | "defend"     // defende o legado
  | "pivot"      // muda o assunto
  | "populist"   // promete o mundo
  | "technical"; // dados e planos

export interface Opponent {
  id: string;
  namePt: string;
  nameEn: string;
  party: PartyId;
  /** -1 esq .. +1 dir */
  leaning: number;
  /** popularidade base 0..100 */
  base: number;
  /** perfil comportamental — pesos por estratégia */
  strategyBias: Record<DebateStrategy, number>;
  /** temas em que domina */
  strengths: DebateTopic[];
  /** tique verbal para a UI */
  slogan: string;
  archetype: "populist" | "technocrat" | "outsider" | "insider" | "moralist";
}

export interface Promise {
  id: string;
  topic: DebateTopic;
  textPt: string;
  textEn: string;
  /** custo fiscal MENSAL após a posse, se reeleito */
  monthlyCost: number;
  /** ganho imediato em % nas pesquisas */
  pollBoost: number;
  /** risco de virar boomerang se não cumprida (perda de aprovação em pontos) */
  breachPenalty: number;
  madeAtMonth: number;
}

export interface CoalitionOffer {
  id: string;
  party: PartyId;
  /** demanda: recursos ou compromissos ideológicos */
  demandPt: string;
  demandEn: string;
  /** custo em capital político para aceitar */
  pcCost: number;
  /** tempo de TV cedido (0..1) */
  tvShare: number;
  /** viabilidade — se aliança "inusitada" (leaning distante) fica cinza sem insatisfação alta */
  unusual: boolean;
  status: "pending" | "accepted" | "rejected";
}

export interface DebateExchange {
  round: number;
  speaker: "mayor" | string; // ou id do opponent
  strategy: DebateStrategy;
  topic: DebateTopic;
  linePt: string;
  lineEn: string;
  /** impacto no público -5..+5 pontos */
  swing: number;
}

export interface DebateState {
  active: boolean;
  topic: DebateTopic;
  round: number;
  maxRounds: number;
  exchanges: DebateExchange[];
  mayorScore: number;   // pontos acumulados
  scores: Record<string, number>; // por opponent id
}

export interface CampaignState {
  /** true quando estamos em período eleitoral (últimos 6 meses do mandato) */
  active: boolean;
  monthsUntilElection: number;

  /** reputação/lealdade do prefeito por partido (0..100) */
  partyLoyalty: Record<PartyId, number>;
  /** cansaço/insatisfação popular acumulada (0..100) */
  publicFatigue: number;

  opponents: Opponent[];
  coalitionOffers: CoalitionOffer[];
  acceptedCoalition: PartyId[];

  promises: Promise[];
  /** custo total mensal caso reeleito */
  committedMonthlyCost: number;

  /** distribuição do horário eleitoral gratuito (soma ≤ 1) */
  tvTime: { mayor: number; opponents: Record<string, number> };

  polls: { mayor: number; opponents: Record<string, number>; undecided: number };

  debate: DebateState | null;
  debateHistory: DebateState[];
}

/* -------------------- Opponents seed -------------------- */

const OPPONENT_POOL: Opponent[] = [
  {
    id: "op_ferreira", namePt: "Ferreirinha do Povo", nameEn: "Freddy the People's Man",
    party: "conserv", leaning: 0.7, base: 42,
    strategyBias: { attack: 0.45, defend: 0.05, pivot: 0.15, populist: 0.30, technical: 0.05 },
    strengths: ["security", "corruption"], archetype: "populist",
    slogan: "Bandido bom é bandido preso",
  },
  {
    id: "op_carla", namePt: "Carla Ribeiro", nameEn: "Carla Ribeiro",
    party: "prog", leaning: -0.6, base: 38,
    strategyBias: { attack: 0.30, defend: 0.10, pivot: 0.10, populist: 0.20, technical: 0.30 },
    strengths: ["health", "education"], archetype: "technocrat",
    slogan: "Cidade que cuida da gente",
  },
  {
    id: "op_dr_saulo", namePt: "Dr. Saulo Andrade", nameEn: "Dr. Saul Andrade",
    party: "center", leaning: 0.1, base: 35,
    strategyBias: { attack: 0.15, defend: 0.20, pivot: 0.20, populist: 0.10, technical: 0.35 },
    strengths: ["economy", "transport"], archetype: "insider",
    slogan: "Gestão com resultados",
  },
  {
    id: "op_madalena", namePt: "Pastora Madalena", nameEn: "Pastor Madalena",
    party: "conserv", leaning: 0.9, base: 28,
    strategyBias: { attack: 0.35, defend: 0.05, pivot: 0.10, populist: 0.35, technical: 0.15 },
    strengths: ["corruption", "housing"], archetype: "moralist",
    slogan: "Família, ordem e trabalho",
  },
  {
    id: "op_kaio", namePt: "Kaio Streamer", nameEn: "Kaio Streamer",
    party: "liberal", leaning: 0.4, base: 22,
    strategyBias: { attack: 0.40, defend: 0.05, pivot: 0.30, populist: 0.20, technical: 0.05 },
    strengths: ["economy", "corruption"], archetype: "outsider",
    slogan: "Prefeitura tem que rodar tipo startup",
  },
  {
    id: "op_val", namePt: "Val da Zona Leste", nameEn: "Val from East Side",
    party: "socialist", leaning: -0.85, base: 25,
    strategyBias: { attack: 0.35, defend: 0.10, pivot: 0.05, populist: 0.30, technical: 0.20 },
    strengths: ["housing", "transport"], archetype: "outsider",
    slogan: "A periferia no centro das decisões",
  },
];

/* -------------------- Debate lines library -------------------- */

const LINES: Record<DebateStrategy, Record<DebateTopic, [string, string][]>> = {
  attack: {
    economy: [["Sua gestão quebrou o caixa!", "You bankrupted the treasury!"]],
    security: [["Enquanto você dorme, a cidade sangra.", "While you sleep, the city bleeds."]],
    health: [["Falta remédio no posto, prefeito!", "The clinics have no meds, mayor!"]],
    education: [["Escola sem merenda, culpa sua.", "Empty school lunches — your fault."]],
    transport: [["Trânsito virou pesadelo!", "Traffic became a nightmare!"]],
    housing: [["Aluguel dobrou no seu mandato!", "Rent doubled under your watch!"]],
    corruption: [["Cheira mal esse contrato...", "That contract stinks..."]],
    environment: [["A cidade está debaixo d'água!", "The city is underwater!"]],
  },
  defend: {
    economy: [["Entregamos superávit e obras.", "We delivered surplus and works."]],
    security: [["Reforçamos a Guarda Municipal.", "We reinforced the city guard."]],
    health: [["Abrimos 12 novas UBSs.", "We opened 12 new clinics."]],
    education: [["Reformamos cada escola.", "We renovated every school."]],
    transport: [["O BRT saiu do papel!", "The BRT is running!"]],
    housing: [["Regularizamos mil famílias.", "We regularized a thousand families."]],
    corruption: [["Nosso governo é transparente.", "Our government is transparent."]],
    environment: [["Plantamos árvore em cada rua.", "A tree on every street."]],
  },
  pivot: {
    economy: [["O importante é falar do povo.", "Let's talk about the people."]],
    security: [["Segurança é responsabilidade do estado.", "Security is a state matter."]],
    health: [["O SUS depende do federal.", "Federal money runs the health system."]],
    education: [["Vamos falar de futuro, não de passado.", "Let's talk future, not past."]],
    transport: [["Transporte é assunto do governador.", "Transport is the governor's job."]],
    housing: [["Habitação exige plano nacional.", "Housing needs a national plan."]],
    corruption: [["Não vim aqui trocar acusações.", "I came for solutions, not accusations."]],
    environment: [["Isso é problema do mundo todo.", "This is a global problem."]],
  },
  populist: {
    economy: [["Vou ZERAR o IPTU!", "I will ZERO the property tax!"]],
    security: [["Câmera em CADA esquina!", "A camera on EVERY corner!"]],
    health: [["Consulta em 24 horas!", "Appointments within 24 hours!"]],
    education: [["Notebook para todo aluno!", "A laptop for every student!"]],
    transport: [["Ônibus GRÁTIS para todos!", "FREE buses for everyone!"]],
    housing: [["Aluguel congelado por 4 anos!", "Rent frozen for 4 years!"]],
    corruption: [["Cassação e cadeia para os corruptos!", "Jail for the corrupt!"]],
    environment: [["Uma árvore para cada morador!", "A tree per citizen!"]],
  },
  technical: {
    economy: [["Nosso plano libera R$ 180M via PPP.", "Our plan unlocks R$ 180M via PPP."]],
    security: [["Modelo Cerezo reduz 22% dos homicídios.", "Cerezo model cuts homicide 22%."]],
    health: [["Fila zero com AP-4 em 18 meses.", "Zero waitlist with AP-4 in 18 months."]],
    education: [["IDEB sobe 0,6 com tempo integral.", "IDEB rises 0.6 with full-day school."]],
    transport: [["Corredor exclusivo corta 12min.", "Dedicated lane cuts 12 min."]],
    housing: [["Locação social atende 4 mil.", "Social rental serves 4,000."]],
    corruption: [["Portal aberto e IA de auditoria.", "Open portal and audit AI."]],
    environment: [["MP2.5 -18% com Zona 30.", "PM2.5 -18% with Zone 30."]],
  },
};

/* -------------------- Init -------------------- */

export function defaultCampaign(): CampaignState {
  return {
    active: false,
    monthsUntilElection: 48,
    partyLoyalty: {
      prog: 50, socialist: 50, green: 50, center: 50, liberal: 50, conserv: 50,
    },
    publicFatigue: 20,
    opponents: [],
    coalitionOffers: [],
    acceptedCoalition: [],
    promises: [],
    committedMonthlyCost: 0,
    tvTime: { mayor: 0.25, opponents: {} },
    polls: { mayor: 30, opponents: {}, undecided: 70 },
    debate: null,
    debateHistory: [],
  };
}

export function ensureCampaign(state: GameState): GameState {
  if (!state.campaign) {
    return { ...state, campaign: defaultCampaign() };
  }
  return state;
}

/* -------------------- Monthly tick -------------------- */

const ELECTION_WINDOW = 6; // meses de campanha oficial
const MANDATE_MONTHS = 48;

export function tickCampaign(state: GameState): GameState {
  const s = ensureCampaign(state);
  const c = s.campaign!;
  const me = monthsElapsed(state);
  const monthsUntil = MANDATE_MONTHS - me;

  const next = structuredClone(s);
  const nc = next.campaign!;
  nc.monthsUntilElection = Math.max(0, monthsUntil);

  // Fatigue cresce lento com baixa aprovação
  const approvalGap = Math.max(0, 55 - state.approval);
  nc.publicFatigue = clamp(nc.publicFatigue + approvalGap * 0.03 - 0.5, 0, 100);

  // Lealdade partidária: cai se sem coligação ou aprovação baixa
  const ml = mayorLean(state);
  for (const p of PARTIES_TEMPLATE) {
    const affinity = 1 - Math.abs(ml - p.leaning) / 2; // 0..1
    const inCoal = nc.acceptedCoalition.includes(p.id);
    const drift = (state.approval - 50) * 0.03 + affinity * 0.4 + (inCoal ? 0.6 : -0.2);
    nc.partyLoyalty[p.id] = clamp(nc.partyLoyalty[p.id] + drift, 0, 100);
  }

  // Ativa campanha na janela final
  if (!nc.active && monthsUntil <= ELECTION_WINDOW && monthsUntil > 0) {
    activateCampaign(nc, state);
  }

  if (nc.active) {
    recomputePolls(nc, state);
    // Gerar ofertas periodicamente
    if (nc.coalitionOffers.filter(o => o.status === "pending").length < 2 && me % 1 === 0) {
      maybeAddCoalitionOffer(nc, state);
    }
  }

  return next;
}

function activateCampaign(nc: CampaignState, state: GameState) {
  nc.active = true;
  // Escolher 3 oponentes: 1 ideológico oposto forte, 1 próximo, 1 outsider
  const ml = mayorLean(state);
  const sorted = [...OPPONENT_POOL].sort((a, b) =>
    Math.abs(b.leaning - ml) - Math.abs(a.leaning - ml)
  );
  const picked = [sorted[0], sorted[sorted.length - 1], sorted[Math.floor(sorted.length / 2)]];
  nc.opponents = picked;
  const share = (1 - nc.tvTime.mayor) / picked.length;
  for (const op of picked) {
    nc.tvTime.opponents[op.id] = share;
    nc.polls.opponents[op.id] = op.base;
  }
}

function recomputePolls(nc: CampaignState, state: GameState) {
  // Base: aprovação × TV × promessas
  const promiseBoost = nc.promises.reduce((s, p) => s + p.pollBoost, 0);
  const coalBonus = nc.acceptedCoalition.length * 3;
  let mayor = state.approval * 0.55 + nc.tvTime.mayor * 30 + promiseBoost + coalBonus - nc.publicFatigue * 0.2;
  mayor = clamp(mayor, 5, 75);

  let total = mayor;
  const opp: Record<string, number> = {};
  for (const o of nc.opponents) {
    const tv = nc.tvTime.opponents[o.id] ?? 0;
    const debateBonus = (nc.debateHistory.reduce((s, d) => s + (d.scores[o.id] ?? 0), 0)) * 0.3;
    const fatigueBonus = nc.publicFatigue * 0.15; // insatisfação favorece oposição
    let v = o.base * 0.5 + tv * 40 + debateBonus + fatigueBonus - (nc.acceptedCoalition.length * 1.5);
    v = clamp(v, 3, 60);
    opp[o.id] = v;
    total += v;
  }

  const undecided = Math.max(5, 100 - total);
  const scale = (100 - undecided) / total;
  nc.polls.mayor = Math.round(mayor * scale);
  for (const k of Object.keys(opp)) opp[k] = Math.round(opp[k] * scale);
  nc.polls.opponents = opp;
  nc.polls.undecided = undecided;
}

/* -------------------- Coalitions -------------------- */

function maybeAddCoalitionOffer(nc: CampaignState, state: GameState) {
  const ml = mayorLean(state);
  const candidates = PARTIES_TEMPLATE.filter(p =>
    !nc.acceptedCoalition.includes(p.id) &&
    !nc.coalitionOffers.some(o => o.party === p.id && o.status === "pending")
  );
  if (candidates.length === 0) return;
  const pick = candidates[Math.floor(rand() * candidates.length)];
  const distance = Math.abs(pick.leaning - ml);
  const unusual = distance > 0.9;
  // Aliança inusitada só surge se fatigue alta OR polls baixas (desespero)
  if (unusual && nc.publicFatigue < 55 && nc.polls.mayor > 35) return;

  const loyalty = nc.partyLoyalty[pick.id];
  const pcCost = Math.round(6 + distance * 12 + (100 - loyalty) * 0.1);
  const tvShare = 0.05 + distance * 0.08;

  nc.coalitionOffers.push({
    id: `co_${Date.now()}_${pick.id}`,
    party: pick.id,
    demandPt: unusual
      ? `Coligação inusitada: ${pick.nameKey} exige duas secretarias e silêncio sobre pautas divergentes.`
      : `${pick.nameKey} aceita apoiar em troca de tempo de TV e vagas no segundo escalão.`,
    demandEn: unusual
      ? `Unusual alliance: ${pick.nameKey} demands two ministries and silence on divergent issues.`
      : `${pick.nameKey} supports you in exchange for TV time and second-tier posts.`,
    pcCost, tvShare, unusual, status: "pending",
  });
}

export function acceptCoalition(state: GameState, offerId: string): GameState {
  const s = ensureCampaign(state);
  const next = structuredClone(s);
  const nc = next.campaign!;
  const o = nc.coalitionOffers.find(x => x.id === offerId && x.status === "pending");
  if (!o) return s;

  // Precisa de capital político
  const pc = (next.politics as any)?.politicalCapital ?? 0;
  if (pc < o.pcCost) return s;
  if ((next.politics as any)) (next.politics as any).politicalCapital = pc - o.pcCost;

  o.status = "accepted";
  nc.acceptedCoalition.push(o.party);

  // Redistribui TV
  const total = 1;
  const givenAway = o.tvShare;
  nc.tvTime.mayor = clamp(nc.tvTime.mayor + givenAway * 0.6, 0, 0.9);
  const remainder = total - nc.tvTime.mayor;
  const opps = Object.keys(nc.tvTime.opponents);
  if (opps.length) {
    const each = remainder / opps.length;
    for (const k of opps) nc.tvTime.opponents[k] = each;
  }

  // Aliança inusitada: castigo em lealdade dos partidos próximos
  if (o.unusual) {
    for (const p of PARTIES_TEMPLATE) {
      if (Math.abs(p.leaning - (mayorLean(state))) < 0.4) {
        nc.partyLoyalty[p.id] = clamp(nc.partyLoyalty[p.id] - 12, 0, 100);
      }
    }
    nc.publicFatigue = clamp(nc.publicFatigue + 5, 0, 100);
  } else {
    nc.partyLoyalty[o.party] = clamp(nc.partyLoyalty[o.party] + 15, 0, 100);
  }

  recomputePolls(nc, next);
  return next;
}

export function rejectCoalition(state: GameState, offerId: string): GameState {
  const next = structuredClone(state);
  const nc = next.campaign!;
  const o = nc?.coalitionOffers.find(x => x.id === offerId && x.status === "pending");
  if (!o) return state;
  o.status = "rejected";
  nc!.partyLoyalty[o.party] = clamp(nc!.partyLoyalty[o.party] - 8, 0, 100);
  return next;
}

/* -------------------- Promises -------------------- */

const PROMISE_TEMPLATES: Array<Omit<Promise, "id" | "madeAtMonth">> = [
  { topic: "transport", textPt: "Tarifa Zero em 90 dias", textEn: "Zero fare in 90 days", monthlyCost: 800_000, pollBoost: 4, breachPenalty: 12 },
  { topic: "health",    textPt: "Fila zero em UBS", textEn: "Zero clinic waitlist", monthlyCost: 450_000, pollBoost: 3, breachPenalty: 9 },
  { topic: "education", textPt: "Notebook para cada aluno", textEn: "A laptop per student", monthlyCost: 620_000, pollBoost: 3, breachPenalty: 7 },
  { topic: "housing",   textPt: "Aluguel congelado 4 anos", textEn: "Rent frozen for 4 years", monthlyCost: 180_000, pollBoost: 5, breachPenalty: 15 },
  { topic: "security",  textPt: "Guarda armada 24h", textEn: "Armed guard 24/7", monthlyCost: 520_000, pollBoost: 4, breachPenalty: 10 },
  { topic: "economy",   textPt: "IPTU zero para pequenos", textEn: "Zero IPTU for small owners", monthlyCost: 350_000, pollBoost: 3, breachPenalty: 6 },
];

export function availablePromises(state: GameState): Array<Omit<Promise, "id" | "madeAtMonth">> {
  const made = state.campaign?.promises.map(p => p.topic) ?? [];
  return PROMISE_TEMPLATES.filter(p => !made.includes(p.topic));
}

export function makePromise(state: GameState, topic: DebateTopic): GameState {
  const s = ensureCampaign(state);
  const tpl = PROMISE_TEMPLATES.find(p => p.topic === topic);
  if (!tpl) return s;
  const next = structuredClone(s);
  const nc = next.campaign!;
  if (nc.promises.some(p => p.topic === topic)) return s;

  const me = monthsElapsed(state);
  nc.promises.push({ ...tpl, id: `pr_${Date.now()}_${topic}`, madeAtMonth: me });
  nc.committedMonthlyCost += tpl.monthlyCost;
  recomputePolls(nc, next);
  return next;
}

/* -------------------- TV time redistribution -------------------- */

export function setMayorTv(state: GameState, share: number): GameState {
  const s = ensureCampaign(state);
  const next = structuredClone(s);
  const nc = next.campaign!;
  const clamped = clamp(share, 0.05, 0.9);
  nc.tvTime.mayor = clamped;
  const remainder = 1 - clamped;
  const opps = Object.keys(nc.tvTime.opponents);
  if (opps.length) {
    const each = remainder / opps.length;
    for (const k of opps) nc.tvTime.opponents[k] = each;
  }
  recomputePolls(nc, next);
  return next;
}

/* -------------------- Debates -------------------- */

export function startDebate(state: GameState, topic: DebateTopic): GameState {
  const s = ensureCampaign(state);
  const next = structuredClone(s);
  const nc = next.campaign!;
  if (!nc.active || nc.debate) return s;
  nc.debate = {
    active: true, topic, round: 0, maxRounds: 4,
    exchanges: [], mayorScore: 0,
    scores: Object.fromEntries(nc.opponents.map(o => [o.id, 0])),
  };
  return next;
}

export function mayorDebateResponse(state: GameState, strategy: DebateStrategy): GameState {
  const s = ensureCampaign(state);
  if (!s.campaign?.debate) return s;
  const next = structuredClone(s);
  const nc = next.campaign!;
  const d = nc.debate!;
  const topic = d.topic;

  // Mayor speaks
  const [pt, en] = pickLine(strategy, topic);
  const mayorSwing = judgeStrategy(strategy, topic, state, /*isMayor*/ true);
  d.exchanges.push({
    round: d.round + 1, speaker: "mayor", strategy, topic,
    linePt: pt, lineEn: en, swing: mayorSwing,
  });
  d.mayorScore += mayorSwing;

  // Each opponent replies with their AI strategy
  for (const op of nc.opponents) {
    const oppStrategy = pickAiStrategy(op, strategy, topic, nc);
    const [optPt, optEn] = pickLine(oppStrategy, topic);
    const opSwing = judgeStrategy(oppStrategy, topic, state, false) +
      (op.strengths.includes(topic) ? 1.5 : 0) +
      (oppStrategy === "attack" && strategy === "defend" ? 0.8 : 0);
    d.exchanges.push({
      round: d.round + 1, speaker: op.id, strategy: oppStrategy, topic,
      linePt: `${op.namePt}: "${optPt}"`, lineEn: `${op.nameEn}: "${optEn}"`,
      swing: opSwing,
    });
    d.scores[op.id] = (d.scores[op.id] ?? 0) + opSwing;
  }

  d.round += 1;
  if (d.round >= d.maxRounds) {
    d.active = false;
    nc.debateHistory.push(d);
    // Impacto em publicFatigue e polls
    const won = d.mayorScore > Math.max(...Object.values(d.scores));
    nc.publicFatigue = clamp(nc.publicFatigue + (won ? -4 : 3), 0, 100);
    nc.debate = null;
    recomputePolls(nc, next);
  }
  return next;
}

function pickLine(strategy: DebateStrategy, topic: DebateTopic): [string, string] {
  const arr = LINES[strategy][topic];
  return arr[Math.floor(rand() * arr.length)];
}

function judgeStrategy(strategy: DebateStrategy, topic: DebateTopic, state: GameState, isMayor: boolean): number {
  // Base swing por estratégia
  const base = {
    attack: 1.2, defend: 0.8, pivot: 0.3, populist: 1.5, technical: 1.0,
  }[strategy];
  // Populist castiga se o eleitor está cansado de promessas (fatigue alta)
  const fatigue = state.campaign?.publicFatigue ?? 20;
  let mod = 0;
  if (strategy === "populist") mod -= (fatigue - 30) * 0.03;
  if (strategy === "technical" && fatigue < 40) mod += 0.6;
  if (strategy === "pivot") mod -= 0.4;
  if (strategy === "attack" && state.approval < 45) mod += isMayor ? -0.5 : 0.7;
  return base + mod + (rand() - 0.5) * 0.8;
}

function pickAiStrategy(op: Opponent, mayorStrategy: DebateStrategy, topic: DebateTopic, nc: CampaignState): DebateStrategy {
  const weights = { ...op.strategyBias };
  // Reação ao prefeito
  if (mayorStrategy === "defend") weights.attack += 0.25;
  if (mayorStrategy === "populist") weights.technical += 0.20;
  if (mayorStrategy === "technical") weights.populist += 0.15;
  if (mayorStrategy === "attack") weights.defend += 0.10;
  if (mayorStrategy === "pivot") weights.attack += 0.30;
  // Adaptativo: se o oponente vai mal na pesquisa, arrisca mais no populismo
  const poll = nc.polls.opponents[op.id] ?? op.base;
  if (poll < 15) weights.populist += 0.30;
  // Roleta
  const entries = Object.entries(weights) as [DebateStrategy, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return "attack";
}

/* -------------------- Utils -------------------- */

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)); }

/** Chama no início de novo mandato para aplicar custo diferido das promessas cumpridas */
export function applyPromiseCostsIfReelected(state: GameState): GameState {
  const c = state.campaign;
  if (!c) return state;
  // Marca custo mensal para o novo mandato; a integração real no fluxo mensal fica em logic.ts
  return state;
}
