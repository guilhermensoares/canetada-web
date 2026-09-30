/**
 * Achievements system — persistent, cross-run collectible progress.
 *
 * Design
 * ------
 * - Definitions are pure data (below). Each entry has a `check(state, ctx)`
 *   predicate evaluated after every game tick / event resolution. First time
 *   it returns true, we mark it unlocked and fire a toast + custom DOM event.
 * - Storage lives in localStorage under `STORAGE_KEY` and survives resets,
 *   career switches and difficulty changes — the whole point is a long-tail
 *   completionist hook that spans many playthroughs.
 * - Secret achievements are hidden in the UI until unlocked. The list itself
 *   is still shipped in the JS bundle (there is no real anti-datamining here),
 *   but the in-game experience preserves surprise.
 *
 * All predicates below reference REAL Canetada mechanics (coalizão, gabinete,
 * oversight/CPI, PiuPiu/ZapZap, drenagem, saneamento, Outorga Onerosa, ZEIS,
 * regularização, transporte, gentrificação, mobilidade espacial, jornada
 * ideológica, etc.). Adding a new one? Append to ACHIEVEMENTS. Keep `id`
 * immutable — it is the storage key. Put spoiler-heavy titles behind
 * `secret: true`.
 */

import type { GameState } from "./types";

export type AchievementId = string;

/** Extra runtime signals the evaluator sees on top of GameState. */
export interface AchievementContext {
  /** Choice index the player just picked (only during resolveEvent). */
  lastChoice?: number;
  /** Event id the player just resolved. */
  lastEventId?: string;
  /** Free-form flags fired by specific UI interactions (easter eggs). */
  flag?: string;
}

export interface Achievement {
  id: AchievementId;
  title: { pt: string; en: string };
  description: { pt: string; en: string };
  /** Emoji shown as icon — keeps bundle tiny and reads well at any size. */
  icon: string;
  /** Hidden until unlocked. */
  secret?: boolean;
  /** Rough rarity for sorting / display. */
  tier?: "bronze" | "silver" | "gold" | "legendary";
  /** Returns true once the condition is satisfied. Pure function of inputs. */
  check: (state: GameState, ctx: AchievementContext) => boolean;
}

/* ============================================================ */
/*  Small helpers                                                */
/* ============================================================ */

function monthsElapsed(s: GameState): number {
  return (s.year - 2026) * 12 + (s.month - 1);
}

function coalitionSeats(s: GameState): number {
  const p = s.politics;
  if (!p) return 0;
  return p.council.parties
    .filter((x) => p.council.coalition.includes(x.id))
    .reduce((sum, x) => sum + x.seats, 0);
}

type HiredAdvisor = NonNullable<
  NonNullable<GameState["advisors"]>["hired"][keyof NonNullable<GameState["advisors"]>["hired"]]
>;

function anyAdvisor(s: GameState, pred: (a: HiredAdvisor) => boolean): boolean {
  const hired = s.advisors?.hired ?? {};
  for (const k of Object.keys(hired) as Array<keyof typeof hired>) {
    const a = hired[k];
    if (a && pred(a)) return true;
  }
  return false;
}

/* ============================================================ */
/*  The 40 achievements                                          */
/* ============================================================ */

