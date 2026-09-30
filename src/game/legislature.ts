/**
 * Municipal legislature module.
 *
 * Adds:
 *  - Political capital (PC): a scarce resource the mayor spends to move
 *    coalitions, twist arms and push controversial bills through the Câmara.
 *  - Bill templates covering fiscal, social, security, environment, housing
 *    and infrastructure agendas, each with ideological leaning and lobby
 *    footprints (which interest groups gain/lose from passage).
 *  - A vote model where each party's yes/no depends on ideological alignment
 *    with the bill, current goodwill toward the mayor, weighted pressure from
 *    interest groups, and any political capital the player spent to whip.
 *  - Random crises that surface as time-limited emergency bills. Passing or
 *    letting them expire has visible consequences.
 *  - Reelection hook: the count of passed vs rejected/expired bills feeds the
 *    campaign score via `legislativeScore`.
 *
 * All effects are additive on top of the existing politics tick.
 */

import type { GameState } from "./types";
import type { GroupId, PartyId, PoliticsState } from "./politics";
import { coalitionStrength, ensurePolitics } from "./politics";
import * as negotiationModule from "./negotiation";
/* Inline news pusher — mirrors logic.ts pushNews (kept private to avoid a
 * circular import with logic.ts). */
type NewsKind = "info" | "warning" | "danger";
function pushNews(state: GameState, item: { kind: NewsKind; titleKey: string; detail?: string }) {
  const n = {
    id: `${state.year}-${state.month}-${state.day}-${Math.random().toString(36).slice(2, 7)}`,
    day: state.day, month: state.month, year: state.year,
    ...item,
  };
  state.news = [n as (typeof state.news)[number], ...state.news].slice(0, 80);
}

/* ============================================================ Types */

export type BillDomain =
  | "fiscal"
  | "social"
  | "security"
  | "environment"
  | "housing"
  | "infra";

export interface BillEffect {
  treasury?: number;
  approval?: number;
  happiness?: number;
  taxIncome?: number;
  taxProperty?: number;
  taxBusiness?: number;
  polEducation?: number;
  polHealth?: number;
  polSecurity?: number;
  polTransport?: number;
  corruption?: number;
  transparency?: number;
  goodwillAll?: number;
  groupMood?: Partial<Record<GroupId, number>>;
}

export interface Bill {
  id: string;
  templateId: string;
  titleKey: string;   // inline "pt||en"
  descKey: string;    // inline "pt||en"
  domain: BillDomain;
  leaning: number;    // -1 (left) .. 1 (right)
  capitalCost: number;   // political capital to propose
  boostCapital: number;  // capital spent whipping votes
  supportGroups: GroupId[];
  opposeGroups: GroupId[];
  effect: BillEffect;
  proposedYear: number;
  proposedMonth: number;
  expiresYear: number;
  expiresMonth: number;
  crisis: boolean;
  status: "pending" | "passed" | "rejected" | "expired";
  votes?: { party: PartyId; yes: boolean; margin: number }[];
  yesSeats?: number;
  noSeats?: number;
}

export interface BillTemplate {
  id: string;
  titleKey: string;
  descKey: string;
  domain: BillDomain;
  leaning: number;
  capitalCost: number;
  supportGroups: GroupId[];
  opposeGroups: GroupId[];
  effect: BillEffect;
  routine?: boolean; // available in the ordinary agenda menu
}

/* ============================================================ Templates */

