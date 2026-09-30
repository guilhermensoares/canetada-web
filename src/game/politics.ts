/**
 * Political and administrative subsystems: municipal council with parties and
 * coalitions, organized interest groups, intergovernmental relations,
 * city-diplomacy, institutional indices and the 4-year electoral cycle.
 *
 * Designed to reflect a plausible Brazilian-inspired municipal environment
 * (vereadores, repasses estaduais/federais, emendas parlamentares, diplomacia
 * federativa e city diplomacy) without naming real parties.
 */

import type { GameState } from "./types";

/* -------------------- Types -------------------- */

export type PartyId = "prog" | "conserv" | "center" | "green" | "liberal" | "socialist";

export interface Party {
  id: PartyId;
  nameKey: string;         // i18n key
  leaning: number;         // -1 (esq) .. 1 (dir)
  seats: number;
}

export interface Council {
  totalSeats: number;
  parties: Party[];
  mayorParty: PartyId;
  coalition: PartyId[];             // includes mayor's party
  goodwill: Record<PartyId, number>;// 0..100 per party
  /**
   * Última tentativa de convite de partido à base — usada pela UI pra
   * mostrar feedback (aceitou / recusou, com qual chance). Mantida por
   * ~24 meses no jogo antes de sumir.
   */
  lastInvite?: {
    partyId: PartyId;
    accepted: boolean;
    chance: number;   // 0..1 — probabilidade calculada no momento
    year: number;
    month: number;
    reason?: string;  // motivo curto (ex.: "distância ideológica")
  };
  /**
   * Demanda aberta de um partido recém-aliado — pede a contratação de um
   * membro (hireMember) ou uma indicação para o gabinete (indicacao).
   * Preenchida por `partyDemands.ts` após aceite do convite.
   */
  pendingDemand?: PartyDemand;
}

/** Demanda aberta feita por um partido convidado ao entrar na base. */
export interface PartyDemand {
  partyId: PartyId;
  /** hireMember = exige contratar já. indicacao = quer só que o nome entre no pool. */
  kind: "hireMember" | "indicacao";
  targetPortfolio: import("./advisors").PortfolioId;
  candidate: import("./advisors").Advisor;
  /** Bônus de assinatura (pago do tesouro se hireMember for aceito). */
  signingBonus: number;
  /** Impactos na aceitação. */
  goodwillOnAccept: number;
  /** Impactos na recusa. */
  goodwillOnDecline: number;
  approvalOnDecline: number;
  createdAt: { year: number; month: number };
  /** Métricas de contexto usadas para explicar as condições ao jogador. */
  articulationScore: number;    // 0..1 (0 = pasta sem titular ou opositor incompetente)
  articulationAffinity: number; // -1..+1 do assessor de articulação com o partido
}


export type GroupId = "unions" | "business" | "movements" | "church" | "media";

export interface InterestGroup {
  id: GroupId;
  nameKey: string;
  mood: number;      // 0..100
  influence: number; // 0..1 relative weight
}

export interface Intergov {
  stateAlignment: number;    // -100..100
  federalAlignment: number;  // -100..100
  transfers: number;         // last-month intergovernmental transfer $
  earmarks: number;          // pending parliamentary earmarks $
}

export interface Diplomacy {
  sisterCities: number;
  reputation: number;         // 0..100
  foreignInvestment: number;  // last-month FDI inflow $
  multilateralPrograms: number;
}

export interface Institutional {
  corruption: number;   // 0..100 (high = bad)
  transparency: number; // 0..100
  governability: number;// 0..100 derived
  hdi: number;          // 0..1000 (HDI-M ×1000)
}

export interface Election {
  termStartYear: number;
  termLengthYears: 4;
  campaignBudget: number;
  timesElected: number;
  reelectionAllowed: boolean;
  pendingResult?: {
    year: number;
    voteShare: number;   // 0..100
    won: boolean;
    breakdown: { approval: number; coalition: number; corruption: number; campaign: number; inflation: number };
  };
}

export interface PoliticsState {
  council: Council;
  groups: InterestGroup[];
  intergov: Intergov;
  diplomacy: Diplomacy;
  institutional: Institutional;
  election: Election;
}

/* -------------------- Defaults -------------------- */

