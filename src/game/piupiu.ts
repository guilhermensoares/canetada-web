/**
 * PiuPiu — rede social satírica (X/Twitter) para o simulador municipal.
 *
 * - Feed cronológico de posts de NPCs reagindo às ações do prefeito.
 * - Trending Topics (hashtags) com "heat" que decai e escala.
 * - Picos de cancelamento: gatilhos como #ForaPrefeito e #VergonhaMunicipal.
 * - Amplificação pela mídia clássica se hashtag negativa ficar 6h no Top 5.
 * - Gabinete de Comunicação: nota oficial, humor, envio de equipes.
 */
import type { GameState } from "./types";

/* ---------------- Tipos ---------------- */

export type PiuPiuHashtag = string; // sempre com # prefix

export type PiuPiuSentiment = "positive" | "neutral" | "negative" | "outrage";

export type PiuPiuArchetype =
  | "militante_plab"    // Partido de Zuza — esquerda
  | "patriota_cidadao"  // Partido de Miro — direita/moralista
  | "faria_limer"       // Partido de Fefê — liberal/tech
  | "fiscal_transito"   // influenciador de mobilidade
  | "deboche_municipal"; // página de humor/memes

export interface PiuPiuAuthor {
  handle: string;   // @manoloko
  name: string;
  avatar: string;   // emoji
  followers: number;
  verified: boolean;
  kind: "citizen" | "journalist" | "influencer" | "politician" | "official" | "meme" | "activist";
  archetype?: PiuPiuArchetype;
}

export interface PiuPiuPost {
  id: string;
  author: PiuPiuAuthor;
  textPt: string;
  textEn: string;
  hashtags: PiuPiuHashtag[];
  createdAt: number;    // game-time in hours since campaign start
  likes: number;
  reposts: number;
  replies: number;
  sentiment: PiuPiuSentiment;
  triggerId?: string;   // vincula ao evento gatilho
  mediaKind?: "photo" | "video" | "none";
}

export interface PiuPiuTrend {
  hashtag: PiuPiuHashtag;
  heat: number;          // 0..1000, cai 15%/hora
  volume: number;        // total de posts com a hashtag
  sentiment: PiuPiuSentiment;
  peakedAt?: number;     // hora em que entrou no top 5
  hoursInTop5: number;   // acumulador
  amplifiedByPress: boolean;
  isCancelWave: boolean; // #ForaPrefeito, #VergonhaMunicipal, etc.
}

export interface CancelTrigger {
  id: string;
  kind:
    | "bus_broken_rain"
    | "traffic_light_out"
    | "tree_cut"
    | "flood_neglect"
    | "vaccine_shortage"
    | "police_abuse"
    | "corruption_leak"
    | "school_meal_lack";
  descPt: string;
  descEn: string;
  createdAt: number;
  deadlineHours: number; // tempo para o prefeito responder antes de escalar
  responded: boolean;
  responseKind?: "official_note" | "humor" | "field_team" | null;
  responseAt?: number;
  hashtags: PiuPiuHashtag[]; // hashtags negativas geradas se escalar
  severity: 1 | 2 | 3;       // 1 leve, 3 crítica
  escalated: boolean;
  /** Passou muito tempo escalado sem resposta — sai do painel de ativos. */
  expired?: boolean;
  /** Canal Videosfera que instigou/turbina a crise (ex.: "vs_dandoboura"). */
  instigatorId?: string;
}

export interface PiuPiuState {
  posts: PiuPiuPost[];           // ring buffer de 60
  trends: PiuPiuTrend[];         // ordenado por heat desc
  triggers: CancelTrigger[];     // ativos + resolvidos recentes (30)
  clock: number;                 // hora do jogo (day*24 + hour approx)
  officialFollowers: number;     // seguidores do @Prefeitura
  humorStock: number;            // 0..3, cooldown do humor (regenera 1/mês)
  fieldTeamsUsed: number;        // no mês atual
  unread: number;                // posts não lidos
  lastAmplification?: {
    hashtag: PiuPiuHashtag;
    approvalHit: number;
    at: number;
  };
  totalCancelPeaks: number;      // stat de campanha
  totalReversals: number;        // crises revertidas com sucesso
  /** Contador de crises resolvidas com sucesso instigadas por Dando Boura. */
  dandoBouraResolved?: number;
  /** Horas restantes até que uma crise do mesmo tipo possa reaparecer. */
  triggerCooldowns?: Partial<Record<CancelTrigger["kind"], number>>;
  /** Horas restantes até que QUALQUER nova crise possa surgir (respiro global). */
  globalCooldown?: number;
}

/* ---------------- Constantes ---------------- */

const HEAT_DECAY_PER_HOUR = 0.85;    // 15% de perda/hora
const TOP5_AMPLIFY_HOURS = 6;        // 6h no top 5 => mídia clássica amplifica
const AMPLIFY_APPROVAL_MULT = 3.0;   // até 300% de multiplicação na queda
/**
 * Prazo BASE de resposta por severidade. A janela real recebe um jitter
 * (±25%) dependendo do tipo de incidente para variar a complexidade.
 */
const RESPONSE_WINDOW_HOURS: Record<CancelTrigger["severity"], number> = {
  1: 48,
  2: 30,
  3: 18,
};
/** Multiplicador de prazo por tipo — decisões técnicas dão mais folga. */
const KIND_DEADLINE_MULT: Record<CancelTrigger["kind"], number> = {
  bus_broken_rain:   0.8,  // urgente
  traffic_light_out: 0.9,
  tree_cut:          1.2,  // decisão política, dá mais tempo
  flood_neglect:     1.1,
  vaccine_shortage:  0.9,
  police_abuse:      0.7,  // muito urgente
  corruption_leak:   1.3,  // exige apuração
  school_meal_lack:  1.0,
};

