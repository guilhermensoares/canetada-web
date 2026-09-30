/**
 * YouTubi — o terceiro veículo de mídia.
 *
 * Plataforma de vídeo satírica (paródia genérica de plataformas de vídeo).
 * Não gera vídeos de verdade: cada "post" é um card com título, formato
 * (vlog/podcast/react/live/cortes), duração fake, visualizações e um
 * resumo em texto que o jogador pode expandir.
 *
 * Os canais são apresentados por influencers-caricatura fictícios,
 * arquétipos genéricos de podcasters/vlogueiros políticos. Nenhum
 * personagem representa pessoa real; qualquer semelhança é coincidência.
 * Cada canal tem viés, formatos favoritos e um catálogo de gatilhos: se
 * uma métrica do jogo estoura um limiar, aquele canal publica com um
 * enquadramento próprio.
 *
 * A dinâmica é mensal e independente do efeito manada do módulo `media.ts`
 * — os cards só afetam humor/aprovação muito de leve (o barulho pesado
 * já vem da imprensa e do PiuPiu).
 */
import type { GameState } from "./types";
import type { CoverageTopic } from "./media";

type RNGLike = { float: () => number };

/* ============================================================
 *  Tipos
 * ============================================================ */

export type VideoFormat = "vlog" | "podcast" | "react" | "live" | "cortes";
export type VideoAngle = -1 | 0 | 1;

/** Viés editorial do canal, independente dos vieses da imprensa clássica. */
export type ChannelBias =
  | "raivoso_direita"     // Dando Boura — grita com a câmera
  | "esquerda_pop"        // Felício Nêutrão — youtuber que virou ativista
  | "libertario"          // Monikás — "liberdade acima de tudo"
  | "conservador_religioso" // Padre Kicowski — moralista de batina
  | "humor_react"         // riso e deboche
  | "liberal_tech"        // Kenny — planilha, EBITDA e reforma
  | "direita_intelectual" // Kaio Coppollini — "meu caro, permita-me"
  | "esquerda_organica"   // Tamiro — militância orgânica
  | "podpé";              // debocho de sofá

export interface VideoChannel {
  id: string;
  /** Nome do canal (marca fictícia). */
  namePt: string;
  nameEn: string;
  /** Apresentador — caricatura fictícia. */
  host: string;
  /** Rótulo interno do arquétipo (uso editorial, não exibido). */
  inspiredBy: string;
  avatar: string;      // emoji
  bias: ChannelBias;
  formats: VideoFormat[];
  subsK: number;       // inscritos em milhares
  bioPt: string;
  bioEn: string;
}

export interface VideoPost {
  id: string;
  channelId: string;
  format: VideoFormat;
  titlePt: string;
  titleEn: string;
  /** Descrição/roteiro resumido, 2–4 frases. */
  summaryPt: string;
  summaryEn: string;
  topic: CoverageTopic;
  angle: VideoAngle;
  /** Duração fake em minutos (vlog 8–15, podcast 60–120, cortes 2–4). */
  durationMin: number;
  /** Views em milhares (fake, ancorado nos inscritos + heat do tópico). */
  viewsK: number;
  month: number;
  year: number;
  /** Já foi visto pelo jogador (fecha o "badge de novo"). */
  seen: boolean;
}

export interface VideosphereState {
  channels: VideoChannel[];
  videos: VideoPost[]; // mais recentes primeiro, cap 30
  stats: { totalVideos: number; totalViewsK: number };
}

/* ============================================================
 *  Elenco de canais
 * ============================================================ */

