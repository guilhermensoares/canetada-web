/**
 * Media & Public Opinion — o barulho midiático como agente ativo.
 *
 * Cada tick mensal:
 *  1) Amostra decisões recentes do jogador (impostos, obras, gastos, escândalos,
 *     desastres, corrupção, aprovação, saúde, transporte, poder paralelo…).
 *  2) Cada veículo, com seu VIÉS próprio, escolhe UMA pauta e gera manchete
 *     com "spin" alinhado ao viés (angle = -1 crítica, 0 neutra, +1 elogiosa).
 *  3) Se >= 3 veículos cobrirem o MESMO tópico com angle negativo no mesmo
 *     mês, dispara "Efeito Manada": queda exponencial extra de aprovação,
 *     enquanto o "heat" daquele tópico não esfriar.
 *
 * O jogador pode responder com "Pronunciamento Oficial" (custa CP + verba de
 * publicidade) que reduz temporariamente o heat e concede uma cobertura
 * positiva dos veículos governistas.
 */

import type { GameState, NewsItem } from "./types";
type RNGLike = { float: () => number };

// Inlined to avoid a circular import with ./logic. Keep in sync with
// POST_TOUR_GRACE_MONTHS / inPostTourGrace() there.
const POST_TOUR_GRACE_MONTHS = 6;
function inPostTourGrace(s: GameState): boolean {
  if (!s.tourEndedAt) return false;
  const elapsed = (s.year - s.tourEndedAt.year) * 12 + (s.month - s.tourEndedAt.month);
  return elapsed < POST_TOUR_GRACE_MONTHS;
}

/* ============================================================
 *  Types
 * ============================================================ */

export type MediaBias =
  | "sensationalist"   // Sensacionalista — amplifica caos, ignora sucesso
  | "government"       // Governista — dourar a pílula, elogia grandes obras
  | "economic"         // Econômico — foca fiscal, impostos, mercado
  | "community"        // Comunitário — periferia, moradia, informalidade
  | "opposition"       // Oposição — sempre contra, adora escândalos
  | "mainstream"       // Rede Cubo — líder, tom sério, adora obra grandiosa
  | "welfare"          // SBTv — caridade e bem-estar social
  | "police"           // Canal Recordar — jornalismo policial, valores tradicionais
  | "urbanNews"        // BandCidades — trânsito e economia local 24h
  | "favelaRadio"      // Rádio Favela FM — voz da periferia, baixa potência
  | "neighborhoodPaper"; // O Pasquim do Bairro — fofoca de quarteirão

export type CoverageTopic =
  | "health"           // fila SUS, falta de médicos
  | "education"        // escola, professor
  | "transport"        // ônibus, metrô, tarifa
  | "tax"              // aumento/redução de imposto
  | "corruption"       // MP, TCE, propina
  | "housing"          // gentrificação, despejo
  | "security"         // milícia, facção, violência
  | "disaster"         // enchente, deslizamento
  | "environment"      // poluição, verde
  | "economy"          // desemprego, inflação
  | "works";           // obras, elefantes brancos

export type OutletKind = "press" | "tv" | "radio" | "pasquim";

export interface MediaOutlet {
  id: string;
  namePt: string;
  nameEn: string;
  bias: MediaBias;
  /** 0..1 — quanto o veículo influencia a opinião pública. */
  reach: number;
  /** "tv" habilita exibição no widget de TV pop-up. */
  kind?: OutletKind;
  /** Slogan curto para o rodapé do canal (aparece na TV). */
  sloganPt?: string;
  sloganEn?: string;
}


export interface Headline {
  id: string;
  outletId: string;
  bias: MediaBias;
  topic: CoverageTopic;
  /** -1 crítica, 0 neutra, +1 elogiosa. */
  angle: -1 | 0 | 1;
  textPt: string;
  textEn: string;
  month: number;
  year: number;
}

