/**
 * bidding.ts — Sistema de Licitações do Modo Prefeito.
 *
 * O jogador não constrói diretamente no mapa: abre uma "Nova Obra" escolhendo
 * categoria (Saúde, Educação, Mobilidade, Habitação, Infra, Marco Cívico) e
 * bairro-alvo (kind de distrito). O jogo gera 3 propostas concorrentes com
 * trade-offs deterministicamente enviesados pela `bidPoolBias` da cidade
 * (Noitedema tende a corrupto, Santo Caetano tende a caro-porém-limpo).
 *
 * Ao adjudicar (award), a obra vai pra fila `works` e avança 1 mês/tick.
 * Ao completar, o `autoGrowth.placeBuildingInDistrict` seleciona um tile
 * adjacente a estrada dentro do distrito-alvo e planta o sprite.
 *
 * Integrações:
 *   - Consome/rende capital político em `politics.politicalCapital`.
 *   - Escândalos (roll de corrupção) disparam `NewsItem` + risco no `oversight`.
 *   - Atrasos consomem tesouro extra e podem virar manchete negativa.
 */
import type { BuildingKind, GameState, NewsItem } from "./types";
import type { DistrictKind } from "./districts";
import { generateDistricts } from "./districts";
import { mulberry32, hashSeed } from "./rng";

export type WorkCategory = "health" | "education" | "mobility" | "housing" | "infra" | "civic";

export interface Proposal {
  id: string;
  company: string;
  price: number;         // total contratado (R$)
  months: number;        // prazo prometido
  quality: 1 | 2 | 3 | 4 | 5;
  corruptionRisk: number; // 0..1
  delayRisk: number;      // 0..1
  politicalTie?: string;  // texto curto (partido/família) — só flavor
}

export interface OpenBidding {
  id: string;
  category: WorkCategory;
  buildingKind: BuildingKind;
  districtKind: DistrictKind;
  basePrice: number;
  baseMonths: number;
  proposals: Proposal[];
  openedAt: { month: number; year: number };
}

export interface PublicWork {
  id: string;
  category: WorkCategory;
  buildingKind: BuildingKind;
  districtKind: DistrictKind;
  company: string;
  totalPrice: number;
  monthsTotal: number;
  monthsElapsed: number;
  quality: number;
  corruptionRisk: number;
  delayRisk: number;
  politicalTie?: string;
  status: "in_progress" | "completed" | "scandal";
}

export interface WorkHistoryEntry {
  id: string;
  company: string;
  buildingKind: BuildingKind;
  districtKind: DistrictKind;
  category: WorkCategory;
  finishedAt: { month: number; year: number };
  outcome: "ok" | "delayed" | "scandal";
}

export interface BiddingState {
  open: OpenBidding[];
  works: PublicWork[];
  history: WorkHistoryEntry[];
}

export interface BidPoolBias {
  corruptionMean: number; // 0..1
  delayMean: number;      // 0..1
  priceMult: number;      // 0.7..1.3 — média multiplicativa do preço-base
  qualityBias: number;    // -2..+2 (adicionado ao roll de qualidade)
}

const DEFAULT_BIAS: BidPoolBias = { corruptionMean: 0.35, delayMean: 0.35, priceMult: 1, qualityBias: 0 };

/* ---------------- Catálogo de obras ---------------- */

interface CategorySpec {
  buildingKind: BuildingKind;
  basePrice: number;
  baseMonths: number;
  labelPt: string;
  labelEn: string;
}