const DEFAULT_CHANNELS: VideoChannel[] = [
  {
    id: "vs_dandoboura",
    namePt: "Canal do Dando",
    nameEn: "Dando's Channel",
    host: "Dando Boura",
    inspiredBy: "vlogger raivoso genérico",
    avatar: "🎸",
    bias: "raivoso_direita",
    formats: ["vlog", "react"],
    subsK: 3_200,
    bioPt: "Guitarrista virou vlogueiro raivoso. Grita, aponta o dedo, corta o vídeo em plano fechado.",
    bioEn: "Guitarist turned angry vlogger. Yells, points fingers, cuts close-up on the face.",
  },
  {
    id: "vs_feliciontrao",
    namePt: "Felício Filma",
    nameEn: "Felício Films",
    host: "Felício Nêutrão",
    inspiredBy: "youtuber pop virou ativista",
    avatar: "😎",
    bias: "esquerda_pop",
    formats: ["vlog"],
    subsK: 45_000,
    bioPt: "Youtuber infantil que virou ativista. Fala olhando pra câmera com trilha dramática.",
    bioEn: "Kids' YouTuber turned activist. Stares at the camera over dramatic music.",
  },
  {
    id: "vs_monikas",
    namePt: "Flow Monikás",
    nameEn: "Flow Monikás",
    host: "Monikás",
    inspiredBy: "podcaster libertário largadão",
    avatar: "🍺",
    bias: "libertario",
    formats: ["podcast"],
    subsK: 2_100,
    bioPt: "Podcaster libertário largadão. Fala arrastado em cima da mesa cheia de lata de cerveja e cita Milton Friedman errado — quando lembra o nome.",
    bioEn: "Sloppy libertarian podcaster. Slurred takes over a table of empty beer cans, misquoting Milton Friedman — when he remembers the name.",
  },
  {
    id: "vs_padrekicowski",
    namePt: "Padre Kicowski em Cristo",
    nameEn: "Fr. Kicowski in Christ",
    host: "Padre Kicowski",
    inspiredBy: "clérigo político genérico",
    avatar: "⛪",
    bias: "conservador_religioso",
    formats: ["vlog", "live"],
    subsK: 780,
    bioPt: "Clérigo político. Todo vídeo começa com a paz e termina com uma indireta.",
    bioEn: "Political cleric. Every video begins in peace and ends with a jab.",
  },
  {
    id: "vs_kennykatacoco",
    namePt: "Kenny Explica",
    nameEn: "Kenny Explains",
    host: "Kenny Katacoco",
    inspiredBy: "ex-líder de movimento liberal jovem",
    avatar: "📊",
    bias: "liberal_tech",
    formats: ["podcast", "cortes"],
    subsK: 1_400,
    bioPt: "Ex-líder de movimento virou influenciador tech. Só fala em planilha, EBITDA e reforma administrativa.",
    bioEn: "Former movement leader turned tech influencer. Speaks only in spreadsheets, EBITDA and admin reform.",
  },
  {
    id: "vs_coppollini",
    namePt: "Coppollini Comenta",
    nameEn: "Coppollini Comments",
    host: "Kaio Coppollini",
    inspiredBy: "comentarista jovem de direita",
    avatar: "🎩",
    bias: "direita_intelectual",
    formats: ["podcast"],
    subsK: 950,
    bioPt: "Comentarista jovem de camisa social. Interrompe convidado citando Roger Scruton fora de contexto.",
    bioEn: "Young shirt-and-blazer pundit. Interrupts guests quoting Roger Scruton out of context.",
  },
  {
    id: "vs_flow_ivan",
    namePt: "Flow com Ivan 4K",
    nameEn: "Flow with Ivan 4K",
    host: "Ivan 4K",
    inspiredBy: "podcast de cortes libertário",
    avatar: "🎚️",
    bias: "libertario",
    formats: ["podcast", "cortes"],
    subsK: 5_800,
    bioPt: "Herdou a mesa depois do escândalo do sócio. Fala pouco, corta muito e vive dizendo 'segue o baile'.",
    bioEn: "Inherited the mic after his partner's scandal. Talks little, clips a lot, always says 'let it roll'.",
  },
  {
    id: "vs_intelilimitada",
    namePt: "Inteligência Limitadíssima",
    nameEn: "Very Limited Intelligence",
    host: "Rogério Vilarejo",
    inspiredBy: "podcast humorístico de react",
    avatar: "🧠",
    bias: "humor_react",
    formats: ["podcast", "cortes"],
    subsK: 4_200,
    bioPt: "Ri de tudo que o prefeito faz. Convida político só pra rir na cara e depois postar corte descontextualizado.",
    bioEn: "Laughs at every mayoral move. Invites politicians just to giggle on-camera and post out-of-context clips.",
  },
  {
    id: "vs_redcast",
    namePt: "RudCast",
    nameEn: "RudCast",
    host: "Juninho Rocha Dura",
    inspiredBy: "podcast raivoso de direita",
    avatar: "🔴",
    bias: "raivoso_direita",
    formats: ["podcast", "live"],
    subsK: 1_900,
    bioPt: "Podcast nacionalista raiz. Bandeira nas costas, revólver de brinquedo na mesa e um mapa do Brasil que ele mesmo desenhou.",
    bioEn: "Hard-right nationalist podcast. Flag on the wall, toy revolver on the desk and a hand-drawn map of Brazil.",
  },
  {
    id: "vs_ludeverso",
    namePt: "Ludeverso",
    nameEn: "Ludeverse",
    host: "Lulude",
    inspiredBy: "podcast de papo de bar viralizável",
    avatar: "🌌",
    bias: "podpé",
    formats: ["podcast", "cortes"],
    subsK: 3_600,
    bioPt: "Convida qualquer figura pública e transforma tudo em papo de bar. Cortes viram meme antes do episódio terminar.",
    bioEn: "Invites anyone in the news and turns it into bar talk. Clips go viral before the episode even ends.",
  },
  {
    id: "vs_tamiro",
    namePt: "Tamiro Comenta",
    nameEn: "Tamiro Talks",
    host: "Tamiro Felipeto",
    inspiredBy: "vídeo-ensaísta trabalhista raiz",
    avatar: "🌹",
    bias: "esquerda_organica",
    formats: ["vlog", "podcast", "cortes"],
    subsK: 1_100,
    bioPt: "Trabalhista raiz, resgata Vargas e Brizola em vídeo-ensaio. Explica reforma tributária citando a Era Vargas e termina batendo no neoliberalismo.",
    bioEn: "Old-school labour-left. Revives Vargas and Brizola in long video essays, ties tax reform to the 1940s and closes swinging at neoliberalism.",
  },
  {
    id: "vs_3manos",
    namePt: "Cast dos 3 Manos",
    nameEn: "3 Bros Cast",
    host: "PC, Ricão e Brunão Siena",
    inspiredBy: "podcast de irmãos no sofá",
    avatar: "👨‍👨‍👦",
    bias: "humor_react",
    formats: ["podcast", "live", "cortes"],
    subsK: 6_700,
    bioPt: "Três irmãos, um sofá e zero preparação. Um defende, outro ataca, o do meio ri — a câmara vira circo em live.",
    bioEn: "Three brothers, one couch, zero prep. One defends, one attacks, the middle one laughs — chamber turns into a circus on live.",
  },
  {
    id: "vs_bonossaurista",
    namePt: "Podcast Bonossaurista Raiz",
    nameEn: "Bonossaurist Roots Podcast",
    host: "Comandante Bonossauro",
    inspiredBy: "podcast nacionalista de caserna",
    avatar: "🦖",
    bias: "raivoso_direita",
    formats: ["podcast", "live", "cortes"],
    subsK: 2_800,
    bioPt: "Podcast nacionalista raiz sob a bandeira do Bonossauro. Defende a caserna, ataca cada canetada de esquerda do prefeito e transforma qualquer decreto progressista em corte viral com trilha épica.",
    bioEn: "Hard-nationalist podcast rallying under the Bonossaur banner. Defends the barracks, attacks every left-leaning pen stroke by the mayor and turns any progressive decree into a viral clip with epic soundtrack.",
  },
];


