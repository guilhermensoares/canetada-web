/**
 * Sistema de Demandas Partidárias — quando um partido aceita entrar na base,
 * pode pedir contrapartida: contratar um dos seus quadros como assessor
 * (hireMember) ou uma indicação pro pool do gabinete (indicacao).
 *
 * A qualidade exigida do assessor e o salário cobrado dependem do assessor de
 * **Articulação Política** já contratado: quanto melhor a capacidade técnica
 * dele e mais alinhado ideologicamente com o partido convidado, menor a
 * pressão da demanda.
 */

import type { GameState } from "./types";
import type { PartyDemand, PartyId, Party } from "./politics";
import { ensurePolitics } from "./politics";
import {
  ensureAdvisors,
  salaryFor,
  PORTFOLIOS,
  PORTFOLIO_LABEL,
  type Advisor,
  type PortfolioId,
  type PartyAlignment,
} from "./advisors";
import {
  archetypesForPortfolio,
  archetypeIdeology,
  PARTY_IDEOLOGY,
} from "./advisorArchetypes";

/* -------------------- util -------------------- */

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
let idc = 1;
function nid() { idc += 1; return `dem_${Date.now().toString(36)}_${idc}`; }

/** Mapeia o `leaning` (-1..+1) do partido do conselho para a sigla fictícia
 *  de assessor mais próxima ideologicamente. Só afeta rótulo/salário. */
function alignmentForLeaning(L: number): PartyAlignment {
  if (L < -0.35) return "PLab";
  if (L < -0.1)  return "PSOB";
  if (L <  0.35) return "P-CENTRO";
  return "PDR";
}

/* -------------------- termos da demanda -------------------- */

export interface DemandTerms {
  affinity: number;         // -1..+1 assessor de articulação × partido
  articulationScore: number; // 0..1
  demandedOverall: number;  // 2..5
  salaryMult: number;       // 1.0..1.7
  signingMonths: number;    // 1..4
  triggerChance: number;    // 0..1
}

/**
 * Calcula os termos exigidos pelo partido convidado com base no assessor de
 * articulação (se houver) e na proximidade ideológica dele com o partido.
 */
export function computeDemandTerms(
  articulation: Advisor | undefined,
  partyLeaning: number,
): DemandTerms {
  const artIdeo = articulation?.ideology ?? PARTY_IDEOLOGY[articulation?.party ?? "P-CENTRO"] ?? 0;
  const affinity = articulation
    ? clamp(1 - Math.abs(artIdeo - partyLeaning), -1, 1)
    : -1;
  // 0..1 — alavancagem do gabinete na negociação.
  const rawScore = articulation
    ? (articulation.overall / 5) * (0.55 + 0.35 * affinity)
    : 0;
  const articulationScore = clamp(rawScore, 0, 1);
  const pressure = 1 - articulationScore;      // 0..1
  const demandedOverall = clamp(Math.round(2.5 + pressure * 2.5), 2, 5);
  const salaryMult = 1 + pressure * 0.7;       // 1.0..1.7
  const signingMonths = 1 + Math.round(pressure * 3); // 1..4
  const triggerChance = articulation
    ? clamp(0.65 - 0.45 * articulationScore, 0.20, 0.65)
    : 0.75;
  return { affinity, articulationScore, demandedOverall, salaryMult, signingMonths, triggerChance };
}

/* -------------------- geração do candidato -------------------- */

