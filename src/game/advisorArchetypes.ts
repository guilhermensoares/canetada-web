/**
 * Arquétipos satíricos + genéricos para geração de assessores.
 *
 * Cada arquétipo é uma persona pré-desenhada (nome satírico, biografia curta,
 * pasta preferida, faixa de estrelas / lealdade / potencial, alinhamento
 * partidário) inspirada em figuras da política brasileira SEM usar nomes
 * reais. Também há arquétipos "genéricos" (tecnocrata, coronel, ativista,
 * etc.) para diversidade da pool.
 */

import type { PortfolioId, PartyAlignment } from "./advisors";

export type ArchetypeCategory = "presidencial" | "governador" | "prefeito" | "parlamentar" | "historico" | "generico";

export interface AdvisorArchetype {
  id: string;
  name: string;              // nome satírico
  bio: string;               // 1 frase — apresenta o personagem
  category: ArchetypeCategory;
  portfolios: PortfolioId[]; // pastas em que costuma se sair bem
  party: PartyAlignment;
  overallRange: [number, number];  // 1..5
  loyaltyRange: [number, number];  // 0..100 (lealdade "neutra" — antes de aplicar afinidade)
  potentialRange: [number, number];
  ageRange: [number, number];
  traits: string[];          // rótulos curtos (satíricos)
  salaryMult?: number;       // >1 → ícones cobram caro
  /**
   * Posição ideológica na régua -1 (esquerda) .. +1 (direita).
   * Quando ausente cai para `PARTY_IDEOLOGY[party]`. Sobrescreva quando a
   * caricatura for mais radical que o partido "casa" (ex.: militar de
   * extrema-direita filiado a partido de centro).
   */
  ideology?: number;
}

/** Ideologia média por sigla fictícia — usada como fallback e para computar
 *  afinidade entre assessor e prefeito quando o arquétipo não define ideology. */
export const PARTY_IDEOLOGY: Record<PartyAlignment, number> = {
  PLab: -0.6,
  PSOB: -0.05,
  "P-CENTRO": 0.0,
  PDR: 0.65,
  TEC: 0.0,
};

/** Devolve a posição ideológica efetiva do arquétipo (-1..+1). */
export function archetypeIdeology(a: AdvisorArchetype): number {
  return a.ideology ?? PARTY_IDEOLOGY[a.party] ?? 0;
}


// ------------------------------------------------------------------ //
// Presidentes (caricaturas)                                          //
// ------------------------------------------------------------------ //
const PRESIDENTIAIS: AdvisorArchetype[] = [
  {
    id: "arq_luis_da_silva",
    name: "Luizinho da Sirva",
    bio: "Metalúrgico virou articulador. Fala em cordel e negocia como ninguém.",
    category: "presidencial",
    portfolios: ["articulation", "works"],
    party: "PLab",
    overallRange: [4, 5],
    loyaltyRange: [60, 85],
    potentialRange: [30, 60],
    ageRange: [65, 78],
    traits: ["Carisma popular", "Negociador"],
    salaryMult: 1.35,
  },
  {
    id: "arq_bonossauro",
    ideology: 0.9,
    name: "Capitão Bonossauro",
    bio: "Ex-militar de fala grossa. Manda antes de ouvir e adora fardas.",
    category: "presidencial",
    portfolios: ["articulation"],
    party: "PDR",
    overallRange: [2, 3],
    loyaltyRange: [50, 80],
    potentialRange: [10, 30],
    ageRange: [58, 70],
    traits: ["Autoritário", "Base de apoio ruidosa"],
    salaryMult: 1.15,
  },
  {
    id: "arq_dilmara",
    name: "Dilmara Housseffi",
    bio: "Engenheira de coração. Odeia meta que muda no meio do caminho.",
    category: "presidencial",
    portfolios: ["works", "finance"],
    party: "PLab",
    overallRange: [3, 4],
    loyaltyRange: [75, 95],
    potentialRange: [15, 35],
    ageRange: [70, 80],
    traits: ["Técnica", "Pouco jogo de cintura"],
  },
  {
    id: "arq_fhc",
    name: "Fernando Enrique Carvalho",
    bio: "Sociólogo virou operador macro. Fala grego, latim e Selic.",
    category: "presidencial",
    portfolios: ["finance", "articulation"],
    party: "PSOB",
    overallRange: [4, 5],
    loyaltyRange: [55, 75],
    potentialRange: [15, 30],
    ageRange: [78, 90],
    traits: ["Erudito", "Ancorou moeda"],
    salaryMult: 1.30,
  },
  {
    id: "arq_collor",
    name: "Coló de Melão",
    bio: "Jovem caçador de marajás. Guarda dinheiro em conta que ninguém acha.",
    category: "presidencial",
    portfolios: ["finance"],
    party: "P-CENTRO",
    overallRange: [2, 3],
    loyaltyRange: [15, 40],
    potentialRange: [20, 45],
    ageRange: [55, 68],
    traits: ["Marketeiro", "Escândalos pendentes"],
  },
  {
    id: "arq_itamar",
    name: "Itamário Piranguinho",
    bio: "Vice discreto que virou chefe. Coleciona ternos e amigos leais.",
    category: "presidencial",
    portfolios: ["articulation", "finance"],
    party: "P-CENTRO",
    overallRange: [3, 4],
    loyaltyRange: [70, 90],
    potentialRange: [10, 25],
    ageRange: [70, 82],
    traits: ["Conciliador", "Discreto"],
  },
];