export const CATEGORY_SPEC: Record<WorkCategory, CategorySpec> = {
  health:    { buildingKind: "hospital",      basePrice: 950_000, baseMonths: 14, labelPt: "Saúde (UPA / Hospital)",     labelEn: "Health (Clinic / Hospital)" },
  education: { buildingKind: "school",        basePrice: 420_000, baseMonths: 10, labelPt: "Educação (Escola)",           labelEn: "Education (School)" },
  mobility:  { buildingKind: "praca",         basePrice: 680_000, baseMonths: 12, labelPt: "Mobilidade (Terminal / BRT)", labelEn: "Mobility (Terminal / BRT)" },
  housing:   { buildingKind: "house_l",       basePrice: 380_000, baseMonths: 8,  labelPt: "Habitação Popular (COHAB)",   labelEn: "Social Housing (COHAB)" },
  infra:     { buildingKind: "water_plant",   basePrice: 550_000, baseMonths: 10, labelPt: "Infra (Água / Energia)",      labelEn: "Infra (Water / Power)" },
  civic:     { buildingKind: "marco_central", basePrice: 260_000, baseMonths: 6,  labelPt: "Marco Cívico (Praça)",        labelEn: "Civic Landmark (Plaza)" },
};

/* Pool satírico — nomes fictícios pra não brigar com marcas reais. */
const COMPANY_POOL: Array<{ name: string; corrupt: number; delay: number; priceBias: number; quality: number; tie?: string }> = [
  { name: "Cebracon Obras",          corrupt: +0.35, delay: +0.10, priceBias: -0.15, quality: -1, tie: "PDR" },
  { name: "Bordering Ltda.",         corrupt: +0.15, delay: +0.05, priceBias:  0.00, quality:  0 },
  { name: "OK Empreiteira",          corrupt: -0.10, delay: -0.05, priceBias: +0.10, quality: +1 },
  { name: "Kbral & Kbral",           corrupt: +0.30, delay: +0.15, priceBias: -0.05, quality: -1, tie: "MDS" },
  { name: "Nova Aurora Engenharia",  corrupt: -0.15, delay: -0.10, priceBias: +0.15, quality: +2 },
  { name: "Serra Alta Construtora",  corrupt: -0.05, delay:  0.00, priceBias: +0.05, quality: +1 },
  { name: "Concreto & Cia",          corrupt:  0.00, delay: +0.05, priceBias: -0.05, quality:  0 },
  { name: "Andrade Superior",        corrupt: +0.10, delay:  0.00, priceBias:  0.00, quality: +1, tie: "UDN-Novo" },
  { name: "Vale do Rio Construtora", corrupt: +0.05, delay: +0.20, priceBias: -0.10, quality:  0 },
  { name: "Amanhã Serviços Urbanos", corrupt: -0.20, delay: -0.05, priceBias: +0.20, quality: +2 },
];

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/* ---------------- API ---------------- */

export function defaultBidding(): BiddingState {
  return { open: [], works: [], history: [] };
}

export function ensureBidding(s: GameState): void {
  if (!s.bidding) s.bidding = defaultBidding();
  if (!Array.isArray(s.bidding.open))    s.bidding.open = [];
  if (!Array.isArray(s.bidding.works))   s.bidding.works = [];
  if (!Array.isArray(s.bidding.history)) s.bidding.history = [];
}

/**
 * Gera uma licitação com 3 propostas para (categoria × distrito). Usa o RNG
 * determinístico do jogo (seed + cursor) pra que a mesma sequência de ações
 * do jogador produza sempre o mesmo pool — permite testes / replays.
 */