export interface MediaState {
  outlets: MediaOutlet[];
  /** Últimas manchetes (mais recentes primeiro), no máximo 40. */
  headlines: Headline[];
  /** Calor por tópico (0..100). Cai ~15/mês. Alimenta o Efeito Manada. */
  topicHeat: Record<CoverageTopic, number>;
  /** Meses restantes de "trégua" após um pronunciamento oficial. */
  briefingCooldown: number;
  /** Estatísticas de campanha. */
  stats: {
    herdEvents: number;
    briefings: number;
    totalHeadlines: number;
  };
  /** Último Efeito Manada observado (para a UI). */
  lastHerd?: {
    topic: CoverageTopic;
    outlets: number;
    approvalHit: number;
    month: number;
    year: number;
  };
}

/* ============================================================
 *  Setup
 * ============================================================ */

const DEFAULT_OUTLETS: MediaOutlet[] = [
  // Imprensa "clássica"
  { id: "o1", namePt: "Diário Popular",   nameEn: "Daily Popular",     bias: "sensationalist", reach: 0.9,  kind: "press" },
  { id: "o2", namePt: "Gazeta Oficial",   nameEn: "Official Gazette",  bias: "government",     reach: 0.6,  kind: "press" },
  { id: "o3", namePt: "Folha Econômica",  nameEn: "Economic Post",     bias: "economic",       reach: 0.7,  kind: "press" },
  { id: "o4", namePt: "Voz da Quebrada",  nameEn: "Voice of the Hood", bias: "community",      reach: 0.55, kind: "press" },
  { id: "o5", namePt: "Contraponto",      nameEn: "Counterpoint",      bias: "opposition",     reach: 0.75, kind: "press" },
  // Canais de TV parodiados
  { id: "tv_cubo",    namePt: "Rede Cubo",           nameEn: "Cube Network",       bias: "mainstream", reach: 1.0,
    kind: "tv", sloganPt: "A gente se vê aqui",       sloganEn: "See you right here" },
  { id: "tv_sbtv",    namePt: "TVN Família",         nameEn: "TVN Family",         bias: "welfare",    reach: 0.85,
    kind: "tv", sloganPt: "A TV da família brasileira", sloganEn: "The Brazilian family channel" },
  { id: "tv_recordar",namePt: "Canal Recordar",      nameEn: "Recall Channel",     bias: "police",     reach: 0.8,
    kind: "tv", sloganPt: "A verdade em primeiro lugar", sloganEn: "Truth first, always" },
  { id: "tv_band",    namePt: "Cidade 24h",          nameEn: "City 24h",           bias: "urbanNews",  reach: 0.7,
    kind: "tv", sloganPt: "Notícia o dia todo",       sloganEn: "News around the clock" },
  // Mídia local / periférica — voz que a Rede Cubo não cobre.
  { id: "radio_favela", namePt: "Rádio Favela FM",    nameEn: "Favela Radio FM",    bias: "favelaRadio", reach: 0.35,
    kind: "radio", sloganPt: "A voz da quebrada",     sloganEn: "The voice of the hood" },
  { id: "pasquim",      namePt: "O Pasquim do Bairro", nameEn: "The Block Pasquim", bias: "neighborhoodPaper", reach: 0.25,
    kind: "pasquim", sloganPt: "Fofoca com endereço", sloganEn: "Gossip with an address" },
];


export function ensureMedia(s: GameState): void {
  if ((s as GameState & { media?: MediaState }).media) return;
  (s as GameState & { media: MediaState }).media = {
    outlets: DEFAULT_OUTLETS.slice(),
    headlines: [],
    topicHeat: {
      health: 0, education: 0, transport: 0, tax: 0, corruption: 0,
      housing: 0, security: 0, disaster: 0, environment: 0, economy: 0, works: 0,
    },
    briefingCooldown: 0,
    stats: { herdEvents: 0, briefings: 0, totalHeadlines: 0 },
  };
}

/* ============================================================
 *  Heat sampling — traduz o estado do jogo em pautas quentes
 * ============================================================ */

interface TopicSignal {
  topic: CoverageTopic;
  /** Intensidade objetiva 0..100 (probabilidade de virar pauta). */
  intensity: number;
  /** Ângulo natural do fato (-1 ruim para prefeito, +1 bom). */
  angle: -1 | 0 | 1;
  /** Rótulo curto para uso na manchete. */
  labelPt: string;
  labelEn: string;
}