// ------------------------------------------------------------------ //
// Governadores / Prefeitos                                           //
// ------------------------------------------------------------------ //
const REGIONAIS: AdvisorArchetype[] = [
  {
    id: "arq_marchola",
    name: "Marchola do Rincão",
    bio: "Governador rural que promete asfalto e cumpre metade.",
    category: "governador",
    portfolios: ["works", "articulation"],
    party: "P-CENTRO",
    overallRange: [2, 3],
    loyaltyRange: [50, 70],
    potentialRange: [20, 40],
    ageRange: [50, 65],
    traits: ["Populista", "Fisiológico"],
  },
  {
    id: "arq_dória_paulista",
    name: "João Doriano",
    bio: "Empresário 'gestor'. Vende cidade como marca e vive de manchete.",
    category: "prefeito",
    portfolios: ["finance", "works"],
    party: "PSOB",
    overallRange: [3, 4],
    loyaltyRange: [30, 55],
    potentialRange: [15, 35],
    ageRange: [55, 68],
    traits: ["Marketeiro", "Foco em imagem"],
    salaryMult: 1.20,
  },
  {
    id: "arq_haddad",
    name: "Haddade Fernando",
    bio: "Economista e professor. Fecha o Orçamento em planilha antes do café e ainda debate arcabouço fiscal no jantar.",
    category: "prefeito",
    portfolios: ["finance", "articulation"],
    party: "PLab",
    overallRange: [4, 5],
    loyaltyRange: [70, 90],
    potentialRange: [15, 35],
    ageRange: [55, 65],
    traits: ["Economia", "Acadêmico", "Arcabouço fiscal"],
    salaryMult: 1.10,
  },
  {
    id: "arq_paulomaluf",
    name: "Paulo Maulof",
    bio: "Eterno prefeito das grandes obras. 'Rouba mas faz' é seu lema.",
    category: "prefeito",
    portfolios: ["works"],
    party: "PDR",
    overallRange: [4, 5],
    loyaltyRange: [10, 35],
    potentialRange: [5, 20],
    ageRange: [78, 92],
    traits: ["Obras grandes", "Suspeitas antigas"],
    salaryMult: 1.25,
  },
  {
    id: "arq_bruno_covid",
    name: "Bruno Coviás",
    bio: "Prefeito tarimbado do gabinete. Sabe onde cada verba está parada.",
    category: "prefeito",
    portfolios: ["finance", "mobility"],
    party: "PSOB",
    overallRange: [3, 4],
    loyaltyRange: [65, 85],
    potentialRange: [15, 30],
    ageRange: [40, 55],
    traits: ["Gestor discreto"],
  },
  {
    id: "arq_zema",
    name: "Rominho Zêma",
    bio: "Herdeiro de rede de eletroeletrônicos. Corta gasto igual quem cala freezer.",
    category: "governador",
    portfolios: ["finance"],
    party: "P-CENTRO",
    overallRange: [3, 4],
    loyaltyRange: [55, 75],
    potentialRange: [15, 30],
    ageRange: [55, 65],
    traits: ["Cortador de gasto"],
  },
];

