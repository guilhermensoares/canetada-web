/**
 * ZapZap — Digital & informal media layer (WhatsApp-style neighborhood group).
 *
 * Simulates how urban rumors and fake news spread through an instant-messaging
 * group of neighbors/family. Feeds off the game's signals (unemployment,
 * congestion, recent tax hikes, evictions) and pressures the player to allocate
 * a Communications Office budget or face protests.
 *
 * All strings are pt/en. All state is JSON-serializable so it fits in the
 * existing save file. No React deps.
 */
import type { GameState, NewsItem } from "./types";



export type ZapMsgKind = "problem" | "fake" | "chatter" | "official";

export interface ZapMessage {
  id: string;
  kind: ZapMsgKind;
  authorId: string;      // stable NPC id
  authorPt: string;
  authorEn: string;
  hue: number;           // 0..359 — used for avatar chip color
  textPt: string;
  textEn: string;
  media?: "photo" | "video" | "audio";
  day: number;
  month: number;
  year: number;
  viral: number;         // 0..100 — how much reach this message got
  debunked?: boolean;    // true if the Coordenadoria desmentiu
  authoritative?: boolean; // true for "official" from the mayor's office
  reactions: number;     // count of thumbs/emojis
}

export interface ZapZapState {
  /** Rolling ring of messages, newest first. Capped ~40. */
  messages: ZapMessage[];
  /** 0..100 — general trust in the group chat rumours. Higher = worse for gov. */
  misinformation: number;
  /** Monthly R$ allocated to the "Coordenadoria de Comunicação". */
  commsBudget: number;
  /** 0..100 — perceived risk of a street-protest triggered by viral fakes. */
  protestRisk: number;
  /** Unread messages since the last time the player opened the panel. */
  unread: number;
  /** Total fakes that were debunked (either by the player or the comms office). */
  debunkedTotal: number;
  /** Total protests fired from the ZapZap loop. */
  protestsFired: number;
  /** Day of the last spawn — throttles the tick. */
  lastSpawnDay: number;
}

const NPCS: Array<{ id: string; pt: string; en: string; hue: number }> = [
  { id: "tia",     pt: "Tia Cida",        en: "Aunt Cida",        hue: 340 },
  { id: "seu_jo",  pt: "Seu João",        en: "Mr. João",         hue: 210 },
  { id: "dona_m",  pt: "Dona Marlene",    en: "Mrs. Marlene",     hue: 12  },
  { id: "cunhado", pt: "Cunhado Wesley",  en: "Cousin Wesley",    hue: 260 },
  { id: "vizinha", pt: "Vizinha Bete",    en: "Neighbor Beth",    hue: 30  },
  { id: "pastor",  pt: "Pastor Wilson",   en: "Pastor Wilson",    hue: 190 },
  { id: "sindico", pt: "Síndico Ademir",  en: "Building mgr Adam",hue: 130 },
  { id: "ze_moto", pt: "Zé do Moto",      en: "Zé Motorbike",     hue: 0   },
  { id: "prof",    pt: "Profa. Denise",   en: "Ms. Denise",       hue: 280 },
  { id: "camelo",  pt: "Rogério Camelô",  en: "Roger Vendor",     hue: 50  },
];

const MAX_MESSAGES = 40;

/** Budget → staff → auto-debunks/month. R$60k ≈ 1 analista. */
function staffFor(budget: number) {
  return Math.floor(Math.max(0, budget) / 60_000);
}

/* --------------------------- Initialisation ------------------------------ */

export function defaultZapZap(): ZapZapState {
  return {
    messages: [],
    misinformation: 22,
    commsBudget: 0,
    protestRisk: 0,
    unread: 0,
    debunkedTotal: 0,
    protestsFired: 0,
    lastSpawnDay: 0,
  };
}

export function ensureZapZap(s: GameState): void {
  const g = s as GameState & { zapzap?: ZapZapState };
  if (!g.zapzap) g.zapzap = defaultZapZap();
}

/* --------------------------- Content generation -------------------------- */

interface Rng { float: () => number }

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng.float() * arr.length) % arr.length];
}

