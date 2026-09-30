/**
 * Caricature politician presets — playable pre-baked mayors.
 *
 * Each persona is a *caricature* (not a portrayal) of a public figure. Names
 * are deliberately mangled, quotes are fictional, and the perks are stylized
 * shorthand for the archetype (welfare-first vs pro-business, technocrat vs
 * populist, etc.), not a factual claim about the real person.
 *
 * Perks apply on top of `initialState`'s defaults at game start via
 * `initialState(...)`. Everything else — approval erosion, policy costs,
 * political coalitions — flows through the normal simulation afterwards.
 */

import type { GameState, PolicyKey, TaxKey, SustainabilityKey } from "./types";
import type { Mayor } from "./mayor";

export type PoliticianTag =
  | "leftPopulist"
  | "socialDemocrat"
  | "centristTechnocrat"
  | "liberalReformist"
  | "conservativeRight"
  | "radicalRight"
  | "developmentalist"
  | "nationalist"
  | "environmentalist"
  | "welfareFocus"
  | "proBusiness"
  | "moderate";

export interface PoliticianPerks {
  /** Starting policy overrides (0..100). */
  policies?: Partial<Record<PolicyKey, number>>;
  /** Starting tax overrides. */
  taxes?: Partial<Record<TaxKey, number>>;
  /** Starting sustainability program funding. */
  sustainability?: Partial<Record<SustainabilityKey, number>>;
  /** Approval bump/penalty at inauguration. */
  approval?: number;
  /** Happiness bump/penalty at inauguration. */
  happiness?: number;
  /** Treasury adjustment (positive = grant, negative = starting debt burden). */
  treasury?: number;
}

export interface PoliticianPreset {
  id: string;
  /** Fictional caricature name (never the real person's name). */
  name: string;
  title: string;
  /** Ideology on the -1 (far left) .. +1 (far right) axis. */
  ideology: number;
  tags: PoliticianTag[];
  /** Short bio + fictional signature quote — PT / EN. */
  bio: { pt: string; en: string };
  quote: { pt: string; en: string };
  perks: PoliticianPerks;
}

/**
 * The full roster. Order = display order in the picker.
 */