function sampleSignals(s: GameState): TopicSignal[] {
  const out: TopicSignal[] = [];
  const p = s.policies;
  const ov = s.oversight;
  const pp = s.parallelPower;
  const dis = s.disasters;
  const hou = s.housing;

  // Saúde
  if (p.health < 40) out.push({ topic: "health", intensity: 60 + (40 - p.health), angle: -1, labelPt: "falta de médicos", labelEn: "doctor shortage" });
  else if (p.health > 70) out.push({ topic: "health", intensity: 30 + (p.health - 70), angle: +1, labelPt: "postos reforçados", labelEn: "clinics reinforced" });

  // Educação
  if (p.education < 40) out.push({ topic: "education", intensity: 55, angle: -1, labelPt: "escolas sucateadas", labelEn: "crumbling schools" });
  else if (p.education > 70) out.push({ topic: "education", intensity: 30 + (p.education - 70), angle: +1, labelPt: "avanço no IDEB", labelEn: "test scores up" });

  // Transporte
  if (p.transport < 40) out.push({ topic: "transport", intensity: 55, angle: -1, labelPt: "ônibus lotado", labelEn: "packed buses" });
  else if (p.transport > 70) out.push({ topic: "transport", intensity: 30 + (p.transport - 70), angle: +1, labelPt: "frota ampliada", labelEn: "fleet expanded" });

  // Impostos (compara com baseline 15/8/12)
  const taxSpike = Math.max(0, s.taxes.property - 12) * 6 + Math.max(0, s.taxes.income - 15) * 4;
  if (taxSpike > 15) out.push({ topic: "tax", intensity: Math.min(90, taxSpike), angle: -1, labelPt: "IPTU nas alturas", labelEn: "property tax soars" });
  else if (s.taxes.property < 10 && s.taxes.income < 12) {
    out.push({ topic: "tax", intensity: 28, angle: +1, labelPt: "carga tributária controlada", labelEn: "tax burden held down" });
  }

  // Economia
  if (s.unemployment > 12) out.push({ topic: "economy", intensity: 40 + s.unemployment, angle: -1, labelPt: "desemprego alto", labelEn: "unemployment surges" });
  else if (s.unemployment < 7) out.push({ topic: "economy", intensity: 35 + (7 - s.unemployment) * 4, angle: +1, labelPt: "empregos em alta", labelEn: "jobs on the rise" });
  if (s.inflation > 8)     out.push({ topic: "economy", intensity: 35 + s.inflation * 2, angle: -1, labelPt: "inflação corrói renda", labelEn: "inflation bites" });
  else if (s.inflation < 4) out.push({ topic: "economy", intensity: 25, angle: +1, labelPt: "inflação sob controle", labelEn: "inflation contained" });

  // Corrupção / Oversight
  if (ov) {
    if (ov.mpRisk > 45) out.push({ topic: "corruption", intensity: ov.mpRisk, angle: -1, labelPt: "MP mira prefeitura", labelEn: "prosecutor targets city hall" });
    if (ov.tceRisk > 45) out.push({ topic: "corruption", intensity: ov.tceRisk * 0.8, angle: -1, labelPt: "TCE aponta irregularidades", labelEn: "audit court flags city" });
    if (ov.stalledWorks.length > 0) out.push({ topic: "works", intensity: 40 + ov.stalledWorks.length * 15, angle: -1, labelPt: "obras paradas", labelEn: "stalled works" });
    // Positivo: fiscalização limpa e obras entregues.
    if (ov.mpRisk < 20 && ov.tceRisk < 20 && ov.stalledWorks.length === 0) {
      out.push({ topic: "corruption", intensity: 25, angle: +1, labelPt: "gestão limpa nos órgãos de controle", labelEn: "clean bill from oversight" });
    }
  }

  // Segurança / Poder paralelo
  if (pp && pp.aggregateControl > 20) {
    out.push({ topic: "security", intensity: Math.min(90, 20 + pp.aggregateControl), angle: -1, labelPt: "facções avançam", labelEn: "factions advance" });
  } else if (p.security > 65 && (!pp || pp.aggregateControl < 8)) {
    out.push({ topic: "security", intensity: 30 + (p.security - 65), angle: +1, labelPt: "queda nos índices de crime", labelEn: "crime rates drop" });
  }

  // Desastres — se não há evento e a cidade vem sem tragédia, resiliência vira notícia.
  if (dis?.activeEvent?.active) {
    out.push({ topic: "disaster", intensity: 90, angle: -1, labelPt: "tragédia anunciada", labelEn: "tragedy foretold" });
  } else if (dis && !dis.activeEvent && p.security > 55) {
    out.push({ topic: "disaster", intensity: 22, angle: +1, labelPt: "defesa civil preparada", labelEn: "civil defense ready" });
  }

  // Habitação
  if (hou && hou.gentrificationIndex > 55) {
    out.push({ topic: "housing", intensity: 30 + hou.gentrificationIndex * 0.5, angle: -1, labelPt: "moradores expulsos", labelEn: "residents pushed out" });
  } else if (hou && hou.gentrificationIndex < 25) {
    out.push({ topic: "housing", intensity: 28, angle: +1, labelPt: "moradia acessível", labelEn: "affordable housing holds" });
  }

  // Meio ambiente
  const emissions = s.sustainability?.emissions ?? 50;
  if (emissions > 65) out.push({ topic: "environment", intensity: emissions * 0.6, angle: -1, labelPt: "ar irrespirável", labelEn: "unbreathable air" });
  else if (emissions < 40) out.push({ topic: "environment", intensity: 30, angle: +1, labelPt: "ar mais limpo", labelEn: "cleaner air" });

  // Aprovação e felicidade altas — a rua está satisfeita.
  if (s.approval > 65) {
    out.push({ topic: "economy", intensity: 28 + (s.approval - 65) * 0.4, angle: +1, labelPt: "gestão em alta", labelEn: "administration on the rise" });
  }
  if (s.happiness > 70) {
    out.push({ topic: "works", intensity: 26, angle: +1, labelPt: "cidade mais feliz", labelEn: "happier city" });
  }

  // Superávit fiscal + baixa dívida.
  if (s.treasury > 3_000_000 && s.approval > 50) {
    out.push({ topic: "works", intensity: 30, angle: +1, labelPt: "cidade em obras", labelEn: "city on the build" });
  }
  const debtRatio = (s as GameState & { debtRatio?: number }).debtRatio ?? 0;
  if (s.treasury > 5_000_000 && debtRatio < 0.4) {
    out.push({ topic: "economy", intensity: 26, angle: +1, labelPt: "contas no azul", labelEn: "books in the black" });
  }

  return out;
}