function makeDemandCandidate(
  party: Party,
  targetPortfolio: PortfolioId,
  terms: DemandTerms,
  rng: () => number,
): Advisor {
  const alignment = alignmentForLeaning(party.leaning);
  // Prioriza arquétipo compatível com a pasta E ideologicamente próximo do partido.
  const pool = archetypesForPortfolio(targetPortfolio).filter((a) => {
    const ai = archetypeIdeology(a);
    return Math.abs(ai - party.leaning) <= 0.55;
  });
  const overall = terms.demandedOverall;
  const potential = Math.round(30 + rng() * 40);
  const age = 34 + Math.floor(rng() * 30);
  const baseSalary = salaryFor(overall, targetPortfolio, alignment);
  const salary = Math.round(baseSalary * terms.salaryMult);
  const loyaltyBase = 45 + Math.round(rng() * 20); // 45..65 — indicações políticas rendem lealdade morna

  if (pool.length > 0 && rng() < 0.75) {
    const arch = pick(pool, rng);
    return {
      id: nid(),
      name: arch.name,
      portfolio: targetPortfolio,
      overall,
      loyalty: loyaltyBase,
      party: alignment,
      salary,
      potential,
      xp: 0,
      age,
      monthsInOffice: 0,
      archetypeId: arch.id,
      bio: `Indicado(a) por ${party.nameKey}. ${arch.bio}`,
      traits: ["Indicação partidária", ...arch.traits.slice(0, 2)],
      ideology: archetypeIdeology(arch),
      affinity: 0, // recomputado se aceito, usando afinidade com o prefeito
    };
  }

  const first = ["Ademar", "Beto", "Cintia", "Douglas", "Erondina", "Fátima", "Gilberto", "Heraldo", "Ivone", "Jandira", "Lauro", "Marta", "Nelson", "Odete"];
  const last = ["Bittencourt", "Cardim", "Domingues", "Estefanini", "Ferraz", "Guerra", "Hollanda", "Iório", "Junqueira", "Loyola", "Machado"];
  const bioLine = terms.affinity < -0.2
    ? `Quadro do ${party.nameKey}. Chega desconfiado(a) do gabinete atual.`
    : `Quadro do ${party.nameKey} indicado(a) após negociação de base.`;
  return {
    id: nid(),
    name: `${pick(first, rng)} ${pick(last, rng)}`,
    portfolio: targetPortfolio,
    overall,
    loyalty: loyaltyBase,
    party: alignment,
    salary,
    potential,
    xp: 0,
    age,
    monthsInOffice: 0,
    bio: bioLine,
    traits: ["Indicação partidária"],
    ideology: party.leaning,
    affinity: 0,
  };
}

/* -------------------- gatilho -------------------- */

/**
 * Rola (se aplicável) uma demanda quando um partido acabou de aceitar entrar
 * na base. Não roda se já existe uma demanda pendente. Muta `s` in-place.
 */
export function maybeCreatePartyDemand(
  s: GameState,
  partyId: PartyId,
  rng: () => number,
): void {
  ensurePolitics(s);
  const council = s.politics.council;
  if (council.pendingDemand) return;
  const party = council.parties.find((p) => p.id === partyId);
  if (!party) return;

  const adv = ensureAdvisors(s);
  const articulation = adv.hired.articulation;
  const terms = computeDemandTerms(articulation, party.leaning);
  if (rng() >= terms.triggerChance) return;

  // Kind: mais pressão → mais chance de exigir contratação; menos → indicação.
  const kindRoll = rng();
  const hireBias = 0.35 + (1 - terms.articulationScore) * 0.45; // 0.35..0.80
  const kind: PartyDemand["kind"] = kindRoll < hireBias ? "hireMember" : "indicacao";

  // Escolha da pasta: articulation em 45%, senão pasta livre; se ninguém livre,
  // pasta com menor overall atual (candidato promete melhoria).
  let targetPortfolio: PortfolioId;
  if (rng() < 0.45) {
    targetPortfolio = "articulation";
  } else {
    const empty = PORTFOLIOS.filter((p) => !adv.hired[p]);
    if (empty.length > 0) {
      targetPortfolio = pick(empty, rng);
    } else {
      const sorted = [...PORTFOLIOS].sort(
        (a, b) => (adv.hired[a]?.overall ?? 0) - (adv.hired[b]?.overall ?? 0),
      );
      targetPortfolio = sorted[0];
    }
  }

  const candidate = makeDemandCandidate(party, targetPortfolio, terms, rng);
  const signingBonus = kind === "hireMember"
    ? Math.round(candidate.salary * terms.signingMonths)
    : 0;

  // Penalidade por recusa: proporcional ao "peso" do partido e da pressão.
  const seatWeight = party.seats / Math.max(1, council.totalSeats);
  const goodwillOnAccept = kind === "hireMember" ? 12 : 6;
  const goodwillOnDecline = kind === "hireMember"
    ? -Math.round(14 + 10 * seatWeight * 4)   // -14..~-40
    : -Math.round(6 + 6 * seatWeight * 4);    // -6..~-24
  const approvalOnDecline = kind === "hireMember" ? -2 : -1;

  council.pendingDemand = {
    partyId,
    kind,
    targetPortfolio,
    candidate,
    signingBonus,
    goodwillOnAccept,
    goodwillOnDecline: Math.max(-45, goodwillOnDecline),
    approvalOnDecline,
    createdAt: { year: s.year, month: s.month },
    articulationScore: terms.articulationScore,
    articulationAffinity: terms.affinity,
  };

  adv.events.unshift(
    `${labelForParty(party)} pediu ${kind === "hireMember" ? "a contratação" : "uma indicação"} para ${PORTFOLIO_LABEL[targetPortfolio]}.`,
  );
  adv.events = adv.events.slice(0, 20);
}