/* ============================================================
 *  Bootstrap
 * ============================================================ */

export function ensureVideosphere(s: GameState): VideosphereState {
  const gs = s as GameState & { videosphere?: VideosphereState };
  if (!gs.videosphere) {
    gs.videosphere = {
      channels: DEFAULT_CHANNELS.slice(),
      videos: [],
      stats: { totalVideos: 0, totalViewsK: 0 },
    };
  }
  return gs.videosphere!;
}

/* ============================================================
 *  Sinais — o que está quente pro YouTubi este mês
 * ============================================================ */

interface VideoSignal {
  topic: CoverageTopic;
  intensity: number;      // 0..100
  angle: VideoAngle;
  hookPt: string;         // gancho curto pro título
  hookEn: string;
}

function sampleVideoSignals(s: GameState): VideoSignal[] {
  const out: VideoSignal[] = [];
  const p = s.policies;
  const ov = s.oversight;
  const pp = s.parallelPower;
  const dis = s.disasters;
  const hou = s.housing;

  if (p.health < 40) out.push({ topic: "health", intensity: 60 + (40 - p.health), angle: -1, hookPt: "fila do SUS", hookEn: "clinic queues" });
  else if (p.health > 70) out.push({ topic: "health", intensity: 28 + (p.health - 70), angle: +1, hookPt: "posto reforçado", hookEn: "reinforced clinic" });

  if (p.education < 40) out.push({ topic: "education", intensity: 55, angle: -1, hookPt: "escola sem merenda", hookEn: "empty lunchboxes" });
  else if (p.education > 70) out.push({ topic: "education", intensity: 28 + (p.education - 70), angle: +1, hookPt: "escola de referência", hookEn: "flagship school" });

  if (p.transport < 40) out.push({ topic: "transport", intensity: 55, angle: -1, hookPt: "ônibus lotado", hookEn: "packed buses" });
  else if (p.transport > 70) out.push({ topic: "transport", intensity: 28 + (p.transport - 70), angle: +1, hookPt: "linha nova funcionando", hookEn: "new line working" });

  const taxSpike = Math.max(0, s.taxes.property - 12) * 6 + Math.max(0, s.taxes.income - 15) * 4;
  if (taxSpike > 15) out.push({ topic: "tax", intensity: Math.min(90, taxSpike), angle: -1, hookPt: "IPTU nas alturas", hookEn: "property tax up" });
  else if (s.taxes.property < 10 && s.taxes.income < 12) {
    out.push({ topic: "tax", intensity: 26, angle: +1, hookPt: "imposto contido", hookEn: "tax held down" });
  }

  if (s.unemployment > 12) out.push({ topic: "economy", intensity: 40 + s.unemployment, angle: -1, hookPt: "desemprego alto", hookEn: "unemployment high" });
  else if (s.unemployment < 7) out.push({ topic: "economy", intensity: 35, angle: +1, hookPt: "empregos crescendo", hookEn: "jobs growing" });
  if (s.inflation > 8)     out.push({ topic: "economy", intensity: 35 + s.inflation * 2, angle: -1, hookPt: "inflação corroendo", hookEn: "inflation biting" });
  else if (s.inflation < 4) out.push({ topic: "economy", intensity: 24, angle: +1, hookPt: "inflação baixa", hookEn: "low inflation" });

  if (ov?.mpRisk && ov.mpRisk > 45) out.push({ topic: "corruption", intensity: ov.mpRisk, angle: -1, hookPt: "MP mirando", hookEn: "prosecutor moving" });
  if (ov?.stalledWorks?.length) out.push({ topic: "works", intensity: 40 + ov.stalledWorks.length * 15, angle: -1, hookPt: "obra parada", hookEn: "stalled works" });
  if (ov && ov.mpRisk < 20 && ov.tceRisk < 20 && ov.stalledWorks.length === 0) {
    out.push({ topic: "corruption", intensity: 24, angle: +1, hookPt: "gestão sem ficha suja", hookEn: "clean record" });
  }

  if (pp && pp.aggregateControl > 20) out.push({ topic: "security", intensity: Math.min(90, 20 + pp.aggregateControl), angle: -1, hookPt: "facção avançando", hookEn: "faction advancing" });
  else if (p.security > 65 && (!pp || pp.aggregateControl < 8)) {
    out.push({ topic: "security", intensity: 28, angle: +1, hookPt: "rua mais segura", hookEn: "streets safer" });
  }

  if (dis?.activeEvent?.active) out.push({ topic: "disaster", intensity: 90, angle: -1, hookPt: "tragédia anunciada", hookEn: "tragedy foretold" });
  if (hou && hou.gentrificationIndex > 55) out.push({ topic: "housing", intensity: 30 + hou.gentrificationIndex * 0.5, angle: -1, hookPt: "gente expulsa", hookEn: "residents pushed out" });
  else if (hou && hou.gentrificationIndex < 25) {
    out.push({ topic: "housing", intensity: 26, angle: +1, hookPt: "aluguel controlado", hookEn: "rents in check" });
  }

  const emissions = s.sustainability?.emissions ?? 50;
  if (emissions > 65) out.push({ topic: "environment", intensity: emissions * 0.6, angle: -1, hookPt: "ar irrespirável", hookEn: "unbreathable air" });
  else if (emissions < 40) out.push({ topic: "environment", intensity: 28, angle: +1, hookPt: "ar mais limpo", hookEn: "cleaner air" });

  // Ângulos positivos gerais.
  if (s.treasury > 3_000_000 && s.approval > 55) {
    out.push({ topic: "works", intensity: 30, angle: +1, hookPt: "cidade em obras", hookEn: "city on the build" });
  }
  if (s.approval > 65) {
    out.push({ topic: "economy", intensity: 26 + (s.approval - 65) * 0.4, angle: +1, hookPt: "gestão em alta", hookEn: "administration on the rise" });
  }
  if (s.happiness > 70) {
    out.push({ topic: "works", intensity: 24, angle: +1, hookPt: "cidade mais feliz", hookEn: "happier city" });
  }

  return out;
}