/* ============================================================
 *  Headline templates — por viés e tópico
 * ============================================================ */

function headlineText(bias: MediaBias, topic: CoverageTopic, angle: -1 | 0 | 1, sig: TopicSignal, lang: "pt" | "en"): string {
  const pt = lang === "pt";
  const label = pt ? sig.labelPt : sig.labelEn;

  // Reescreve o mesmo fato com "spin" diferente por viés.
  const templates: Record<MediaBias, { neg: string; pos: string; neu: string }> = {
    sensationalist: {
      neg: pt ? `URGENTE: ${label} vira caos na cidade!` : `URGENT: ${label} throws city into chaos!`,
      pos: pt ? `INCRÍVEL: prefeito faz o que ninguém fez` : `INCREDIBLE: mayor pulls off the impossible`,
      neu: pt ? `O que está por trás de ${label}?` : `What lies behind the ${label}?`,
    },
    government: {
      neg: pt ? `Prefeitura enfrenta ${label} com plano de choque` : `City hall tackles ${label} with shock plan`,
      pos: pt ? `Gestão comemora avanços: ${label}` : `Administration celebrates progress: ${label}`,
      neu: pt ? `Boletim oficial esclarece ${label}` : `Official briefing clarifies ${label}`,
    },
    economic: {
      neg: pt ? `${label} pressiona contas municipais` : `${label} pressures municipal accounts`,
      pos: pt ? `Investidores aprovam rumo da cidade` : `Investors back city's direction`,
      neu: pt ? `Análise: impacto fiscal de ${label}` : `Analysis: fiscal impact of ${label}`,
    },
    community: {
      neg: pt ? `Periferia sofre com ${label}, denunciam moradores` : `Outskirts suffer under ${label}, residents say`,
      pos: pt ? `Bairros populares aplaudem ${label}` : `Working-class neighborhoods applaud ${label}`,
      neu: pt ? `Vozes da quebrada sobre ${label}` : `Voices from the hood on ${label}`,
    },
    opposition: {
      neg: pt ? `Prefeito(a) é responsável por ${label}, dizem opositores` : `Mayor blamed for ${label}, opponents say`,
      pos: pt ? `Mesmo com falhas, prefeitura acerta em ${label}` : `Despite flaws, city gets ${label} right`,
      neu: pt ? `Oposição cobra respostas sobre ${label}` : `Opposition demands answers on ${label}`,
    },
    mainstream: {
      neg: pt ? `JN: cidade enfrenta ${label} em meio à desordem urbana` : `Prime Time: city faces ${label} amid urban disorder`,
      pos: pt ? `Boa noite: obra grandiosa marca nova fase da cidade` : `Good evening: landmark project ushers in new era`,
      neu: pt ? `Reportagem especial analisa ${label}` : `Special report examines ${label}`,
    },
    welfare: {
      neg: pt ? `Programa chora ao vivo: famílias sofrem com ${label}` : `Live tears on air: families suffer under ${label}`,
      pos: pt ? `Prefeitura abraça o povo com programa contra ${label}` : `City hall embraces the people against ${label}`,
      neu: pt ? `Especial solidariedade cobre ${label}` : `Solidarity special covers ${label}`,
    },
    police: {
      neg: pt ? `A hora da verdade: bandidagem por trás de ${label}` : `Truth Hour: crime lurks behind ${label}`,
      pos: pt ? `Operação exemplar põe fim a ${label}` : `Textbook operation puts an end to ${label}`,
      neu: pt ? `Cidade Alerta debate ${label}` : `Crime Watch debates ${label}`,
    },
    urbanNews: {
      neg: pt ? `Plantão 24h: ${label} trava o comércio e o trânsito` : `24h newsroom: ${label} stalls commerce and traffic`,
      pos: pt ? `Boletim econômico: cidade destrava com avanço em ${label}` : `Economic briefing: city unblocks with progress on ${label}`,
      neu: pt ? `Ao vivo do trânsito: como fica ${label}?` : `Live from traffic: what now for ${label}?`,
    },
    favelaRadio: {
      neg: pt ? `Aqui na comunidade: ${label} e a Rede Cubo não noticia` : `From the community: ${label} — Cube Network stays silent`,
      pos: pt ? `Boa notícia da quebrada: mutirão vence ${label}` : `Good news from the hood: community effort beats ${label}`,
      neu: pt ? `Recado do morador: atenção com ${label}` : `Neighbor's word: watch out for ${label}`,
    },
    neighborhoodPaper: {
      neg: pt ? `PASQUIM: ${label} vira caso de rua no bairro` : `PASQUIM: ${label} becomes a street-corner scandal`,
      pos: pt ? `PASQUIM: obra da esquina alegra vizinhança` : `PASQUIM: corner project brightens the block`,
      neu: pt ? `PASQUIM: o que dizem os vizinhos sobre ${label}` : `PASQUIM: what neighbors say about ${label}`,
    },
  };


  const t = templates[bias];
  return angle < 0 ? t.neg : angle > 0 ? t.pos : t.neu;
}

