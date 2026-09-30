/**
 * "Hora da Verdade" — programa de notícias policiais estilo Datena.
 *
 * O programa dispara automaticamente quando a criminalidade de qualquer bairro
 * ultrapassa o limiar. O apresentador (NPC) invade a tela gritando, exigindo
 * o envio de viaturas. Se o prefeito não agir dentro do prazo, ele quebra a
 * cadeira ao vivo e detona uma crise (queda de aprovação + protestos + risco MP).
 *
 * Este módulo é self-contained: cria seu próprio modelo de bairros derivado
 * das estatísticas globais (policies.security, parallelPower.aggregateControl,
 * spatialJustice) para não exigir refatoração de tipos existentes.
 */

import type { GameState, NewsItem } from "./types";
import { polExt } from "./legislature";
type RNGLike = { float: () => number };

/* ============================================================
 *  Types
 * ============================================================ */

export type NeighborhoodId =
  | "centro" | "zona_norte" | "zona_sul" | "zona_leste" | "zona_oeste" | "periferia";

export interface NeighborhoodCrime {
  id: NeighborhoodId;
  namePt: string;
  nameEn: string;
  /** 0..100. Acima de PANIC_THRESHOLD dispara o programa. */
  crimeIndex: number;
  /** Nível 0..100 acumulado de tensão exibida pela imprensa policial. */
  fear: number;
}

export type HostAnger = "calm" | "loud" | "furious" | "chair_break";

export interface PoliceBroadcast {
  active: boolean;
  targetHood: NeighborhoodId;
  /** Dias restantes até o apresentador quebrar a cadeira. */
  timerDays: number;
  /** Aumenta conforme o tempo passa: calm → loud → furious → chair_break. */
  anger: HostAnger;
  /** Efeito acumulado de infelicidade no bairro (pico já aplicado). */
  peakHit: number;
  /** Última fala do apresentador, em PT e EN, para a UI. */
  quotePt: string;
  quoteEn: string;
}

export interface PoliceShowState {
  neighborhoods: NeighborhoodCrime[];
  broadcast: PoliceBroadcast | null;
  /** Dias até novo programa poder ser disparado (evita spam). */
  cooldownDays: number;
  /** Estatísticas de campanha. */
  stats: {
    broadcasts: number;
    chairsBroken: number;
    dispatched: number;
    ignored: number;
  };
}

/* ============================================================
 *  Constantes de balanceamento
 * ============================================================ */

/** Índice de crime acima do qual o Datena vem à tela. */
export const PANIC_THRESHOLD = 72;
/** Prazo (em dias de jogo) até quebrar a cadeira. */
export const BROADCAST_TIMER = 45;
/** Cooldown após qualquer broadcast (dias). */
export const BROADCAST_COOLDOWN = 90;
/** Custo do envio de viaturas. */
export const DISPATCH_COST = 600_000;
/** Capital político consumido no envio de viaturas. */
export const DISPATCH_CP = 8;

const HOOD_META: Record<NeighborhoodId, { namePt: string; nameEn: string; bias: number }> = {
  centro:      { namePt: "Centro",       nameEn: "Downtown",   bias: 0 },
  zona_norte:  { namePt: "Zona Norte",   nameEn: "North Zone", bias: +6 },
  zona_sul:    { namePt: "Zona Sul",     nameEn: "South Zone", bias: -8 },
  zona_leste:  { namePt: "Zona Leste",   nameEn: "East Zone",  bias: +4 },
  zona_oeste:  { namePt: "Zona Oeste",   nameEn: "West Zone",  bias: -2 },
  periferia:   { namePt: "Periferia",    nameEn: "Outskirts",  bias: +14 },
};

/* ============================================================
 *  Setup
 * ============================================================ */

export function ensurePoliceShow(s: GameState): void {
  const ext = s as GameState & { policeShow?: PoliceShowState };
  if (ext.policeShow) return;
  ext.policeShow = {
    neighborhoods: (Object.keys(HOOD_META) as NeighborhoodId[]).map((id) => ({
      id,
      namePt: HOOD_META[id].namePt,
      nameEn: HOOD_META[id].nameEn,
      crimeIndex: 30 + HOOD_META[id].bias,
      fear: 20,
    })),
    broadcast: null,
    cooldownDays: 0,
    stats: { broadcasts: 0, chairsBroken: 0, dispatched: 0, ignored: 0 },
  };
}

/* ============================================================
 *  Tick
 * ============================================================ */

export interface PoliceShowTickResult {
  approvalDelta: number;
  happinessDelta: number;
  mpRiskDelta: number;
  treasuryDelta: number;
  news: Omit<NewsItem, "id" | "month" | "year" | "day">[];
}