/* ============================================================
 *  Afinidade canal × tópico
 * ============================================================ */

const CHANNEL_TOPIC_AFFINITY: Record<ChannelBias, Partial<Record<CoverageTopic, number>>> = {
  raivoso_direita:       { corruption: 1.8, security: 1.6, tax: 1.4, works: 1.2 },
  esquerda_pop:          { housing: 1.7, education: 1.5, health: 1.4, environment: 1.3 },
  libertario:            { tax: 1.9, economy: 1.5, works: 1.1 },
  conservador_religioso: { security: 1.5, education: 1.4, environment: 0.7 },
  humor_react:           { disaster: 1.4, corruption: 1.3, works: 1.2, security: 1.1, transport: 1.1 },
  liberal_tech:          { economy: 1.7, tax: 1.5, works: 1.3, transport: 1.2 },
  direita_intelectual:   { corruption: 1.6, education: 1.3, tax: 1.3 },
  esquerda_organica:     { housing: 1.6, health: 1.5, education: 1.4, security: 1.1 },
  podpé:                 { corruption: 1.4, disaster: 1.5, works: 1.3, transport: 1.2, tax: 1.1 },
};

/** Como cada viés reinterpreta o ângulo natural. */
function channelAngle(bias: ChannelBias, natural: VideoAngle): VideoAngle {
  switch (bias) {
    case "raivoso_direita":       return natural > 0 ? 0 : -1;
    case "esquerda_pop":          return natural > 0 ? 0 : -1;
    case "libertario":            return natural > 0 ? 0 : -1;
    case "conservador_religioso": return natural > 0 ? 0 : -1;
    case "humor_react":           return natural; // reage ao fato
    case "liberal_tech":          return natural;
    case "direita_intelectual":   return natural > 0 ? 0 : -1;
    case "esquerda_organica":     return natural > 0 ? 0 : -1;
    case "podpé":                 return natural < 0 ? 0 : natural; // deboche neutro na crise
  }
}