/** Como cada viés reinterpreta o ângulo natural do fato. */
function biasAngle(bias: MediaBias, natural: -1 | 0 | 1): -1 | 0 | 1 {
  switch (bias) {
    case "sensationalist": return natural < 0 ? -1 : natural > 0 ? 0 : -1; // sempre puxa pro drama
    case "government":     return natural < 0 ? 0 : +1;                     // suaviza ou elogia
    case "economic":       return natural;                                  // técnico
    case "community":      return natural;                                  // reflete a rua
    case "opposition":     return natural > 0 ? 0 : -1;                     // nunca elogia
    case "mainstream":     return natural;                                  // "sério" — segue o fato, mas amplifica obra
    case "welfare":        return natural < 0 ? -1 : +1;                    // drama ou celebração, sem meio-termo
    case "police":         return natural < 0 ? -1 : 0;                     // pauta policial não elogia gestão
    case "urbanNews":         return natural;                                  // técnico, foco em mobilidade/economia
    case "favelaRadio":       return natural < 0 ? -1 : natural > 0 ? +1 : -1; // se cala, denuncia
    case "neighborhoodPaper": return natural;                                  // fofoca fiel ao que se vê na rua
  }

}

/* ============================================================
 *  Tick
 * ============================================================ */

export interface MediaTickResult {
  approvalDelta: number;
  happinessDelta: number;
  news: Omit<NewsItem, "id" | "month" | "year" | "day">[];
}