export function openBiddingForCategory(
  s: GameState,
  category: WorkCategory,
  districtKind: DistrictKind,
): OpenBidding {
  ensureBidding(s);
  const spec = CATEGORY_SPEC[category];
  const bias = s.bidPoolBias ?? DEFAULT_BIAS;
  // RNG local baseado em (seed, cursor, categoria) — cursor avança pra evitar
  // que duas licitações consecutivas gerem pools idênticos.
  const salt = `${s.seed}|bid|${s.rngCursor ?? 0}|${category}|${districtKind}`;
  s.rngCursor = (s.rngCursor ?? 0) + 1;
  const rng = mulberry32(hashSeed(salt));

  // Amostra 3 empresas distintas.
  const pool = [...COMPANY_POOL];
  const picks: typeof COMPANY_POOL = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }

  const proposals: Proposal[] = picks.map((p, i) => {
    const priceMult = clamp((0.85 + rng() * 0.5) * bias.priceMult * (1 + p.priceBias), 0.55, 1.85);
    const monthMult = 0.6 + rng() * 1.2; // 0.6..1.8
    const qRoll = Math.round(2 + rng() * 3 + p.quality + bias.qualityBias);
    const quality = clamp(qRoll, 1, 5) as Proposal["quality"];
    const corruption = clamp01(bias.corruptionMean + p.corrupt + (rng() - 0.5) * 0.3);
    const delay = clamp01(bias.delayMean + p.delay + (rng() - 0.5) * 0.3);
    return {
      id: `p_${salt}_${i}`,
      company: p.name,
      price: Math.round(spec.basePrice * priceMult / 1000) * 1000,
      months: Math.max(3, Math.round(spec.baseMonths * monthMult)),
      quality,
      corruptionRisk: corruption,
      delayRisk: delay,
      politicalTie: p.tie,
    };
  });

  const bid: OpenBidding = {
    id: `bid_${s.seed}_${s.rngCursor}_${category}_${districtKind}`,
    category,
    buildingKind: spec.buildingKind,
    districtKind,
    basePrice: spec.basePrice,
    baseMonths: spec.baseMonths,
    proposals,
    openedAt: { month: s.month, year: s.year },
  };
  s.bidding!.open.push(bid);
  return bid;
}

/**
 * O jogador adjudica a licitação: paga o valor (sinal + empenho), consome
 * capital político proporcional ao risco de corrupção e ao vínculo político,
 * e move a obra pra `works`. Retorna true em sucesso.
 */