export const BILL_TEMPLATES: BillTemplate[] = [
  {
    id: "iss_hike",
    titleKey: "Elevação da alíquota do ISS||ISS business-tax hike",
    descKey:
      "Aumenta a arrecadação municipal cobrando mais dos serviços.||Raises municipal revenue by taxing services more heavily.",
    domain: "fiscal", leaning: -0.5, capitalCost: 8,
    supportGroups: ["unions", "movements"],
    opposeGroups: ["business", "media"],
    effect: { taxBusiness: +2, approval: -2, treasury: 60_000 },
    routine: true,
  },
  {
    id: "iptu_relief",
    titleKey: "Desconto de IPTU para pequenos imóveis||IPTU relief for small properties",
    descKey:
      "Alívio fiscal popular, custo imediato para o tesouro.||Popular fiscal relief with an immediate treasury cost.",
    domain: "fiscal", leaning: -0.1, capitalCost: 6,
    supportGroups: ["movements", "church"],
    opposeGroups: [],
    effect: { taxProperty: -1, approval: +3, treasury: -80_000 },
    routine: true,
  },
  {
    id: "pro_business",
    titleKey: "Pacote de incentivos empresariais||Pro-business incentives package",
    descKey:
      "Reduz tributos e simplifica alvarás para atrair investimento.||Cuts taxes and simplifies permits to attract investment.",
    domain: "fiscal", leaning: 0.7, capitalCost: 9,
    supportGroups: ["business", "media"],
    opposeGroups: ["unions", "movements"],
    effect: { taxBusiness: -2, taxIncome: -1, approval: +1, treasury: -40_000 },
    routine: true,
  },
  {
    id: "school_bump",
    titleKey: "Reforço na educação básica||Basic-education boost",
    descKey:
      "Amplia recursos para escolas e formação docente.||Expands funding for schools and teacher training.",
    domain: "social", leaning: -0.4, capitalCost: 7,
    supportGroups: ["unions", "movements"],
    opposeGroups: [],
    effect: { polEducation: +8, transparency: +2, treasury: -50_000 },
    routine: true,
  },
  {
    id: "sus_reinforce",
    titleKey: "Reforço emergencial no SUS||Emergency reinforcement of public health",
    descKey:
      "Mais leitos, agentes e vacinação de rotina.||More beds, community agents and routine immunization.",
    domain: "social", leaning: -0.3, capitalCost: 7,
    supportGroups: ["movements", "unions", "church"],
    opposeGroups: [],
    effect: { polHealth: +8, happiness: +2, treasury: -70_000 },
    routine: true,
  },
  {
    id: "law_and_order",
    titleKey: "Programa Lei e Ordem||Law-and-order program",
    descKey:
      "Amplia o efetivo da Guarda Municipal e monitoramento de câmeras.||Expands the municipal guard and CCTV coverage.",
    domain: "security", leaning: 0.6, capitalCost: 8,
    supportGroups: ["business", "church", "media"],
    opposeGroups: ["movements"],
    effect: { polSecurity: +10, approval: +2, treasury: -60_000 },
    routine: true,
  },
  {
    id: "green_bonds",
    titleKey: "Emissão de títulos verdes||Green bond issuance",
    descKey:
      "Capta recursos vinculados a metas ambientais.||Raises capital tied to environmental targets.",
    domain: "environment", leaning: -0.2, capitalCost: 8,
    supportGroups: ["movements", "media"],
    opposeGroups: ["conserv" as unknown as GroupId], // ignored (not a group id)
    effect: { treasury: +250_000, transparency: +3, approval: +1 },
    routine: true,
  },
  {
    id: "housing_zeis",
    titleKey: "Ampliar ZEIS em áreas centrais||Expand ZEIS in central areas",
    descKey:
      "Reserva terra urbanizada para habitação de interesse social.||Reserves serviced land for social-interest housing.",
    domain: "housing", leaning: -0.7, capitalCost: 10,
    supportGroups: ["movements", "unions"],
    opposeGroups: ["business"],
    effect: { happiness: +2, approval: +3, corruption: -2 },
    routine: true,
  },
  {
    id: "transparency_pack",
    titleKey: "Pacote de transparência e dados abertos||Transparency & open-data package",
    descKey:
      "Publica contratos, folhas e indicadores em portal aberto.||Publishes contracts, payroll and indicators in an open portal.",
    domain: "social", leaning: 0.0, capitalCost: 6,
    supportGroups: ["media", "movements"],
    opposeGroups: [],
    effect: { transparency: +8, corruption: -4, approval: +1 },
    routine: true,
  },
  {
    id: "transit_expansion",
    titleKey: "Expansão da malha de transporte||Public-transit expansion",
    descKey:
      "Novas linhas e integração modal financiadas via orçamento.||New lines and modal integration funded from the budget.",
    domain: "infra", leaning: -0.1, capitalCost: 8,
    supportGroups: ["unions", "movements", "business"],
    opposeGroups: [],
    effect: { polTransport: +10, happiness: +1, treasury: -120_000 },
    routine: true,
  },
];