export function tickMedia(s: GameState, rng: RNGLike): MediaTickResult {
  ensureMedia(s);
  const m = (s as GameState & { media: MediaState }).media;
  const res: MediaTickResult = { approvalDelta: 0, happinessDelta: 0, news: [] };

  // 0) Esfriar temas: -15/mês.
  for (const k of Object.keys(m.topicHeat) as CoverageTopic[]) {
    m.topicHeat[k] = Math.max(0, m.topicHeat[k] - 15);
  }
  if (m.briefingCooldown > 0) m.briefingCooldown -= 1;

  // 1) Amostrar sinais e escolher pautas.
  const signals = sampleSignals(s);
  if (signals.length === 0) return res;

  // Cada veículo tenta cobrir uma pauta proporcional à intensidade.
  const monthCoverage: Record<CoverageTopic, { outlets: number; angleSum: number }> = {} as Record<CoverageTopic, { outlets: number; angleSum: number }>;
  const newHeadlines: Headline[] = [];

  for (const outlet of m.outlets) {
    // Roleta ponderada por intensidade + afinidade do viés.
    const weights = signals.map((sig) => {
      const affinity = biasAffinity(outlet.bias, sig.topic);
      return Math.max(0.1, sig.intensity * affinity);
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) continue;
    // 60% de chance do veículo publicar algo no mês.
    if (rng.float() > 0.6 + outlet.reach * 0.3) continue;

    let roll = rng.float() * sum;
    let picked = 0;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { picked = i; break; }
    }
    const sig = signals[picked];
    const angle = biasAngle(outlet.bias, sig.angle);

    // Se estamos em cooldown de briefing e o angle seria negativo, chance de virar neutro.
    const effectiveAngle: -1 | 0 | 1 =
      m.briefingCooldown > 0 && angle < 0 && rng.float() < 0.5 ? 0 : angle;

    const hl: Headline = {
      id: `hl_${s.year}_${s.month}_${outlet.id}_${signals[picked].topic}`,
      outletId: outlet.id,
      bias: outlet.bias,
      topic: sig.topic,
      angle: effectiveAngle,
      textPt: headlineText(outlet.bias, sig.topic, effectiveAngle, sig, "pt"),
      textEn: headlineText(outlet.bias, sig.topic, effectiveAngle, sig, "en"),
      month: s.month,
      year: s.year,
    };
    newHeadlines.push(hl);

    const bucket = monthCoverage[sig.topic] ?? (monthCoverage[sig.topic] = { outlets: 0, angleSum: 0 });
    bucket.outlets += 1;
    bucket.angleSum += effectiveAngle * outlet.reach;

    // Heat imediato do tema (por manchete negativa).
    if (effectiveAngle < 0) m.topicHeat[sig.topic] = Math.min(100, m.topicHeat[sig.topic] + 12);
    if (effectiveAngle > 0) m.topicHeat[sig.topic] = Math.max(0, m.topicHeat[sig.topic] - 4);
  }

  // Easter egg ultra-raro: manchete do Uno com Escada dobrando o espaço-tempo.
  // Frequência menor que o easter egg do Kwid (ver SpriteCityCanvas).
  if (rng.float() < 0.0015 && m.outlets.length > 0) {
    const outlet = m.outlets[Math.floor(rng.float() * m.outlets.length)];
    newHeadlines.push({
      id: `hl_ee_uno_${s.year}_${s.month}_${outlet.id}`,
      outletId: outlet.id,
      bias: outlet.bias,
      topic: "security",
      angle: 0,
      textPt: "Um Uno com escada alcançou velocidades tão altas que dobrou o espaço-tempo e nunca mais foi encontrado.",
      textEn: "A ladder-topped Fiat Uno reached such speeds that it folded spacetime and was never seen again.",
      month: s.month,
      year: s.year,
    });
  }

  // Persistir manchetes (cap 40).
  m.headlines = [...newHeadlines, ...m.headlines].slice(0, 40);
  m.stats.totalHeadlines += newHeadlines.length;


  // 2) Efeito direto na aprovação: soma ponderada dos angles.
  let approvalPush = 0;
  for (const hl of newHeadlines) {
    const outlet = m.outlets.find(o => o.id === hl.outletId)!;
    approvalPush += hl.angle * outlet.reach * 0.8;
  }
  res.approvalDelta += approvalPush;
  res.happinessDelta += approvalPush * 0.4;

  // 3) Efeito Manada: >=3 veículos negativos no MESMO tópico este mês → queda exponencial.
  //    Suprimido durante a janela de graça pós-tour para não afogar o jogador.
  const herdSuppressed = inPostTourGrace(s);
  if (!herdSuppressed) for (const topic of Object.keys(monthCoverage) as CoverageTopic[]) {
    const b = monthCoverage[topic];
    if (b.outlets >= 3 && b.angleSum < -0.8) {
      const heat = m.topicHeat[topic];
      // exponencial: base 1.6 sobre nº de veículos acima do gatilho, escalada pelo heat.
      const bonus = Math.pow(1.6, b.outlets - 2) * (0.6 + heat / 120);
      const hit = Math.min(6, bonus);
      res.approvalDelta -= hit;
      res.happinessDelta -= hit * 0.5;
      m.stats.herdEvents += 1;
      m.lastHerd = { topic, outlets: b.outlets, approvalHit: hit, month: s.month, year: s.year };
      res.news.push({
        kind: "danger",
        titleKey: "news_media_herd",
        detail: s.lang === "pt"
          ? `Efeito manada: ${b.outlets} veículos concentram cobertura negativa em ${topicLabel(topic, "pt")} (−${hit.toFixed(1)} de aprovação).`
          : `Herd effect: ${b.outlets} outlets pile negative coverage on ${topicLabel(topic, "en")} (−${hit.toFixed(1)} approval).`,
      });
    } else if (b.outlets >= 3 && b.angleSum > 0.8) {
      // Efeito manada POSITIVO: 3+ veículos elogiando o mesmo tema puxam a
      // aprovação para cima. Bônus mais modesto que a punição (a imprensa
      // é sempre mais eficiente derrubando do que sustentando).
      const bonus = Math.pow(1.4, b.outlets - 2) * 0.7;
      const gain = Math.min(4, bonus);
      res.approvalDelta += gain;
      res.happinessDelta += gain * 0.5;
      m.stats.herdEvents += 1;
      m.lastHerd = { topic, outlets: b.outlets, approvalHit: -gain, month: s.month, year: s.year };
      res.news.push({
        kind: "info",
        titleKey: "news_media_herd_positive",
        detail: s.lang === "pt"
          ? `Onda positiva: ${b.outlets} veículos destacam ${topicLabel(topic, "pt")} (+${gain.toFixed(1)} de aprovação).`
          : `Positive wave: ${b.outlets} outlets highlight ${topicLabel(topic, "en")} (+${gain.toFixed(1)} approval).`,
      });
    }
  }

  return res;
}