// ------------------------------------------------------------------ //
// Parlamentares / Ministros                                          //
// ------------------------------------------------------------------ //
const PARLAMENTARES: AdvisorArchetype[] = [
  {
    id: "arq_ciro_gomes",
    name: "Cirano Gomas",
    bio: "PhD em berrar. Diagnóstico brilhante, coalizão zero.",
    category: "parlamentar",
    portfolios: ["finance", "articulation"],
    party: "P-CENTRO",
    overallRange: [4, 5],
    loyaltyRange: [40, 65],
    potentialRange: [10, 25],
    ageRange: [60, 72],
    traits: ["Explosivo", "Genial em macro"],
    salaryMult: 1.20,
  },
  {
    id: "arq_gleisi",
    ideology: -0.7,
    name: "Gleici Rufino",
    bio: "Presidente de partido. Whip implacável quando o líder pede.",
    category: "parlamentar",
    portfolios: ["articulation"],
    party: "PLab",
    overallRange: [3, 4],
    loyaltyRange: [80, 95],
    potentialRange: [15, 30],
    ageRange: [50, 62],
    traits: ["Líder de bancada"],
  },
  {
    id: "arq_arthur_lira",
    name: "Artur Liragás",
    bio: "Cacique alagoano. Sabe o preço exato de cada voto na Câmara.",
    category: "parlamentar",
    portfolios: ["articulation"],
    party: "P-CENTRO",
    overallRange: [4, 5],
    loyaltyRange: [25, 45],
    potentialRange: [10, 25],
    ageRange: [50, 60],
    traits: ["Fisiológico", "Rei do orçamento secreto"],
    salaryMult: 1.30,
  },
  {
    id: "arq_flavio",
    ideology: 0.75,
    name: "Fávio Bonossauro",
    bio: "Senador herdeiro. Rachadinha na ficha, sorriso na frente da câmera.",
    category: "parlamentar",
    portfolios: ["articulation"],
    party: "PDR",
    overallRange: [1, 2],
    loyaltyRange: [20, 45],
    potentialRange: [10, 25],
    ageRange: [40, 50],
    traits: ["Nepotismo", "Investigado"],
  },
  {
    id: "arq_tabata",
    name: "Tabátha Ementário",
    bio: "Deputada nova geração. Planilhas, PowerPoint e cara de aluna 10 — vive de PL sobre educação e ajuste fiscal.",
    category: "parlamentar",
    portfolios: ["finance", "articulation"],
    party: "PSOB",
    overallRange: [3, 4],
    loyaltyRange: [65, 85],
    potentialRange: [50, 80],
    ageRange: [30, 40],
    traits: ["Jovem", "Data-driven", "Educação"],
  },
  {
    id: "arq_dr_drauzio",
    name: "Dr. Drauzino",
    bio: "Médico famoso. UBS, campanha contra tabaco, TV Globa.",
    category: "generico",
    portfolios: ["health"],
    party: "TEC",
    overallRange: [4, 5],
    loyaltyRange: [70, 90],
    potentialRange: [10, 20],
    ageRange: [70, 82],
    traits: ["Prestígio médico"],
    salaryMult: 1.25,
  },
  {
    id: "arq_vitinho_viana",
    name: "Vitinho Viana",
    bio: "Vereador mais jovem da Câmara. Vive de celular na mão fiscalizando obra atrasada e nota fiscal suspeita.",
    category: "parlamentar",
    portfolios: ["articulation", "finance"],
    party: "PSOB",
    overallRange: [3, 4],
    loyaltyRange: [80, 95],
    potentialRange: [70, 95],
    ageRange: [24, 28],
    traits: ["Jovem", "Fiscalizador", "Rede social"],
  },
  {
    id: "arq_chupetikolas",
    ideology: 0.85,
    name: "Chupetikolas Mameira",
    bio: "Deputado mais jovem e mais viral da direita. Vive de corte de reels, provocação em plenário e chupeta na tribuna.",
    category: "parlamentar",
    portfolios: ["articulation"],
    party: "PDR",
    overallRange: [3, 4],
    loyaltyRange: [40, 65],
    potentialRange: [70, 95],
    ageRange: [26, 32],
    traits: ["Jovem", "Viral", "Provocador", "Reels"],
    salaryMult: 1.15,
  },
  {
    id: "arq_kenny_katacoco",
    ideology: 0.35,
    name: "Kenny Katacoco",
    bio: "Ex-líder de movimento de rua virou deputado. Libertário, meme fácil e discurso econômico afiado — quando não trava.",
    category: "parlamentar",
    portfolios: ["finance", "articulation"],
    party: "P-CENTRO",
    overallRange: [3, 4],
    loyaltyRange: [35, 60],
    potentialRange: [65, 90],
    ageRange: [26, 34],
    traits: ["Jovem", "Libertário", "Meme", "Discurso econômico"],
    salaryMult: 1.10,
  },
];