const CANCEL_HASHTAGS: Record<CancelTrigger["kind"], PiuPiuHashtag[]> = {
  bus_broken_rain:    ["#CadêOÔnibus", "#VergonhaMunicipal"],
  traffic_light_out:  ["#SemaforoQuebrado", "#PrefeituraAusente"],
  tree_cut:           ["#MotoserraNaCidade", "#ForaPrefeito"],
  flood_neglect:      ["#CadêOSaneamento", "#ForaPrefeito"],
  vaccine_shortage:   ["#SaudePrecarizada", "#VergonhaMunicipal"],
  police_abuse:       ["#PoliciaCriminosa", "#ForaPrefeito"],
  corruption_leak:    ["#Roubalheira", "#ForaPrefeito"],
  school_meal_lack:   ["#MerendaVazia", "#EducaçãoAbandonada"],
};

const AUTHORS_POOL: PiuPiuAuthor[] = [
  { handle: "@manoloko",    name: "Manoloko Silva",     avatar: "😤", followers: 1_200,     verified: false, kind: "citizen" },
  { handle: "@dona_zefa",   name: "Dona Zefa",          avatar: "👵", followers: 340,       verified: false, kind: "citizen" },
  { handle: "@brenda_zn",   name: "Brenda ZN",          avatar: "💅", followers: 22_400,    verified: false, kind: "influencer" },
  { handle: "@joao_do_bar", name: "João do Bar",        avatar: "🍺", followers: 780,       verified: false, kind: "citizen" },
  { handle: "@repórter_x",  name: "Repórter X",         avatar: "🎤", followers: 65_000,    verified: true,  kind: "journalist" },
  { handle: "@datenão",     name: "Datenão Ao Vivo",    avatar: "📢", followers: 340_000,   verified: true,  kind: "journalist" },
  { handle: "@mc_periferia",name: "MC Periferia",       avatar: "🎧", followers: 480_000,   verified: true,  kind: "influencer" },
  { handle: "@ver_bostinha",name: "Ver. Bostinha",      avatar: "🕴️", followers: 12_500,    verified: true,  kind: "politician" },
  { handle: "@meme_da_zona",name: "Meme da Zona",       avatar: "🤡", followers: 890_000,   verified: false, kind: "meme" },
  { handle: "@tia_do_zap",  name: "Tia do Zap",         avatar: "📱", followers: 210,       verified: false, kind: "citizen" },
  { handle: "@engenheiro",  name: "Eng. Camargo",       avatar: "👷", followers: 4_300,     verified: false, kind: "citizen" },
  { handle: "@ativista",    name: "Ativista Coletivo",  avatar: "✊", followers: 33_000,    verified: false, kind: "citizen" },
  // ===== NPCs satíricos com narrativa própria =====
  { handle: "@MilitanteDoPLab",  name: "Militante do PLab",  avatar: "🚩", followers: 88_000,  verified: false, kind: "activist",   archetype: "militante_plab" },
  { handle: "@PatriotaCidadão",  name: "Patriota Cidadão",   avatar: "🇧🇷", followers: 142_000, verified: false, kind: "activist",   archetype: "patriota_cidadao" },
  { handle: "@FariaLimerTecno",  name: "Faria Limer Tecno",  avatar: "📈", followers: 61_500,  verified: true,  kind: "activist",   archetype: "faria_limer" },
  { handle: "@FiscalDoTrânsito", name: "Fiscal do Trânsito", avatar: "🚦", followers: 500_000, verified: true,  kind: "influencer", archetype: "fiscal_transito" },
  { handle: "@DebocheMunicipal", name: "Deboche Municipal",  avatar: "🤪", followers: 1_200_000,verified: false, kind: "meme",       archetype: "deboche_municipal" },
];

const OFFICIAL_AUTHOR: PiuPiuAuthor = {
  handle: "@Prefeitura",
  name: "Prefeitura Municipal",
  avatar: "🏛️",
  followers: 45_000,
  verified: true,
  kind: "official",
};

/* ---------------- Utilidades ---------------- */

function nowHours(s: GameState): number {
  return (s.year * 12 + s.month) * 30 * 24 + s.day * 24;
}

function nid(prefix: string, s: GameState): string {
  s.rngCursor++;
  return `${prefix}_${s.rngCursor.toString(36)}`;
}

function pickAuthor(rng: () => number, bias?: PiuPiuAuthor["kind"]): PiuPiuAuthor {
  const pool = bias ? AUTHORS_POOL.filter(a => a.kind === bias) : AUTHORS_POOL;
  const arr = pool.length ? pool : AUTHORS_POOL;
  return arr[Math.floor(rng() * arr.length)];
}

function trimBuffer<T>(arr: T[], max: number): T[] {
  return arr.length > max ? arr.slice(arr.length - max) : arr;
}

/* ---------------- Bootstrap ---------------- */

export function defaultPiuPiu(): PiuPiuState {
  return {
    posts: [],
    trends: [],
    triggers: [],
    clock: 0,
    officialFollowers: 45_000,
    humorStock: 2,
    fieldTeamsUsed: 0,
    unread: 0,
    totalCancelPeaks: 0,
    totalReversals: 0,
    dandoBouraResolved: 0,
    triggerCooldowns: {},
  };
}

export function ensurePiuPiu(s: GameState): PiuPiuState {
  if (!s.piupiu) s.piupiu = defaultPiuPiu();
  return s.piupiu;
}

/* ---------------- Trends ---------------- */

function bumpTrend(
  p: PiuPiuState,
  hashtag: PiuPiuHashtag,
  heatDelta: number,
  sentiment: PiuPiuSentiment,
  isCancel = false,
): void {
  let t = p.trends.find(x => x.hashtag === hashtag);
  if (!t) {
    t = {
      hashtag,
      heat: 0,
      volume: 0,
      sentiment,
      hoursInTop5: 0,
      amplifiedByPress: false,
      isCancelWave: isCancel,
    };
    p.trends.push(t);
  }
  t.heat = Math.min(1000, t.heat + heatDelta);
  t.volume += 1;
  if (sentiment === "outrage" || sentiment === "negative") t.sentiment = sentiment;
  if (isCancel) t.isCancelWave = true;
}

