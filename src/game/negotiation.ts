/*
 * Mesa de Negociação — legislative bargaining layer on top of `politics.ts`
 * and `legislature.ts`. It adds:
 *
 *   - Named vereadores (councillors) tied to a party, a home district, and a
 *     personal "price" (how many benefits it takes to whip their vote).
 *   - District satisfaction (Centro, Zona Norte, Periferia, Zona Sul,
 *     Industrial) that maps back to party vote share on the next election —
 *     a simplified electoral quotient.
 *   - Bargain instruments: emendas locais (pork barrel), loteamento de
 *     secretarias (ceded ministries) and blocking-committee (CPI) counter.
 *   - Vote pledges honored inside `callVote` so bargains actually convert
 *     into yes votes without touching the legislature RNG logic.
 *   - A monthly CPI/opposition simulation that can paralyze the mayor's
 *     capital investments until it is resolved.
 *
 * Nothing here mutates state without going through structuredClone (mirrors
 * the reducer convention used by useGame). All exported actions therefore
 * return a fresh GameState.
 */

import type { GameState, NewsItem } from "./types";
import type { PartyId } from "./politics";
import { ensurePolitics, TOTAL_SEATS } from "./politics";
import { ensureLegislature, polExt, pendingBills } from "./legislature";

/* ============================================================ Types ===== */

export type DistrictId =
  | "centro"
  | "zona_norte"
  | "periferia_leste"
  | "zona_sul"
  | "industrial";

export type MinistryId =
  | "transport"
  | "housing"
  | "health"
  | "education"
  | "works"
  | "environment";

export type PledgeSource = "emenda" | "ministry" | "ideology";

export interface District {
  id: DistrictId;
  namePt: string;
  nameEn: string;
  /** Base voter tendency, aligned with the -1..1 party leaning axis. */
  leaning: number;
  /** Population weight used in the electoral-quotient projection. */
  weight: number;
  /** 0..100. Fed monthly from happiness, approval, and area-specific signals. */
  satisfaction: number;
  /** Cash spent on emendas this term — decays each year. */
  emendaCredit: number;
}

export interface Vereador {
  id: string;
  namePt: string;
  nameEn: string;
  party: PartyId;
  district: DistrictId;
  /** -1 (progressive) .. 1 (conservative). */
  leaning: number;
  /** Baseline sympathy for the mayor, 0..100. */
  loyalty: number;
  /** Reais needed to whip this vereador with a local amendment. */
  emendaPrice: number;
  /** Cadeira / seats this vereador represents (usually 1). */
  seats: number;
  /** True while the vereador is publicly attacking the mayor. */
  opposition: boolean;
  archetype: "leader" | "backbencher" | "fireband" | "broker";
}

export interface CededMinistry {
  ministry: MinistryId;
  party: PartyId;
  /** 0..1. Effectiveness penalty applied by external systems that read it. */
  efficiencyPenalty: number;
  cededYear: number;
  cededMonth: number;
}

export interface Pledge {
  billId: string;
  vereadorId: string;
  source: PledgeSource;
  /** Total cash committed for this pledge (for emendas only). */
  cost: number;
}

export interface CpiState {
  active: boolean;
  /** 0..100. When >= 100 the CPI concludes (usually against the mayor). */
  progress: number;
  /** Which vereador is leading the inquiry. */
  chairId: string | null;
  reasonPt: string;
  reasonEn: string;
  openedYear: number;
  openedMonth: number;
  /** Set to true after the mayor spends resources to close the CPI. */
  resolved: boolean;
  /** True while active — paralyses discretionary capital spending. */
  freezeInvestments: boolean;
  /** How many CPIs have concluded against the mayor (each hurts reelection). */
  concludedAgainst: number;
}

export interface NegotiationState {
  districts: District[];
  vereadores: Vereador[];
  cededMinistries: CededMinistry[];
  pledges: Pledge[];
  cpi: CpiState;
  /** Total spent on emendas since term start. */
  emendaSpent: number;
  /** How many bills the mayor has already whipped through negotiation. */
  brokeredBills: number;
}

/* ============================================================ Bootstrap = */

