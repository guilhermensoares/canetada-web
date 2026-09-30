/**
 * Covert Communications Operations ("Operações Clandestinas").
 *
 * Player-only backchannel for reputation warfare on PiuPiu:
 *   - Contratar agências (Sombra Digital, VoxBots, EngajaBR, InflubrLab).
 *   - Rodar "Fazendas de Bots" (ataque a opositores, hashtags de apoio,
 *     pautas de distração).
 *   - Contratar influenciadores para promover obras/serviços.
 *
 * Cada operação injeta posts no PiuPiu, movimenta trends, altera aprovação
 * e reputação de oponentes, e acumula RISCO DE EXPOSIÇÃO. Se estourar,
 * pode disparar CPI por improbidade — e, em casos graves, impeachment.
 *
 * Integração:
 *   - Consome caixa (state.treasury) e opcionalmente "fundos ocultos" de
 *     campanha (state.campaign.warChest, quando existir).
 *   - Injeta posts em state.piupiu via pushPost/bumpTrend (usa apenas API
 *     pública deste módulo para evitar acoplamento circular).
 *   - Reduz state.campaign.polls.opponents[id] quando ataca oponentes.
 *   - Gera CpiState.active em state.negotiation ao ser desmascarado.
 */
import type { GameState } from "./types";
import { ensurePiuPiu, type PiuPiuAuthor, type PiuPiuPost, type PiuPiuHashtag } from "./piupiu";

/* ============================================================== Tipos == */

export type AgencyId = "sombra_digital" | "voxbots" | "engajabr" | "influbr_lab";

export interface Agency {
  id: AgencyId;
  namePt: string;
  nameEn: string;
  /** Custo fixo mensal (retainer). */
  retainer: number;
  /** Especialidade — afeta tetos de eficácia. */
  focus: "bots" | "influencers" | "both";
  /** Redução multiplicativa do risco de detecção (0.5..1). */
  stealth: number;
  /** Multiplicador de eficácia (0.8..1.4). */
  potency: number;
  descPt: string;
  descEn: string;
}

export type BotTactic =
  | "attack_opponent"     // ataca @op_zuza / @op_miro (opositor específico)
  | "support_hashtag"     // #PrefeitoTrabalha, inflar aprovação
  | "distraction"         // pauta paralela para tirar foco de crise
  | "flood_negative";     // afogar hashtag negativa

export type InfluencerCampaign =
  | "park_opening"
  | "public_lighting"
  | "transport_upgrade"
  | "health_clinic"
  | "school_program";

export interface BotFarmOp {
  id: string;
  agency: AgencyId;
  tactic: BotTactic;
  /** Alvo: id do oponente OU hashtag alvo. */
  target?: string;
  /** Verba MENSAL alocada (R$). */
  monthlyBudget: number;
  /** Iniciou em (year, month). */
  startedYear: number;
  startedMonth: number;
  /** Ativo? Falso após cancelamento ou exposição. */
  active: boolean;
  /** Total gasto. */
  totalSpent: number;
  /** Contagem de posts injetados. */
  postsInjected: number;
  /** Risco acumulado 0..100 (chega em 100 => exposto). */
  exposureRisk: number;
}

export interface InfluencerOp {
  id: string;
  agency: AgencyId;
  campaign: InfluencerCampaign;
  /** Pagamento único (R$). */
  fee: number;
  startedYear: number;
  startedMonth: number;
  /** Meses restantes de promoção paga. */
  monthsLeft: number;
  active: boolean;
  /** Se o serviço promovido está indo mal, cresce. Acima de 60 gera backlash. */
  authenticityRisk: number;
  /** Se estourou, boomerang aplicado. */
  backlashed: boolean;
}