/** Problem reports — grounded in actual game signals. */
function problemTemplates(s: GameState): Array<{ pt: string; en: string }> {
  const out: Array<{ pt: string; en: string }> = [];
  if (s.unemployment > 12)
    out.push({
      pt: "Gente, meu filho tá há 3 meses sem emprego. Isso aqui tá difícil.",
      en: "Folks, my son's been jobless for 3 months. It's rough out here.",
    });
  if ((s.infra.waterCapacity ?? 0) * 1.1 < s.waterDemand)
    out.push({
      pt: "Alguém mais sem água hoje?? Já ligamos e nada 😡",
      en: "Anyone else with no water today?? We already called, nothing 😡",
    });
  const congestion = s.transport?.split?.congestion ?? 0;
  if (congestion > 55)
    out.push({
      pt: "Trânsito parado na avenida. Ônibus lotado, gente pendurada 🫠",
      en: "Traffic locked on the avenue. Buses packed, people hanging on 🫠",
    });
  if ((s.wellbeing?.pm25 ?? 0) > 25)
    out.push({
      pt: "Ar tá horrível hoje. Meu neto asmático não consegue nem sair.",
      en: "Air is awful today. My asthmatic grandson can't even step out.",
    });
  const crime = s.happiness < 50 ? 1 : 0;
  if (crime)
    out.push({
      pt: "Assaltaram três esquinas aqui essa semana. Cadê a viatura??",
      en: "Three corners got robbed this week. Where's the patrol??",
    });
  // Always-available generic complaints so the chat never runs dry.
  out.push({
    pt: "Bueiro entupido de novo na Rua das Palmeiras. Vou mandar foto.",
    en: "Storm drain clogged again on Palm Street. Sending a photo.",
  });
  out.push({
    pt: "O buraco da esquina virou piscina. Já quebrou 2 pneus 😤",
    en: "The corner pothole is a pool now. Blew 2 tires already 😤",
  });
  return out;
}

/** Fake news — reacts to recent controversial player choices. */
function fakeTemplates(s: GameState): Array<{ pt: string; en: string }> {
  const t = s.taxes;
  const out: Array<{ pt: string; en: string }> = [
    {
      pt: "URGENTE!! O prefeito vai TAXAR as carroças e as bicicletas! Manda pra todo mundo!!",
      en: "URGENT!! The mayor will TAX carts and bicycles! Forward to everyone!!",
    },
    {
      pt: "Recebi da minha comadre: vão fechar o postinho do bairro pra dar de graça pra estrangeiro. 😱",
      en: "Got it from a friend: they'll shut our health clinic to give it away for free to foreigners. 😱",
    },
    {
      pt: "MEU AMIGO É POLICIAL e ele disse que amanhã tem toque de recolher. Compra comida!!",
      en: "MY FRIEND IS A COP and he said there's a curfew tomorrow. Stock up on food!!",
    },
  ];
  if (t.property > 1.2)
    out.push({
      pt: "IPTU vai TRIPLICAR ano que vem, já tá assinado! Segura o barco vizinho.",
      en: "Property tax will TRIPLE next year, already signed! Hold on, neighbor.",
    });
  if (t.business > 6)
    out.push({
      pt: "Confirmado no gabinete: novo imposto pro comércio de esquina. VÃO QUEBRAR TUDO.",
      en: "Confirmed in city hall: new tax on corner shops. THEY'LL GO BROKE.",
    });
  if ((s.parallelPower?.policy?.doctrine ?? "") === "ostensive")
    out.push({
      pt: "Vazou áudio: operação vai invadir o beco de madrugada. Fica em casa!!",
      en: "Leaked audio: raid coming into the alley at dawn. Stay home!!",
    });
  if ((s.landConflict?.occupations?.length ?? 0) > 0)
    out.push({
      pt: "Os ocupantes do prédio do centro vão ganhar apartamento de graça e nós pagando! 🤡",
      en: "The downtown squatters will get free apartments while we foot the bill! 🤡",
    });
  return out;
}

const CHATTER: Array<{ pt: string; en: string }> = [
  { pt: "Bom dia grupo, alguém tem uma escada emprestada?", en: "Morning group, anyone got a ladder to borrow?" },
  { pt: "Missa hoje às 19h, todos convidados 🙏", en: "Mass tonight at 7pm, everyone welcome 🙏" },
  { pt: "Perdi meu gato, chama Salsicha. Se virem, avisem!", en: "Lost my cat, name's Sausage. Ping me if you see him!" },
  { pt: "Passando pra desejar bom dia pro grupo lindo ❤️", en: "Just dropping in to wish y'all a lovely morning ❤️" },
];