const DISTRICTS: District[] = [
  { id: "centro",           namePt: "Centro",           nameEn: "Downtown",       leaning:  0.05, weight: 0.18, satisfaction: 55, emendaCredit: 0 },
  { id: "zona_norte",       namePt: "Zona Norte",       nameEn: "North Zone",     leaning:  0.25, weight: 0.22, satisfaction: 50, emendaCredit: 0 },
  { id: "periferia_leste",  namePt: "Periferia Leste",  nameEn: "East Periphery", leaning: -0.45, weight: 0.26, satisfaction: 45, emendaCredit: 0 },
  { id: "zona_sul",         namePt: "Zona Sul",         nameEn: "South Zone",     leaning:  0.30, weight: 0.16, satisfaction: 60, emendaCredit: 0 },
  { id: "industrial",       namePt: "Distrito Industrial", nameEn: "Industrial District", leaning: 0.55, weight: 0.18, satisfaction: 55, emendaCredit: 0 },
];

/**
 * Fifteen named vereadores across the 6 parties. Names are caricatured on
 * purpose — Zuza, Fefê and Miro anchor the opposition, as required.
 * Total seats = 21 (matches politics.TOTAL_SEATS via aggregation).
 */
const VEREADORES: Vereador[] = [
  // Prog (4)
  { id: "v_lu",    namePt: "Lu Batista",  nameEn: "Lu Batista",  party: "prog",     district: "periferia_leste", leaning: -0.5, loyalty: 65, emendaPrice:  800_000, seats: 2, opposition: false, archetype: "leader" },
  { id: "v_regi",  namePt: "Regi Souza",  nameEn: "Regi Souza",  party: "prog",     district: "centro",          leaning: -0.4, loyalty: 55, emendaPrice:  600_000, seats: 2, opposition: false, archetype: "backbencher" },

  // Socialist (2)
  { id: "v_fefe",  namePt: "Fefê Andrade", nameEn: "Fefê Andrade", party: "socialist", district: "periferia_leste", leaning: -0.85, loyalty: 30, emendaPrice: 1_200_000, seats: 2, opposition: true, archetype: "fireband" },

  // Green (2)
  { id: "v_mari",  namePt: "Mari Verde",  nameEn: "Mari Green",  party: "green",    district: "zona_sul",        leaning: -0.15, loyalty: 60, emendaPrice:  500_000, seats: 2, opposition: false, archetype: "broker" },

  // Center (5)
  { id: "v_toninho", namePt: "Toninho Gordo", nameEn: "Toninho Gordo", party: "center", district: "centro",     leaning:  0.05, loyalty: 70, emendaPrice:  400_000, seats: 2, opposition: false, archetype: "broker" },
  { id: "v_dona",    namePt: "Dona Zilda",    nameEn: "Dona Zilda",    party: "center", district: "zona_norte", leaning:  0.10, loyalty: 60, emendaPrice:  350_000, seats: 2, opposition: false, archetype: "backbencher" },
  { id: "v_miro",    namePt: "Miro Coelho",   nameEn: "Miro Coelho",   party: "center", district: "industrial", leaning:  0.20, loyalty: 40, emendaPrice:  700_000, seats: 1, opposition: true, archetype: "leader" },

  // Liberal (4)
  { id: "v_bruno",   namePt: "Bruno Vetor",   nameEn: "Bruno Vetor",   party: "liberal", district: "zona_sul",     leaning:  0.55, loyalty: 45, emendaPrice:  650_000, seats: 2, opposition: false, archetype: "broker" },
  { id: "v_juca",    namePt: "Juca Mercado",  nameEn: "Juca Mercado",  party: "liberal", district: "industrial",   leaning:  0.65, loyalty: 40, emendaPrice:  900_000, seats: 2, opposition: false, archetype: "backbencher" },

  // Conserv (4)
  { id: "v_zuza",    namePt: "Zuza Ferreira", nameEn: "Zuza Ferreira", party: "conserv", district: "centro",       leaning:  0.90, loyalty: 20, emendaPrice: 1_400_000, seats: 2, opposition: true, archetype: "fireband" },
  { id: "v_paulao",  namePt: "Paulão Bragança", nameEn: "Paulão Bragança", party: "conserv", district: "zona_sul", leaning:  0.75, loyalty: 35, emendaPrice:  850_000, seats: 2, opposition: true, archetype: "backbencher" },
];