export const ACHIEVEMENTS: Achievement[] = [
  /* ---------- Sobrevivência & carreira ---------- */
  {
    id: "first_month",
    tier: "bronze",
    icon: "🗓️",
    title: { pt: "Primeira canetada", en: "First stroke of the pen" },
    description: {
      pt: "Sobreviva ao seu primeiro mês como prefeito(a) sem cair.",
      en: "Survive your first month as mayor without falling.",
    },
    check: (s) => monthsElapsed(s) >= 1,
  },
  {
    id: "first_year",
    tier: "bronze",
    icon: "📅",
    title: { pt: "Um ano no cargo", en: "One year in office" },
    description: {
      pt: "Complete o primeiro ano de mandato sem ser afastado(a).",
      en: "Finish your first full year in office.",
    },
    check: (s) => monthsElapsed(s) >= 12,
  },
  {
    id: "mandato_completo",
    tier: "silver",
    icon: "🏛️",
    title: { pt: "Mandato inteiro", en: "Full term" },
    description: {
      pt: "Cumpra os 4 anos do primeiro mandato até o fim.",
      en: "Serve out all 4 years of your first term.",
    },
    check: (s) => monthsElapsed(s) >= 48,
  },
  {
    id: "reelected",
    tier: "gold",
    icon: "🗳️",
    title: { pt: "Reeleito(a)!", en: "Reelected!" },
    description: {
      pt: "Vença a eleição e conquiste um segundo mandato.",
      en: "Win the election and secure a second term.",
    },
    check: (s) => (s.politics?.election?.timesElected ?? 1) >= 2,
  },
  {
    id: "two_terms_complete",
    tier: "legendary",
    icon: "👑",
    title: { pt: "Dois mandatos, um legado", en: "Two terms, one legacy" },
    description: {
      pt: "Complete os dois mandatos consecutivos permitidos por lei.",
      en: "Complete both consecutive terms allowed by law.",
    },
    check: (s) =>
      (s.politics?.election?.timesElected ?? 1) >= 2 && monthsElapsed(s) >= 84,
  },
  {
    id: "legacy_saint",
    tier: "legendary",
    icon: "✨",
    title: { pt: "Santo(a) da política", en: "Political saint" },
    description: {
      pt: "Termine a carreira em vitória com coerência ideológica acima de 80.",
      en: "End your career in victory with ideological coherence above 80.",
    },
    check: (s) =>
      s.journey?.careerEnded === "victory" && (s.journey?.coherenceScore ?? 0) >= 80,
  },

  /* ---------- Aprovação popular ---------- */
  {
    id: "approval_70",
    tier: "silver",
    icon: "📈",
    title: { pt: "Queridinho(a) da cidade", en: "City sweetheart" },
    description: {
      pt: "Atinja 70% de aprovação popular.",
      en: "Reach 70% approval rating.",
    },
    check: (s) => s.approval >= 70,
  },
  {
    id: "approval_100",
    tier: "legendary",
    icon: "💯",
    title: { pt: "Aprovação total", en: "Total approval" },
    description: {
      pt: "Atinja 100% de aprovação popular. Nem Jesus conseguiu.",
      en: "Hit 100% approval. Even Jesus fell short.",
    },
    check: (s) => s.approval >= 100,
  },
  {
    id: "teflon",
    tier: "gold",
    icon: "🛡️",
    title: { pt: "Prefeito(a) teflon", en: "Teflon mayor" },
    description: {
      pt: "Sobreviva 6 meses seguidos com aprovação abaixo de 20% sem cair.",
      en: "Survive 6 months in a row with approval below 20% without falling.",
    },
    // Barato: aprovação está < 20 e o jogador já jogou pelo menos 6 meses.
    check: (s) => s.approval < 20 && monthsElapsed(s) >= 6,
  },
  {
    id: "happy_city",
    tier: "silver",
    icon: "😊",
    title: { pt: "Cidade feliz", en: "Happy city" },
    description: {
      pt: "Chegue a 85 de felicidade média dos moradores.",
      en: "Reach 85 average resident happiness.",
    },
    check: (s) => s.happiness >= 85,
  },

  /* ---------- População ---------- */
  {
    id: "population_boom",
    tier: "silver",
    icon: "🏙️",
    title: { pt: "Cidade em expansão", en: "Growing city" },
    description: {
      pt: "Ultrapasse 500 mil habitantes.",
      en: "Grow past 500k inhabitants.",
    },
    check: (s) => s.population >= 500_000,
  },
  {
    id: "megacity",
    tier: "gold",
    icon: "🌆",
    title: { pt: "Metrópole", en: "Metropolis" },
    description: {
      pt: "Ultrapasse 1 milhão de habitantes.",
      en: "Grow past 1 million inhabitants.",
    },
    check: (s) => s.population >= 1_000_000,
  },

  /* ---------- Finanças ---------- */
  {
    id: "treasury_millionaire",
    tier: "silver",
    icon: "💰",
    title: { pt: "Cofre cheio", en: "Full coffers" },
    description: {
      pt: "Acumule R$ 5 milhões no tesouro municipal.",
      en: "Accumulate R$ 5M in the municipal treasury.",
    },
    check: (s) => s.treasury >= 5_000_000,
  },
  {
    id: "treasury_titan",
    tier: "gold",
    icon: "🏦",
    title: { pt: "Titã do tesouro", en: "Treasury titan" },
    description: {
      pt: "Acumule R$ 20 milhões no tesouro municipal.",
      en: "Accumulate R$ 20M in the treasury.",
    },
    check: (s) => s.treasury >= 20_000_000,
  },
  {
    id: "debt_free",
    tier: "gold",
    icon: "🧾",
    title: { pt: "Dívida zerada", en: "Debt-free" },
    description: {
      pt: "Zere a dívida municipal depois de 2 anos de mandato.",
      en: "Zero out the municipal debt after 2 years in office.",
    },
    check: (s) => s.debt <= 0 && monthsElapsed(s) >= 24,
  },
  {
    id: "inflation_tamer",
    tier: "silver",
    icon: "🧊",
    title: { pt: "Domador(a) da inflação", en: "Inflation tamer" },
    description: {
      pt: "Mantenha inflação abaixo de 3% com desemprego abaixo de 6%.",
      en: "Keep inflation under 3% with unemployment under 6%.",
    },
    check: (s) => s.inflation < 3 && s.unemployment < 6 && monthsElapsed(s) >= 6,
  },
  {
    id: "hardline_taxer",
    tier: "silver",
    icon: "🧮",
    title: { pt: "Prefeito(a) mão-pesada", en: "Iron-fisted taxman" },
    description: {
      pt: "Rode com IPTU ≥ 15%, ISS ≥ 25% e mantenha aprovação acima de 40%.",
      en: "Run with property tax ≥ 15%, business tax ≥ 25% and keep approval above 40%.",
    },
    check: (s) =>
      s.taxes.property >= 15 && s.taxes.business >= 25 && s.approval >= 40,
  },

  /* ---------- Política / coalizão ---------- */
  {
    id: "coalition_majority",
    tier: "silver",
    icon: "🤝",
    title: { pt: "Maioria na Câmara", en: "Simple majority" },
    description: {
      pt: "Feche a base com mais da metade dos vereadores.",
      en: "Build a coalition with more than half of the council seats.",
    },
    check: (s) => coalitionSeats(s) * 2 > (s.politics?.council.totalSeats ?? 21),
  },
  {
    id: "supermajority",
    tier: "gold",
    icon: "🧱",
    title: { pt: "Supermaioria", en: "Supermajority" },
    description: {
      pt: "Alcance 2/3 das cadeiras — imune a CPI da oposição.",
      en: "Hold 2/3 of the seats — immune to opposition CPIs.",
    },
    check: (s) => coalitionSeats(s) * 3 >= (s.politics?.council.totalSeats ?? 21) * 2,
  },
  {
    id: "big_tent",
    tier: "legendary",
    icon: "🎪",
    title: { pt: "Toldo grande", en: "Big tent" },
    description: {
      pt: "Traga TODOS os partidos para a base do governo ao mesmo tempo.",
      en: "Bring EVERY single party into the coalition at the same time.",
    },
    check: (s) => {
      const p = s.politics;
      if (!p) return false;
      return p.council.parties.every((x) => p.council.coalition.includes(x.id));
    },
  },
  {
    id: "lone_wolf",
    tier: "gold",
    icon: "🐺",
    title: { pt: "Lobo solitário", en: "Lone wolf" },
    description: {
      pt: "Complete 2 anos de mandato sem admitir nenhum outro partido na base.",
      en: "Serve 2 years without inviting any other party into the coalition.",
    },
    check: (s) =>
      monthsElapsed(s) >= 24 && (s.politics?.council.coalition.length ?? 0) <= 1,
  },

  /* ---------- Gabinete / assessores ---------- */
  {
    id: "full_cabinet",
    tier: "silver",
    icon: "👥",
    title: { pt: "Gabinete completo", en: "Full cabinet" },
    description: {
      pt: "Preencha as 5 pastas de assessores ao mesmo tempo.",
      en: "Staff all 5 advisor portfolios at once.",
    },
    check: (s) => Object.keys(s.advisors?.hired ?? {}).length >= 5,
  },
  {
    id: "star_advisor",
    tier: "gold",
    icon: "⭐",
    title: { pt: "Assessor(a) 5 estrelas", en: "5-star advisor" },
    description: {
      pt: "Tenha um(a) assessor(a) com Capacidade Técnica máxima (5★).",
      en: "Have an advisor at maximum technical skill (5★).",
    },
    check: (s) => anyAdvisor(s, (a) => a.overall >= 5),
  },
  {
    id: "sabotaged",
    tier: "silver",
    icon: "🗡️",
    title: { pt: "Sabotado(a) pelo próprio time", en: "Sabotaged from within" },
    description: {
      pt: "Descubra um(a) assessor(a) com lealdade abaixo de 25 — sugestões envenenadas.",
      en: "Catch an advisor with loyalty below 25 — poisoned recommendations.",
    },
    check: (s) => anyAdvisor(s, (a) => a.loyalty < 25),
  },
  {
    id: "betrayed",
    tier: "gold",
    icon: "🔪",
    title: { pt: "Traído(a)", en: "Betrayed" },
    description: {
      pt: "Um(a) assessor(a) traiu o gabinete e vazou informação.",
      en: "An advisor betrayed your cabinet and leaked information.",
    },
    check: (s) => anyAdvisor(s, (a) => !!a.betrayed),
  },


  /* ---------- Corrupção / oversight ---------- */
  {
    id: "clean_hands",
    tier: "gold",
    icon: "🧼",
    title: { pt: "Mãos limpas", en: "Clean hands" },
    description: {
      pt: "Chegue ao ano 2030 com índice de corrupção abaixo de 15.",
      en: "Reach 2030 with the corruption index under 15.",
    },
    check: (s) => (s.politics?.institutional?.corruption ?? 100) < 15 && s.year >= 2030,
  },
  {
    id: "transparency_master",
    tier: "silver",
    icon: "🔍",
    title: { pt: "Vitrine da transparência", en: "Transparency showcase" },
    description: {
      pt: "Atinja 80 de transparência institucional.",
      en: "Reach 80 institutional transparency.",
    },
    check: (s) => (s.politics?.institutional?.transparency ?? 0) >= 80,
  },
  {
    id: "cpi_survivor",
    tier: "legendary",
    icon: "⚖️",
    title: { pt: "CPI encerrada, cargo mantido", en: "CPI closed, seat kept" },
    description: {
      pt: "Sobreviva a um processo de impeachment que chegou ao plenário.",
      en: "Survive an impeachment process that reached the plenary vote.",
    },
    check: (s) => {
      const ov = (s as unknown as { oversight?: { impeachment?: { phase?: string } } }).oversight;
      return ov?.impeachment?.phase === "closed" && !s.journey?.careerEnded;
    },
  },

  /* ---------- PiuPiu / ZapZap / mídia ---------- */
  {
    id: "crisis_reverter",
    tier: "gold",
    icon: "🔥",
    title: { pt: "Apagador(a) de incêndio", en: "Fire-extinguisher" },
    description: {
      pt: "Reverta 3 crises virais no PiuPiu com resposta bem-sucedida.",
      en: "Reverse 3 PiuPiu viral crises with successful responses.",
    },
    check: (s) => {
      const p = (s as unknown as { piupiu?: { totalReversals?: number } }).piupiu;
      return (p?.totalReversals ?? 0) >= 3;
    },
  },
  {
    id: "debunker",
    tier: "silver",
    icon: "📵",
    title: { pt: "Desmentiu no ZapZap", en: "Debunked on ZapZap" },
    description: {
      pt: "Desminta 10 fake news no ZapZap ao longo do mandato.",
      en: "Debunk 10 fake news items on ZapZap during your term.",
    },
    check: (s) => {
      const z = (s as unknown as { zapzap?: { debunkedTotal?: number } }).zapzap;
      return (z?.debunkedTotal ?? 0) >= 10;
    },
  },
  {
    id: "press_briefer",
    tier: "bronze",
    icon: "🎙️",
    title: { pt: "Coletiva marcada", en: "Press briefing" },
    description: {
      pt: "Convoque 5 pronunciamentos oficiais à imprensa.",
      en: "Hold 5 official press briefings.",
    },
    check: (s) => {
      const m = (s as unknown as { media?: { stats?: { briefings?: number } } }).media;
      return (m?.stats?.briefings ?? 0) >= 5;
    },
  },

  /* ---------- Clima / saneamento / resíduos ---------- */
  {
    id: "drainage_ready",
    tier: "silver",
    icon: "🌧️",
    title: { pt: "Sem enchente esse ano", en: "Flood-proof year" },
    description: {
      pt: "Construa 3 piscinões — a cidade respira nas chuvas de verão.",
      en: "Build 3 macro-drainage reservoirs — the city breathes in summer rain.",
    },
    check: (s) => (s.climate?.drainage?.piscinoes ?? 0) >= 3,
  },
  {
    id: "universal_sanitation",
    tier: "gold",
    icon: "🚿",
    title: { pt: "Saneamento universal", en: "Universal sanitation" },
    description: {
      pt: "Chegue a 95% de cobertura de água e esgoto — Marco cumprido.",
      en: "Reach 95% water & sewage coverage — sanitation goal met.",
    },
    check: (s) =>
      (s.climate?.sanitation?.waterCoverage ?? 0) >= 95 &&
      (s.climate?.sanitation?.sewageCoverage ?? 0) >= 95,
  },
  {
    id: "no_more_lixao",
    tier: "silver",
    icon: "♻️",
    title: { pt: "Fim do lixão", en: "No more dumpsite" },
    description: {
      pt: "Rode 2 anos sem despejar lixo em lixão (aterro ou reciclagem).",
      en: "Run 2 years without using an open dumpsite (landfill or recycling only).",
    },
    check: (s) =>
      s.climate?.waste?.mode !== "dump" && monthsElapsed(s) >= 24,
  },
  {
    id: "catadores",
    tier: "gold",
    icon: "🧑‍🔧",
    title: { pt: "Cidade dos catadores", en: "City of recyclers" },
    description: {
      pt: "Financie 3 cooperativas de reciclagem com o programa em pleno vapor.",
      en: "Fund 3 recycling co-ops with the program in full swing.",
    },
    check: (s) =>
      s.climate?.waste?.mode === "recycling" &&
      (s.climate?.waste?.cooperatives ?? 0) >= 3,
  },

  /* ---------- Uso do solo / Plano Diretor ---------- */
  {
    id: "regularizou_favela",
    tier: "gold",
    icon: "🏘️",
    title: { pt: "Regularização fundiária", en: "Land title reform" },
    description: {
      pt: "Regularize 20 lotes de favela com documentação e serviços.",
      en: "Regularize 20 favela plots with proper documents and services.",
    },
    check: (s) => (s.landUse?.regularized ?? 0) >= 20,
  },
  {
    id: "outorga_milionaria",
    tier: "silver",
    icon: "🏗️",
    title: { pt: "Outorga milionária", en: "Millionaire building rights" },
    description: {
      pt: "Arrecade R$ 5 milhões vendendo Outorga Onerosa aos incorporadores.",
      en: "Collect R$ 5M in Outorga Onerosa (bonus-FAR) revenue from developers.",
    },
    check: (s) => (s.landUse?.outorgaRevenue ?? 0) >= 5_000_000,
  },

  /* ---------- Transporte ---------- */
  {
    id: "brt_city",
    tier: "silver",
    icon: "🚌",
    title: { pt: "Cidade do BRT", en: "BRT city" },
    description: {
      pt: "Implante 3 corredores de BRT ligando as periferias ao centro.",
      en: "Deploy 3 BRT corridors linking periphery to the core.",
    },
    check: (s) => (s.transport?.brtCorridors ?? 0) >= 3,
  },
  {
    id: "metro_pronto",
    tier: "gold",
    icon: "🚇",
    title: { pt: "Inauguração do metrô", en: "Metro inauguration" },
    description: {
      pt: "Entregue 3 estações de metrô — placa com o seu nome.",
      en: "Open 3 metro stations — plaque bearing your name.",
    },
    check: (s) => (s.transport?.metroStations ?? 0) >= 3,
  },

  /* ---------- Sustentabilidade & equidade ---------- */
  {
    id: "cidade_verde",
    tier: "silver",
    icon: "🌱",
    title: { pt: "Cidade verde", en: "Green city" },
    description: {
      pt: "Chegue a 80 no programa de energia renovável.",
      en: "Reach 80 on the renewables program.",
    },
    check: (s) => s.sustainability?.renewables >= 80,
  },
  {
    id: "ar_puro",
    tier: "gold",
    icon: "🍃",
    title: { pt: "Ar puro", en: "Clean air" },
    description: {
      pt: "Mantenha a qualidade do ar acima de 85 e poluição abaixo de 15.",
      en: "Keep air quality above 85 and pollution below 15.",
    },
    check: (s) =>
      (s.environment?.airQuality ?? 0) >= 85 &&
      (s.environment?.pollution ?? 100) < 15,
  },
  {
    id: "equidade_espacial",
    tier: "gold",
    icon: "⚖️",
    title: { pt: "Justiça espacial", en: "Spatial justice" },
    description: {
      pt: "Reduza o gap de mobilidade social entre estratos para menos de 15 pontos.",
      en: "Cut the social-mobility gap between strata to under 15 points.",
    },
    check: (s) => {
      const gap = s.mobility?.mobilityGap;
      return typeof gap === "number" && gap <= 15 && monthsElapsed(s) >= 12;
    },
  },
  {
    id: "diploma_para_todos",
    tier: "gold",
    icon: "🎓",
    title: { pt: "Diploma para todos", en: "Diplomas for all" },
    description: {
      pt: "Chegue a 25% da população adulta com ensino superior.",
      en: "Reach 25% of adults holding a higher-education diploma.",
    },
    check: (s) => (s.education?.cohorts?.higher ?? 0) >= 0.25,
  },
  {
    id: "sem_gentrificacao",
    tier: "silver",
    icon: "🏠",
    title: { pt: "Cidade sem expulsão", en: "No-eviction city" },
    description: {
      pt: "Passe 2 anos mantendo o índice de gentrificação abaixo de 30.",
      en: "Spend 2 years keeping the gentrification index below 30.",
    },
    check: (s) => {
      const H = (s as unknown as { housing?: { gentrificationIndex?: number } }).housing;
      return (H?.gentrificationIndex ?? 100) < 30 && monthsElapsed(s) >= 24;
    },
  },

  /* ---------- Fracassos icônicos ---------- */
  {
    id: "secret_broke_first_month",
    secret: true,
    tier: "bronze",
    icon: "💸",
    title: { pt: "Quebrou tudo em 30 dias", en: "Bankrupt in 30 days" },
    description: {
      pt: "Zere o tesouro logo no primeiro mês. Um clássico brasileiro.",
      en: "Blow through the treasury in your very first month. A classic.",
    },
    check: (s) => s.treasury < 0 && s.year === 2026 && s.month <= 2,
  },
  {
    id: "impeached",
    secret: true,
    tier: "silver",
    icon: "🚪",
    title: { pt: "Cassado(a)!", en: "Impeached!" },
    description: {
      pt: "Sofra impeachment e seja afastado(a) do cargo. Faz parte.",
      en: "Get impeached and removed from office. It happens.",
    },
    check: (s) => s.journey?.careerEnded === "impeached",
  },

  /* ---------- Easter eggs ---------- */
  {
    id: "secret_second_chance",
    secret: true,
    tier: "gold",
    icon: "⏮️",
    title: { pt: "Voltando 1 ano no tempo", en: "Rewound one year" },
    description: {
      pt: "Use a Segunda Chance para voltar 1 ano antes de uma eleição perdida.",
      en: "Cash in the Second Chance rewind after losing an election.",
    },
    check: (s) => !!s.secondChance?.used,
  },
  {
    id: "secret_konami",
    secret: true,
    tier: "gold",
    icon: "🎮",
    title: { pt: "Código Konami", en: "Konami code" },
    description: {
      pt: "Digite ↑↑↓↓←→←→BA em qualquer tela do jogo.",
      en: "Type ↑↑↓↓←→←→BA on any screen.",
    },
    check: (_s, ctx) => ctx.flag === "konami",
  },
  {
    id: "secret_uno_com_escada",
    secret: true,
    tier: "silver",
    icon: "🚗",
    title: { pt: "Uno com escada", en: "Ladder-topped hatchback" },
    description: {
      pt: "Descubra o easter egg clicando 5x no logo do Canetada.",
      en: "Trigger the easter egg by clicking the Canetada logo 5 times.",
    },
    check: (_s, ctx) => ctx.flag === "uno_com_escada",
  },
  {
    id: "secret_copa_sem_hospital",
    secret: true,
    tier: "legendary",
    icon: "🏆",
    title: {
      pt: "Realmente, não se faz Copa do Mundo com Hospital",
      en: "Turns out you don't build a World Cup out of hospitals",
    },
    description: {
      pt: "Deixe a Saúde afundar e ainda assim veja o Brasil ser hexacampeão em 2030 com sua aprovação de pé.",
      en: "Let public health rot and still watch Brazil lift the 2030 World Cup while your approval holds.",
    },
    check: (s) => !!s.copa2030?.won,
  },
  {
    id: "secret_nando_moura_404",
    secret: true,
    tier: "legendary",
    icon: "📏",
    title: {
      pt: "Nando Moura mede 1 ,... Error 404 - Not Found",
      en: "Nando Moura is 1 .… Error 404 - Not Found",
    },
    description: {
      pt: "Sobreviva a 5 crises instigadas por Dando Boura até ele publicar o vídeo revelando a própria altura.",
      en: "Survive 5 crises instigated by Dando Boura until he drops the video revealing his own height.",
    },
    check: (s) => !!s.dandoBoura?.heightRevealed,
  },
  {
    id: "secret_zuza_grosso_setembro",
    secret: true,
    tier: "gold",
    icon: "💸",
    title: {
      pt: "O grosso entrou, mas ainda nem é setembro...",
      en: "The big haul came in — and it isn't even September yet...",
    },
    description: {
      pt: "Jogando de Zuza, aumente significativamente algum imposto antes de setembro do ano corrente.",
      en: "Playing as Zuza, bump any tax significantly before September of the current year.",
    },
    check: (s) => !!s.zuzaGrossoTax,
  },
];