/* ------------------------------ Ticks ------------------------------------ */

/** Called from the DAILY tick — chance to post a new message. */
export function tickZapZapDaily(s: GameState, rng: Rng): void {
  ensureZapZap(s);
  const z = s.zapzap!;
  if (z.lastSpawnDay === s.day && s.day !== 1) return;

  // Boatos abertos represados: se já tem muita coisa pra resolver, o grupo esfria.
  const openFakes = z.messages.filter(m => m.kind === "fake" && !m.debunked).length;
  if (openFakes >= 3) return;

  // Baseline ~18% spawn rate/day, um pouco maior quando a desinformação ferve.
  const rate = 0.14 + z.misinformation / 700;
  if (rng.float() > rate) return;

  // Mix depends on the misinformation index and unresolved player issues.
  const fakeShare   = 0.12 + z.misinformation / 500;                 // 0.12..0.32
  const problemShare = 0.30 + (s.unemployment > 12 ? 0.15 : 0.05);
  const roll = rng.float();
  const kind: ZapMsgKind =
    roll < fakeShare ? "fake"
    : roll < fakeShare + problemShare ? "problem"
    : "chatter";

  // Escolhe template evitando repetir texto usado nas últimas 5 mensagens.
  const recentTexts = new Set(z.messages.slice(0, 5).map(m => m.textPt));
  const pool =
    kind === "fake"    ? fakeTemplates(s)
    : kind === "problem" ? problemTemplates(s)
    : CHATTER;
  const fresh = pool.filter(t => !recentTexts.has(t.pt));
  const tpl = fresh.length ? pick(rng, fresh) : pick(rng, pool);
  const npc = pick(rng, NPCS);

  const msg: ZapMessage = {
    id: `zap-${s.year}-${s.month}-${s.day}-${Math.floor(rng.float() * 9999)}`,
    kind,
    authorId: npc.id,
    authorPt: npc.pt,
    authorEn: npc.en,
    hue: npc.hue,
    textPt: tpl.pt,
    textEn: tpl.en,
    media: rng.float() < 0.35 ? (rng.float() < 0.5 ? "photo" : "video") : undefined,
    day: s.day, month: s.month, year: s.year,
    viral: kind === "fake" ? 25 + Math.floor(rng.float() * 45) : Math.floor(rng.float() * 25),
    reactions: Math.floor(rng.float() * 40),
  };

  z.messages = [msg, ...z.messages].slice(0, MAX_MESSAGES);
  z.unread = Math.min(99, z.unread + 1);
  z.lastSpawnDay = s.day;

  // Fake news slowly raises the misinformation index if not debunked.
  if (kind === "fake") z.misinformation = clamp(z.misinformation + msg.viral / 60, 0, 100);
}

/**
 * Called from the MONTHLY tick — collects budget, runs auto-debunks,
 * cools misinformation, evaluates protest risk, emits news items.
 */