export interface CovertOpsState {
  /** Agências contratadas (mensal). */
  contractedAgencies: AgencyId[];
  /** Operações ativas + histórico recente. */
  botOps: BotFarmOp[];
  influencerOps: InfluencerOp[];
  /** Risco agregado consolidado (para UI). */
  globalRisk: number;
  /** Contadores de campanha. */
  totalExposed: number;
  totalCpisTriggered: number;
  /** Última exposição (para narrativa). */
  lastExposure?: {
    kind: "bot_farm" | "influencer";
    opId: string;
    year: number;
    month: number;
    outletPt: string;
    outletEn: string;
  };
}

/* ============================================================ Agências */

export const AGENCIES: Agency[] = [
  {
    id: "sombra_digital",
    namePt: "Sombra Digital",
    nameEn: "Digital Shadow",
    retainer: 45_000, focus: "bots", stealth: 0.75, potency: 1.15,
    descPt: "Agência offshore. Bots caros, difíceis de rastrear.",
    descEn: "Offshore agency. Expensive bots, hard to trace.",
  },
  {
    id: "voxbots",
    namePt: "VoxBots MG",
    nameEn: "VoxBots MG",
    retainer: 18_000, focus: "bots", stealth: 1.05, potency: 0.9,
    descPt: "Baratos e amadores. Ótimo custo, mas riscam a moleza.",
    descEn: "Cheap and amateur. Great cost, but leaves fingerprints.",
  },
  {
    id: "engajabr",
    namePt: "EngajaBR",
    nameEn: "EngajaBR",
    retainer: 32_000, focus: "both", stealth: 0.9, potency: 1.05,
    descPt: "Combina bots com micro-influenciadores de bairro.",
    descEn: "Combines bots with neighborhood micro-influencers.",
  },
  {
    id: "influbr_lab",
    namePt: "InflubrLab",
    nameEn: "InflubrLab",
    retainer: 25_000, focus: "influencers", stealth: 0.85, potency: 1.2,
    descPt: "Especialistas em contratar rostos conhecidos do PiuPiu.",
    descEn: "Specialists at hiring known PiuPiu faces.",
  },
];

export function findAgency(id: AgencyId): Agency {
  return AGENCIES.find(a => a.id === id)!;
}

/* =========================================================== Bootstrap */

export function defaultCovertOps(): CovertOpsState {
  return {
    contractedAgencies: [],
    botOps: [],
    influencerOps: [],
    globalRisk: 0,
    totalExposed: 0,
    totalCpisTriggered: 0,
  };
}

export function ensureCovertOps(s: GameState): CovertOpsState {
  const g = s as GameState & { covertOps?: CovertOpsState };
  if (!g.covertOps) g.covertOps = defaultCovertOps();
  return g.covertOps!;
}

/* ============================================================ Ações == */

let idCursor = 1;
function newId(prefix: string): string {
  idCursor++;
  return `${prefix}_${Date.now().toString(36)}_${idCursor.toString(36)}`;
}

/** Contrata uma agência (paga retainer imediato do mês). */
export function hireAgency(state: GameState, id: AgencyId): GameState {
  const co = ensureCovertOps(state);
  if (co.contractedAgencies.includes(id)) return state;
  const ag = findAgency(id);
  if (state.treasury < ag.retainer) return state;
  state.treasury -= ag.retainer;
  co.contractedAgencies.push(id);
  return state;
}

export function fireAgency(state: GameState, id: AgencyId): GameState {
  const co = ensureCovertOps(state);
  co.contractedAgencies = co.contractedAgencies.filter(a => a !== id);
  // Ops dependentes dessa agência ficam órfãs => cancela.
  for (const op of co.botOps) if (op.agency === id) op.active = false;
  for (const op of co.influencerOps) if (op.agency === id) op.active = false;
  return state;
}

export function launchBotFarm(
  state: GameState,
  agency: AgencyId,
  tactic: BotTactic,
  monthlyBudget: number,
  target?: string,
): GameState {
  const co = ensureCovertOps(state);
  if (!co.contractedAgencies.includes(agency)) return state;
  if (state.treasury < monthlyBudget) return state;
  state.treasury -= monthlyBudget;
  co.botOps.push({
    id: newId("bot"),
    agency, tactic, target,
    monthlyBudget,
    startedYear: state.year, startedMonth: state.month,
    active: true, totalSpent: monthlyBudget,
    postsInjected: 0, exposureRisk: 0,
  });
  // Trim histórico > 20.
  if (co.botOps.length > 20) co.botOps = co.botOps.slice(-20);
  return state;
}