function sortTrends(p: PiuPiuState): void {
  p.trends.sort((a, b) => b.heat - a.heat);
  // manter no máximo 15 tendências ativas
  if (p.trends.length > 15) p.trends = p.trends.slice(0, 15);
}

/* ---------------- Post generation ---------------- */

const NEUTRAL_TEMPLATES: Array<{ pt: string; en: string }> = [
  { pt: "trânsito na Radial parece que engoliu o mundo hoje 🙃", en: "traffic on the Radial ate the world today 🙃" },
  { pt: "alguém sabe se a feira vai abrir sábado?", en: "anyone know if the market opens saturday?" },
  { pt: "o café da esquina subiu de novo, tá loco", en: "corner coffee went up again, insane" },
  { pt: "chegou a conta de luz e eu chorei", en: "power bill came and i cried" },
];

const POSITIVE_TEMPLATES: Array<{ pt: string; en: string; hashtags: PiuPiuHashtag[] }> = [
  { pt: "confesso que o novo BRT tá voando, obrigado prefeitura 🚌", en: "gotta admit the new BRT is flying, thanks city hall 🚌", hashtags: ["#PrefeitoTrabalha"] },
  { pt: "olha o parque novo que lindo 🌳✨", en: "look at the new park, gorgeous 🌳✨", hashtags: ["#CidadeMelhor"] },
  { pt: "postinho de saúde reformado, atendimento decente pela primeira vez", en: "clinic renovated, decent care for the first time", hashtags: ["#PrefeitoTrabalha"] },
];

function makeIncidentText(kind: CancelTrigger["kind"]): { pt: string; en: string; mediaKind: PiuPiuPost["mediaKind"] } {
  const t: Record<CancelTrigger["kind"], { pt: string; en: string; mediaKind: PiuPiuPost["mediaKind"] }> = {
    bus_broken_rain: {
      pt: "ônibus PAROU no meio da enxurrada, todo mundo com água até o joelho, cadê o prefeito?? 📹",
      en: "bus STOPPED in the flood, everyone knee-deep, where's the mayor?? 📹",
      mediaKind: "video",
    },
    traffic_light_out: {
      pt: "semáforo apagado há 4h na Avenida Central, acidente iminente 🚨",
      en: "traffic light out for 4h on Central Ave, crash waiting to happen 🚨",
      mediaKind: "photo",
    },
    tree_cut: {
      pt: "acabaram de derrubar a jaqueira de 80 anos sem AVISO. Assassinos 🌳💔",
      en: "they just cut down the 80-year jackfruit tree with NO NOTICE. Killers 🌳💔",
      mediaKind: "photo",
    },
    flood_neglect: {
      pt: "meu bairro alaga TODA VEZ que chove. Cadê o piscinão prometido?",
      en: "my neighborhood floods EVERY time it rains. Where's the promised drain?",
      mediaKind: "video",
    },
    vaccine_shortage: {
      pt: "UBS sem vacina de novo. Trouxe minha filha e mandaram voltar amanhã 😡",
      en: "clinic out of vaccines again. Brought my daughter and they told me to come back tomorrow 😡",
      mediaKind: "photo",
    },
    police_abuse: {
      pt: "abordagem violenta na parada de ônibus, tô com o vídeo 📹",
      en: "violent stop at the bus terminal, i got video 📹",
      mediaKind: "video",
    },
    corruption_leak: {
      pt: "vazou planilha da secretaria — nota fiscal fantasma de R$ 2mi",
      en: "leaked spreadsheet from the secretariat — R$ 2M ghost invoice",
      mediaKind: "photo",
    },
    school_meal_lack: {
      pt: "meu filho voltou da escola com fome, disseram que não tem merenda 🍽️",
      en: "my kid came home hungry, they said there's no school meal 🍽️",
      mediaKind: "photo",
    },
  };
  return t[kind];
}

function postFromTrigger(p: PiuPiuState, s: GameState, rng: () => number, trg: CancelTrigger): PiuPiuPost {
  const author = pickAuthor(rng, rng() < 0.3 ? "journalist" : "citizen");
  const txt = makeIncidentText(trg.kind);
  const reach = author.followers;
  const likes = Math.round(reach * (0.02 + rng() * 0.08));
  const post: PiuPiuPost = {
    id: nid("p", s),
    author,
    textPt: txt.pt,
    textEn: txt.en,
    hashtags: trg.hashtags.slice(0, 2),
    createdAt: p.clock,
    likes,
    reposts: Math.round(likes * (0.15 + rng() * 0.35)),
    replies: Math.round(likes * 0.05),
    sentiment: trg.severity >= 2 ? "outrage" : "negative",
    triggerId: trg.id,
    mediaKind: txt.mediaKind,
  };
  return post;
}