/* ============================================================
 *  Templates de vídeo (título + resumo) por viés × ângulo
 * ============================================================ */

function pickFormat(ch: VideoChannel, rng: RNGLike): VideoFormat {
  return ch.formats[Math.floor(rng.float() * ch.formats.length)];
}

function formatDuration(fmt: VideoFormat, rng: RNGLike): number {
  switch (fmt) {
    case "vlog":    return 8 + Math.floor(rng.float() * 8);   // 8–15
    case "podcast": return 55 + Math.floor(rng.float() * 65); // 55–120
    case "react":   return 12 + Math.floor(rng.float() * 20); // 12–31
    case "live":    return 60 + Math.floor(rng.float() * 90); // 60–150
    case "cortes":  return 2 + Math.floor(rng.float() * 4);   // 2–5
  }
}

interface VideoTemplate {
  titlePt: string;
  titleEn: string;
  summaryPt: string;
  summaryEn: string;
}

function pickTemplate(
  ch: VideoChannel,
  sig: VideoSignal,
  angle: VideoAngle,
  fmt: VideoFormat,
  s: GameState,
  rng: RNGLike,
): VideoTemplate {
  const hookPt = sig.hookPt;
  const hookEn = sig.hookEn;
  const city = s.cityName ?? "cidade";
  const mayor = s.mayor?.name ?? "o(a) prefeito(a)";

  const uc = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
  const upperHook = uc(hookPt);
  const upperHookEn = uc(hookEn);

  // Cada viés tem uma família de openings. Escolhe uma variação por rng.
  switch (ch.bias) {
    case "raivoso_direita": return angle < 0 ? {
      titlePt: `URGENTE! ${upperHook.toUpperCase()} EM ${city.toUpperCase()} — CADÊ ${mayor.toUpperCase()}?!`,
      titleEn: `URGENT! ${upperHookEn.toUpperCase()} IN ${city.toUpperCase()} — WHERE IS ${mayor.toUpperCase()}?!`,
      summaryPt: `${ch.host} abre o vídeo gritando com a câmera fechada no rosto. Culpa "a esquerda festiva", cita três estatísticas soltas e termina pedindo like, share e "corta pra vinheta". ${fmt === "react" ? 'No fim, reage a uma coletiva antiga do prefeito com legenda "MENTIRA #1".' : ""}`,
      summaryEn: `${ch.host} opens screaming close-up. Blames "the woke left", cites three loose stats and ends begging for likes. ${fmt === "react" ? 'Ends by reacting to an old press conference tagged "LIE #1".' : ""}`,
    } : {
      titlePt: `NÃO QUERIA DIZER ISSO, MAS ${mayor.toUpperCase()} ACERTOU EM UMA COISA`,
      titleEn: `I DIDN'T WANT TO SAY THIS, BUT ${mayor.toUpperCase()} GOT ONE THING RIGHT`,
      summaryPt: `Elogio contrariado de dois minutos. ${ch.host} concede o mérito e passa dez minutos explicando por que ainda "não confia".`,
      summaryEn: `A two-minute reluctant compliment. ${ch.host} concedes the point and then spends ten minutes explaining why he still "doesn't trust".`,
    };

    case "esquerda_pop": return angle < 0 ? {
      titlePt: `Gente, precisamos falar sobre ${hookPt} em ${city}`,
      titleEn: `Guys, we need to talk about ${hookEn} in ${city}`,
      summaryPt: `${ch.host} filma em plano frontal, música dramática de fundo. Chora um pouquinho no minuto 3, chama a base a "não normalizar isso" e fixa uma vaquinha no primeiro comentário.`,
      summaryEn: `${ch.host} films front-facing with dramatic music. Sheds a tear at minute 3, calls followers to "not normalize this" and pins a fundraiser in the top comment.`,
    } : {
      titlePt: `${upperHook} em ${city}: por que a esquerda NÃO pode ceder isso pra direita`,
      titleEn: `${upperHookEn} in ${city}: why the left CAN'T let the right own this`,
      summaryPt: `Vídeo-ensaio celebrando o avanço, mas alertando que "a narrativa vai ser roubada". Termina com hashtag do partido preferido.`,
      summaryEn: `Essay video celebrating the progress but warning "the narrative will be stolen". Ends with a party hashtag.`,
    };

    case "libertario": return {
      titlePt: `${upperHook} PROVA que a solução é PRIVATIZAR TUDO`,
      titleEn: `${upperHookEn} PROVES the only fix is to PRIVATIZE EVERYTHING`,
      summaryPt: `${ch.host} bebe cerveja com um convidado libertário. Nos primeiros 40 minutos discutem se o Estado deveria existir. Nos últimos 20 concluem que "isso não aconteceria no Vale do Silício".`,
      summaryEn: `${ch.host} drinks beer with a libertarian guest. First 40 minutes argue whether the state should exist. Final 20 conclude "this wouldn't happen in Silicon Valley".`,
    };

    case "conservador_religioso": return angle < 0 ? {
      titlePt: `A paz do Senhor, hoje um alerta: ${hookPt} chegou em ${city}`,
      titleEn: `Peace of the Lord — today a warning: ${hookEn} reached ${city}`,
      summaryPt: `${ch.host} começa fazendo o sinal da cruz. Liga ${hookPt} a "decadência moral" e sugere que a solução passa por família, escola e "menos gente na rua depois das 22h".`,
      summaryEn: `${ch.host} opens with the sign of the cross. Ties ${hookEn} to "moral decay" and prescribes family values, schools and "fewer people on the streets after 10pm".`,
    } : {
      titlePt: `Graças a Deus e ao trabalho de ${mayor}: um passo na direção certa`,
      titleEn: `Thanks to God and to ${mayor}'s work: a step in the right direction`,
      summaryPt: `Elogio moderado, com trilha de coral e uma citação bíblica descontextualizada.`,
      summaryEn: `Moderate praise, with a choir soundtrack and one out-of-context Bible verse.`,
    };

    case "humor_react": return angle < 0 ? {
      titlePt: `REAGINDO à coletiva do prefeito sobre ${hookPt} 😬`,
      titleEn: `REACTING to the mayor's press briefing on ${hookEn} 😬`,
      summaryPt: `${ch.host} assiste ao vivo com a galera. Rí no lugar errado, tapa o rosto duas vezes, ${fmt === "cortes" ? "e o corte de 30s viraliza no PiuPiu na mesma noite." : 'e no fim admite que "tá difícil defender".'}`,
      summaryEn: `${ch.host} watches live with chat. Laughs at the wrong beat, facepalms twice, ${fmt === "cortes" ? "and the 30s clip trends on PiuPiu that same night." : `and by the end admits it's "hard to defend".`}`,
    } : {
      titlePt: `Óh gente, ${city} FEZ uma coisa boa dessa vez — react`,
      titleEn: `Look folks, ${city} DID something right this time — react`,
      summaryPt: `Reação bem-humorada a uma nota positiva. ${ch.host} brinca com o time da prefeitura, dá crédito e pede pra "não estragar depois".`,
      summaryEn: `Good-humored reaction to a positive story. ${ch.host} teases city hall, gives credit and asks them "not to ruin it later".`,
    };

    case "liberal_tech": return {
      titlePt: `${upperHook} em ${city}: os NÚMEROS que ninguém tá te contando`,
      titleEn: `${upperHookEn} in ${city}: the NUMBERS nobody is telling you`,
      summaryPt: `${ch.host} abre planilha compartilhada. Cita CAPEX, OPEX, LRF, benchmarking com Recife e Curitiba. Sugere uma PPP, dois cortes e uma reforma administrativa. Termina com "isso é gestão".`,
      summaryEn: `${ch.host} opens a shared spreadsheet. Cites CAPEX, OPEX, fiscal law, benchmarks with Recife and Curitiba. Proposes a PPP, two cuts and admin reform. Ends with "that's what management looks like".`,
    };

    case "direita_intelectual": return angle < 0 ? {
      titlePt: `Meu caro, permita-me: sobre ${hookPt} em ${city}`,
      titleEn: `My dear, allow me: about ${hookEn} in ${city}`,
      summaryPt: `${ch.host} recebe convidado de gravata. Interrompe três vezes. Cita Roger Scruton, Olavo (mas não muito) e sugere que o problema é "civilizacional".`,
      summaryEn: `${ch.host} hosts a guest in a tie. Interrupts three times. Quotes Roger Scruton, Olavo (but not too much) and calls the crisis "civilisational".`,
    } : {
      titlePt: `Um ponto de acordo pouco improvável: ${city} caminhou`,
      titleEn: `A rare point of agreement: ${city} did move forward`,
      summaryPt: `Elogio contido com dois ressalvas latinas e uma provocação à esquerda.`,
      summaryEn: `Contained praise plus two Latin caveats and one jab at the left.`,
    };

    case "esquerda_organica": return angle < 0 ? {
      titlePt: `${upperHook}: e o silêncio da grande imprensa? — episódio de hoje`,
      titleEn: `${upperHookEn}: and the silence of the mainstream press? — today's episode`,
      summaryPt: `${ch.host} recebe uma liderança do movimento social. Trata ${hookPt} como sintoma de um "projeto neoliberal em curso" e convoca ato no domingo às 10h.`,
      summaryEn: `${ch.host} hosts a movement leader. Frames ${hookEn} as symptom of a "neoliberal project" and calls a Sunday 10am rally.`,
    } : {
      titlePt: `${upperHook}: uma vitória do povo organizado em ${city}`,
      titleEn: `${upperHookEn}: a win for the organized people of ${city}`,
      summaryPt: `Comemoração organizada. Dá crédito à base, cobra que "o próximo passo tem que ser mais ousado" e distribui cartilha em PDF.`,
      summaryEn: `Organized celebration. Credits the base, demands "a bolder next step" and hands out a PDF booklet.`,
    };

    case "podpé": return angle < 0 ? {
      titlePt: `${city} tá NORMAL? — corte do Podpé`,
      titleEn: `Is ${city} even okay? — Podpé clip`,
      summaryPt: `Iggy 3K e Mítigo caem na risada com ${hookPt}. Fazem uma imitação do prefeito, prometem chamar ele no próximo episódio e cortam pra propaganda de aposta.`,
      summaryEn: `Iggy 3K and Mítigo crack up over ${hookEn}. Do a mayor impression, promise to invite him next episode and cut to a betting ad.`,
    } : {
      titlePt: `${mayor} no Podpé: parece que o cara ENTENDE mesmo — corte`,
      titleEn: `${mayor} on Podpé: the guy actually GETS it — clip`,
      summaryPt: `Momento raro em que os apresentadores param de rir e admitem que "olha, tem coisa boa acontecendo". Depois voltam a rir.`,
      summaryEn: `Rare moment where the hosts stop laughing and admit "hey, some good things are happening". Then they start laughing again.`,
    };
  }
}