const MINISTRY_LABEL: Record<MinistryId, { pt: string; en: string; penalty: number }> = {
  transport:   { pt: "Sec. de Transportes",  en: "Transport",   penalty: 0.20 },
  housing:     { pt: "Sec. de Habitação",    en: "Housing",     penalty: 0.15 },
  health:      { pt: "Sec. de Saúde",        en: "Health",      penalty: 0.25 },
  education:   { pt: "Sec. de Educação",     en: "Education",   penalty: 0.20 },
  works:       { pt: "Sec. de Obras",        en: "Public Works", penalty: 0.18 },
  environment: { pt: "Sec. de Meio Ambiente", en: "Environment", penalty: 0.22 },
};

export function ministryLabel(id: MinistryId): { pt: string; en: string; penalty: number } {
  return MINISTRY_LABEL[id];
}

export function ensureNegotiation(s: GameState): void {
  ensurePolitics(s);
  ensureLegislature(s);
  const g = s as GameState & { negotiation?: NegotiationState };
  if (!g.negotiation) {
    g.negotiation = {
      districts: DISTRICTS.map(d => ({ ...d })),
      vereadores: VEREADORES.map(v => ({ ...v })),
      cededMinistries: [],
      pledges: [],
      cpi: {
        active: false, progress: 0, chairId: null,
        reasonPt: "", reasonEn: "",
        openedYear: s.year, openedMonth: s.month,
        resolved: false, freezeInvestments: false,
        concludedAgainst: 0,
      },
      emendaSpent: 0,
      brokeredBills: 0,
    };
  }
}

export function neg(s: GameState): NegotiationState {
  ensureNegotiation(s);
  return (s as GameState & { negotiation: NegotiationState }).negotiation;
}

/* ============================================================ Selectors = */

/** True when a ministry is currently ceded to a party. */
export function isMinistryCeded(s: GameState, m: MinistryId): CededMinistry | null {
  return neg(s).cededMinistries.find(c => c.ministry === m) ?? null;
}

/** Combined efficiency multiplier for a ministry (1.0 = full). */
export function ministryEfficiency(s: GameState, m: MinistryId): number {
  const c = isMinistryCeded(s, m);
  if (!c) return 1.0;
  return Math.max(0.5, 1 - c.efficiencyPenalty);
}

/** Aggregate committed seats for a specific bill from every pledge source. */
export function pledgedSeats(s: GameState, billId: string): number {
  const n = neg(s);
  const seen = new Set<string>();
  let total = 0;
  for (const p of n.pledges) {
    if (p.billId !== billId) continue;
    if (seen.has(p.vereadorId)) continue;
    seen.add(p.vereadorId);
    const v = n.vereadores.find(x => x.id === p.vereadorId);
    if (v) total += v.seats;
  }
  return total;
}

/** Whether the current pledges guarantee a simple majority for the bill. */
export function bargainMajority(s: GameState, billId: string): boolean {
  return pledgedSeats(s, billId) * 2 > TOTAL_SEATS;
}

/* ============================================================ Bargains == */

/**
 * Offer a local amendment (verba de emenda) to a vereador in exchange for a
 * yes vote on a specific pending bill. The vereador only accepts if the
 * amount clears their personal price, adjusted by loyalty.
 */