// ------------------------------------------------------------------ //
// Históricos                                                          //
// ------------------------------------------------------------------ //
const HISTORICOS: AdvisorArchetype[] = [
  {
    id: "arq_getúlio",
    name: "Getulinho Vargast",
    bio: "Autoritário paternalista. Legisla por decreto entre um charuto e outro.",
    category: "historico",
    portfolios: ["finance", "articulation"],
    party: "P-CENTRO",
    overallRange: [4, 5],
    loyaltyRange: [60, 80],
    potentialRange: [10, 20],
    ageRange: [60, 75],
    traits: ["Estadista", "Autoritário"],
    salaryMult: 1.20,
  },
  {
    id: "arq_juscelino",
    name: "Jussé Kubček",
    bio: "'50 anos em 5'. Cria capital no cerrado e dorme quatro horas por noite.",
    category: "historico",
    portfolios: ["works"],
    party: "P-CENTRO",
    overallRange: [4, 5],
    loyaltyRange: [70, 90],
    potentialRange: [15, 30],
    ageRange: [55, 68],
    traits: ["Desenvolvimentista", "Otimista"],
    salaryMult: 1.15,
  },
  {
    id: "arq_brizola",
    ideology: -0.55,
    name: "Leonel Brissolino",
    bio: "Trabalhista gaúcho de brigadinha. Escola-parque em cada esquina.",
    category: "historico",
    portfolios: ["works", "health"],
    party: "PLab",
    overallRange: [3, 4],
    loyaltyRange: [70, 90],
    potentialRange: [15, 30],
    ageRange: [65, 78],
    traits: ["Reformista", "Estilo populista"],
  },
];