/* ============================================================
 *  Tick mensal
 * ============================================================ */

export interface VideosphereTickResult {
  approvalDelta: number;
  happinessDelta: number;
}

const MAX_VIDEOS_PER_MONTH = 3;

export function tickVideosphereMonth(s: GameState, rng: RNGLike): VideosphereTickResult {
  const v = ensureVideosphere(s);
  const res: VideosphereTickResult = { approvalDelta: 0, happinessDelta: 0 };

  const signals = sampleVideoSignals(s);
  if (signals.length === 0) return res;

  // Sorteia até MAX canais por mês, ponderados pelo tamanho de inscritos e
  // afinidade com o tópico mais quente da lista.
  const shuffled = v.channels.slice().sort(() => rng.float() - 0.5);
  const newPosts: VideoPost[] = [];
  let posted = 0;

  for (const ch of shuffled) {
    if (posted >= MAX_VIDEOS_PER_MONTH) break;

    // Chance base de publicar: canais grandes postam mais, mas com teto pra
    // não afogar o feed.
    const publishChance = Math.min(0.75, 0.28 + Math.log10(Math.max(10, ch.subsK)) * 0.06);
    if (rng.float() > publishChance) continue;

    // Escolhe uma pauta ponderada por intensidade × afinidade.
    const weights = signals.map((sig) => {
      const aff = CHANNEL_TOPIC_AFFINITY[ch.bias][sig.topic] ?? 0.6;
      return Math.max(0.05, sig.intensity * aff);
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) continue;
    let roll = rng.float() * sum;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { idx = i; break; }
    }
    const sig = signals[idx];
    const angle = channelAngle(ch.bias, sig.angle);
    const fmt = pickFormat(ch, rng);
    const tpl = pickTemplate(ch, sig, angle, fmt, s, rng);
    const duration = formatDuration(fmt, rng);

    // Views: log da base de inscritos × multiplicador de intensidade.
    const viewMult = 0.05 + (sig.intensity / 100) * 0.35 + rng.float() * 0.15;
    const viewsK = Math.max(1, Math.round(ch.subsK * viewMult));

    const post: VideoPost = {
      id: `vid_${s.year}_${s.month}_${ch.id}_${sig.topic}_${posted}`,
      channelId: ch.id,
      format: fmt,
      titlePt: tpl.titlePt,
      titleEn: tpl.titleEn,
      summaryPt: tpl.summaryPt,
      summaryEn: tpl.summaryEn,
      topic: sig.topic,
      angle,
      durationMin: duration,
      viewsK,
      month: s.month,
      year: s.year,
      seen: false,
    };
    newPosts.push(post);

    // Efeito bem leve na aprovação — canais com muito público pesam mais.
    const weight = Math.log10(Math.max(10, viewsK)) * 0.12;
    res.approvalDelta += angle * weight;
    res.happinessDelta += angle * weight * 0.3;

    posted += 1;
  }

  if (newPosts.length === 0) return res;

  v.videos = [...newPosts, ...v.videos].slice(0, 30);
  v.stats.totalVideos += newPosts.length;
  v.stats.totalViewsK += newPosts.reduce((a, p) => a + p.viewsK, 0);
  return res;
}