export function offerEmenda(
  s: GameState, billId: string, vereadorId: string, amount: number,
): { state: GameState; ok: boolean; reason?: string } {
  const bill = pendingBills(s).find(b => b.id === billId);
  if (!bill) return { state: s, ok: false, reason: "bill_missing" };
  if (s.treasury < amount) return { state: s, ok: false, reason: "no_cash" };

  const next = structuredClone(s);
  const n = neg(next);
  const v = n.vereadores.find(x => x.id === vereadorId);
  if (!v) return { state: s, ok: false, reason: "vereador_missing" };

  // Price scales down with loyalty and up when the vereador is in opposition.
  const price = v.emendaPrice * (v.opposition ? 1.4 : 1.0) * (1 - (v.loyalty - 50) / 300);
  if (amount < price) return { state: s, ok: false, reason: "too_low" };

  // Register the pledge if it isn't already there.
  const dup = n.pledges.find(p => p.billId === billId && p.vereadorId === vereadorId);
  if (dup) { dup.cost += amount; dup.source = "emenda"; }
  else n.pledges.push({ billId, vereadorId, source: "emenda", cost: amount });

  // Pay & feed the district's satisfaction bucket.
  next.treasury -= amount;
  n.emendaSpent += amount;
  const d = n.districts.find(x => x.id === v.district);
  if (d) {
    d.emendaCredit += amount;
    d.satisfaction = Math.min(100, d.satisfaction + Math.round(amount / 200_000));
  }
  v.loyalty = Math.min(100, v.loyalty + 4);
  v.opposition = false;
  next.approval = Math.max(0, Math.min(100, next.approval - 1)); // whiff of pork-barrel scandal

  const item: Omit<NewsItem, "id" | "month" | "year" | "day"> = {
    kind: "warning",
    titleKey:
      `Emenda de R$ ${(amount / 1000).toFixed(0)}k libera voto de ${v.namePt} (${d?.namePt ?? "?"})||` +
      `R$${(amount / 1000).toFixed(0)}k earmark unlocks vote from ${v.nameEn} (${d?.nameEn ?? "?"})`,
  };
  if (!next.news) next.news = [];
  next.news.unshift({
    id: `emenda-${vereadorId}-${next.year}-${next.month}`,
    kind: item.kind, titleKey: item.titleKey,
    day: next.day, month: next.month, year: next.year,
  });

  return { state: next, ok: true };
}

/**
 * Cede a municipal secretariat to a party. Every vereador of that party
 * immediately pledges yes on all pending bills, but the ministry incurs an
 * efficiency penalty that other systems can read via ministryEfficiency().
 */
export function cedeMinistry(
  s: GameState, ministry: MinistryId, party: PartyId,
): { state: GameState; ok: boolean; reason?: string } {
  if (isMinistryCeded(s, ministry)) return { state: s, ok: false, reason: "already_ceded" };
  const next = structuredClone(s);
  const n = neg(next);
  const label = MINISTRY_LABEL[ministry];
  n.cededMinistries.push({
    ministry, party,
    efficiencyPenalty: label.penalty,
    cededYear: next.year, cededMonth: next.month,
  });

  // All pending bills instantly get pledges from this party's vereadores.
  const bills = pendingBills(next);
  for (const b of bills) {
    for (const v of n.vereadores.filter(x => x.party === party)) {
      const dup = n.pledges.find(p => p.billId === b.id && p.vereadorId === v.id);
      if (!dup) n.pledges.push({ billId: b.id, vereadorId: v.id, source: "ministry", cost: 0 });
      v.loyalty = Math.min(100, v.loyalty + 8);
      v.opposition = false;
    }
  }

  // Coalition goodwill boost, capital loss (fisiologismo).
  const pol = polExt(next);
  pol.council.goodwill[party] = Math.min(100, pol.council.goodwill[party] + 15);
  if (!pol.council.coalition.includes(party)) pol.council.coalition.push(party);
  pol.institutional.transparency = Math.max(0, pol.institutional.transparency - 5);
  pol.institutional.corruption   = Math.min(100, pol.institutional.corruption + 4);
  next.approval = Math.max(0, next.approval - 3);

  if (!next.news) next.news = [];
  next.news.unshift({
    id: `ministry-${ministry}-${next.year}-${next.month}`,
    kind: "warning",
    titleKey:
      `${label.pt} entregue ao partido — eficiência técnica −${Math.round(label.penalty * 100)}%||` +
      `${label.en} handed to party — technical efficiency −${Math.round(label.penalty * 100)}%`,
    day: next.day, month: next.month, year: next.year,
  });

  return { state: next, ok: true };
}