/** Atualiza índice de crime por bairro. Deve ser chamado 1x/mês. */
export function tickPoliceShowMonthly(s: GameState, rng: RNGLike): void {
  ensurePoliceShow(s);
  const st = (s as GameState & { policeShow: PoliceShowState }).policeShow;
  const sec = s.policies.security;
  const ppCtrl = s.parallelPower?.aggregateControl ?? 0;
  const unemp = s.unemployment;
  const socialMitigation =
    (s.housing?.socialQueue ? Math.max(0, 8 - s.housing.socialQueue / 5000) : 0) +
    (s.policies.education > 60 ? 4 : 0) +
    (s.mobility?.cityMobility ?? 50) * 0.05;

  // Base municipal (0..100): baixa segurança + controle paralelo + desemprego pesam.
  const base = 55 - sec * 0.55 + ppCtrl * 0.35 + Math.max(0, unemp - 6) * 1.8 - socialMitigation;

  for (const h of st.neighborhoods) {
    const noise = (rng.float() - 0.5) * 10;
    const target = clamp(base + HOOD_META[h.id].bias + noise, 5, 100);
    // suavização (EMA) para evitar picos absurdos.
    h.crimeIndex = clamp(h.crimeIndex * 0.65 + target * 0.35, 0, 100);
    // O medo cai devagar quando o crime baixa (percepção é grudenta).
    h.fear = clamp(h.fear * 0.85 + h.crimeIndex * 0.2, 0, 100);
  }
}

/** Roda a cada dia: cooldown, timer do broadcast, escalada do apresentador. */
export function tickPoliceShowDaily(s: GameState, rng: RNGLike): PoliceShowTickResult {
  ensurePoliceShow(s);
  const st = (s as GameState & { policeShow: PoliceShowState }).policeShow;
  const res: PoliceShowTickResult = {
    approvalDelta: 0, happinessDelta: 0, mpRiskDelta: 0, treasuryDelta: 0, news: [],
  };

  if (st.cooldownDays > 0) st.cooldownDays -= 1;

  // 1) Se não há broadcast ativo, checar gatilho.
  if (!st.broadcast && st.cooldownDays <= 0) {
    // Pega o bairro mais violento.
    const worst = [...st.neighborhoods].sort((a, b) => b.crimeIndex - a.crimeIndex)[0];
    if (worst && worst.crimeIndex >= PANIC_THRESHOLD) {
      const q = pickHostQuote(worst, "loud", rng);
      st.broadcast = {
        active: true,
        targetHood: worst.id,
        timerDays: BROADCAST_TIMER,
        anger: "loud",
        peakHit: 0,
        quotePt: q.pt,
        quoteEn: q.en,
      };
      st.stats.broadcasts += 1;

      // Pico imediato de infelicidade — independente do estado real.
      const hit = 3 + (worst.crimeIndex - PANIC_THRESHOLD) * 0.15;
      st.broadcast.peakHit = hit;
      res.happinessDelta -= hit;
      res.approvalDelta -= hit * 0.4;
      res.news.push({
        kind: "danger",
        titleKey: "news_police_show_on_air",
        detail: s.lang === "pt"
          ? `"HORA DA VERDADE": apresentador grita ao vivo sobre ${worst.namePt}`
          : `"TRUTH HOUR": host screams live about ${worst.nameEn}`,
      });
    }
    return res;
  }

  if (!st.broadcast) return res;

  // 2) Broadcast ativo — timer e escalada.
  const b = st.broadcast;
  b.timerDays -= 1;

  // Reamostra a fala do apresentador a cada ~7 dias para dar vida à UI.
  if (b.timerDays % 7 === 0) {
    const hood = st.neighborhoods.find(h => h.id === b.targetHood)!;
    const q = pickHostQuote(hood, b.anger, rng);
    b.quotePt = q.pt;
    b.quoteEn = q.en;
  }

  // Escala a raiva do apresentador.
  const frac = b.timerDays / BROADCAST_TIMER;
  if (frac > 0.66)      b.anger = "loud";
  else if (frac > 0.33) b.anger = "furious";
  else if (frac > 0)    b.anger = "furious";

  // Drena aprovação/felicidade enquanto está no ar.
  res.happinessDelta -= 0.06;
  res.approvalDelta -= 0.04;

  // 3) Cadeira quebrada — timer estourou.
  if (b.timerDays <= 0) {
    b.anger = "chair_break";
    st.stats.chairsBroken += 1;
    st.stats.ignored += 1;
    const hood = st.neighborhoods.find(h => h.id === b.targetHood)!;
    // Crise: protestos em frente à prefeitura.
    res.approvalDelta -= 8;
    res.happinessDelta -= 6;
    res.mpRiskDelta += 12;
    res.news.push({
      kind: "danger",
      titleKey: "news_police_show_chair_break",
      detail: s.lang === "pt"
        ? `CADEIRA QUEBRADA AO VIVO! Protestos em frente à prefeitura por causa de ${hood.namePt}.`
        : `CHAIR BROKEN LIVE! Protests at city hall over ${hood.nameEn}.`,
    });
    // Encerra o broadcast e trava cooldown longo.
    st.broadcast = null;
    st.cooldownDays = 180;
  }

  return res;
}