export function tickZapZapMonthly(
  s: GameState,
  rng: Rng,
): {
  expenses: number;
  approvalDelta: number;
  happinessDelta: number;
  treasuryDelta: number;
  news: Array<Omit<NewsItem, "id" | "month" | "year" | "day">>;
} {
  ensureZapZap(s);
  const z = s.zapzap!;
  const out = { expenses: 0, approvalDelta: 0, happinessDelta: 0, treasuryDelta: 0,
                news: [] as Array<Omit<NewsItem, "id" | "month" | "year" | "day">> };

  // 1) Pay the comms office monthly cost.
  if (z.commsBudget > 0) {
    out.expenses = z.commsBudget;
    out.treasuryDelta -= z.commsBudget;
  }

  // 2) Auto-debunk up to N fake messages per month.
  const staff = staffFor(z.commsBudget);
  let capacity = staff * 3; // each analyst kills ~3 rumours/mo
  for (const m of z.messages) {
    if (capacity <= 0) break;
    if (m.kind === "fake" && !m.debunked) {
      m.debunked = true;
      z.debunkedTotal += 1;
      z.misinformation = clamp(z.misinformation - 5, 0, 100);
      capacity -= 1;
    }
  }

  // 3) Passive decay + drift from unresolved fakes.
  const unresolvedFakes = z.messages.filter(m => m.kind === "fake" && !m.debunked).length;
  const drift = unresolvedFakes * 1.2 - (staff > 0 ? 4 + staff * 1.5 : 0.5);
  z.misinformation = clamp(z.misinformation + drift, 0, 100);

  // 4) Protest-risk build-up. Above 75 → spawn protest.
  const heat = z.misinformation + unresolvedFakes * 2 - staff * 4;
  z.protestRisk = clamp(z.protestRisk * 0.75 + heat * 0.35, 0, 100);

  // Chronic exposure to misinformation nudges approval down.
  if (z.misinformation > 60) {
    out.approvalDelta -= Math.round((z.misinformation - 60) / 12);
    out.happinessDelta -= 1;
  } else if (z.misinformation < 30 && staff >= 2) {
    out.approvalDelta += 1;
  }

  if (z.protestRisk >= 75 && rng.float() < 0.55) {
    z.protestsFired += 1;
    z.protestRisk = 25;
    out.approvalDelta -= 6;
    out.happinessDelta -= 4;
    out.treasuryDelta -= 180_000; // property damage & policing costs
    out.expenses += 180_000;
    // Reset the loudest fakes so the loop doesn't re-fire immediately.
    for (const m of z.messages) if (m.kind === "fake" && !m.debunked) m.viral = Math.max(10, m.viral - 40);
    z.misinformation = clamp(z.misinformation - 12, 0, 100);

    out.news.push({
      kind: "danger",
      titleKey: "Protesto violento em frente à prefeitura, alimentado por boatos virais no ZapZap.||Violent protest at city hall, fueled by viral ZapZap rumors.",
    });

    // Post an "official" statement into the chat so the player sees the loop close.
    const official: ZapMessage = {
      id: `zap-off-${s.year}-${s.month}-${s.day}`,
      kind: "official",
      authorId: "prefeitura",
      authorPt: "Prefeitura", authorEn: "City Hall",
      hue: 220,
      textPt: "Prefeitura repudia atos violentos e reforça canais oficiais de informação.",
      textEn: "City Hall condemns the violence and reinforces official information channels.",
      day: s.day, month: s.month, year: s.year, viral: 100, reactions: 0, authoritative: true,
    };
    z.messages = [official, ...z.messages].slice(0, MAX_MESSAGES);
    z.unread = Math.min(99, z.unread + 1);
  }

  return out;
}

/* ------------------------------ Actions ---------------------------------- */

/** Player sets the monthly comms budget. Snaps to R$30k steps, 0..R$600k. */
export function setCommsBudget(s: GameState, value: number): GameState {
  ensureZapZap(s);
  const clamped = Math.max(0, Math.min(600_000, Math.round(value / 30_000) * 30_000));
  return { ...s, zapzap: { ...s.zapzap!, commsBudget: clamped } };
}

/** Player manually shuts down one fake — costs R$ 30k + 2 aprovação points. */
export function debunkMessage(s: GameState, id: string): GameState {
  ensureZapZap(s);
  const z = s.zapzap!;
  const idx = z.messages.findIndex(m => m.id === id);
  if (idx < 0) return s;
  const m = z.messages[idx];
  if (m.debunked || m.kind !== "fake") return s;
  if (s.treasury < 30_000) return s;

  const messages = z.messages.slice();
  messages[idx] = { ...m, debunked: true, viral: Math.max(5, m.viral - 60) };
  return {
    ...s,
    treasury: s.treasury - 30_000,
    approval: clamp(s.approval + 1, 0, 100),
    zapzap: {
      ...z,
      messages,
      misinformation: clamp(z.misinformation - 9, 0, 100),
      debunkedTotal: z.debunkedTotal + 1,
    },
  };
}

/** Marks the panel as read. */
export function markChatRead(s: GameState): GameState {
  ensureZapZap(s);
  return { ...s, zapzap: { ...s.zapzap!, unread: 0 } };
}

/* ------------------------------ Utility ---------------------------------- */

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