function biasAffinity(bias: MediaBias, topic: CoverageTopic): number {
  const table: Record<MediaBias, Partial<Record<CoverageTopic, number>>> = {
    sensationalist: { security: 1.6, disaster: 1.7, corruption: 1.4, health: 1.2 },
    government:     { works: 1.5, economy: 1.1, education: 1.2 },
    economic:       { tax: 1.7, economy: 1.6, works: 1.2 },
    community:      { housing: 1.7, transport: 1.4, health: 1.3, security: 1.2 },
    opposition:     { corruption: 1.8, works: 1.4, tax: 1.3, disaster: 1.2 },
    mainstream:     { works: 1.6, corruption: 1.4, disaster: 1.3, security: 1.1, economy: 1.1 },
    welfare:        { health: 1.6, education: 1.5, housing: 1.4, disaster: 1.3 },
    police:         { security: 1.9, corruption: 1.3, disaster: 1.1 },
    urbanNews:         { transport: 1.9, economy: 1.5, works: 1.2, environment: 1.1 },
    favelaRadio:       { housing: 1.9, security: 1.7, health: 1.5, disaster: 1.5, transport: 1.2 },
    neighborhoodPaper: { works: 1.6, transport: 1.4, environment: 1.2, housing: 1.3, education: 1.1 },
  };

  return table[bias][topic] ?? 1;
}