/* ============================================================
 *  Ações do jogador
 * ============================================================ */

/** Enviar viaturas: fecha o programa, calma o apresentador, reduz o crime local. */
export function dispatchPoliceUnits(state: GameState): GameState {
  ensurePoliceShow(state);
  const st = (state as GameState & { policeShow: PoliceShowState }).policeShow;
  if (!st.broadcast) return state;
  if (state.treasury < DISPATCH_COST) return state;

  const polx = polExt(state);
  const pc = polx.politicalCapital ?? 0;
  if (pc < DISPATCH_CP) return state;

  const hood = st.neighborhoods.find(h => h.id === st.broadcast!.targetHood);
  if (hood) {
    hood.crimeIndex = Math.max(0, hood.crimeIndex - 30);
    hood.fear = Math.max(0, hood.fear - 20);
  }
  st.stats.dispatched += 1;
  st.broadcast = null;
  st.cooldownDays = BROADCAST_COOLDOWN;

  const news: NewsItem = {
    id: `${state.year}-${state.month}-${state.day}-police-dispatch`,
    kind: "info",
    titleKey: "news_police_show_dispatched",
    detail: state.lang === "pt"
      ? `Viaturas enviadas para ${hood?.namePt}. Apresentador respira fundo e volta ao intervalo.`
      : `Cars dispatched to ${hood?.nameEn}. Host calms down and cuts to commercials.`,
    month: state.month, year: state.year, day: state.day,
  };

  const next: GameState = {
    ...state,
    treasury: state.treasury - DISPATCH_COST,
    approval: clamp(state.approval + 2, 0, 100),
    happiness: clamp(state.happiness + 3, 0, 100),
    politics: state.politics ? { ...state.politics } : state.politics,
    news: [news, ...state.news].slice(0, 60),
  };
  if (next.politics) {
    const p = polExt(next);
    p.politicalCapital = Math.max(0, pc - DISPATCH_CP);
  }
  return next;
}

/** Ignorar: fecha o modal mas o programa continua no ar (drena passivo). */
export function ignorePoliceShow(state: GameState): GameState {
  // Modal-only close: não mexe no broadcast, apenas informa a UI que o
  // jogador viu. Aqui não temos flag de "visto" — a UI trata isso com
  // estado local. Deixamos a função pronta para futuras extensões.
  return state;
}

/* ============================================================
 *  Falas do apresentador
 * ============================================================ */

function pickHostQuote(h: NeighborhoodCrime, anger: HostAnger, rng: RNGLike): { pt: string; en: string } {
  const name = { pt: h.namePt, en: h.nameEn };
  const pool: Record<HostAnger, { pt: string; en: string }[]> = {
    calm: [
      { pt: `Meus amigos, atenção com o que está acontecendo em ${name.pt}.`,
        en: `My friends, pay attention to what is going on in ${name.en}.` },
    ],
    loud: [
      { pt: `PREFEITO! Cadê a polícia em ${name.pt}?! Eu quero ver VIATURA na tela!`,
        en: `MAYOR! Where are the cops in ${name.en}?! I want to see PATROL cars on screen!` },
      { pt: `Isso é um absurdo, um ABSURDO! ${name.pt} virou terra de ninguém!`,
        en: `This is an outrage, an OUTRAGE! ${name.en} became a lawless land!` },
      { pt: `Família brasileira NÃO merece isso! Ó a bandidagem solta em ${name.pt}!`,
        en: `Brazilian families do NOT deserve this! Look at ${name.en}, crime running loose!` },
    ],
    furious: [
      { pt: `PREFEITO COVARDE! Vai esperar mais quanto para mandar a tropa a ${name.pt}?!`,
        en: `COWARD MAYOR! How long will you wait to send troops to ${name.en}?!` },
      { pt: `EU EXIJO! EXIJO uma resposta AGORA sobre ${name.pt}! Ao vivo, aqui, agora!`,
        en: `I DEMAND! I DEMAND an answer NOW about ${name.en}! Live, right here, right now!` },
      { pt: `A cidade está em CHAMAS e o prefeito não faz NADA por ${name.pt}!`,
        en: `The city is ON FIRE and the mayor does NOTHING for ${name.en}!` },
    ],
    chair_break: [
      { pt: `*QUEBRA A CADEIRA* CHEGA! CHEGA DESSA VERGONHA! O POVO VAI ÀS RUAS!`,
        en: `*BREAKS THE CHAIR* ENOUGH! ENOUGH OF THIS SHAME! THE PEOPLE WILL RIOT!` },
    ],
  };
  const arr = pool[anger];
  return arr[Math.floor(rng.float() * arr.length)] ?? arr[0];
}

/* ============================================================
 *  Utils
 * ============================================================ */

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function hoodLabel(id: NeighborhoodId, lang: "pt" | "en"): string {
  return lang === "pt" ? HOOD_META[id].namePt : HOOD_META[id].nameEn;
}