export const PARTIES_TEMPLATE: Party[] = [
  { id: "prog",      nameKey: "party_prog",      leaning: -0.6, seats: 4 },
  { id: "socialist", nameKey: "party_socialist", leaning: -0.9, seats: 2 },
  { id: "green",     nameKey: "party_green",     leaning: -0.2, seats: 2 },
  { id: "center",    nameKey: "party_center",    leaning:  0.1, seats: 5 },
  { id: "liberal",   nameKey: "party_liberal",   leaning:  0.6, seats: 4 },
  { id: "conserv",   nameKey: "party_conserv",   leaning:  0.9, seats: 4 },
];
export const TOTAL_SEATS = PARTIES_TEMPLATE.reduce((s, p) => s + p.seats, 0); // 21

export function defaultPolitics(startYear = 2026): PoliticsState {
  const parties = PARTIES_TEMPLATE.map((p) => ({ ...p }));
  const goodwill: Record<PartyId, number> = {
    prog: 55, socialist: 45, green: 60, center: 65, liberal: 50, conserv: 40,
  };
  return {
    council: {
      totalSeats: TOTAL_SEATS,
      parties,
      mayorParty: "center",
      coalition: ["center"],
      goodwill,
    },
    groups: [
      { id: "unions",    nameKey: "grp_unions",    mood: 55, influence: 0.22 },
      { id: "business",  nameKey: "grp_business",  mood: 60, influence: 0.24 },
      { id: "movements", nameKey: "grp_movements", mood: 55, influence: 0.18 },
      { id: "church",    nameKey: "grp_church",    mood: 60, influence: 0.14 },
      { id: "media",     nameKey: "grp_media",     mood: 60, influence: 0.22 },
    ],
    intergov: {
      stateAlignment: 0,
      federalAlignment: 0,
      transfers: 0,
      earmarks: 0,
    },
    diplomacy: {
      sisterCities: 0,
      reputation: 45,
      foreignInvestment: 0,
      multilateralPrograms: 0,
    },
    institutional: {
      corruption: 30,
      transparency: 55,
      governability: 50,
      hdi: 720,
    },
    election: {
      termStartYear: startYear,
      termLengthYears: 4,
      campaignBudget: 0,
      timesElected: 1,
      reelectionAllowed: true,
    },
  };
}

/* -------------------- Selectors -------------------- */

export function coalitionSeats(p: PoliticsState): number {
  return p.council.parties
    .filter((x) => p.council.coalition.includes(x.id))
    .reduce((sum, x) => sum + x.seats, 0);
}

export function coalitionStrength(p: PoliticsState): number {
  return coalitionSeats(p) / p.council.totalSeats;
}

export function hasMajority(p: PoliticsState): boolean {
  return coalitionSeats(p) * 2 > p.council.totalSeats;
}

export function electionYear(p: PoliticsState): number {
  return p.election.termStartYear + p.election.termLengthYears;
}

/* -------------------- Migrations -------------------- */

export function ensurePolitics(s: GameState): void {
  if (!s.politics) s.politics = defaultPolitics(s.year);
}

/* -------------------- Actions -------------------- */

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Custo mínimo de capital político só pra abrir a negociação. Se o
 * prefeito não tem esse capital, a negociação nem começa — evita
 * spammar convites de graça.
 */
export const INVITE_PC_COST = 6;

/**
 * Detalhamento da probabilidade de um partido aceitar entrar na base.
 * Exposto pra UI mostrar ao jogador ANTES do convite, evitando o
 * "convido e sempre entra" que quebrava o balanceamento.
 *
 * Fatores considerados:
 *   • confiança atual do partido no prefeito (goodwill)
 *   • distância ideológica em relação ao partido do prefeito
 *   • saturação da base — partido grande dilui influência de todos,
 *     então quanto mais lotada, mais custa convencer
 *   • aprovação popular do prefeito (todo mundo quer subir em barco cheio)
 *   • percepção de corrupção e transparência (risco de contaminação)
 *   • se o prefeito tem capital político suficiente pra pagar a negociação
 */
export interface InviteOdds {
  chance: number;             // 0..1
  breakdown: {
    goodwill: number;         // contribuição em pontos percentuais
    ideology: number;
    saturation: number;
    approval: number;
    integrity: number;
  };
  blocked?: "no_capital" | "already_in" | "is_mayor" | "hostile";
  hint: string;               // motivo dominante quando chance for baixa
}