export function cancelBotOp(state: GameState, opId: string): GameState {
  const co = ensureCovertOps(state);
  const op = co.botOps.find(o => o.id === opId);
  if (op) op.active = false;
  return state;
}

const INFLUENCER_FEES: Record<InfluencerCampaign, number> = {
  park_opening:       180_000,
  public_lighting:    150_000,
  transport_upgrade:  320_000,
  health_clinic:      240_000,
  school_program:     200_000,
};

export function hireInfluencerCampaign(
  state: GameState,
  agency: AgencyId,
  campaign: InfluencerCampaign,
): GameState {
  const co = ensureCovertOps(state);
  if (!co.contractedAgencies.includes(agency)) return state;
  const fee = INFLUENCER_FEES[campaign];
  if (state.treasury < fee) return state;
  state.treasury -= fee;
  co.influencerOps.push({
    id: newId("inf"),
    agency, campaign, fee,
    startedYear: state.year, startedMonth: state.month,
    monthsLeft: 2,
    active: true,
    authenticityRisk: 0,
    backlashed: false,
  });
  if (co.influencerOps.length > 20) co.influencerOps = co.influencerOps.slice(-20);
  return state;
}

export function getInfluencerFee(c: InfluencerCampaign): number {
  return INFLUENCER_FEES[c];
}

/* ============================================================ Injeção */

const BOT_AUTHORS: PiuPiuAuthor[] = [
  { handle: "@carlos_br_2019", name: "Carlos Brasil",   avatar: "🤖", followers: 340,  verified: false, kind: "citizen" },
  { handle: "@patriota_livre", name: "Patriota Livre",  avatar: "🇧🇷", followers: 1_200, verified: false, kind: "citizen" },
  { handle: "@ana_do_povo88",  name: "Ana do Povo",     avatar: "👩", followers: 210,  verified: false, kind: "citizen" },
  { handle: "@brasil_forte77", name: "Brasil Forte",    avatar: "💪", followers: 890,  verified: false, kind: "citizen" },
  { handle: "@joao_verdade",   name: "João Verdade",    avatar: "🗣️", followers: 640,  verified: false, kind: "citizen" },
  { handle: "@cidadão_bom",    name: "Cidadão Bom",     avatar: "😇", followers: 120,  verified: false, kind: "citizen" },
];

const INFLU_AUTHORS: PiuPiuAuthor[] = [
  { handle: "@dede_lifestyle",  name: "Dedé Lifestyle",  avatar: "✨", followers: 480_000,  verified: true, kind: "influencer" },
  { handle: "@rafa_fitness",    name: "Rafa Fitness",    avatar: "🏋️", followers: 620_000,  verified: true, kind: "influencer" },
  { handle: "@familia_gabs",    name: "Família Gabs",    avatar: "👨‍👩‍👧", followers: 1_100_000, verified: true, kind: "influencer" },
];

const BOT_ATTACK_TEMPLATES: Record<string, { pt: string; en: string; tag: PiuPiuHashtag }> = {
  op_zuza: {
    pt: "Enquanto o prefeito trabalha, {NAME} só posta pra viralizar. Cadê propostas?",
    en: "While the mayor works, {NAME} just posts for clout. Where are the proposals?",
    tag: "#{NAMEFora}",
  },
  default: {
    pt: "{NAME} de novo mentindo. A cidade não é boba, viu?",
    en: "{NAME} lying again. The city isn't dumb, you know?",
    tag: "#{NAMEFora}",
  },
};

const BOT_SUPPORT_TAGS: PiuPiuHashtag[] = ["#PrefeitoTrabalha", "#OrgulhoDaCidade", "#GestãoQueEntrega"];
const BOT_DISTRACTION_TAGS: PiuPiuHashtag[] = ["#ChampionsHoje", "#NovelaChoque", "#CelebridadeCancelada"];