/* ============================================================
 *  Helpers de UI
 * ============================================================ */

export function markAllVideosSeen(s: GameState): void {
  const v = ensureVideosphere(s);
  for (const p of v.videos) p.seen = true;
}

export function videoFormatLabel(fmt: VideoFormat, lang: "pt" | "en"): string {
  const pt: Record<VideoFormat, string> = {
    vlog: "Vlog", podcast: "Podcast", react: "React", live: "Live", cortes: "Cortes",
  };
  const en: Record<VideoFormat, string> = {
    vlog: "Vlog", podcast: "Podcast", react: "React", live: "Live", cortes: "Clips",
  };
  return (lang === "pt" ? pt : en)[fmt];
}

export function channelBiasLabel(bias: ChannelBias, lang: "pt" | "en"): string {
  const pt: Record<ChannelBias, string> = {
    raivoso_direita: "Direita raivosa",
    esquerda_pop: "Esquerda pop",
    libertario: "Libertário",
    conservador_religioso: "Conservador religioso",
    humor_react: "Humor/React",
    liberal_tech: "Liberal tech",
    direita_intelectual: "Direita intelectual",
    esquerda_organica: "Esquerda orgânica",
    podpé: "Podcast de galera",
  };
  const en: Record<ChannelBias, string> = {
    raivoso_direita: "Angry right",
    esquerda_pop: "Pop left",
    libertario: "Libertarian",
    conservador_religioso: "Religious conservative",
    humor_react: "Humor / React",
    liberal_tech: "Tech-liberal",
    direita_intelectual: "Intellectual right",
    esquerda_organica: "Party-line left",
    podpé: "Buddies' podcast",
  };
  return (lang === "pt" ? pt : en)[bias];
}