function partyById(p: PoliticsState, id: PartyId): Party | undefined {
  return p.council.parties.find((x) => x.id === id);
}

export function coalitionAcceptanceOdds(s: GameState, id: PartyId): InviteOdds {
  ensurePolitics(s);
  const p = s.politics;
  const party = partyById(p, id);
  const mayor = partyById(p, p.council.mayorParty);
  const empty = { goodwill: 0, ideology: 0, saturation: 0, approval: 0, integrity: 0 };

  if (!party || !mayor) return { chance: 0, breakdown: empty, blocked: "already_in", hint: "" };
  if (id === p.council.mayorParty) return { chance: 0, breakdown: empty, blocked: "is_mayor", hint: "partido do prefeito" };
  if (p.council.coalition.includes(id)) return { chance: 0, breakdown: empty, blocked: "already_in", hint: "já está na base" };

  // Capital político (opcional — só existe depois que legislature.ts inicializa).
  const pc = (p as unknown as { politicalCapital?: number }).politicalCapital ?? 100;
  if (pc < INVITE_PC_COST) {
    return { chance: 0, breakdown: empty, blocked: "no_capital", hint: `precisa de ${INVITE_PC_COST} de capital político` };
  }

  // 1) Confiança — âncora principal. Abaixo de 25 = hostilidade aberta.
  const gwBase = (p.council.goodwill[id] - 30) / 100;           // -0.30..+0.70
  const goodwill = clamp(gwBase, -0.30, 0.70);

  if (p.council.goodwill[id] < 20) {
    return {
      chance: 0.03, breakdown: { ...empty, goodwill: -0.30 },
      blocked: "hostile", hint: "partido hostil ao prefeito",
    };
  }

  // 2) Distância ideológica ao partido do prefeito (-1..+1 → 0..2).
  const dist = Math.abs(party.leaning - mayor.leaning);
  const ideology = -0.35 * dist;                                 // até -0.70

  // 3) Saturação: cadeiras já aliadas / total. Base lotada assusta.
  const alliedSeats = coalitionSeats(p);
  const satRatio = alliedSeats / p.council.totalSeats;           // 0..1
  const saturation = -0.20 * Math.max(0, satRatio - 0.35);       // só pesa acima de 35%

  // 4) Aprovação popular do prefeito. Barco furado repele.
  const approval = (s.approval - 50) / 250;                       // -0.20..+0.20

  // 5) Percepção institucional — corrupção alta assusta partidos "limpos".
  const corr = p.institutional.corruption;
  const trans = p.institutional.transparency;
  let integrity = (trans - 50) / 400 - Math.max(0, corr - 40) / 200;
  // Partido conservador/liberal se importa menos com corrupção percebida.
  if (party.leaning > 0.4) integrity *= 0.5;

  const raw = 0.50 + goodwill + ideology + saturation + approval + integrity;
  const chance = clamp(raw, 0.05, 0.92);

  // Motivo dominante quando as chances são ruins.
  let hint = "";
  const contribs: Array<[string, number]> = [
    ["ideologia distante", ideology],
    ["base já saturada", saturation],
    ["baixa aprovação popular", approval],
    ["percepção de corrupção", integrity],
    ["baixa confiança", goodwill < 0 ? goodwill : 0],
  ];
  contribs.sort((a, b) => a[1] - b[1]);
  if (chance < 0.55 && contribs[0][1] < -0.05) hint = contribs[0][0];

  return {
    chance,
    breakdown: { goodwill, ideology, saturation, approval, integrity },
    hint,
  };
}

/**
 * Convida um partido pra base. Agora com **probabilidade** — o partido
 * pode recusar. Rejeição custa capital político e queima confiança
 * (partidos avisam à cúpula que o prefeito é "fraco").
 */