const INFLU_TEMPLATES: Record<InfluencerCampaign, { pt: string; en: string; tag: PiuPiuHashtag }> = {
  park_opening: {
    pt: "Gente, TE-NHO que mostrar o novo parque da cidade! Levei a família, ficou LINDO 😍 obrigada prefeitura! #ad",
    en: "Y'all, I HAVE to show the new city park! Took the family, it's GORGEOUS 😍 thanks city hall! #ad",
    tag: "#CidadeQueCuida",
  },
  public_lighting: {
    pt: "Andar de noite virou outra coisa! Iluminação nova mudou meu bairro. Recomendo demais 💡 #publi",
    en: "Walking at night is a whole new thing! New lighting changed my hood 💡 #ad",
    tag: "#CidadeIluminada",
  },
  transport_upgrade: {
    pt: "Testei o novo BRT e SIMPLESMENTE amei. Vídeo no story! 🚌✨ #publi",
    en: "Tried the new BRT and I'm OBSESSED. Story up! 🚌✨ #ad",
    tag: "#TransporteDoFuturo",
  },
  health_clinic: {
    pt: "Fui na UBS nova e o atendimento foi INCRÍVEL. Parabéns pela gestão 🏥 #publi",
    en: "Went to the new clinic and service was AMAZING. Kudos to management 🏥 #ad",
    tag: "#SaúdeQueFunciona",
  },
  school_program: {
    pt: "Escola do meu filho tá cheia de novidade! Merenda, esporte, tudo top! 🎒 #publi",
    en: "My kid's school is packed with new stuff! Meals, sports, all top-tier! 🎒 #ad",
    tag: "#EducaçãoQueTransforma",
  },
};

/* -------- Helpers de injeção usando API de piupiu -------- */

function nowHours(s: GameState): number {
  return (s.year * 12 + s.month) * 30 * 24 + s.day * 24;
}

function injectPost(state: GameState, post: PiuPiuPost): void {
  const p = ensurePiuPiu(state);
  p.posts.push(post);
  if (p.posts.length > 60) p.posts = p.posts.slice(p.posts.length - 60);
  p.unread = Math.min(99, p.unread + 1);
  // Heat simplificado.
  const heat = 40 + Math.log10(Math.max(10, post.author.followers)) * 15
             + Math.log10(Math.max(1, post.likes + post.reposts * 3)) * 8;
  for (const h of post.hashtags) {
    let t = p.trends.find(x => x.hashtag === h);
    if (!t) {
      t = {
        hashtag: h, heat: 0, volume: 0,
        sentiment: post.sentiment, hoursInTop5: 0,
        amplifiedByPress: false,
        isCancelWave: post.sentiment === "outrage",
      };
      p.trends.push(t);
    }
    t.heat += heat;
    t.volume += 1;
    if (post.sentiment !== "neutral") t.sentiment = post.sentiment;
  }
  p.trends.sort((a, b) => b.heat - a.heat);
}

/* ============================================================ Tick ==== */

/**
 * Tick mensal — aplica efeitos, cobra retainers, acumula risco, roda detecção.
 */
