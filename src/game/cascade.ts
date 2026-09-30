/**
 * Cascade Incident — game-loop encadeado que integra Fato Urbano → PiuPiu →
 * Mídia clássica → Decisão do Prefeito.
 *
 * Fluxo do "Ônibus no Viaduto":
 *   1. Chuva forte disparou uma pane em ônibus no viaduto principal.
 *   2. @FiscalDoTrânsito posta a foto → sobe #CaosNoTrânsito no PiuPiu.
 *   3. @MilitanteDoPLab e @PatriotaCidadão bombam a hashtag.
 *   4. Rede Cubo entra ao vivo do viaduto.
 *   5. Modal de decisão para o jogador (A/B/C).
 *
 * Opções:
 *   A) Guincho + tweet assumindo — custa caixa, cura aprovação e resfria tag.
 *   B) Fazenda de bots (#TudoNormalNaCidade) — precisa agência contratada,
 *      gasta verba e cria BotFarmOp com risco alto de CPI.
 *   C) Ignorar — perde aprovação, aumenta chance de CPI aberta pela oposição.
 */
import type { GameState } from "./types";
import { ensurePiuPiu, type PiuPiuPost, type PiuPiuAuthor } from "./piupiu";
import { launchBotFarm, ensureCovertOps } from "./covertOps";
import type { NegotiationState } from "./negotiation";

/* ============================================================== Tipos == */

export type CascadeKind = "bus_bridge_rain";

export interface CascadeIncident {
  id: string;
  kind: CascadeKind;
  createdYear: number;
  createdMonth: number;
  createdDay: number;
  /** Aberto até o jogador decidir. */
  open: boolean;
  chosen?: "tow_and_own" | "bot_farm" | "ignore";
  descPt: string;
  descEn: string;
}

export interface CascadeState {
  active?: CascadeIncident;
  history: CascadeIncident[];
}

/* =========================================================== Bootstrap */

export function ensureCascade(state: GameState): CascadeState {
  const g = state as GameState & { cascade?: CascadeState };
  if (!g.cascade) g.cascade = { history: [] };
  return g.cascade!;
}

/* =========================================================== Injetores */

function nowHours(s: GameState): number {
  return (s.year * 12 + s.month) * 30 * 24 + s.day * 24;
}

function pushPost(state: GameState, post: PiuPiuPost, hashtags: string[], sentiment: PiuPiuPost["sentiment"]): void {
  const p = ensurePiuPiu(state);
  p.posts.push(post);
  if (p.posts.length > 60) p.posts = p.posts.slice(p.posts.length - 60);
  p.unread = Math.min(99, p.unread + 1);
  const heat = 80 + Math.log10(Math.max(10, post.author.followers)) * 25;
  for (const h of hashtags) {
    let t = p.trends.find(x => x.hashtag === h);
    if (!t) {
      t = { hashtag: h, heat: 0, volume: 0, sentiment, hoursInTop5: 0, amplifiedByPress: false, isCancelWave: sentiment === "outrage" };
      p.trends.push(t);
    }
    t.heat += heat;
    t.volume += 1;
    t.sentiment = sentiment;
  }
  p.trends.sort((a, b) => b.heat - a.heat);
}

const FISCAL: PiuPiuAuthor = { handle: "@FiscalDoTrânsito", name: "Fiscal do Trânsito", avatar: "🚦", followers: 500_000, verified: true, kind: "influencer", archetype: "fiscal_transito" };
const MILITANTE: PiuPiuAuthor = { handle: "@MilitanteDoPLab", name: "Militante do PLab", avatar: "🚩", followers: 88_000, verified: false, kind: "activist", archetype: "militante_plab" };
const PATRIOTA: PiuPiuAuthor = { handle: "@PatriotaCidadão", name: "Patriota Cidadão", avatar: "🇧🇷", followers: 142_000, verified: false, kind: "activist", archetype: "patriota_cidadao" };
const REDECUBO: PiuPiuAuthor = { handle: "@redecubo", name: "Rede Cubo Notícias", avatar: "📺", followers: 2_100_000, verified: true, kind: "journalist" };

/* ============================================================ Gatilho */

/**
 * Tenta disparar o cascade. Retorna true se acionou (evita repetir sob mesma crise).
 * Deve ser chamado do daily tick com condição de chuva forte.
 */