function labelForParty(p: Party): string {
  // Rótulo curto para o log — usa nameKey só como identificador legível.
  return p.nameKey.replace(/^party_/, "").toUpperCase();
}

/* -------------------- resposta do jogador -------------------- */

export type DemandResponse = "accept" | "decline";

export function respondPartyDemand(s: GameState, response: DemandResponse): GameState {
  ensurePolitics(s);
  const cur = s.politics.council.pendingDemand;
  if (!cur) return s;

  const next = structuredClone(s);
  const council = next.politics.council;
  const demand = council.pendingDemand!;
  const adv = ensureAdvisors(next);

  if (response === "accept") {
    if (demand.kind === "hireMember") {
      // Cobra bônus de assinatura; se não tem grana, marca como dívida mas
      // ainda contrata (jogador pediu). Salário mensal entra no fluxo normal.
      next.treasury -= demand.signingBonus;
      const previous = adv.hired[demand.targetPortfolio];
      if (previous) {
        // Multa rescisória do titular anterior (menor — negociada, não é demissão pura).
        next.treasury -= Math.round(previous.salary * 1.2);
        adv.events.unshift(`Substituído(a) ${previous.name} para acomodar indicação do ${labelForParty(council.parties.find((p) => p.id === demand.partyId)!)}.`);
      }
      const cand: Advisor = { ...demand.candidate, monthsInOffice: 0 };
      adv.hired[demand.targetPortfolio] = cand;
      adv.events.unshift(
        `Contratado(a) ${cand.name} (${cand.overall}★) via acordo de base — ${PORTFOLIO_LABEL[demand.targetPortfolio]}.`,
      );
    } else {
      // indicacao: adiciona ao roster (se pasta ainda existe no roster).
      const already = adv.roster.some((c) => c.id === demand.candidate.id);
      if (!already) adv.roster.push({ ...demand.candidate });
      adv.events.unshift(
        `Indicação aceita: ${demand.candidate.name} entra no pool de candidatos.`,
      );
    }
    council.goodwill[demand.partyId] = clamp(
      council.goodwill[demand.partyId] + demand.goodwillOnAccept, 0, 100,
    );
  } else {
    // Recusa: queima confiança e leva pequeno hit de aprovação (foi pública).
    council.goodwill[demand.partyId] = clamp(
      council.goodwill[demand.partyId] + demand.goodwillOnDecline, 0, 100,
    );
    next.approval = clamp(next.approval + demand.approvalOnDecline, 0, 100);
    // Se ficar hostil (goodwill < 20) e for hireMember pesada, partido pode
    // até deixar a base — mantemos ele dentro por simplicidade; goodwill baixo
    // já limita apoio em outras votações.
    adv.events.unshift(
      `Recusada demanda do ${labelForParty(council.parties.find((p) => p.id === demand.partyId)!)}: goodwill ${demand.goodwillOnDecline}.`,
    );
  }
  adv.events = adv.events.slice(0, 20);

  delete council.pendingDemand;
  return next;
}

export function dismissPartyDemand(s: GameState): GameState {
  ensurePolitics(s);
  if (!s.politics.council.pendingDemand) return s;
  const next = structuredClone(s);
  delete next.politics.council.pendingDemand;
  return next;
}