export function invitePartyToCoalition(s: GameState, id: PartyId, rng?: () => number): GameState {
  ensurePolitics(s);
  const p = s.politics;
  if (p.council.coalition.includes(id)) return s;
  if (id === p.council.mayorParty) return s;
  const odds = coalitionAcceptanceOdds(s, id);
  if (odds.blocked) return s;                    // UI já deve bloquear, mas defensivo.

  const roll = (rng ?? Math.random)();
  const accepted = roll < odds.chance;
  const party = p.council.parties.find((x) => x.id === id)!;

  const next = structuredClone(s);
  const np = next.politics;

  // Custo de capital político — pago sempre que a negociação acontece.
  const pol = np as unknown as { politicalCapital?: number };
  if (typeof pol.politicalCapital === "number") {
    pol.politicalCapital = Math.max(0, pol.politicalCapital - INVITE_PC_COST);
  }

  if (accepted) {
    np.council.coalition = [...np.council.coalition, id];
    // Custo diplomático: rivais ideológicos perdem confiança.
    for (const other of np.council.parties) {
      if (other.id === id || np.council.coalition.includes(other.id)) continue;
      const delta = -Math.abs(other.leaning - party.leaning) * 6;
      np.council.goodwill[other.id] = clamp(np.council.goodwill[other.id] + delta, 0, 100);
    }
    np.council.goodwill[id] = clamp(np.council.goodwill[id] - 8, 0, 100); // capital gasto
  } else {
    // Recusa pública: queima confiança do próprio partido e reverbera nos
    // ideologicamente próximos (mostrou fraqueza da mesa).
    np.council.goodwill[id] = clamp(np.council.goodwill[id] - 12, 0, 100);
    for (const other of np.council.parties) {
      if (other.id === id) continue;
      const closeness = 1 - Math.min(1, Math.abs(other.leaning - party.leaning));
      const delta = -3 * closeness;
      np.council.goodwill[other.id] = clamp(np.council.goodwill[other.id] + delta, 0, 100);
    }
    next.approval = clamp(next.approval - 1, 0, 100);
  }

  np.council.lastInvite = {
    partyId: id,
    accepted,
    chance: odds.chance,
    year: next.year,
    month: next.month,
    reason: accepted ? undefined : (odds.hint || "recusa política"),
  };

  return next;
}

export function ejectPartyFromCoalition(s: GameState, id: PartyId): GameState {
  ensurePolitics(s);
  const p = s.politics;
  if (id === p.council.mayorParty) return s;
  if (!p.council.coalition.includes(id)) return s;
  const next = structuredClone(s);
  next.politics.council.coalition = p.council.coalition.filter((x) => x !== id);
  next.politics.council.goodwill[id] = clamp(p.council.goodwill[id] - 20, 0, 100);
  next.approval = clamp(next.approval - 2, 0, 100);
  return next;
}


/** Diplomatic mission: pay a fee to open a sister-city / MOU. */
export const SISTER_CITY_COST = 90_000;
export function foundSisterCity(s: GameState): GameState {
  ensurePolitics(s);
  if (s.treasury < SISTER_CITY_COST) return s;
  const next = structuredClone(s);
  next.treasury -= SISTER_CITY_COST;
  next.politics.diplomacy.sisterCities += 1;
  next.politics.diplomacy.reputation = clamp(next.politics.diplomacy.reputation + 4, 0, 100);
  next.approval = clamp(next.approval + 1, 0, 100);
  return next;
}

/** Apply for a multilateral cooperation grant. Success depends on transparency. */
export const GRANT_APPLICATION_COST = 40_000;
export function applyMultilateralGrant(s: GameState, rng: () => number): GameState {
  ensurePolitics(s);
  if (s.treasury < GRANT_APPLICATION_COST) return s;
  const next = structuredClone(s);
  next.treasury -= GRANT_APPLICATION_COST;
  const chance = next.politics.institutional.transparency / 130
    + next.politics.diplomacy.reputation / 260;
  if (rng() < chance) {
    const grant = 250_000 + Math.floor(rng() * 400_000);
    next.treasury += grant;
    next.politics.diplomacy.multilateralPrograms += 1;
    next.politics.diplomacy.reputation = clamp(next.politics.diplomacy.reputation + 3, 0, 100);
  } else {
    next.politics.institutional.transparency = clamp(
      next.politics.institutional.transparency - 1, 0, 100,
    );
  }
  return next;
}