export function maybeSpawnBusCascade(state: GameState, rng: () => number): boolean {
  const c = ensureCascade(state);
  if (c.active?.open) return false;

  const inc: CascadeIncident = {
    id: `casc_${state.year}_${state.month}_${state.day}`,
    kind: "bus_bridge_rain",
    createdYear: state.year, createdMonth: state.month, createdDay: state.day,
    open: true,
    descPt: "Ônibus da linha 8080 quebra no viaduto principal durante chuva forte. Trânsito paralisado em ambos os sentidos.",
    descEn: "Bus of line 8080 breaks down on the main viaduct during heavy rain. Traffic locked both ways.",
  };
  c.active = inc;
  c.history.push(inc);
  if (c.history.length > 20) c.history = c.history.slice(-20);

  // 1) FiscalDoTrânsito abre a cascata.
  const t = nowHours(state);
  pushPost(state, {
    id: `casc_p1_${inc.id}`, author: FISCAL,
    textPt: "🚨 ÔNIBUS QUEBRADO no viaduto principal na hora do pico DEBAIXO DE CHUVA. Fila de 4km. Foto abaixo 📸 CADÊ A PREFEITURA?",
    textEn: "🚨 BUS BROKEN on the main viaduct at rush hour UNDER RAIN. 4km queue. Photo below 📸 WHERE IS CITY HALL?",
    hashtags: ["#CaosNoTrânsito", "#ÔnibusNão"],
    createdAt: t, likes: 320_000, reposts: 140_000, replies: 21_000,
    sentiment: "outrage", mediaKind: "photo",
  }, ["#CaosNoTrânsito", "#ÔnibusNão"], "outrage");

  // 2) Militante do PLab.
  pushPost(state, {
    id: `casc_p2_${inc.id}`, author: MILITANTE,
    textPt: "Enquanto o prefeito corta a tarifa social, a frota apodrece. #CaosNoTrânsito é resultado de política neoliberal!",
    textEn: "While the mayor cuts social fares, the fleet rots. #CaosNoTrânsito is neoliberal policy at work!",
    hashtags: ["#CaosNoTrânsito", "#PrefeitoNeoliberal"],
    createdAt: t, likes: 42_000, reposts: 18_000, replies: 3_200, sentiment: "outrage",
  }, ["#CaosNoTrânsito", "#PrefeitoNeoliberal"], "outrage");

  // 3) Patriota Cidadão.
  pushPost(state, {
    id: `casc_p3_${inc.id}`, author: PATRIOTA,
    textPt: "Gastam com ciclovia mas ônibus quebra no viaduto? Prefeito preocupado com pauta identitária enquanto povo espera. #CaosNoTrânsito",
    textEn: "They spend on bike lanes but the bus breaks on the viaduct? Mayor busy with identity politics while the people wait. #CaosNoTrânsito",
    hashtags: ["#CaosNoTrânsito", "#ForaPrefeito"],
    createdAt: t, likes: 71_000, reposts: 34_000, replies: 6_400, sentiment: "outrage",
  }, ["#CaosNoTrânsito", "#ForaPrefeito"], "outrage");

  // 4) Rede Cubo entra ao vivo.
  pushPost(state, {
    id: `casc_p4_${inc.id}`, author: REDECUBO,
    textPt: "🔴 AO VIVO agora do viaduto principal: helicóptero da Rede Cubo mostra o caos após pane em ônibus. Prefeito ainda não se manifestou.",
    textEn: "🔴 LIVE from the main viaduct: Rede Cubo chopper shows the chaos after bus breakdown. Mayor hasn't spoken yet.",
    hashtags: ["#CaosNoTrânsito", "#AoVivo"],
    createdAt: t, likes: 890_000, reposts: 260_000, replies: 45_000, sentiment: "outrage", mediaKind: "video",
  }, ["#CaosNoTrânsito", "#AoVivo"], "outrage");

  state.news = state.news ?? [];
  state.news.unshift({
    id: `casc-${inc.id}`,
    kind: "danger",
    titleKey: "🚌 Ônibus quebra no viaduto sob chuva — cascata #CaosNoTrânsito||🚌 Bus breaks on viaduct in rain — #CaosNoTrânsito cascade",
    month: state.month, year: state.year, day: state.day,
  });
  if (state.news.length > 25) state.news.pop();

  return true;
}

/* =========================================================== Decisão */

/**
 * A: Guincho + admite. Custa caixa, restaura aprovação, resfria hashtags.
 */
export function decideTowAndOwn(state: GameState): GameState {
  const c = ensureCascade(state);
  if (!c.active?.open) return state;
  const cost = 180_000;
  if (state.treasury < cost) return state;
  state.treasury -= cost;
  c.active.open = false;
  c.active.chosen = "tow_and_own";

  // Nota oficial do prefeito.
  pushPost(state, {
    id: `casc_off_${c.active.id}`,
    author: { handle: "@Prefeitura", name: "Prefeitura Municipal", avatar: "🏛️", followers: 45_000, verified: true, kind: "official" },
    textPt: "Nota oficial: guincho já a caminho, ocorrência assumida. Vamos revisar toda a frota. Nosso compromisso é com quem usa o transporte todo dia. #TransparênciaMunicipal",
    textEn: "Official note: tow truck en route, incident acknowledged. Full fleet review coming. Our commitment is with daily riders. #MunicipalTransparency",
    hashtags: ["#TransparênciaMunicipal", "#PrefeitoTrabalha"],
    createdAt: nowHours(state),
    likes: 62_000, reposts: 24_000, replies: 4_800,
    sentiment: "positive", mediaKind: "photo",
  }, ["#TransparênciaMunicipal", "#PrefeitoTrabalha"], "positive");

  // Resfria hashtag principal.
  const p = ensurePiuPiu(state);
  for (const t of p.trends) {
    if (t.hashtag === "#CaosNoTrânsito" || t.hashtag === "#ForaPrefeito") {
      t.heat *= 0.4;
      t.hoursInTop5 = 0;
    }
  }

  state.approval = Math.min(100, state.approval + 3);
  state.happiness = Math.min(100, state.happiness + 1.5);

  state.news = state.news ?? [];
  state.news.unshift({
    id: `casc-tow-${c.active.id}`,
    kind: "success",
    titleKey: "Prefeito assume falha e envia guincho — crise se dissolve||Mayor owns the mistake and dispatches tow — crisis fades",
    month: state.month, year: state.year, day: state.day,
  });
  return state;
}

