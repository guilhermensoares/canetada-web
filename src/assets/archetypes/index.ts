/**
 * Pixel-art archetypes for custom mayors.
 *
 * A player who doesn't pick a caricature persona picks an archetype instead.
 * The archetype is the visual identity (sprite + label). It carries no
 * gameplay perks — those come from persona presets only.
 */
import empresario from "./empresario.png";
import pastora from "./pastora.png";
import sindicalista from "./sindicalista.png";
import professora from "./professora.png";
import militar from "./militar.png";
import medico from "./medico.png";
import engenheiro from "./engenheiro.png";
import ativista from "./ativista.png";
import advogada from "./advogada.png";
import agropecuarista from "./agropecuarista.png";
import youtuber from "./youtuber.png";
import veterana from "./veterana.png";

export type ArchetypeId =
  | "empresario"
  | "pastora"
  | "sindicalista"
  | "professora"
  | "militar"
  | "medico"
  | "engenheiro"
  | "ativista"
  | "advogada"
  | "agropecuarista"
  | "youtuber"
  | "veterana";

export interface Archetype {
  id: ArchetypeId;
  portrait: string;
  namePt: string;
  nameEn: string;
  descPt: string;
  descEn: string;
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "empresario",
    portrait: empresario,
    namePt: "Empresário",
    nameEn: "Businessman",
    descPt: "Terno alinhado, planilha na cabeça. Fala em eficiência e ROI.",
    descEn: "Sharp suit, spreadsheet mind. Speaks in efficiency and ROI.",
  },
  {
    id: "pastora",
    portrait: pastora,
    namePt: "Pastora",
    nameEn: "Pastor",
    descPt: "Bíblia na mão, base fiel na igreja e nos grupos do ZapZap.",
    descEn: "Bible in hand, base loyal in church and ZapZap groups.",
  },
  {
    id: "sindicalista",
    portrait: sindicalista,
    namePt: "Sindicalista",
    nameEn: "Union Leader",
    descPt: "Punho erguido, boné vermelho. Mobiliza categoria como ninguém.",
    descEn: "Fist up, red cap. Mobilizes the rank and file like no one else.",
  },
  {
    id: "professora",
    portrait: professora,
    namePt: "Professora",
    nameEn: "Professor",
    descPt: "Doutora em política pública. Explica tudo com paciência didática.",
    descEn: "PhD in public policy. Explains everything with patient rigor.",
  },
  {
    id: "militar",
    portrait: militar,
    namePt: "Militar",
    nameEn: "Officer",
    descPt: "Coturno lustrado, ordem e progresso. Segurança é slogan e método.",
    descEn: "Polished boots, order and progress. Security is slogan and method.",
  },
  {
    id: "medico",
    portrait: medico,
    namePt: "Médico",
    nameEn: "Doctor",
    descPt: "Jaleco do SUS. Trocou plantão por comício, mas ainda usa estetoscópio.",
    descEn: "Public-health coat. Traded shifts for rallies but still wears the stethoscope.",
  },
  {
    id: "engenheiro",
    portrait: engenheiro,
    namePt: "Engenheiro",
    nameEn: "Engineer",
    descPt: "Capacete, colete refletivo. Vê a cidade como um projeto de obra.",
    descEn: "Hard hat, hi-vis vest. Sees the city as a construction project.",
  },
  {
    id: "ativista",
    portrait: ativista,
    namePt: "Ativista",
    nameEn: "Activist",
    descPt: "Vem da rua e da luta. Bandana vermelha, punho estampado.",
    descEn: "Comes from the street and the struggle. Red bandana, printed fist.",
  },
  {
    id: "advogada",
    portrait: advogada,
    namePt: "Advogada",
    nameEn: "Lawyer",
    descPt: "Toga elegante, retórica afiada. Sabe onde cada vírgula da lei mora.",
    descEn: "Sharp blazer, sharper rhetoric. Knows where every legal comma lives.",
  },
  {
    id: "agropecuarista",
    portrait: agropecuarista,
    namePt: "Agropecuarista",
    nameEn: "Agribusiness",
    descPt: "Chapelão, camisa xadrez. Fala em safra, boi e produtividade.",
    descEn: "Wide-brim hat, plaid shirt. Talks harvest, cattle and productivity.",
  },
  {
    id: "youtuber",
    portrait: youtuber,
    namePt: "Influencer",
    nameEn: "Influencer",
    descPt: "Cabelo colorido, headset no ouvido. Governa em corte de 30 segundos.",
    descEn: "Dyed hair, headset on. Governs in 30-second cuts.",
  },
  {
    id: "veterana",
    portrait: veterana,
    namePt: "Veterana",
    nameEn: "Veteran",
    descPt: "Cabelo grisalho, blazer marinho. Já viu de tudo — e sobreviveu.",
    descEn: "Grey hair, navy blazer. Has seen it all — and survived.",
  },
];

export const ARCHETYPE_MAP: Record<ArchetypeId, Archetype> =
  ARCHETYPES.reduce((acc, a) => ({ ...acc, [a.id]: a }), {} as Record<ArchetypeId, Archetype>);

export function portraitForArchetype(id?: ArchetypeId | null): string | null {
  if (!id) return null;
  return ARCHETYPE_MAP[id]?.portrait ?? null;
}

export const DEFAULT_ARCHETYPE_ID: ArchetypeId = "professora";