function postAmbient(p: PiuPiuState, s: GameState, rng: () => number): PiuPiuPost | null {
  // decide sentimento com base em happiness/approval
  const mood = (s.happiness + s.approval) / 200;
  const roll = rng();
  const author = pickAuthor(rng);
  const reach = author.followers;
  const likes = Math.round(reach * (0.005 + rng() * 0.04));
  if (roll < 0.15 && mood > 0.55) {
    const tpl = POSITIVE_TEMPLATES[Math.floor(rng() * POSITIVE_TEMPLATES.length)];
    return {
      id: nid("p", s),
      author,
      textPt: tpl.pt,
      textEn: tpl.en,
      hashtags: tpl.hashtags,
      createdAt: p.clock,
      likes, reposts: Math.round(likes * 0.1), replies: Math.round(likes * 0.03),
      sentiment: "positive",
      mediaKind: "none",
    };
  }
  if (roll > 0.85 || mood < 0.4) {
    // desabafo neutro-negativo
    const tpl = NEUTRAL_TEMPLATES[Math.floor(rng() * NEUTRAL_TEMPLATES.length)];
    return {
      id: nid("p", s),
      author,
      textPt: tpl.pt,
      textEn: tpl.en,
      hashtags: [],
      createdAt: p.clock,
      likes, reposts: Math.round(likes * 0.05), replies: Math.round(likes * 0.02),
      sentiment: mood < 0.4 ? "negative" : "neutral",
      mediaKind: "none",
    };
  }
  return null;
}

/* ---------------- NPCs satíricos (arquétipos partidários) ---------------- */

interface ArchetypeTemplate {
  pt: string;
  en: string;
  tags: string[];
  sentiment: PiuPiuSentiment;
}

/** Um post arquétipo com base em sinais do jogo. Retorna null se nada relevante para postar. */
function pickArchetypePost(
  archetype: PiuPiuArchetype,
  s: GameState,
  rng: () => number,
): ArchetypeTemplate | null {
  const T = s.transport as unknown as { cyclewayKm?: number; brtCorridors?: number; split?: { congestion?: number }; modes?: Record<string, { quality?: number }> };
  const cycleKm = T?.cyclewayKm ?? 0;
  const informal = (s.informal as unknown as { vendors?: number })?.vendors ?? 0;
  const taxes = s.taxes;
  const ipuIndex = taxes?.property ?? 5;
  const iss = taxes?.business ?? 5;
  const traffic = T?.split?.congestion ?? 0;
  const busQ = T?.modes?.bus?.quality ?? 55;
  const busUnrel = Math.max(0, (100 - busQ) / 100);
  const potholes = Math.max(0, 100 - (s.happiness ?? 60)) / 100;

  switch (archetype) {
    case "militante_plab": {
      const opts: ArchetypeTemplate[] = [];
      if (ipuIndex >= 6) opts.push({
        pt: "IPTU nas alturas, escola sem merenda. Prefeitura serve a QUEM? #ForaNeoliberais #TarifaZero",
        en: "Property tax up, no school meals. Who does this city serve? #OutNeoliberals #FreeFares",
        tags: ["#ForaNeoliberais", "#TarifaZero"],
        sentiment: "outrage",
      });
      if (T?.brtCorridors && T.brtCorridors > 0) opts.push({
        pt: "BRT no eixo rico, ônibus quebrado na periferia. Gentrificação elitista em curso. #TransportePraQuem",
        en: "BRT in rich areas, broken buses in the outskirts. Elitist gentrification. #TransportForWhom",
        tags: ["#TransportePraQuem", "#GentrificaçãoJá"],
        sentiment: "negative",
      });
      opts.push({
        pt: "Enquanto a Faria Lima brinda, a periferia paga a conta. #ImpostoDoPovo",
        en: "While the elite toast, the outskirts pay the bill. #PeoplesTax",
        tags: ["#ImpostoDoPovo"],
        sentiment: "negative",
      });
      return opts[Math.floor(rng() * opts.length)];
    }
    case "patriota_cidadao": {
      const opts: ArchetypeTemplate[] = [];
      if (cycleKm > 2) opts.push({
        pt: `Mais uma CICLOVIA? Ideologia de gênero sobre rodas! Cadê a Guarda Municipal? #ChegaDeCiclovia`,
        en: `Another BIKE LANE? Gender ideology on wheels! Where's the Municipal Guard? #NoMoreBikeLanes`,
        tags: ["#ChegaDeCiclovia", "#GuardaJá"],
        sentiment: "negative",
      });
      if (informal > 0.3) opts.push({
        pt: "Ambulantes em toda esquina, anarquismo urbano! Cadê a ordem? #OrdemEProgresso",
        en: "Street vendors on every corner, urban anarchy! Where's law and order? #OrderAndProgress",
        tags: ["#OrdemEProgresso", "#ChegaDeCamelô"],
        sentiment: "outrage",
      });
      opts.push({
        pt: "Prefeito acha que cidade é ONG. QUERO POLÍCIA NA RUA! 🇧🇷",
        en: "Mayor thinks the city is an NGO. I WANT POLICE ON THE STREETS! 🇧🇷",
        tags: ["#PolíciaNaRua"],
        sentiment: "negative",
      });
      return opts[Math.floor(rng() * opts.length)];
    }
    case "faria_limer": {
      const opts: ArchetypeTemplate[] = [];
      if (iss >= 5 || ipuIndex >= 5) opts.push({
        pt: "Carga tributária municipal é UM ABSURDO. Desburocratize já! 📊 #ChegaDeImposto",
        en: "Municipal tax load is ABSURD. Deregulate now! 📊 #EnoughTax",
        tags: ["#ChegaDeImposto", "#Desburocratiza"],
        sentiment: "negative",
      });
      opts.push({
        pt: "Folha de pagamento da prefeitura = 65% do orçamento. PRIVATIZE OS PARQUES já! 📈",
        en: "Municipal payroll = 65% of budget. PRIVATIZE THE PARKS now! 📈",
        tags: ["#PrivatizaJá", "#EstadoMínimo"],
        sentiment: "negative",
      });
      opts.push({
        pt: "PPP na iluminação pública gera EBITDA de 3 dígitos. Bora modernizar? #EficiênciaFiscal",
        en: "Public-lighting PPP delivers 3-digit EBITDA. Let's modernize? #FiscalEfficiency",
        tags: ["#EficiênciaFiscal"],
        sentiment: "neutral",
      });
      return opts[Math.floor(rng() * opts.length)];
    }
    case "fiscal_transito": {
      const opts: ArchetypeTemplate[] = [];
      if (traffic > 55) opts.push({
        pt: `🚗 TRÂNSITO PARADO na avenida principal. Semáforo dessincronizado há SEMANAS. Faz alguma coisa, prefeito!`,
        en: `🚗 TRAFFIC LOCKED on the main avenue. Signals out of sync for WEEKS. Do something, mayor!`,
        tags: ["#TrânsitoCaótico", "#CadêSemáforo"],
        sentiment: "negative",
      });
      if (busUnrel > 0.35) opts.push({
        pt: "Linha 8080 atrasa 47 min. Terceiro dia seguido. Vídeo em anexo. 📹 #ÔnibusNão",
        en: "Line 8080 delayed 47 min. Third day in a row. Video attached. 📹 #NoBusNoLife",
        tags: ["#ÔnibusNão", "#TransportePúblico"],
        sentiment: "outrage",
      });
      if (potholes > 0.4) opts.push({
        pt: "Buraco na Av. Central come CARRO INTEIRO. Documentei aqui 📸 quem paga o pneu? #BuracoDaSemana",
        en: "Pothole on Central Ave EATS A WHOLE CAR. Documented here 📸 who pays the tire? #PotholeOfTheWeek",
        tags: ["#BuracoDaSemana", "#OndeMoraOIPTU"],
        sentiment: "outrage",
      });
      if (cycleKm < 5) opts.push({
        pt: "Cidade sem ciclovia é cidade do século passado. Vamos mudar isso 🚴",
        en: "A city without bike lanes belongs to the last century. Let's change that 🚴",
        tags: ["#CicloviaAgora"],
        sentiment: "negative",
      });
      return opts.length ? opts[Math.floor(rng() * opts.length)] : null;
    }
    case "deboche_municipal": {
      // memes: reagem se há triggers ativos ou crises leves
      const active = s.piupiu?.triggers.filter(t => !t.responded && !t.expired) ?? [];
      const opts: ArchetypeTemplate[] = [
        {
          pt: "🐹 CAPIVARA nadando na Marginal virou meu novo prefeito honorário. Bem-vinda ao caos, majestade.",
          en: "🐹 CAPYBARA swimming on the Marginal is my new honorary mayor. Welcome to the chaos, your majesty.",
          tags: ["#CapivaraPrefeita"],
          sentiment: "neutral",
        },
        {
          pt: "Prefeitura anuncia obra. Obra atrasa. Prefeitura anuncia inauguração. Obra não inaugura. Ciclo do carbono municipal 🔁",
          en: "City hall announces works. Works delay. City hall announces opening. Nothing opens. Municipal carbon cycle 🔁",
          tags: ["#ObraQueNãoAcaba"],
          sentiment: "neutral",
        },
      ];
      if (active.length > 0) opts.push({
        pt: `Prefeito hoje: "não sabia". Todo mundo hoje: 🤡🤡🤡 #${active[0].kind.replace(/_/g, "")}`,
        en: `Mayor today: "didn't know". Everyone today: 🤡🤡🤡`,
        tags: ["#PrefeitoNãoSabia"],
        sentiment: "neutral",
      });
      return opts[Math.floor(rng() * opts.length)];
    }
  }
}