/* Crisis templates are surfaced by tickLegislature only. */
export const CRISIS_TEMPLATES: BillTemplate[] = [
  {
    id: "crisis_flood_relief",
    titleKey: "Crédito extraordinário para enchentes||Emergency flood-relief credit",
    descKey:
      "Libera verba emergencial para famílias atingidas.||Releases emergency funds for affected families.",
    domain: "infra", leaning: 0.0, capitalCost: 4,
    supportGroups: ["movements", "media", "church"],
    opposeGroups: [],
    effect: { treasury: -180_000, approval: +4, happiness: +3, groupMood: { movements: +8 } },
  },
  {
    id: "crisis_health_task",
    titleKey: "Força-tarefa contra surto epidêmico||Task force against outbreak",
    descKey:
      "Mobiliza equipes e recursos para conter o surto.||Mobilizes teams and resources to contain the outbreak.",
    domain: "social", leaning: -0.2, capitalCost: 4,
    supportGroups: ["movements", "unions", "church"],
    opposeGroups: [],
    effect: { treasury: -140_000, polHealth: +6, approval: +3, groupMood: { movements: +6 } },
  },
  {
    id: "crisis_corruption_probe",
    titleKey: "CPI contra a corrupção||Anti-corruption inquiry",
    descKey:
      "Cria comissão para investigar contratos suspeitos.||Sets up a commission to investigate suspect contracts.",
    domain: "social", leaning: 0.0, capitalCost: 6,
    supportGroups: ["media", "movements"],
    opposeGroups: ["business"],
    effect: { corruption: -10, transparency: +6, approval: +2 },
  },
  {
    id: "crisis_general_strike",
    titleKey: "Reajuste salarial do funcionalismo||Public-payroll adjustment",
    descKey:
      "Fim da greve exige acordo salarial imediato.||Ending the strike demands an immediate wage deal.",
    domain: "fiscal", leaning: -0.6, capitalCost: 5,
    supportGroups: ["unions"],
    opposeGroups: ["business", "media"],
    effect: { treasury: -220_000, approval: +2, groupMood: { unions: +12, business: -6 } },
  },
  {
    id: "crisis_business_flight",
    titleKey: "Pacote emergencial de retenção de empresas||Emergency business-retention pack",
    descKey:
      "Incentivos para conter a fuga de investimentos.||Incentives to stop investment leaving the city.",
    domain: "fiscal", leaning: 0.6, capitalCost: 5,
    supportGroups: ["business", "media"],
    opposeGroups: ["unions"],
    effect: { taxBusiness: -3, treasury: -80_000, groupMood: { business: +12 } },
  },
];

/* ============================================================ Utilities */

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Compute the mayor's governing ideological axis from current policy mix. */
function govAxis(s: GameState): number {
  const spend = (s.policies.education + s.policies.health + s.policies.security + s.policies.transport) / 400;
  const tax = (s.taxes.income + s.taxes.property + s.taxes.business) / 100;
  return clamp((spend - tax), -1, 1);
}

/** Ensure the extended fields exist on the politics state. */
export function ensureLegislature(s: GameState): void {
  ensurePolitics(s);
  const p = s.politics as PoliticsWithLegislature;
  if (typeof p.politicalCapital !== "number") p.politicalCapital = 25;
  if (!Array.isArray(p.bills)) p.bills = [];
  if (typeof p.billsPassed !== "number") p.billsPassed = 0;
  if (typeof p.billsRejected !== "number") p.billsRejected = 0;
}