/** Negotiate an intergovernmental transfer request. Success needs alignment. */
export type TransferKind = "state" | "federal";
export function requestTransfer(s: GameState, kind: TransferKind, rng: () => number): GameState {
  ensurePolitics(s);
  const next = structuredClone(s);
  const align =
    kind === "state" ? next.politics.intergov.stateAlignment : next.politics.intergov.federalAlignment;
  const chance = 0.4 + align / 200 + next.politics.institutional.transparency / 300;
  const cost = 20_000; // diplomatic effort
  if (next.treasury < cost) return s;
  next.treasury -= cost;
  if (rng() < chance) {
    const grant = 150_000 + Math.floor(rng() * 250_000);
    next.treasury += grant;
    next.politics.intergov.earmarks += grant;
    if (kind === "state") {
      next.politics.intergov.stateAlignment = clamp(align - 8, -100, 100);
    } else {
      next.politics.intergov.federalAlignment = clamp(align - 8, -100, 100);
    }
  } else {
    if (kind === "state") {
      next.politics.intergov.stateAlignment = clamp(align - 4, -100, 100);
    } else {
      next.politics.intergov.federalAlignment = clamp(align - 4, -100, 100);
    }
  }
  return next;
}

/** Respond to a pressure group demand. Concessions cost approval/money elsewhere. */
export function respondToGroup(
  s: GameState,
  id: GroupId,
  mode: "concede" | "confront",
): GameState {
  ensurePolitics(s);
  const next = structuredClone(s);
  const g = next.politics.groups.find((x) => x.id === id);
  if (!g) return s;
  if (mode === "concede") {
    g.mood = clamp(g.mood + 15, 0, 100);
    // Concession cost varies by group
    if (id === "unions")    next.treasury -= 80_000;
    if (id === "business")  next.taxes.business = clamp(next.taxes.business - 1, 0, 30);
    if (id === "movements") next.policies.health = clamp(next.policies.health + 4, 0, 100);
    if (id === "church")    next.happiness = clamp(next.happiness + 1, 0, 100);
    if (id === "media")     next.politics.institutional.transparency = clamp(
      next.politics.institutional.transparency + 3, 0, 100,
    );
    next.approval = clamp(next.approval - 1, 0, 100);
  } else {
    g.mood = clamp(g.mood - 15, 0, 100);
    next.approval = clamp(next.approval + 1, 0, 100);
    // Confronting media can worsen transparency perception
    if (id === "media") {
      next.politics.institutional.transparency = clamp(
        next.politics.institutional.transparency - 3, 0, 100,
      );
    }
  }
  return next;
}

/** Spend campaign money in an election year (or before). */
export function spendCampaign(s: GameState, amount: number): GameState {
  ensurePolitics(s);
  const cost = Math.max(10_000, Math.min(amount, 500_000));
  if (s.treasury < cost) return s;
  const next = structuredClone(s);
  next.treasury -= cost;
  next.politics.election.campaignBudget += cost;
  next.approval = clamp(next.approval + cost / 120_000, 0, 100);
  return next;
}

/** Acknowledge an election result and start a new term (or reset). */
export function acknowledgeElection(s: GameState): GameState {
  const next = structuredClone(s);
  const res = next.politics.election.pendingResult;
  if (!res) return next;
  if (res.won) {
    next.politics.election.termStartYear = res.year;
    next.politics.election.campaignBudget = 0;
    next.politics.election.timesElected += 1;
    if (next.politics.election.timesElected >= 2) {
      next.politics.election.reelectionAllowed = false;
    }
    next.approval = clamp(next.approval + 5, 0, 100);
    // Journey — second consecutive win completes the "Dois Mandatos" arc.
    if (next.politics.election.timesElected >= 2) {
      if (!next.journey) next.journey = {
        coherenceScore: 50, choicesMade: 0, taggedChoices: 0,
        keyDecisions: [], monthsLowCoherence: 0,
      };
      next.journey.careerEnded = "victory";
    }
  } else {
    // Loss → career ends by defeat at the polls.
    if (!next.journey) next.journey = {
      coherenceScore: 50, choicesMade: 0, taggedChoices: 0,
      keyDecisions: [], monthsLowCoherence: 0,
    };
    next.journey.careerEnded = "defeated";
  }
  next.politics.election.pendingResult = undefined;
  return next;
}

/* -------------------- Monthly tick -------------------- */

/**
 * Apply monthly political dynamics: interest-group moods drift toward levers
 * the mayor pulls; goodwill drifts toward ideological positions; intergov
 * transfers land in the treasury; institutional indices update; and if the
 * calendar reaches the election year, a result is computed and staged.
 */