export const POLITICIAN_PRESETS: PoliticianPreset[] = [
  /* ---------------- International example given by the design brief -------- */
  {
    id: "sarack_ojama",
    name: "Sarack Ojama",
    title: "Prefeito",
    ideology: -0.15,
    tags: ["liberalReformist", "moderate", "centristTechnocrat"],    bio: {
      pt: "Advogado eloquente e progressista moderado. Aposta em consensos e reformas graduais.",
      en: "Eloquent lawyer and moderate progressive. Bets on consensus and gradual reform.",
    },
    quote: {
      pt: "Sim, nós podemos — desde que sentemos à mesma mesa.",
      en: "Yes we can — as long as we sit at the same table.",
    },
    perks: {
      policies: { education: 62, health: 60, transport: 55 },
      approval: 8,
      happiness: 4,
    },
  },

  /* ---------------- 12 Brazilian caricatures ------------------------------- */
  {
    id: "zuza",
    name: "Zuza",
    title: "Prefeito",
    ideology: -0.6,
    tags: ["leftPopulist", "welfareFocus", "developmentalist"],    bio: {
      pt: "Ex-metalúrgico com voz rouca e discurso de fábrica. Prioridade absoluta: renda para os mais pobres.",
      en: "Former metalworker with a raspy voice and factory-floor rhetoric. Top priority: income for the poorest.",
    },
    quote: {
      pt: "Ninguém solta a mão de ninguém — nem no fim do mês.",
      en: "No one lets go of anyone's hand — not even at month's end.",
    },
    perks: {
      policies: { education: 65, health: 70, security: 45, transport: 55 },
      taxes: { income: 16, business: 14 },
      approval: 10, happiness: 6, treasury: -80_000,
    },
  },
  {
    id: "facir_bonossauro",
    name: "Facir Bonossauro",
    title: "Prefeito",
    ideology: 0.85,
    tags: ["radicalRight", "conservativeRight", "proBusiness", "nationalist"],    bio: {
      pt: "Ex-oficial de discurso agressivo. Programa: mão pesada na segurança e liberdade total para empresários.",
      en: "Ex-officer with a combative style. Platform: hard-line security and full freedom for business.",
    },
    quote: {
      pt: "Cidade sem cabresto — só ordem e mercado livre.",
      en: "No leash on this city — just order and a free market.",
    },
    perks: {
      policies: { security: 78, education: 38, health: 40, transport: 35 },
      taxes: { income: 8, business: 6, property: 4 },
      sustainability: { renewables: 5, emissions: 0, greenTransit: 5 },
      approval: -4, happiness: -2, treasury: 60_000,
    },
  },
  {
    id: "zeitu_vargas",
    name: "Zeitú Vargast",
    title: "Prefeito",
    ideology: -0.1,
    tags: ["developmentalist", "nationalist", "welfareFocus"],    bio: {
      pt: "Estilo formal, charuto na mão. Constrói indústria e leis trabalhistas com a mesma caneta.",
      en: "Formal style, cigar in hand. Builds industry and labor law with the same pen.",
    },
    quote: {
      pt: "Trabalhador é a pátria — e a pátria vai ao trabalho.",
      en: "The worker is the nation — and the nation goes to work.",
    },
    perks: {
      policies: { education: 55, health: 55, security: 60, transport: 60 },
      taxes: { income: 14, business: 12 },
      approval: 6, treasury: 120_000,
    },
  },
  {
    id: "jusselino",
    name: "Jusselino Kubček",
    title: "Prefeito",
    ideology: -0.05,
    tags: ["developmentalist", "liberalReformist", "moderate"],    bio: {
      pt: "Sorriso largo e promessa de crescimento acelerado — cinquenta anos de progresso em cinco.",
      en: "Wide smile and a promise of accelerated growth — fifty years of progress in five.",
    },
    quote: {
      pt: "Cinco anos em cinco meses, se derem licença.",
      en: "Five years in five months, if you'll let me.",
    },
    perks: {
      policies: { transport: 70, education: 55, security: 45 },
      taxes: { property: 8 },
      treasury: 200_000,
      approval: 5,
    },
  },
  {
    id: "jango_gular",
    name: "Jangó Golar",
    title: "Prefeito",
    ideology: -0.5,
    tags: ["leftPopulist", "welfareFocus", "socialDemocrat"],    bio: {
      pt: "Reformista de fala mansa. Quer redistribuir terra, alfabetizar e regular capital estrangeiro.",
      en: "Soft-spoken reformist. Wants to redistribute land, teach literacy and regulate foreign capital.",
    },
    quote: {
      pt: "Reforma de base é urgência, não paciência.",
      en: "Structural reform is urgency, not patience.",
    },
    perks: {
      policies: { education: 68, health: 60, security: 40 },
      taxes: { business: 14 },
      approval: -3,
    },
  },
  {
    id: "terzredo",
    name: "Terzredo Nevesco",
    title: "Prefeito",
    ideology: -0.05,
    tags: ["moderate", "centristTechnocrat", "liberalReformist"],    bio: {
      pt: "Conciliador silencioso. Costura acordos entre esquerda e centro, com paciência de mineiro.",
      en: "Quiet conciliator. Threads deals between left and center with mineiro patience.",
    },
    quote: {
      pt: "Não se apressa quem sabe onde vai chegar.",
      en: "Those who know where they're going don't need to rush.",
    },
    perks: {
      policies: { education: 58, health: 58, security: 52, transport: 50 },
      approval: 12, happiness: 3,
    },
  },
  {
    id: "sarney_norte",
    name: "Sarnei do Norte",
    title: "Prefeito",
    ideology: 0.2,
    tags: ["conservativeRight", "proBusiness", "moderate"],    bio: {
      pt: "Cacique de longa duração. Sabe fazer nomeações, ganhar tempo e sobreviver a crises.",
      en: "Long-running political boss. Knows how to hand out posts, buy time and outlast crises.",
    },
    quote: {
      pt: "Governar é durar.",
      en: "To govern is to endure.",
    },
    perks: {
      policies: { transport: 50, security: 55 },
      taxes: { business: 8 },
      treasury: 80_000, approval: -2,
    },
  },
  {
    id: "collor_melão",
    name: "Coló de Melão",
    title: "Prefeito",
    ideology: 0.35,
    tags: ["liberalReformist", "proBusiness", "conservativeRight"],    bio: {
      pt: "Jovem, telegênico, discurso anti-corrupção — e um estilo de gastos que dá manchete.",
      en: "Young, telegenic, anti-corruption speeches — and a spending style that makes headlines.",
    },
    quote: {
      pt: "Vou caçar os marajás — depois do almoço.",
      en: "I'll chase the fat cats — after lunch.",
    },
    perks: {
      policies: { security: 55, education: 45 },
      taxes: { income: 10, business: 8 },
      approval: 6, treasury: -40_000,
    },
  },
  {
    id: "fhc_carvalho",
    name: "Fernando Enrique Carvalho",
    title: "Prefeito",
    ideology: 0.15,
    tags: ["centristTechnocrat", "liberalReformist", "socialDemocrat"],    bio: {
      pt: "Sociólogo de tom professoral. Estabiliza moeda, fala em três idiomas e assusta a inflação.",
      en: "Sociologist with a professorial tone. Stabilizes the currency, speaks three languages and scares off inflation.",
    },
    quote: {
      pt: "Esqueçam o que escrevi — leiam o que estou fazendo.",
      en: "Forget what I wrote — read what I'm doing.",
    },
    perks: {
      policies: { education: 62, health: 55, transport: 45 },
      taxes: { income: 13, business: 11 },
      // Special: strong opening against inflation — reflected as treasury cushion.
      treasury: 150_000,
    },
  },
  {
    id: "dilmara",
    name: "Dilmara Housseffi",
    title: "Prefeita",
    ideology: -0.4,
    tags: ["socialDemocrat", "welfareFocus", "developmentalist"],    bio: {
      pt: "Economista de linha dura. Pilota megaprojetos, controla energia e não tem paciência para floreios.",
      en: "Hard-line economist. Steers megaprojects, controls energy and has no patience for flourishes.",
    },
    quote: {
      pt: "Não vou entregar o meu governo pela porta dos fundos.",
      en: "I will not hand over my government through the back door.",
    },
    perks: {
      policies: { education: 60, health: 62, transport: 55 },
      sustainability: { renewables: 25, greenTransit: 20 },
      approval: 4, treasury: -50_000,
    },
  },
  {
    id: "temerario",
    name: "Michel Temerário",
    title: "Prefeito",
    ideology: 0.5,
    tags: ["conservativeRight", "proBusiness", "moderate"],    bio: {
      pt: "Advogado discreto, sempre de terno escuro. Costura maiorias no atacado e teto de gastos no varejo.",
      en: "Discreet lawyer, always in dark suits. Wholesales majorities and retails spending caps.",
    },
    quote: {
      pt: "Ponte para o futuro — pedágio incluído.",
      en: "Bridge to the future — toll included.",
    },
    perks: {
      policies: { education: 42, health: 42, security: 55, transport: 45 },
      taxes: { income: 10, business: 7 },
      approval: -10, treasury: 90_000,
    },
  },
  {
    id: "marina_prata",
    name: "Marina da Prata",
    title: "Prefeita",
    ideology: -0.15,
    tags: ["environmentalist", "moderate", "socialDemocrat"],    bio: {
      pt: "Voz calma da floresta. Coloca clima e ética no centro — mesmo quando custa apoio empresarial.",
      en: "The forest's calm voice. Puts climate and ethics at the center — even when it costs business support.",
    },
    quote: {
      pt: "Não há economia em planeta morto.",
      en: "There is no economy on a dead planet.",
    },
    perks: {
      policies: { education: 60, health: 55, transport: 60 },
      sustainability: { renewables: 45, emissions: 40, greenTransit: 45 },
      approval: 3, happiness: 4, treasury: -30_000,
    },
  },
  {
    id: "vitinho_viana",
    name: "Vitinho Viana",
    title: "Prefeito",
    ideology: -0.05,
    tags: ["liberalReformist", "moderate", "centristTechnocrat"],    bio: {
      pt: "Ex-vereador mais jovem da Câmara, virou celebridade fiscalizando obra atrasada no PiuPiu. Trocou o mandato pelo Executivo com discurso de transparência total.",
      en: "The city council's youngest member turned social-media celebrity by live-streaming late public works. Traded the legislative seat for the mayor's office on a full-transparency platform.",
    },
    quote: {
      pt: "Se não cabe no story, é porque não devia ter sido assinado.",
      en: "If it doesn't fit in a story, it shouldn't have been signed.",
    },
    perks: {
      policies: { education: 60, health: 55, transport: 55, security: 45 },
      taxes: { income: 12, business: 10, property: 3 },
      approval: 6, happiness: 3, treasury: -20_000,
    },
  },
  {
    id: "chupetikolas",
    name: "Chupetikolas Mameira",
    title: "Prefeito",
    ideology: 0.75,
    tags: ["radicalRight", "conservativeRight", "nationalist"],    bio: {
      pt: "Deputado mais jovem e mais viral da direita. Vive de corte de reels, provocação em plenário e chupeta na tribuna para dar palco ao adversário.",
      en: "The right wing's youngest and most viral congressman. Lives off reel clips, plenary provocations, and pulling out a pacifier at the podium to troll opponents.",
    },
    quote: {
      pt: "Se o adversário chorou, o corte já viralizou.",
      en: "If the opponent cried, the clip already went viral.",
    },
    perks: {
      policies: { security: 70, education: 40, health: 42, transport: 40 },
      taxes: { income: 9, business: 7, property: 5 },
      approval: 4, happiness: -2, treasury: 30_000,
    },
  },
  {
    id: "kenny_katacoco",
    name: "Kenny Katacoco",
    title: "Prefeito",
    ideology: 0.55,
    tags: ["liberalReformist", "proBusiness", "conservativeRight"],    bio: {
      pt: "Ex-líder de movimento de rua virou o deputado mais jovem da Câmara. Libertário, meme fácil e planilha na mão para defender corte de gasto e Estado mínimo.",
      en: "Former street-movement leader turned the House's youngest congressman. Libertarian, meme-ready and armed with spreadsheets to defend spending cuts and a minimal state.",
    },
    quote: {
      pt: "Menos Estado, mais liberdade — e mais story pra provar.",
      en: "Less state, more freedom — and more stories to prove it.",
    },
    perks: {
      policies: { education: 50, health: 40, security: 55, transport: 45 },
      taxes: { income: 8, business: 6, property: 4 },
      approval: 3, happiness: 0, treasury: 70_000,
    },
  },
];