/* -------------------------------------------------------------------------- */
/* Storage                                                                     */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "prefeito2026.achievements.v1";

/** Persisted shape. `unlocked` is an id → ISO timestamp map. */
interface StoredAchievements {
  unlocked: Record<string, string>;
}

function loadStore(): StoredAchievements {
  if (typeof window === "undefined") return { unlocked: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlocked: {} };
    const parsed = JSON.parse(raw) as StoredAchievements;
    return { unlocked: parsed.unlocked ?? {} };
  } catch {
    return { unlocked: {} };
  }
}

function saveStore(s: StoredAchievements) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota — ignore */
  }
}

export function getUnlockedAchievements(): Record<string, string> {
  return loadStore().unlocked;
}

export function isUnlocked(id: AchievementId): boolean {
  return id in loadStore().unlocked;
}

/** Unlock a specific achievement. Returns true if it was newly unlocked. */
export function unlockAchievement(id: AchievementId): boolean {
  const store = loadStore();
  if (store.unlocked[id]) return false;
  store.unlocked[id] = new Date().toISOString();
  saveStore(store);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("achievement:unlocked", { detail: { id } }));
  }
  return true;
}

/**
 * Evaluate all achievements against the current state + context.
 * Returns the list of newly-unlocked ids. Cheap: ~40 predicates, each a
 * couple of field reads.
 */
export function evaluateAchievements(
  state: GameState,
  ctx: AchievementContext = {},
): AchievementId[] {
  const store = loadStore();
  const newly: AchievementId[] = [];
  for (const a of ACHIEVEMENTS) {
    if (store.unlocked[a.id]) continue;
    try {
      if (a.check(state, ctx)) {
        store.unlocked[a.id] = new Date().toISOString();
        newly.push(a.id);
      }
    } catch {
      /* defensive: never let a broken check break the game */
    }
  }
  if (newly.length > 0) {
    saveStore(store);
    if (typeof window !== "undefined") {
      for (const id of newly) {
        window.dispatchEvent(new CustomEvent("achievement:unlocked", { detail: { id } }));
      }
    }
  }
  return newly;
}

/** Dev helper — reset all achievements. Exposed on window for the console. */
export function resetAchievements() {
  saveStore({ unlocked: {} });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("achievement:reset"));
  }
}

export function findAchievement(id: AchievementId): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