export interface LegislatureExtension {
  politicalCapital: number;
  bills: Bill[];
  billsPassed: number;
  billsRejected: number;
}

// Structural extension of PoliticsState with legislature fields.
export type PoliticsWithLegislature = PoliticsState & LegislatureExtension;

export function polExt(s: GameState): PoliticsWithLegislature {
  ensureLegislature(s);
  return s.politics as PoliticsWithLegislature;
}

/* ============================================================ Bill lifecycle */

const ROUTINE_TEMPLATES = BILL_TEMPLATES.filter((t) => t.routine !== false);

export function listRoutineTemplates(): BillTemplate[] {
  return ROUTINE_TEMPLATES;
}

export function pendingBills(s: GameState): Bill[] {
  return polExt(s).bills.filter((b) => b.status === "pending");
}

export function recentBills(s: GameState, n = 6): Bill[] {
  const p = polExt(s);
  return [...p.bills].slice(-n).reverse();
}

function nextExpiry(year: number, month: number, monthsAhead = 3) {
  let m = month + monthsAhead;
  let y = year;
  while (m > 12) { m -= 12; y += 1; }
  return { y, m };
}

/**
 * Propose a bill from a template. Deducts political capital; returns the same
 * state if unavailable.
 */
export function proposeBill(s: GameState, templateId: string): GameState {
  const tpl = BILL_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return s;
  const cap = polExt(s).politicalCapital;
  if (cap < tpl.capitalCost) return s;
  const next = structuredClone(s);
  const p = polExt(next);
  p.politicalCapital = cap - tpl.capitalCost;
  const exp = nextExpiry(next.year, next.month, 3);
  const bill: Bill = {
    id: `${tpl.id}-${next.year}-${next.month}-${p.bills.length + 1}`,
    templateId: tpl.id,
    titleKey: tpl.titleKey,
    descKey: tpl.descKey,
    domain: tpl.domain,
    leaning: tpl.leaning,
    capitalCost: tpl.capitalCost,
    boostCapital: 0,
    supportGroups: tpl.supportGroups.filter((g) => VALID_GROUPS.includes(g)),
    opposeGroups: tpl.opposeGroups.filter((g) => VALID_GROUPS.includes(g)),
    effect: tpl.effect,
    proposedYear: next.year,
    proposedMonth: next.month,
    expiresYear: exp.y,
    expiresMonth: exp.m,
    crisis: false,
    status: "pending",
  };
  p.bills.push(bill);
  return next;
}

const VALID_GROUPS: GroupId[] = ["unions", "business", "movements", "church", "media"];

/** Spend PC to whip a specific bill. Adds to boostCapital (up to 12). */
export function boostBill(s: GameState, billId: string, spend: number): GameState {
  const p0 = polExt(s);
  const b = p0.bills.find((x) => x.id === billId && x.status === "pending");
  if (!b) return s;
  const cost = clamp(Math.floor(spend), 1, 12);
  if (p0.politicalCapital < cost) return s;
  const next = structuredClone(s);
  const p = polExt(next);
  const nb = p.bills.find((x) => x.id === billId)!;
  nb.boostCapital = Math.min(20, nb.boostCapital + cost);
  p.politicalCapital -= cost;
  return next;
}

export function withdrawBill(s: GameState, billId: string): GameState {
  const next = structuredClone(s);
  const p = polExt(next);
  const b = p.bills.find((x) => x.id === billId && x.status === "pending");
  if (!b) return s;
  b.status = "rejected"; // counts as failed for career purposes
  p.billsRejected += 1;
  return next;
}

/* ============================================================ Voting */

/**
 * Simulate a party's yes-probability on a bill combining:
 *  - ideological affinity (party.leaning * bill.leaning)
 *  - trust in the mayor (goodwill toward mayor party)
 *  - coalition discipline (bonus if inside coalition)
 *  - lobby pressure from support/oppose groups (weighted by influence and mood)
 *  - PC whip (boostCapital)
 */