export function findPolitician(id: string): PoliticianPreset | undefined {
  return POLITICIAN_PRESETS.find((p) => p.id === id);
}

/**
 * Convert a caricature preset to a Mayor object (usable directly by
 * `initialState`). `personaId` tags the mayor so `applyPoliticianPerks` can
 * be re-applied deterministically.
 */
export function politicianToMayor(preset: PoliticianPreset): Mayor {
  return {
    name: preset.name,
    title: preset.title,    personaId: preset.id,
  };
}

/**
 * Mutates the state in place to apply perks. Called by `initialState` after
 * the city preset overrides so persona effects always win the tie.
 */
export function applyPoliticianPerks(state: GameState, personaId: string): void {
  const p = findPolitician(personaId);
  if (!p) return;
  const perks = p.perks;
  if (perks.policies) {
    state.policies = { ...state.policies, ...perks.policies };
  }
  if (perks.taxes) {
    state.taxes = { ...state.taxes, ...perks.taxes };
  }
  if (perks.sustainability) {
    state.sustainability = { ...state.sustainability, ...perks.sustainability };
  }
  if (typeof perks.approval === "number") {
    state.approval = clamp(state.approval + perks.approval, 0, 100);
  }
  if (typeof perks.happiness === "number") {
    state.happiness = clamp(state.happiness + perks.happiness, 0, 100);
  }
  if (typeof perks.treasury === "number") {
    state.treasury += perks.treasury;
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