/** Retorna um post arquétipo se algum NPC tiver algo a dizer nesta hora. */
function postArchetype(p: PiuPiuState, s: GameState, rng: () => number): PiuPiuPost | null {
  const archetypes: PiuPiuArchetype[] = [
    "militante_plab", "patriota_cidadao", "faria_limer",
    "fiscal_transito", "deboche_municipal",
  ];
  const arch = archetypes[Math.floor(rng() * archetypes.length)];
  const author = AUTHORS_POOL.find(a => a.archetype === arch);
  if (!author) return null;
  const tpl = pickArchetypePost(arch, s, rng);
  if (!tpl) return null;
  const reach = author.followers;
  const engagement = (tpl.sentiment === "outrage" ? 0.12 : tpl.sentiment === "negative" ? 0.06 : 0.03);
  const likes = Math.round(reach * (engagement + rng() * 0.05));
  return {
    id: nid("p", s),
    author,
    textPt: tpl.pt,
    textEn: tpl.en,
    hashtags: tpl.tags,
    createdAt: p.clock,
    likes,
    reposts: Math.round(likes * 0.25),
    replies: Math.round(likes * 0.08),
    sentiment: tpl.sentiment,
    mediaKind: arch === "fiscal_transito" ? "photo" : arch === "deboche_municipal" ? "photo" : "none",
  };
}


function pushPost(p: PiuPiuState, post: PiuPiuPost): void {
  // Deduplicação leve: evita empurrar texto idêntico ao dos últimos 8 posts.
  const recent = p.posts.slice(-8);
  if (recent.some(pp => pp.textPt === post.textPt)) return;
  p.posts.push(post);
  p.posts = trimBuffer(p.posts, 60);
  p.unread = Math.min(99, p.unread + 1);
  const heat = Math.log10(Math.max(10, post.author.followers)) * 20 + Math.log10(Math.max(1, post.likes + post.reposts * 3)) * 10;
  for (const h of post.hashtags) {
    bumpTrend(p, h, heat, post.sentiment, post.sentiment === "outrage");
  }
}

/* ---------------- Triggers ---------------- */

/** Máximo de crises simultâneas abertas — evita afogar o jogador. */
const MAX_ACTIVE_TRIGGERS = 2;