function partyYesProb(
  s: GameState,
  b: Bill,
  partyId: PartyId,
): number {
  const p = polExt(s);
  const party = p.council.parties.find((x) => x.id === partyId)!;
  const inCoalition = p.council.coalition.includes(partyId);
  const goodwill = p.council.goodwill[partyId];

  // Ideological alignment: same sign → positive contribution.
  const ideology = party.leaning * b.leaning; // -1..1
  let prob = 0.5 + ideology * 0.35;

  // Trust in the mayor.
  prob += (goodwill - 50) / 160;

  // Coalition discipline: bias toward yes, unless the bill is deeply hostile.
  if (inCoalition) prob += 0.14 - Math.max(0, -ideology) * 0.1;

  // Lobby pressure.
  let lobby = 0;
  for (const gid of b.supportGroups) {
    const g = p.groups.find((x) => x.id === gid);
    if (!g) continue;
    lobby += g.influence * ((g.mood - 40) / 100);
  }
  for (const gid of b.opposeGroups) {
    const g = p.groups.find((x) => x.id === gid);
    if (!g) continue;
    lobby -= g.influence * ((g.mood - 40) / 100);
  }
  prob += clamp(lobby, -0.35, 0.35);

  // Political capital whip: diminishing returns.
  prob += Math.min(0.35, b.boostCapital * 0.04);

  // Corruption drag: more graft → looser discipline.
  prob += (p.institutional.corruption - 30) * 0.0015 * (inCoalition ? -1 : 0.5);

  return clamp(prob, 0.03, 0.97);
}

/**
 * Call a vote on a pending bill. If it passes, apply effects. Returns updated
 * state with the bill closed out.
 */
export function callVote(s: GameState, billId: string, rng: () => number): GameState {
  const p0 = polExt(s);
  const b0 = p0.bills.find((x) => x.id === billId && x.status === "pending");
  if (!b0) return s;

  const next = structuredClone(s);
  const p = polExt(next);
  const b = p.bills.find((x) => x.id === billId)!;

  // Pledged seats from Mesa de Negociação (emendas + ceded ministries).
  // Static import — negotiation.ts imports from us but only calls our
  // functions lazily, so the cycle is safe at runtime.
  const negMod = negotiationModule;
  const nState = negMod.neg(next);
  const pledgedByParty: Record<string, number> = {};
  const seen = new Set<string>();
  for (const pl of nState.pledges.filter(p => p.billId === billId)) {
    if (seen.has(pl.vereadorId)) continue;
    seen.add(pl.vereadorId);
    const v = nState.vereadores.find(x => x.id === pl.vereadorId);
    if (!v) continue;
    pledgedByParty[v.party] = (pledgedByParty[v.party] ?? 0) + v.seats;
  }

  const votes: NonNullable<Bill["votes"]> = [];
  let yesSeats = 0;
  let noSeats = 0;
  for (const party of p.council.parties) {
    const pledged = Math.min(pledgedByParty[party.id] ?? 0, party.seats);
    const remaining = party.seats - pledged;
    yesSeats += pledged;
    if (remaining <= 0) {
      votes.push({ party: party.id, yes: true, margin: 1 });
      continue;
    }
    const yesProb = partyYesProb(next, b, party.id);
    const yes = rng() < yesProb;
    const margin = Math.abs(yesProb - 0.5);
    votes.push({ party: party.id, yes, margin });
    if (yes) yesSeats += remaining;
    else noSeats += remaining;
  }
  b.votes = votes;
  b.yesSeats = yesSeats;
  b.noSeats = noSeats;
  const passed = yesSeats * 2 > p.council.totalSeats;
  b.status = passed ? "passed" : "rejected";
  // Consume the pledges for this bill.
  nState.pledges = nState.pledges.filter(pl => pl.billId !== billId);
  if (passed) {
    p.billsPassed += 1;
    applyBillEffect(next, b);
    pushNews(next, {
      kind: "info",
      titleKey: `Câmara aprova: ${b.titleKey.split("||")[0]}||Council passes: ${b.titleKey.split("||")[1] ?? b.titleKey}`,
    });
  } else {
    p.billsRejected += 1;
    // A rejected bill damages the mayor's coalition standing a little.
    for (const gid of Object.keys(p.council.goodwill) as PartyId[]) {
      if (p.council.coalition.includes(gid)) {
        p.council.goodwill[gid] = clamp(p.council.goodwill[gid] - 2, 0, 100);
      }
    }
    next.approval = clamp(next.approval - 1, 0, 100);
    pushNews(next, {
      kind: "warning",
      titleKey: `Câmara rejeita: ${b.titleKey.split("||")[0]}||Council rejects: ${b.titleKey.split("||")[1] ?? b.titleKey}`,
    });
  }
  return next;
}