/** Revoke a ceded ministry. Loses that party's pledges and goodwill. */
export function revokeMinistry(s: GameState, ministry: MinistryId): GameState {
  const c = isMinistryCeded(s, ministry);
  if (!c) return s;
  const next = structuredClone(s);
  const n = neg(next);
  n.cededMinistries = n.cededMinistries.filter(x => x.ministry !== ministry);
  n.pledges = n.pledges.filter(p => {
    const v = n.vereadores.find(x => x.id === p.vereadorId);
    return !(v && v.party === c.party && p.source === "ministry");
  });
  const pol = polExt(next);
  pol.council.goodwill[c.party] = Math.max(0, pol.council.goodwill[c.party] - 25);
  for (const v of n.vereadores.filter(x => x.party === c.party)) {
    v.opposition = true;
    v.loyalty = Math.max(0, v.loyalty - 15);
  }
  return next;
}

/* ============================================================ CPI ====== */

/**
 * Player action: try to defuse an active CPI by spending political capital
 * and treasury on legal defense and communication.
 */
export function investigateCPI(s: GameState): GameState {
  const n = neg(s);
  if (!n.cpi.active || n.cpi.resolved) return s;
  const pol = polExt(s);
  if (pol.politicalCapital < 12 || s.treasury < 300_000) return s;
  const next = structuredClone(s);
  const p = polExt(next);
  const nn = neg(next);
  p.politicalCapital -= 12;
  next.treasury -= 300_000;
  nn.cpi.progress = Math.max(0, nn.cpi.progress - 35);
  if (nn.cpi.progress <= 5) {
    nn.cpi.active = false;
    nn.cpi.resolved = true;
    nn.cpi.freezeInvestments = false;
    if (!next.news) next.news = [];
    next.news.unshift({
      id: `cpi-close-${next.year}-${next.month}`,
      kind: "info",
      titleKey: "CPI arquivada após acordo entre lideranças||Inquiry shelved after backroom deal",
      day: next.day, month: next.month, year: next.year,
    });
  }
  return next;
}

/* ============================================================ Vote hook  */

/**
 * Called from `callVote` in legislature.ts BEFORE the RNG loop. Any bill
 * for which pledges already guarantee majority is decided here — the
 * pledges are then consumed (removed) so a subsequent vote does not double
 * count them.
 *
 * Returns `null` when the bill still needs the normal RNG voting logic.
 */
export function tryForceApprove(
  s: GameState, billId: string,
): { state: GameState; approved: boolean } | null {
  const yesSeats = pledgedSeats(s, billId);
  if (yesSeats * 2 <= TOTAL_SEATS) return null;
  const next = structuredClone(s);
  const n = neg(next);
  n.brokeredBills += 1;
  n.pledges = n.pledges.filter(p => p.billId !== billId);
  return { state: next, approved: true };
}

/* ============================================================ Monthly === */

/**
 * Feed district satisfaction from macro signals, decay emenda credit,
 * update opposition flags, run CPI progression and trigger CPIs when the
 * mayor's approval collapses.
 */