export function tickCovertOpsMonth(state: GameState, rng: () => number): GameState {
  const co = ensureCovertOps(state);

  // 1) Retainers das agências ativas.
  for (const aid of [...co.contractedAgencies]) {
    const ag = findAgency(aid);
    if (state.treasury < ag.retainer) {
      // Sem verba => agência abandona.
      fireAgency(state, aid);
      state.news = state.news ?? [];
      state.news.unshift({
        id: `co-fire-${aid}-${state.year}-${state.month}`,
        kind: "warning",
        titleKey: `Agência ${ag.namePt} encerra contrato por inadimplência||${ag.nameEn} ended contract for unpaid retainer`,
        month: state.month, year: state.year, day: state.day,
      });
      if (state.news.length > 25) state.news.pop();
      continue;
    }
    state.treasury -= ag.retainer;
  }

  // 2) Bot farms — efeitos + risco.
  for (const op of co.botOps) {
    if (!op.active) continue;
    if (!co.contractedAgencies.includes(op.agency)) { op.active = false; continue; }
    // Renovação de verba.
    if (state.treasury < op.monthlyBudget) { op.active = false; continue; }
    state.treasury -= op.monthlyBudget;
    op.totalSpent += op.monthlyBudget;

    const ag = findAgency(op.agency);
    const scale = op.monthlyBudget / 50_000; // 1.0 = 50k
    const potency = ag.potency * Math.min(2.5, scale);

    // Efeitos por tática.
    if (op.tactic === "attack_opponent" && op.target && state.campaign) {
      const polls = state.campaign.polls.opponents;
      if (op.target in polls) {
        const hit = 0.6 * potency;
        polls[op.target] = Math.max(0, polls[op.target] - hit);
        state.campaign.polls.undecided = Math.min(100, state.campaign.polls.undecided + hit * 0.5);
      }
      // Post de ataque.
      const opp = state.campaign?.opponents.find(o => o.id === op.target);
      const name = opp?.namePt ?? "Oponente";
      const tpl = BOT_ATTACK_TEMPLATES[op.target] ?? BOT_ATTACK_TEMPLATES.default;
      const nposts = 2 + Math.floor(potency * 2);
      for (let i = 0; i < nposts; i++) {
        const a = BOT_AUTHORS[Math.floor(rng() * BOT_AUTHORS.length)];
        const tag = `#${name.split(" ")[0]}Fora`;
        injectPost(state, {
          id: newId("bp"),
          author: a,
          textPt: tpl.pt.replace("{NAME}", name),
          textEn: tpl.en.replace("{NAME}", opp?.nameEn ?? "Opponent"),
          hashtags: [tag],
          createdAt: nowHours(state),
          likes: Math.round(a.followers * 0.4),
          reposts: Math.round(a.followers * 0.15),
          replies: 3,
          sentiment: "negative",
        });
        op.postsInjected++;
      }
    } else if (op.tactic === "support_hashtag") {
      const boost = 0.7 * potency;
      state.approval = Math.min(100, state.approval + boost);
      const tag = BOT_SUPPORT_TAGS[Math.floor(rng() * BOT_SUPPORT_TAGS.length)];
      const nposts = 3 + Math.floor(potency * 2);
      for (let i = 0; i < nposts; i++) {
        const a = BOT_AUTHORS[Math.floor(rng() * BOT_AUTHORS.length)];
        injectPost(state, {
          id: newId("bp"),
          author: a,
          textPt: `Prefeito(a) mudando a cidade de verdade! Vamos junto! ${tag}`,
          textEn: `Mayor really changing the city! Let's go! ${tag}`,
          hashtags: [tag],
          createdAt: nowHours(state),
          likes: Math.round(a.followers * 0.5),
          reposts: Math.round(a.followers * 0.2),
          replies: 2,
          sentiment: "positive",
        });
        op.postsInjected++;
      }
    } else if (op.tactic === "distraction") {
      // Enfria trends negativas roubando atenção.
      const p = ensurePiuPiu(state);
      const tag = BOT_DISTRACTION_TAGS[Math.floor(rng() * BOT_DISTRACTION_TAGS.length)];
      for (const t of p.trends) if (t.isCancelWave) t.heat *= (1 - 0.15 * potency);
      const nposts = 3 + Math.floor(potency * 2);
      for (let i = 0; i < nposts; i++) {
        const a = BOT_AUTHORS[Math.floor(rng() * BOT_AUTHORS.length)];
        injectPost(state, {
          id: newId("bp"),
          author: a,
          textPt: `GENTE VOCÊS VIRAM?? ${tag} 😱`,
          textEn: `Y'ALL SEE THIS?? ${tag} 😱`,
          hashtags: [tag],
          createdAt: nowHours(state),
          likes: Math.round(a.followers * 0.35),
          reposts: Math.round(a.followers * 0.12),
          replies: 1,
          sentiment: "neutral",
        });
        op.postsInjected++;
      }
    } else if (op.tactic === "flood_negative" && op.target) {
      const p = ensurePiuPiu(state);
      const t = p.trends.find(x => x.hashtag === op.target);
      if (t) t.heat *= (1 - 0.3 * potency);
    }

    // Risco de detecção acumulado por operação.
    const riskGrowth = (5 + potency * 3) * (1 / ag.stealth);
    op.exposureRisk = Math.min(100, op.exposureRisk + riskGrowth);
  }

  // 3) Influenciadores — pagam boost e envelhecem.
  for (const op of co.influencerOps) {
    if (!op.active) continue;
    if (!co.contractedAgencies.includes(op.agency)) { op.active = false; continue; }
    const ag = findAgency(op.agency);
    const tpl = INFLU_TEMPLATES[op.campaign];
    const a = INFLU_AUTHORS[Math.floor(rng() * INFLU_AUTHORS.length)];
    injectPost(state, {
      id: newId("ip"),
      author: a,
      textPt: tpl.pt,
      textEn: tpl.en,
      hashtags: [tpl.tag],
      createdAt: nowHours(state),
      likes: Math.round(a.followers * 0.08),
      reposts: Math.round(a.followers * 0.03),
      replies: Math.round(a.followers * 0.02),
      sentiment: "positive",
      mediaKind: "photo",
    });

    // Boost de aprovação enquanto o serviço estiver bem.
    const svcQuality = serviceQualityFor(state, op.campaign); // 0..1
    const boost = 0.9 * ag.potency * svcQuality;
    state.approval = Math.min(100, state.approval + boost);

    // Autenticidade cai quando serviço está mal.
    const gap = Math.max(0, 0.55 - svcQuality); // limiar 55%
    op.authenticityRisk = Math.min(100, op.authenticityRisk + gap * 100);

    if (op.authenticityRisk >= 60 && !op.backlashed) {
      op.backlashed = true;
      // Cancelamento — hashtag negativa e queda de aprovação.
      injectPost(state, {
        id: newId("ipbk"),
        author: { handle: "@meme_da_zona", name: "Meme da Zona", avatar: "🤡", followers: 890_000, verified: false, kind: "meme" },
        textPt: `Pagaram influencer pra elogiar ${labelCampaign(op.campaign, "pt")} que NÃO FUNCIONA. #PropagandaPaga`,
        textEn: `They PAID an influencer to praise ${labelCampaign(op.campaign, "en")} that DOESN'T WORK. #PaidPropaganda`,
        hashtags: ["#PropagandaPaga", "#ForaPrefeito"],
        createdAt: nowHours(state),
        likes: 120_000,
        reposts: 45_000,
        replies: 8_000,
        sentiment: "outrage",
      });
      state.approval = Math.max(0, state.approval - 4);
      state.happiness = Math.max(0, state.happiness - 2);
      state.news = state.news ?? [];
      state.news.unshift({
        id: `co-bklsh-${op.id}`,
        kind: "danger",
        titleKey: "Influenciador desmascarado: publi da Prefeitura vira meme||Influencer exposed: paid post becomes a meme",
        month: state.month, year: state.year, day: state.day,
      });
    }

    op.monthsLeft -= 1;
    if (op.monthsLeft <= 0) op.active = false;
  }

  // 4) Detecção de bot farms.
  for (const op of co.botOps) {
    if (!op.active) continue;
    // Chance mensal cresce com risco acumulado.
    const chance = Math.pow(op.exposureRisk / 100, 2) * 0.35;
    if (rng() < chance) {
      exposeBotFarm(state, op, rng);
    }
  }

  // 5) Risco global agregado (UI).
  const bots = co.botOps.filter(o => o.active);
  co.globalRisk = Math.round(
    (bots.reduce((s, o) => s + o.exposureRisk, 0) / Math.max(1, bots.length))
  );

  return state;
}