function maybeSpawnTrigger(p: PiuPiuState, s: GameState, rng: () => number): void {
  // Respiro global: nada nasce enquanto o cooldown geral não zerar.
  if ((p.globalCooldown ?? 0) > 0) return;

  const active = p.triggers.filter(t => !t.responded && !t.expired);
  if (active.length >= MAX_ACTIVE_TRIGGERS) return;

  // probabilidade baseada em happiness/approval e infraestrutura
  const mood = (s.happiness + s.approval) / 200; // 0..1
  const baseProb = 0.012 + (1 - mood) * 0.035;
  if (rng() > baseProb) return;

  if (!p.triggerCooldowns) p.triggerCooldowns = {};

  const allKinds: CancelTrigger["kind"][] = [
    "bus_broken_rain", "traffic_light_out", "tree_cut",
    "flood_neglect", "vaccine_shortage", "police_abuse",
    "corruption_leak", "school_meal_lack",
  ];
  // Evita gerar tipo já ativo (não respondido e não expirado) ou em cooldown.
  const activeKinds = new Set(active.map(t => t.kind));
  const kinds = allKinds.filter(
    k => !activeKinds.has(k) && (p.triggerCooldowns![k] ?? 0) <= 0,
  );
  if (kinds.length === 0) return;

  const kind = kinds[Math.floor(rng() * kinds.length)];
  const sev: 1 | 2 | 3 = rng() < 0.15 ? 3 : rng() < 0.55 ? 1 : 2;
  // Prazo varia por severidade × tipo × jitter (0.85..1.15).
  const jitter = 0.85 + rng() * 0.3;
  const deadline = Math.max(
    2,
    Math.round(RESPONSE_WINDOW_HOURS[sev] * KIND_DEADLINE_MULT[kind] * jitter),
  );
  // ~35% de chance de crises graves de temas sensíveis serem "puxadas" pelo
  // vlogger raivoso Dando Boura — vira o gancho do easter egg da altura.
  const dandoKinds = new Set<CancelTrigger["kind"]>([
    "police_abuse", "corruption_leak", "vaccine_shortage", "school_meal_lack",
  ]);
  const instigatedByDando =
    sev >= 2 && dandoKinds.has(kind) && rng() < 0.35;

  const baseDescPt = makeIncidentText(kind).pt;
  const baseDescEn = makeIncidentText(kind).en;
  const trg: CancelTrigger = {
    id: nid("trg", s),
    kind,
    descPt: instigatedByDando ? `Dando Boura ataca: ${baseDescPt}` : baseDescPt,
    descEn: instigatedByDando ? `Dando Boura attacks: ${baseDescEn}` : baseDescEn,
    createdAt: p.clock,
    deadlineHours: deadline,
    responded: false,
    hashtags: CANCEL_HASHTAGS[kind],
    severity: sev,
    escalated: false,
    instigatorId: instigatedByDando ? "vs_dandoboura" : undefined,
  };
  p.triggers.push(trg);
  p.triggers = trimBuffer(p.triggers, 30);
  // Cooldown: nenhum outro incidente do mesmo tipo por ~6x o prazo.
  p.triggerCooldowns[kind] = deadline * 6;
  // Respiro global: pelo menos ~1,5x o prazo antes da próxima crise qualquer.
  p.globalCooldown = Math.round(deadline * 1.5);
  // 1-3 posts iniciais do incidente
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) pushPost(p, postFromTrigger(p, s, rng, trg));
}

function tickTriggers(p: PiuPiuState, s: GameState, rng: () => number): { approvalHit: number } {
  let approvalHit = 0;
  for (const trg of p.triggers) {
    if (trg.responded || trg.expired) continue;
    const elapsed = p.clock - trg.createdAt;
    // gerar mais posts enquanto o incidente é fresco
    if (!trg.escalated && elapsed <= trg.deadlineHours && rng() < 0.35) {
      pushPost(p, postFromTrigger(p, s, rng, trg));
    }
    // escalação: passou do prazo sem resposta => vira pico de cancelamento
    if (!trg.escalated && elapsed > trg.deadlineHours) {
      trg.escalated = true;
      p.totalCancelPeaks++;
      // rajada de posts com hashtags de cancelamento
      const n = 3 + trg.severity * 2;
      for (let i = 0; i < n; i++) {
        const author = pickAuthor(rng, rng() < 0.4 ? "influencer" : "citizen");
        const first = trg.hashtags[0];
        const post: PiuPiuPost = {
          id: nid("p", s),
          author,
          textPt: `INACREDITÁVEL. ${trg.descPt} ${trg.hashtags.join(" ")}`,
          textEn: `UNBELIEVABLE. ${trg.descEn} ${trg.hashtags.join(" ")}`,
          hashtags: trg.hashtags,
          createdAt: p.clock,
          likes: Math.round(author.followers * (0.05 + rng() * 0.12)),
          reposts: Math.round(author.followers * (0.03 + rng() * 0.08)),
          replies: Math.round(author.followers * 0.01),
          sentiment: "outrage",
          triggerId: trg.id,
          mediaKind: "photo",
        };
        pushPost(p, post);
        // boost extra na hashtag principal
        bumpTrend(p, first, 250, "outrage", true);
      }
      approvalHit += 0.8 * trg.severity;
    }
    // Expiração: depois de escalar por muito tempo sem resposta, arquiva.
    if (trg.escalated && elapsed > trg.deadlineHours * 3) {
      trg.expired = true;
    }
  }
  return { approvalHit };
}

/* ---------------- Amplificação pela mídia ---------------- */