function applyBillEffect(s: GameState, b: Bill): void {
  const p = polExt(s);
  const e = b.effect;
  if (e.treasury) s.treasury += e.treasury;
  if (e.approval) s.approval = clamp(s.approval + e.approval, 0, 100);
  if (e.happiness) s.happiness = clamp(s.happiness + e.happiness, 0, 100);
  if (e.taxIncome) s.taxes.income = clamp(s.taxes.income + e.taxIncome, 0, 30);
  if (e.taxProperty) s.taxes.property = clamp(s.taxes.property + e.taxProperty, 0, 30);
  if (e.taxBusiness) s.taxes.business = clamp(s.taxes.business + e.taxBusiness, 0, 30);
  if (e.polEducation) s.policies.education = clamp(s.policies.education + e.polEducation, 0, 100);
  if (e.polHealth) s.policies.health = clamp(s.policies.health + e.polHealth, 0, 100);
  if (e.polSecurity) s.policies.security = clamp(s.policies.security + e.polSecurity, 0, 100);
  if (e.polTransport) s.policies.transport = clamp(s.policies.transport + e.polTransport, 0, 100);
  if (e.corruption) p.institutional.corruption = clamp(p.institutional.corruption + e.corruption, 0, 100);
  if (e.transparency) p.institutional.transparency = clamp(p.institutional.transparency + e.transparency, 0, 100);
  if (e.goodwillAll) {
    for (const id of Object.keys(p.council.goodwill) as PartyId[]) {
      p.council.goodwill[id] = clamp(p.council.goodwill[id] + e.goodwillAll, 0, 100);
    }
  }
  if (e.groupMood) {
    for (const gid of Object.keys(e.groupMood) as GroupId[]) {
      const g = p.groups.find((x) => x.id === gid);
      const delta = e.groupMood[gid];
      if (g && typeof delta === "number") g.mood = clamp(g.mood + delta, 0, 100);
    }
  }
}

/* ============================================================ Monthly tick */

/**
 * Monthly legislature tick:
 *  - Accrue political capital from approval and governability.
 *  - Expire stale bills; apply small penalty for letting crisis bills lapse.
 *  - Occasionally spawn a crisis bill triggered by the city's current problems.
 */