/* ============================================================ Detecção */

const OUTLETS = [
  { pt: "Rede Cubo", en: "Cube Network" },
  { pt: "Ministério Público", en: "Public Prosecutor" },
  { pt: "Portal Piauá", en: "Piauá Portal" },
  { pt: "Hora da Verdade", en: "The Hour of Truth" },
];

function exposeBotFarm(state: GameState, op: BotFarmOp, rng: () => number): void {
  const co = ensureCovertOps(state);
  op.active = false;
  co.totalExposed += 1;
  const outlet = OUTLETS[Math.floor(rng() * OUTLETS.length)];
  co.lastExposure = {
    kind: "bot_farm", opId: op.id,
    year: state.year, month: state.month,
    outletPt: outlet.pt, outletEn: outlet.en,
  };

  // Post viral desmascarando.
  injectPost(state, {
    id: newId("exp"),
    author: { handle: "@reporter_x", name: "Repórter X", avatar: "🎤", followers: 650_000, verified: true, kind: "journalist" },
    textPt: `EXCLUSIVO ${outlet.pt}: prefeitura contratou fazenda de bots para atacar oposição. Perícia digital comprova. #GabineteDoÓdio`,
    textEn: `EXCLUSIVE ${outlet.en}: city hall hired a bot farm to attack opposition. Digital forensics confirm. #HateOffice`,
    hashtags: ["#GabineteDoÓdio", "#ForaPrefeito", "#CPIJá"],
    createdAt: nowHours(state),
    likes: 480_000, reposts: 210_000, replies: 32_000,
    sentiment: "outrage",
    mediaKind: "video",
  });

  // Impacto direto.
  state.approval = Math.max(0, state.approval - 8);
  state.happiness = Math.max(0, state.happiness - 3);

  // Dispara CPI, se ainda não estiver ativa.
  const g = state as GameState & { negotiation?: import("./negotiation").NegotiationState };
  if (g.negotiation && !g.negotiation.cpi.active) {
    g.negotiation.cpi = {
      active: true, progress: 40, chairId: "v_zuza",
      reasonPt: "Improbidade administrativa — fazenda de bots municipal",
      reasonEn: "Administrative misconduct — municipal bot farm",
      openedYear: state.year, openedMonth: state.month,
      resolved: false, freezeInvestments: true,
      concludedAgainst: g.negotiation.cpi.concludedAgainst,
    };
    co.totalCpisTriggered += 1;
  }

  state.news = state.news ?? [];
  state.news.unshift({
    id: `co-exposed-${op.id}`,
    kind: "danger",
    titleKey: `${outlet.pt} expõe gabinete do ódio: CPI aberta na Câmara||${outlet.en} exposes hate office: inquiry opened`,
    month: state.month, year: state.year, day: state.day,
  });
  if (state.news.length > 25) state.news.pop();
}

/* ============================================================ Helpers  */

function serviceQualityFor(state: GameState, c: InfluencerCampaign): number {
  // Aproxima qualidade real do serviço promovido pelas métricas existentes.
  const h = state.happiness / 100;
  switch (c) {
    case "park_opening":       return Math.min(1, 0.4 + h * 0.6);
    case "public_lighting":    return Math.min(1, 0.5 + h * 0.5);
    case "transport_upgrade":  return Math.min(1, 0.3 + h * 0.7);
    case "health_clinic":      return Math.min(1, 0.35 + h * 0.65);
    case "school_program":     return Math.min(1, 0.4 + h * 0.6);
  }
}

export function labelCampaign(c: InfluencerCampaign, lang: "pt" | "en"): string {
  const map = {
    park_opening:      { pt: "o novo parque", en: "the new park" },
    public_lighting:   { pt: "a iluminação pública", en: "public lighting" },
    transport_upgrade: { pt: "a modernização do transporte", en: "transport upgrade" },
    health_clinic:    { pt: "a nova UBS", en: "the new clinic" },
    school_program:   { pt: "o programa escolar", en: "the school program" },
  };
  return map[c][lang];
}