function tickAmplification(p: PiuPiuState, s: GameState): { approvalHit: number } {
  sortTrends(p);
  const top5 = p.trends.slice(0, 5);
  let approvalHit = 0;
  for (const t of p.trends) {
    const inTop5 = top5.includes(t);
    if (inTop5) {
      if (t.peakedAt === undefined) t.peakedAt = p.clock;
      t.hoursInTop5 += 1;
      if (!t.amplifiedByPress && t.isCancelWave && t.hoursInTop5 >= TOP5_AMPLIFY_HOURS) {
        t.amplifiedByPress = true;
        const baseHit = 1.2 * (t.sentiment === "outrage" ? 1 : 0.6);
        const amp = baseHit * AMPLIFY_APPROVAL_MULT;
        approvalHit += amp;
        p.lastAmplification = { hashtag: t.hashtag, approvalHit: amp, at: p.clock };
        // repercussão na "Hora da Verdade" / Rede Cubo
        s.news = s.news ?? [];
        s.news.unshift({
          id: nid("news", s),
          kind: "danger",
          titleKey: `📺 Rede Cubo & Hora da Verdade adotam ${t.hashtag} como pauta principal`,
          month: s.month, year: s.year, day: s.day,
        });
        if (s.news.length > 25) s.news.pop();
      }
    }
  }
  return { approvalHit };
}

/* ---------------- Tick horário ---------------- */

/**
 * Deve ser chamado ~1x por "hora de jogo". Como o jogo avança por dias/meses,
 * chamamos com N iterações no daily tick.
 */
export function tickPiuPiuHour(state: GameState, rng: () => number): GameState {
  const p = ensurePiuPiu(state);
  p.clock += 1;

  // 1) decaimento de heat
  for (const t of p.trends) {
    t.heat *= HEAT_DECAY_PER_HOUR;
    if (!t.amplifiedByPress && !p.trends.slice(0, 5).includes(t)) t.hoursInTop5 = Math.max(0, t.hoursInTop5 - 0.5);
  }
  p.trends = p.trends.filter(t => t.heat > 5);

  // 1b) cooldowns de tipo de trigger
  if (p.triggerCooldowns) {
    for (const k of Object.keys(p.triggerCooldowns) as Array<CancelTrigger["kind"]>) {
      const v = (p.triggerCooldowns[k] ?? 0) - 1;
      if (v <= 0) delete p.triggerCooldowns[k];
      else p.triggerCooldowns[k] = v;
    }
  }
  // 1c) respiro global entre crises
  if ((p.globalCooldown ?? 0) > 0) p.globalCooldown = (p.globalCooldown ?? 0) - 1;

  // 2) posts ambientais
  // 2) posts ambientais + arquétipos satíricos
  if (rng() < 0.6) {
    const amb = postAmbient(p, state, rng);
    if (amb) pushPost(p, amb);
  }
  if (rng() < 0.45) {
    const arc = postArchetype(p, state, rng);
    if (arc) pushPost(p, arc);
  }

  // 3) novos gatilhos
  maybeSpawnTrigger(p, state, rng);

  // 4) triggers em curso
  const trgOut = tickTriggers(p, state, rng);

  // 5) amplificação da mídia clássica
  const ampOut = tickAmplification(p, state);

  // @DebocheMunicipal ameniza gravidade percebida (-20% impacto em triggers)
  // mas o meme também corrói eficiência: -0.15 aprovação por hora com meme fresco
  const debocheActive = p.posts.slice(-6).some(pp => pp.author.archetype === "deboche_municipal");
  const memeSoftening = debocheActive ? 0.8 : 1;
  const memeEfficiencyHit = debocheActive ? 0.15 : 0;
  // @FiscalDoTrânsito bate diretamente a felicidade da classe média baixa
  const fiscalActive = p.posts.slice(-6).some(pp => pp.author.archetype === "fiscal_transito");
  const fiscalHit = fiscalActive ? 0.35 : 0;

  const totalHit = trgOut.approvalHit * memeSoftening + ampOut.approvalHit + memeEfficiencyHit + fiscalHit;
  if (totalHit > 0) {
    state.approval = Math.max(0, state.approval - totalHit);
    state.happiness = Math.max(0, state.happiness - totalHit * 0.4);
  }
  sortTrends(p);
  return state;
}

/**
 * Reset mensal: cooldowns do gabinete de comunicação.
 */
export function tickPiuPiuMonth(state: GameState): GameState {
  const p = ensurePiuPiu(state);
  p.humorStock = Math.min(3, p.humorStock + 1);
  p.fieldTeamsUsed = 0;
  // seguidores oficiais crescem com aprovação
  const growth = ((state.approval - 40) / 100) * 500;
  p.officialFollowers = Math.max(10_000, Math.round(p.officialFollowers + growth));
  // limpar triggers respondidos há mais de 3 dias
  // Purga: mantém responded/expired por até 72h como histórico visível.
  p.triggers = p.triggers.filter(t => {
    const done = t.responded || t.expired;
    if (!done) return true;
    const ref = t.responseAt ?? (t.createdAt + t.deadlineHours * 4);
    return (p.clock - ref) < 72;
  });
  return state;
}

/* ---------------- Ações do jogador ---------------- */

export const RESPONSE_COST = {
  official_note: 5_000,
  humor: 0,
  field_team: 120_000,
} as const;

function activeTrigger(p: PiuPiuState): CancelTrigger | undefined {
  // prioriza o mais grave / mais recente escalonado
  const cand = p.triggers.filter(t => !t.responded && !t.expired);
  cand.sort((a, b) => b.severity - a.severity || b.createdAt - a.createdAt);
  return cand[0];
}