// ------------------------------------------------------------------ //
// Genéricos (não paródia direta) — dão diversidade de perfil.        //
// ------------------------------------------------------------------ //
const GENERICOS: AdvisorArchetype[] = [
  {
    id: "arq_tec_bc",
    name: "Ana Furlani",
    bio: "Ex-BC. Fala em juros reais no jantar de família.",
    category: "generico",
    portfolios: ["finance"],
    party: "TEC",
    overallRange: [4, 5],
    loyaltyRange: [60, 80],
    potentialRange: [20, 40],
    ageRange: [40, 55],
    traits: ["Ortodoxa", "Notório saber"],
    salaryMult: 1.30,
  },
  {
    id: "arq_engenheira_metro",
    name: "Beatriz Camargolo",
    bio: "Engenheira de mobilidade. Não dorme enquanto tem linha inaugurando.",
    category: "generico",
    portfolios: ["mobility", "works"],
    party: "TEC",
    overallRange: [3, 5],
    loyaltyRange: [70, 90],
    potentialRange: [25, 50],
    ageRange: [38, 52],
    traits: ["Foco em obra", "Perfeccionista"],
  },
  {
    id: "arq_ativista_saude",
    ideology: -0.5,
    name: "Padre Genésio",
    bio: "Militante de UBS na periferia. Sabe nome de cada agente comunitário.",
    category: "generico",
    portfolios: ["health", "articulation"],
    party: "PLab",
    overallRange: [3, 4],
    loyaltyRange: [85, 100],
    potentialRange: [20, 40],
    ageRange: [45, 62],
    traits: ["Base comunitária"],
  },
  {
    id: "arq_influencer",
    name: "Kaká Vibe",
    bio: "Influencer virou secretário. Grava reels em obra parada.",
    category: "generico",
    portfolios: ["articulation", "mobility"],
    party: "P-CENTRO",
    overallRange: [1, 3],
    loyaltyRange: [30, 55],
    potentialRange: [40, 70],
    ageRange: [26, 34],
    traits: ["Reels", "Sem experiência"],
  },
  {
    id: "arq_coronel",
    ideology: 0.55,
    name: "Coronel Marreco",
    bio: "PM aposentado. Fala em 'ordem' e desconfia de sociólogo.",
    category: "generico",
    portfolios: ["articulation"],
    party: "PDR",
    overallRange: [2, 3],
    loyaltyRange: [55, 80],
    potentialRange: [10, 25],
    ageRange: [55, 68],
    traits: ["Linha-dura"],
  },
  {
    id: "arq_burocrata",
    name: "Sebastião Almanaque",
    bio: "Servidor de carreira há 30 anos. Conhece cada portaria por número.",
    category: "generico",
    portfolios: ["finance", "works"],
    party: "TEC",
    overallRange: [3, 4],
    loyaltyRange: [75, 95],
    potentialRange: [5, 15],
    ageRange: [55, 68],
    traits: ["Burocrata", "Confiável"],
  },
  {
    id: "arq_empreiteira",
    name: "Guilherme Concreto",
    bio: "Ex-diretor de construtora. Sabe onde cada aditivo cabe.",
    category: "generico",
    portfolios: ["works"],
    party: "P-CENTRO",
    overallRange: [3, 4],
    loyaltyRange: [20, 45],
    potentialRange: [10, 25],
    ageRange: [50, 65],
    traits: ["Conflito de interesse"],
    salaryMult: 1.10,
  },
  {
    id: "arq_jovem_promessa",
    name: "Duda Prata",
    bio: "Mestranda em políticas públicas. Ainda paga aluguel em kitnet.",
    category: "generico",
    portfolios: ["health", "finance", "mobility"],
    party: "PLab",
    overallRange: [2, 3],
    loyaltyRange: [70, 90],
    potentialRange: [70, 100],
    ageRange: [26, 33],
    traits: ["Promissora", "Baixo custo"],
  },
];

export const ADVISOR_ARCHETYPES: AdvisorArchetype[] = [
  ...PRESIDENTIAIS,
  ...REGIONAIS,
  ...PARLAMENTARES,
  ...HISTORICOS,
  ...GENERICOS,
];

export function archetypesForPortfolio(p: PortfolioId): AdvisorArchetype[] {
  return ADVISOR_ARCHETYPES.filter((a) => a.portfolios.includes(p));
}

export function findArchetype(id: string): AdvisorArchetype | undefined {
  return ADVISOR_ARCHETYPES.find((a) => a.id === id);
}