/**
 * B: Fazenda de Bots com #TudoNormalNaCidade. Precisa de agência ativa.
 */
export function decideBotFarm(state: GameState): GameState {
  const c = ensureCascade(state);
  if (!c.active?.open) return state;
  const co = ensureCovertOps(state);
  if (co.contractedAgencies.length === 0) return state;

  const budget = 80_000;
  if (state.treasury < budget) return state;

  const agency = co.contractedAgencies[0];
  launchBotFarm(state, agency, "distraction", budget, "#CaosNoTrânsito");

  // Boost extra do risco (é operação de crise em cima de trend viral).
  const op = co.botOps[co.botOps.length - 1];
  if (op) op.exposureRisk = Math.min(100, op.exposureRisk + 45);

  // Cria hashtag falsa #TudoNormalNaCidade impulsionada.
  pushPost(state, {
    id: `casc_bot_${c.active.id}`,
    author: { handle: "@carlos_br_2019", name: "Carlos Brasil", avatar: "🤖", followers: 340, verified: false, kind: "citizen" },
    textPt: "Passei agora no viaduto, tudo tranquilo. Fake news da oposição. Prefeito trabalhando muito! #TudoNormalNaCidade",
    textEn: "Just drove by the viaduct, all quiet. Opposition fake news. Mayor working hard! #TudoNormalNaCidade",
    hashtags: ["#TudoNormalNaCidade", "#PrefeitoTrabalha"],
    createdAt: nowHours(state),
    likes: 12_000, reposts: 8_000, replies: 400,
    sentiment: "positive",
  }, ["#TudoNormalNaCidade", "#PrefeitoTrabalha"], "positive");

  c.active.open = false;
  c.active.chosen = "bot_farm";

  state.news = state.news ?? [];
  state.news.unshift({
    id: `casc-bot-${c.active.id}`,
    kind: "warning",
    titleKey: "Gabinete de sombra aciona bots com #TudoNormalNaCidade||Shadow office fires bots with #TudoNormalNaCidade",
    month: state.month, year: state.year, day: state.day,
  });
  return state;
}

/**
 * C: Ignorar. Perda pesada de aprovação + risco de CPI aberta pela oposição.
 */
export function decideIgnore(state: GameState, rng: () => number): GameState {
  const c = ensureCascade(state);
  if (!c.active?.open) return state;
  c.active.open = false;
  c.active.chosen = "ignore";

  state.approval = Math.max(0, state.approval - 7);
  state.happiness = Math.max(0, state.happiness - 3);

  // Chance real de CPI.
  const g = state as GameState & { negotiation?: NegotiationState };
  if (g.negotiation && !g.negotiation.cpi.active && rng() < 0.55) {
    g.negotiation.cpi = {
      active: true, progress: 25, chairId: "v_zuza",
      reasonPt: "Omissão do Executivo — colapso do transporte durante chuva",
      reasonEn: "Executive omission — transport collapse during rain",
      openedYear: state.year, openedMonth: state.month,
      resolved: false, freezeInvestments: true,
      concludedAgainst: g.negotiation.cpi.concludedAgainst,
    };
  }

  // Rajada extra de posts de raiva.
  const t = nowHours(state);
  pushPost(state, {
    id: `casc_ign_${c.active.id}`,
    author: MILITANTE,
    textPt: "24 HORAS DEPOIS: nenhuma palavra do prefeito. Vamos pra rua! #ForaPrefeito #CaosNoTrânsito",
    textEn: "24 HOURS LATER: no word from the mayor. To the streets! #ForaPrefeito #CaosNoTrânsito",
    hashtags: ["#ForaPrefeito", "#CaosNoTrânsito"],
    createdAt: t, likes: 210_000, reposts: 95_000, replies: 12_000, sentiment: "outrage",
  }, ["#ForaPrefeito", "#CaosNoTrânsito"], "outrage");

  state.news = state.news ?? [];
  state.news.unshift({
    id: `casc-ign-${c.active.id}`,
    kind: "danger",
    titleKey: "Silêncio do prefeito vira combustível: oposição fala em CPI||Mayor's silence fuels outrage: opposition mulls inquiry",
    month: state.month, year: state.year, day: state.day,
  });
  return state;
}