export function respondCrisis(
  state: GameState,
  triggerId: string,
  kind: "official_note" | "humor" | "field_team",
): GameState {
  const p = ensurePiuPiu(state);
  const trg = p.triggers.find(t => t.id === triggerId);
  if (!trg || trg.responded) return state;

  const cost = RESPONSE_COST[kind];
  if (state.treasury < cost) return state;
  if (kind === "humor" && p.humorStock <= 0) return state;
  state.treasury -= cost;

  if (kind === "humor") {
    p.humorStock -= 1;
  }
  if (kind === "field_team") {
    p.fieldTeamsUsed += 1;
  }

  trg.responded = true;
  trg.responseKind = kind;
  trg.responseAt = p.clock;

  // eficácia depende do tempo de resposta e da severidade
  const elapsed = p.clock - trg.createdAt;
  const onTime = elapsed <= trg.deadlineHours;
  const escFactor = trg.escalated ? 0.5 : 1.0;

  const baseEff: Record<typeof kind, number> = {
    official_note: 0.55,
    humor: 0.75,
    field_team: 0.9,
  };
  const eff = baseEff[kind] * (onTime ? 1 : 0.6) * escFactor;
  const success = eff > 0.5;

  // resfria hashtags do incidente
  for (const h of trg.hashtags) {
    const t = p.trends.find(x => x.hashtag === h);
    if (t) {
      t.heat *= (1 - eff * 0.8);
      t.hoursInTop5 = Math.max(0, t.hoursInTop5 - 3);
    }
  }

  // posts oficiais + comunidade
  const officialText: Record<typeof kind, { pt: string; en: string }> = {
    official_note: {
      pt: `Nota oficial: a Prefeitura já mobilizou equipes e informa que ${trg.descPt.toLowerCase()} está sendo tratado. #TransparênciaMunicipal`,
      en: `Official note: City Hall has mobilized teams. ${trg.descEn} is being addressed. #MunicipalTransparency`,
    },
    humor: {
      pt: `😅 Aqui é o social media da Prefeitura respondendo: ${trg.descPt.slice(0, 60)}… já mandei o boss pra resolver, calma povo`,
      en: `😅 City Hall's social media here: ${trg.descEn.slice(0, 60)}… i pinged the boss, chill folks`,
    },
    field_team: {
      pt: `🚑 Equipe de resposta rápida ENVIADA. Fotos em breve. ${trg.hashtags.map(h => h.replace("#Fora", "#Prefeito")).join(" ")}`,
      en: `🚑 Rapid response team DISPATCHED. Photos soon. ${trg.hashtags.map(h => h.replace("#Fora", "#Mayor")).join(" ")}`,
    },
  };
  const officialPost: PiuPiuPost = {
    id: nid("p", state),
    author: { ...OFFICIAL_AUTHOR, followers: p.officialFollowers },
    textPt: officialText[kind].pt,
    textEn: officialText[kind].en,
    hashtags: success ? ["#PrefeitoTrabalha"] : ["#TransparênciaMunicipal"],
    createdAt: p.clock,
    likes: Math.round(p.officialFollowers * (success ? 0.15 : 0.05)),
    reposts: Math.round(p.officialFollowers * (success ? 0.08 : 0.02)),
    replies: Math.round(p.officialFollowers * 0.04),
    sentiment: success ? "positive" : "neutral",
    triggerId: trg.id,
    mediaKind: kind === "field_team" ? "photo" : "none",
  };
  pushPost(p, officialPost);

  if (success) {
    p.totalReversals += 1;
    bumpTrend(p, "#PrefeitoTrabalha", 350, "positive", false);
    // bônus especialmente forte com humor (efeito viral no eleitorado jovem)
    const bonus = kind === "humor" ? 3.5 : kind === "field_team" ? 2.5 : 1.5;
    state.approval = Math.min(100, state.approval + bonus);
    state.happiness = Math.min(100, state.happiness + bonus * 0.4);

    // Easter egg: 5 crises instigadas por Dando Boura resolvidas com sucesso
    // fazem o vlogger publicar um vídeo "revelando" a própria altura.
    if (trg.instigatorId === "vs_dandoboura") {
      p.dandoBouraResolved = (p.dandoBouraResolved ?? 0) + 1;
      if (p.dandoBouraResolved >= 5 && !state.dandoBoura?.heightRevealed) {
        state.dandoBoura = {
          heightRevealed: true,
          at: { month: state.month, year: state.year },
        };
        // Post satírico no PiuPiu do próprio Dando Boura
        const dandoAuthor: PiuPiuAuthor = {
          handle: "@DandoBouraOficial",
          name: "Dando Boura",
          avatar: "🎸",
          followers: 3_200_000,
          verified: true,
          kind: "influencer",
          archetype: "deboche_municipal",
        };
        pushPost(p, {
          id: nid("p", state),
          author: dandoAuthor,
          textPt: "GENTE VEJAM MEU NOVO VÍDEO: EU MEÇO 1,… [ERRO 404 — NÃO ENCONTRADO] 🎸📏 #MinhaAlturaReal",
          textEn: "GUYS WATCH MY NEW VIDEO: I AM 1.… [ERROR 404 — NOT FOUND] 🎸📏 #MyRealHeight",
          hashtags: ["#Trend"],
          createdAt: p.clock,
          likes: 480_000,
          reposts: 220_000,
          replies: 95_000,
          sentiment: "neutral",
          mediaKind: "video",
        });
        bumpTrend(p, "#Trend", 900, "neutral", false);
        // Manchete destacada no Diário da Cidade
        const headline = {
          id: `${state.year}-${state.month}-${state.day}-dandoboura`,
          day: state.day,
          month: state.month,
          year: state.year,
          kind: "success" as const,
          titleKey: "news_dandoboura_altura",
          highlight: true,
          detail:
            "Após semanas apanhando de crises que ele mesmo turbinou, o vlogger Dando Boura publica um vídeo prometendo revelar sua altura. Na hora exata da revelação: tela preta, 'Error 404 – Not Found'. Internet em polvorosa.",
        };
        state.news = [headline, ...state.news].slice(0, 80);
      }
    }
  } else {
    // resposta fraca ainda gera pequeno efeito
    state.approval = Math.min(100, state.approval + 0.3);
  }
  sortTrends(p);
  return { ...state };
}

export function markAllRead(state: GameState): GameState {
  const p = ensurePiuPiu(state);
  p.unread = 0;
  return { ...state };
}

export function getActiveCrisis(state: GameState): CancelTrigger | undefined {
  const p = state.piupiu;
  if (!p) return undefined;
  return activeTrigger(p);
}