export function tickLegislature(s: GameState, rng: () => number): void {
  ensureLegislature(s);
  const p = polExt(s);

  // Accrue PC.
  const accrual =
    2 +
    s.approval / 28 +
    p.institutional.governability / 45 +
    coalitionStrength(p) * 3 -
    p.institutional.corruption / 40;
  p.politicalCapital = clamp(
    p.politicalCapital + Math.max(0, accrual),
    0,
    120,
  );

  // Expire.
  for (const b of p.bills) {
    if (b.status !== "pending") continue;
    const past =
      s.year > b.expiresYear ||
      (s.year === b.expiresYear && s.month > b.expiresMonth);
    if (past) {
      b.status = "expired";
      p.billsRejected += 1;
      if (b.crisis) {
        // Ignored crisis: real consequences.
        s.approval = clamp(s.approval - 4, 0, 100);
        s.happiness = clamp(s.happiness - 2, 0, 100);
        for (const gid of b.supportGroups) {
          const g = p.groups.find((x) => x.id === gid);
          if (g) g.mood = clamp(g.mood - 8, 0, 100);
        }
        pushNews(s, {
          kind: "danger",
          titleKey: `Crise sem resposta: ${b.titleKey.split("||")[0]}||Unaddressed crisis: ${b.titleKey.split("||")[1] ?? b.titleKey}`,
        });
      } else {
        pushNews(s, {
          kind: "info",
          titleKey: `Projeto arquivado por decurso de prazo||Bill shelved (deadline lapsed)`,
        });
      }
    }
  }

  // Maybe spawn a crisis: base 6%/month, plus modifiers from current state.
  const openCrises = p.bills.filter((b) => b.status === "pending" && b.crisis).length;
  if (openCrises === 0) {
    let chance = 0.06;
    if (s.climate?.drainage.lastFlooded) chance += 0.35;
    if (s.climate?.sanitation.lastOutbreak) chance += 0.35;
    if (p.institutional.corruption > 55) chance += 0.15;
    if (s.unemployment > 12) chance += 0.15;
    if (s.inflation > 8) chance += 0.1;
    if (rng() < chance) spawnCrisisBill(s, rng);
  }
}

function spawnCrisisBill(s: GameState, rng: () => number): void {
  const p = polExt(s);
  // Pick a template that best matches the current pressure.
  const preferred: string[] = [];
  if (s.climate?.drainage.lastFlooded) preferred.push("crisis_flood_relief");
  if (s.climate?.sanitation.lastOutbreak) preferred.push("crisis_health_task");
  if (p.institutional.corruption > 55) preferred.push("crisis_corruption_probe");
  if (s.unemployment > 12) preferred.push("crisis_general_strike");
  if (s.inflation > 8 || s.businesses < 4) preferred.push("crisis_business_flight");

  const pool = preferred.length > 0
    ? CRISIS_TEMPLATES.filter((t) => preferred.includes(t.id))
    : CRISIS_TEMPLATES;
  const tpl = pool[Math.floor(rng() * pool.length)] ?? CRISIS_TEMPLATES[0];

  const exp = nextExpiry(s.year, s.month, 2); // crisis bills expire faster
  const bill: Bill = {
    id: `${tpl.id}-${s.year}-${s.month}-${p.bills.length + 1}`,
    templateId: tpl.id,
    titleKey: tpl.titleKey,
    descKey: tpl.descKey,
    domain: tpl.domain,
    leaning: tpl.leaning,
    capitalCost: 0, // crises are surfaced, not chosen by the mayor
    boostCapital: 0,
    supportGroups: tpl.supportGroups.filter((g) => VALID_GROUPS.includes(g)),
    opposeGroups: tpl.opposeGroups.filter((g) => VALID_GROUPS.includes(g)),
    effect: tpl.effect,
    proposedYear: s.year,
    proposedMonth: s.month,
    expiresYear: exp.y,
    expiresMonth: exp.m,
    crisis: true,
    status: "pending",
  };
  p.bills.push(bill);
  pushNews(s, {
    kind: "warning",
    titleKey: `Nova crise na pauta: ${tpl.titleKey.split("||")[0]}||New crisis on the agenda: ${tpl.titleKey.split("||")[1] ?? tpl.titleKey}`,
  });
}

/* ============================================================ Reelection */

/**
 * Contribution of legislative record to reelection vote share (-8..+8 points).
 * Long streaks of passed bills boost; failures and expired crises hurt.
 */
export function legislativeScore(s: GameState): number {
  const p = polExt(s);
  const total = p.billsPassed + p.billsRejected;
  if (total === 0) return 0;
  const rate = p.billsPassed / total; // 0..1
  const volume = Math.min(1, total / 15);
  return clamp((rate - 0.5) * 16 * volume, -8, 8);
}