export function awardBidding(s: GameState, biddingId: string, proposalId: string): boolean {
  ensureBidding(s);
  const idx = s.bidding!.open.findIndex(b => b.id === biddingId);
  if (idx < 0) return false;
  const bid = s.bidding!.open[idx];
  const proposal = bid.proposals.find(p => p.id === proposalId);
  if (!proposal) return false;

  // Custo imediato: 30% do valor total como empenho / mobilização.
  const upfront = Math.round(proposal.price * 0.3);
  if (s.treasury < upfront) return false;
  s.treasury -= upfront;

  // Consumo de capital político: base 3 + risco de corrupção × 10 (+ tie).
  if (s.politics) {
    const pcCost = 3 + Math.round(proposal.corruptionRisk * 10) + (proposal.politicalTie ? 2 : 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const politics = s.politics as any;
    if (typeof politics.politicalCapital === "number") {
      politics.politicalCapital = Math.max(0, politics.politicalCapital - pcCost);
    }
  }

  const work: PublicWork = {
    id: `w_${bid.id}_${proposal.id}`,
    category: bid.category,
    buildingKind: bid.buildingKind,
    districtKind: bid.districtKind,
    company: proposal.company,
    totalPrice: proposal.price,
    monthsTotal: proposal.months,
    monthsElapsed: 0,
    quality: proposal.quality,
    corruptionRisk: proposal.corruptionRisk,
    delayRisk: proposal.delayRisk,
    politicalTie: proposal.politicalTie,
    status: "in_progress",
  };
  s.bidding!.works.push(work);
  s.bidding!.open.splice(idx, 1);
  return true;
}

export function cancelBidding(s: GameState, biddingId: string): void {
  ensureBidding(s);
  s.bidding!.open = s.bidding!.open.filter(b => b.id !== biddingId);
}

/**
 * Avança as obras 1 mês. Emite manchetes, aplica escândalos, retorna a lista
 * de obras que completaram nesse tick (para o `autoGrowth` plantar o sprite).
 */
export function tickBiddingMonth(s: GameState, rng: () => number): PublicWork[] {
  ensureBidding(s);
  const completed: PublicWork[] = [];
  const news: Array<Omit<NewsItem, "id" | "month" | "year" | "day">> = [];
  const remaining: PublicWork[] = [];

  for (const w of s.bidding!.works) {
    // Parcela mensal (empenho restante distribuído).
    const monthlyDraw = Math.round((w.totalPrice * 0.7) / Math.max(1, w.monthsTotal));
    s.treasury -= monthlyDraw;
    w.monthsElapsed += 1;

    // Atraso: cada mês depois de metade do prazo, chance = delayRisk × 0.15.
    if (w.monthsElapsed > w.monthsTotal * 0.5 && rng() < w.delayRisk * 0.15) {
      w.monthsTotal += 1;
      const extra = Math.round(w.totalPrice * 0.03);
      s.treasury -= extra;
      w.totalPrice += extra;
      news.push({
        kind: "warning",
        titleKey: `Obra da ${w.company} atrasa (+1 mês, +R$ ${extra.toLocaleString("pt-BR")})||${w.company} project delays (+1 mo, +R$ ${extra.toLocaleString("en-US")})`,
      });
    }

    // Escândalo: chance por tick = corruptionRisk × 0.04.
    if (rng() < w.corruptionRisk * 0.04) {
      w.status = "scandal";
      news.push({
        kind: "danger",
        titleKey: `Escândalo: superfaturamento na obra da ${w.company}||Scandal: overpricing at ${w.company}'s project`,
      });
      // Aumenta risco de MP se módulo Oversight estiver ativo.
      if (s.oversight && typeof s.oversight.mpRisk === "number") {
        s.oversight.mpRisk = clamp(s.oversight.mpRisk + 8, 0, 100);
      }
      // Perde capital político.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const politics = s.politics as any;
      if (politics && typeof politics.politicalCapital === "number") {
        politics.politicalCapital = Math.max(0, politics.politicalCapital - 6);
      }
      // Continua a obra mesmo em escândalo — só marca a manchete.
    }

    if (w.monthsElapsed >= w.monthsTotal) {
      w.status = w.status === "scandal" ? "scandal" : "completed";
      completed.push(w);
      s.bidding!.history.unshift({
        id: w.id,
        company: w.company,
        buildingKind: w.buildingKind,
        districtKind: w.districtKind,
        category: w.category,
        finishedAt: { month: s.month, year: s.year },
        outcome: w.status === "scandal" ? "scandal" : (w.delayRisk > 0.55 ? "delayed" : "ok"),
      });
      if (s.bidding!.history.length > 40) s.bidding!.history.length = 40;
      news.push({
        kind: w.status === "scandal" ? "warning" : "success",
        titleKey: `Inauguração: ${w.company} entrega ${labelForCategoryPt(w.category)}||Ribbon-cut: ${w.company} delivers ${labelForCategoryEn(w.category)}`,
      });
    } else {
      remaining.push(w);
    }
  }

  s.bidding!.works = remaining;
  // Emite manchetes na ordem gerada.
  for (const n of news) {
    s.news = [{
      id: `${s.year}-${s.month}-${Math.random().toString(36).slice(2, 7)}`,
      month: s.month,
      year: s.year,
      ...n,
    }, ...s.news].slice(0, 80);
  }
  return completed;
}

export function labelForCategoryPt(c: WorkCategory): string {
  return CATEGORY_SPEC[c].labelPt;
}
export function labelForCategoryEn(c: WorkCategory): string {
  return CATEGORY_SPEC[c].labelEn;
}

/** Utilitário público pra a UI listar distritos-alvo válidos. */
export function listDistrictKinds(s: GameState): DistrictKind[] {
  const layer = generateDistricts(s.mapSize, s.seed, s.cityName);
  const kinds = new Set<DistrictKind>();
  for (const d of layer.districts) kinds.add(d.kind);
  return Array.from(kinds);
}