export function tickNegotiation(s: GameState, rng: () => number): void {
  ensureNegotiation(s);
  const n = neg(s);
  const pol = polExt(s);

  // 1) District satisfaction — seeded by approval + happiness + area signals.
  const base = (s.approval + s.happiness) / 2;
  const commuteStress = (s.wellbeing?.commuteMinutes ?? 70) - 70;      // periphery pain
  const gentrifiPress = s.housing?.gentrificationIndex ?? 0;          // centre pain
  const industrialAir = s.wellbeing?.pm25 ?? 12;                        // industrial pain

  for (const d of n.districts) {
    let sat = base + (d.leaning * 4);
    if (d.id === "periferia_leste") sat -= Math.max(0, commuteStress) * 0.15;
    if (d.id === "centro")          sat -= Math.min(20, gentrifiPress) * 0.3;
    if (d.id === "industrial")      sat -= Math.max(0, industrialAir - 15) * 0.2;
    if (d.id === "zona_sul")        sat += (s.policies?.security ?? 50 - 50) * 0.05;
    // Emenda credit → local bonus that fades each month.
    sat += Math.min(20, d.emendaCredit / 200_000);
    d.emendaCredit = Math.max(0, d.emendaCredit - d.emendaCredit * 0.05);
    d.satisfaction = Math.max(0, Math.min(100, Math.round(sat)));
  }

  // 2) Feed satisfaction back into party seats — simplified electoral quotient.
  //    Runs continuously to project the "next election" balance and drives
  //    party opposition flags immediately.
  const partyPull: Record<PartyId, number> = {
    prog: 0, socialist: 0, green: 0, center: 0, liberal: 0, conserv: 0,
  };
  for (const d of n.districts) {
    const dissatisfaction = (100 - d.satisfaction) / 100;
    // Each party's affinity with the district (based on leaning distance).
    for (const p of pol.council.parties) {
      const affinity = 1 - Math.min(1, Math.abs(p.leaning - d.leaning));
      partyPull[p.id] += d.weight * dissatisfaction * affinity;
    }
  }
  // Normalize into projected seats and stash as `projectedSeats` on parties.
  const totalPull = Object.values(partyPull).reduce((a, b) => a + b, 1e-6);
  for (const p of pol.council.parties) {
    const projected = Math.round((partyPull[p.id] / totalPull) * TOTAL_SEATS);
    (p as unknown as { projectedSeats?: number }).projectedSeats =
      Math.max(1, projected);
  }

  // 3) Vereador opposition flags: react to their district's mood.
  for (const v of n.vereadores) {
    const d = n.districts.find(x => x.id === v.district)!;
    if (d.satisfaction < 30 && v.loyalty < 60) v.opposition = true;
    if (d.satisfaction > 70 && v.loyalty > 55) v.opposition = false;
  }

  // 4) CPI progression / trigger.
  const cpi = n.cpi;
  const oppLeaders = n.vereadores.filter(v => v.opposition && v.archetype !== "backbencher");
  const oppSeats = oppLeaders.reduce((a, v) => a + v.seats, 0);
  const collapse = s.approval < 32 && oppSeats >= 7;

  if (!cpi.active && !cpi.resolved && collapse && rng() < 0.35) {
    // Choose chair from most vocal opposition
    const chair = oppLeaders.find(v => v.archetype === "fireband") ?? oppLeaders[0];
    cpi.active = true;
    cpi.chairId = chair?.id ?? null;
    cpi.progress = 20;
    cpi.openedYear = s.year;
    cpi.openedMonth = s.month;
    cpi.freezeInvestments = true;
    cpi.reasonPt = "Suspeitas de fisiologismo em emendas e loteamento de secretarias";
    cpi.reasonEn = "Suspected pork-barrel dealings and ministry patronage";
    if (!s.news) s.news = [];
    s.news.unshift({
      id: `cpi-open-${s.year}-${s.month}`,
      kind: "danger",
      titleKey:
        `CPI da Prefeitura instalada — investimentos suspensos||` +
        `Inquiry Commission installed — capital projects frozen`,
      day: s.day, month: s.month, year: s.year,
    });
  } else if (cpi.active) {
    // Progress builds up while opposition is strong and approval bad.
    const escalation =
      (oppSeats / TOTAL_SEATS) * 20 +
      Math.max(0, 40 - s.approval) * 0.5 +
      n.cededMinistries.length * 4;
    cpi.progress = Math.min(100, cpi.progress + escalation * 0.35);
    if (cpi.progress >= 100) {
      cpi.active = false;
      cpi.resolved = false;
      cpi.freezeInvestments = false;
      cpi.concludedAgainst += 1;
      s.approval = Math.max(0, s.approval - 12);
      s.happiness = Math.max(0, s.happiness - 6);
      pol.institutional.transparency = Math.max(0, pol.institutional.transparency - 8);
      if (!s.news) s.news = [];
      s.news.unshift({
        id: `cpi-conclude-${s.year}-${s.month}`,
        kind: "danger",
        titleKey:
          `Relatório final da CPI aponta irregularidades — aprovação despenca||` +
          `Inquiry final report finds wrongdoing — approval collapses`,
        day: s.day, month: s.month, year: s.year,
      });
    }
  }

  // 5) Cleanup stale pledges (bills that no longer exist / expired).
  const validBills = new Set(polExt(s).bills.map(b => b.id));
  n.pledges = n.pledges.filter(p => validBills.has(p.billId));
}