export function tickPolitics(s: GameState, rng: () => number): void {
  ensurePolitics(s);
  const p = s.politics;

  /* --- Interest-group mood drift ---
   * Each group has a target mood function of current policies/taxes/city state.
   * Mood eases toward the target and then feeds back into approval. */
  const taxBurden = s.taxes.income + s.taxes.property * 0.6 + s.taxes.business * 0.5;
  const targets: Record<GroupId, number> = {
    unions:    50 + (s.policies.education - 50) * 0.3 + (s.policies.security - 50) * 0.1
                - (s.unemployment - 8) * 1.4 + (60 - taxBurden) * 0.1,
    business:  50 + (30 - s.taxes.business) * 1.2 + (s.policies.transport - 50) * 0.2
                - Math.max(0, s.inflation - 4) * 2.5,
    movements: 50 + (s.policies.health - 50) * 0.35 + (s.attractiveness - 50) * 0.15
                - Math.min(30, favelaCount(s)) * 1.2 + s.favelaUrbanized * 0.6,
    church:    50 + (s.happiness - 55) * 0.3 - Math.abs(s.taxes.income - 12) * 0.4,
    media:     50 + (p.institutional.transparency - 50) * 0.5
                - (p.institutional.corruption - 30) * 0.6,
  };
  for (const g of p.groups) {
    const tgt = clamp(targets[g.id], 0, 100);
    g.mood = clamp(g.mood + (tgt - g.mood) * 0.25 + (rng() - 0.5) * 1.5, 0, 100);
  }
  const groupMoodAvg = p.groups.reduce((sum, g) => sum + g.mood * g.influence, 0)
    / p.groups.reduce((sum, g) => sum + g.influence, 0);
  s.approval = clamp(s.approval + (groupMoodAvg - s.approval) * 0.05, 0, 100);

  /* --- Coalition goodwill drift ---
   * Non-coalition parties lose or gain trust based on ideological proximity
   * to the mayor's current policy mix (progressive spending vs low-tax). */
  const govAxis = clampAxis(
    (s.policies.education + s.policies.health + s.policies.security + s.policies.transport) / 400
      - (s.taxes.income + s.taxes.property + s.taxes.business) / 100,
  ); // roughly -1..1 where negative = right-leaning mix
  for (const party of p.council.parties) {
    if (p.council.coalition.includes(party.id)) continue;
    const alignment = 1 - Math.abs(party.leaning - govAxis) / 2; // 0..1
    const drift = (alignment - 0.5) * 3 + (rng() - 0.5);
    p.council.goodwill[party.id] = clamp(p.council.goodwill[party.id] + drift, 0, 100);
  }

  /* --- Intergovernmental transfers ---
   * State and federal transfers scale with alignment and transparency. */
  const baseTransfer = s.lastRevenue * 0.06;
  const stateShare = baseTransfer * (0.5 + p.intergov.stateAlignment / 200)
    * (0.6 + p.institutional.transparency / 250);
  const fedShare = baseTransfer * (0.5 + p.intergov.federalAlignment / 200)
    * (0.6 + p.institutional.transparency / 250);
  const transfer = Math.max(0, Math.round(stateShare + fedShare));
  p.intergov.transfers = transfer;
  s.treasury += transfer;
  // Alignments drift back toward zero (political cycles).
  p.intergov.stateAlignment  = clamp(p.intergov.stateAlignment  + (rng() - 0.5) * 5, -100, 100);
  p.intergov.federalAlignment = clamp(p.intergov.federalAlignment + (rng() - 0.5) * 5, -100, 100);

  /* --- Diplomacy & foreign investment ---
   * Reputation grows with low corruption and stable inflation.
   * FDI inflow scales with reputation and low business tax. */
  const repDelta = ((100 - p.institutional.corruption) - 50) * 0.03
    - Math.max(0, s.inflation - 5) * 0.3
    + p.diplomacy.sisterCities * 0.15
    + p.diplomacy.multilateralPrograms * 0.4;
  p.diplomacy.reputation = clamp(p.diplomacy.reputation + repDelta * 0.4, 0, 100);
  const fdi = Math.round(
    p.diplomacy.reputation * 400 * (0.4 + (30 - s.taxes.business) / 40)
      + p.diplomacy.sisterCities * 8_000
      + p.diplomacy.multilateralPrograms * 15_000,
  );
  p.diplomacy.foreignInvestment = Math.max(0, fdi);
  s.businesses += Math.round(fdi / 40_000);

  /* --- Institutional indices ---
   * Corruption climbs when transparency is low and deficits pile up. */
  const deficit = s.lastExpenses - s.lastRevenue;
  let corrDelta = -p.institutional.transparency * 0.02
    + (deficit > 0 ? 0.4 : -0.2)
    - p.groups.find((g) => g.id === "media")!.mood * 0.01;
  p.institutional.corruption = clamp(p.institutional.corruption + corrDelta, 0, 100);
  let transDelta = (s.policies.education - 50) * 0.02
    - (p.institutional.corruption - 30) * 0.03
    + (p.groups.find((g) => g.id === "media")!.mood - 50) * 0.02;
  p.institutional.transparency = clamp(p.institutional.transparency + transDelta, 0, 100);
  p.institutional.governability = clamp(
    coalitionStrength(p) * 100 * 0.6 + s.approval * 0.4 - p.institutional.corruption * 0.2, 0, 100,
  );
  // Municipal HDI (education+health+income proxies + happiness).
  p.institutional.hdi = clamp(
    (s.policies.education * 3 + s.policies.health * 3
      + (100 - s.unemployment * 2) * 2 + s.happiness) * 1.3,
    200, 1000,
  );

  /* --- Konami "second chance" snapshot ---
   * Twelve months before the election window (Oct of electionYear-1), stash a
   * full snapshot of the state. Recorded at most once per election cycle. */
  const targetElectionYear = electionYear(p);
  if (
    s.year === targetElectionYear - 1 &&
    s.month === 10 &&
    (!s.secondChance || s.secondChance.electionYear !== targetElectionYear)
  ) {
    const snap = structuredClone(s) as GameState;
    // Break recursion: the snapshot does not carry its own secondChance.
    snap.secondChance = undefined;
    s.secondChance = {
      snapshot: snap,
      snapshotAt: { year: s.year, month: s.month },
      electionYear: targetElectionYear,
      used: false,
    };
  }

  /* --- Election trigger ---
   * When the calendar reaches (termStartYear + termLength) and month === 10
   * (early October — Brazilian municipal election window), stage the result. */
  if (
    !p.election.pendingResult &&
    s.year === electionYear(p) &&
    s.month === 10
  ) {
    const approvalScore = s.approval * 0.55;
    const coalScore     = coalitionStrength(p) * 100 * 0.15;
    const corruptScore  = -(p.institutional.corruption) * 0.15;
    const campaignScore = Math.min(15, p.election.campaignBudget / 60_000);
    const inflScore     = -Math.max(0, s.inflation - 4) * 1.2;
    const share = clamp(
      approvalScore + coalScore + corruptScore + campaignScore + inflScore + (rng() - 0.5) * 6,
      5, 90,
    );
    p.election.pendingResult = {
      year: s.year,
      voteShare: share,
      won: share >= 50 && p.election.reelectionAllowed,
      breakdown: {
        approval: approvalScore,
        coalition: coalScore,
        corruption: corruptScore,
        campaign: campaignScore,
        inflation: inflScore,
      },
    };
    s.speed = 0;
  }
}

/**
 * Multiplier applied to policy effectiveness this month, driven by
 * governability. Below ~30% governability, unilateral action stalls.
 * Called from the main tick to modulate policy contribution to happiness.
 */
export function policyEffectiveness(s: GameState): number {
  ensurePolitics(s);
  const g = s.politics.institutional.governability;
  return 0.5 + (g / 100) * 0.7; // 0.5 .. 1.2
}

/** Whether the mayor can currently issue new debt (needs a working majority). */
export function canIssueDebt(s: GameState): boolean {
  ensurePolitics(s);
  return hasMajority(s.politics) && s.politics.institutional.governability > 30;
}

/* -------------------- Local helpers -------------------- */

function clampAxis(v: number) { return Math.max(-1, Math.min(1, v)); }

function favelaCount(s: GameState): number {
  let n = 0;
  for (const b of s.builtBuildings) {
    if (b === "favela_s" || b === "favela_m" || b === "favela_l") n++;
  }
  return n;
}