function topicLabel(topic: CoverageTopic, lang: "pt" | "en"): string {
  const pt: Record<CoverageTopic, string> = {
    health: "saúde", education: "educação", transport: "transporte", tax: "impostos",
    corruption: "corrupção", housing: "moradia", security: "segurança",
    disaster: "desastres", environment: "meio ambiente", economy: "economia", works: "obras",
  };
  const en: Record<CoverageTopic, string> = {
    health: "health", education: "education", transport: "transport", tax: "taxes",
    corruption: "corruption", housing: "housing", security: "security",
    disaster: "disasters", environment: "environment", economy: "economy", works: "works",
  };
  return (lang === "pt" ? pt : en)[topic];
}

export function topicLabelPublic(topic: CoverageTopic, lang: "pt" | "en"): string {
  return topicLabel(topic, lang);
}

export function biasLabel(bias: MediaBias, lang: "pt" | "en"): string {
  const pt: Record<MediaBias, string> = {
    sensationalist: "Sensacionalista", government: "Governista", economic: "Econômico",
    community: "Comunitário", opposition: "Oposição",
    mainstream: "Líder de audiência", welfare: "Bem-estar", police: "Policial", urbanNews: "Trânsito & Economia",
    favelaRadio: "Rádio comunitária", neighborhoodPaper: "Jornal de bairro",
  };
  const en: Record<MediaBias, string> = {
    sensationalist: "Sensationalist", government: "Pro-government", economic: "Economic",
    community: "Community", opposition: "Opposition",
    mainstream: "Prime-time", welfare: "Welfare TV", police: "Crime desk", urbanNews: "Traffic & Economy",
    favelaRadio: "Community radio", neighborhoodPaper: "Neighborhood paper",
  };
  return (lang === "pt" ? pt : en)[bias];
}


/* ============================================================
 *  Player action: Pronunciamento Oficial
 * ============================================================ */

export const BRIEFING_COST = 250_000;
export const BRIEFING_CP = 10;

export function officialBriefing(state: GameState): GameState {
  ensureMedia(state);
  const m = (state as GameState & { media: MediaState }).media;
  if (state.treasury < BRIEFING_COST) return state;
  const politicsExt = state.politics as unknown as { politicalCapital?: number } | undefined;
  const pc = politicsExt?.politicalCapital ?? 0;
  if (pc < BRIEFING_CP) return state;

  const next: GameState = { ...state, treasury: state.treasury - BRIEFING_COST };
  const nm: MediaState = {
    ...m,
    briefingCooldown: 3,
    stats: { ...m.stats, briefings: m.stats.briefings + 1 },
    topicHeat: { ...m.topicHeat },
  };
  for (const k of Object.keys(nm.topicHeat) as CoverageTopic[]) {
    nm.topicHeat[k] = Math.max(0, nm.topicHeat[k] - 30);
  }
  next.approval = Math.min(100, state.approval + 1.5);
  if (next.politics) {
    const p = next.politics as unknown as { politicalCapital?: number };
    next.politics = { ...next.politics };
    (next.politics as unknown as { politicalCapital: number }).politicalCapital =
      (p.politicalCapital ?? 0) - BRIEFING_CP;
  }
  (next as GameState & { media: MediaState }).media = nm;
  return next;
}
