// ──────────────────────────────────────────────────────────────────────
// Trilha sonora adaptativa do Canetada.
//
// As faixas foram analisadas por BPM, energia (RMS), brilho espectral e
// dinâmica; cada "mood" agrupa faixas com caráter compatível. O gerenciador
// (useSoundtrack) escolhe o mood a partir do estado do jogo e faz crossfade.
// ──────────────────────────────────────────────────────────────────────
import batidaPesada from "@/assets/music/Batida_Pesada.mp3.asset.json";
import cobblestoneMorning from "@/assets/music/Cobblestone_Morning.mp3.asset.json";
import coffeeAndConcrete from "@/assets/music/Coffee_and_Concrete.mp3.asset.json";
import concreteHorizons from "@/assets/music/Concrete_Horizons.mp3.asset.json";
import foundationUnderPressure from "@/assets/music/Foundation_Under_Pressure.mp3.asset.json";
import morningAtTheTownHall from "@/assets/music/Morning_at_the_Town_Hall.mp3.asset.json";
import quietRooftops from "@/assets/music/Quiet_Rooftops.mp3.asset.json";
import rushHourAscent from "@/assets/music/Rush_Hour_Ascent.mp3.asset.json";
import streetCornerFanfare from "@/assets/music/Street_Corner_Fanfare.mp3.asset.json";
import sunriseOverTownSquare from "@/assets/music/Sunrise_over_Town_Square.mp3.asset.json";
import theCopperChime from "@/assets/music/The_Copper_Chime.mp3.asset.json";
import theFirstStone from "@/assets/music/The_First_Stone.mp3.asset.json";

export type Mood = "menu" | "calm" | "pressure" | "crisis" | "triumph";

export interface Track {
  id: string;
  /** Nome exibido no widget de música. */
  title: string;
  url: string;
  /** Volume relativo da faixa (0..1) — normaliza faixas mais quentes. */
  gain: number;
}

const T = (id: string, title: string, url: string, gain = 1): Track => ({ id, title, url, gain });

export const TRACKS: Record<string, Track> = {
  sunrise:    T("sunrise",    "Sunrise over Town Square", sunriseOverTownSquare.url, 0.95),
  cobble:     T("cobble",     "Cobblestone Morning",      cobblestoneMorning.url,    1),
  copper:     T("copper",     "The Copper Chime",         theCopperChime.url,        1),
  horizons:   T("horizons",   "Concrete Horizons",        concreteHorizons.url,      0.95),
  firstStone: T("firstStone", "The First Stone",          theFirstStone.url,         1),
  foundation: T("foundation", "Foundation Under Pressure",foundationUnderPressure.url, 0.9),
  coffee:     T("coffee",     "Coffee and Concrete",      coffeeAndConcrete.url,     0.95),
  batida:     T("batida",     "Batida Pesada",            batidaPesada.url,          0.8),
  rushHour:   T("rushHour",   "Rush Hour Ascent",         rushHourAscent.url,        0.85),
  fanfare:    T("fanfare",    "Street Corner Fanfare",    streetCornerFanfare.url,   0.9),
  townHall:   T("townHall",   "Morning at the Town Hall", morningAtTheTownHall.url,  0.9),
  rooftops:   T("rooftops",   "Quiet Rooftops",           quietRooftops.url,         0.9),
};

/** Playlists por clima narrativo. Tocadas em ordem embaralhada, em loop. */
export const MOOD_PLAYLIST: Record<Mood, Track[]> = {
  // Menu/dossiê: temas de abertura, crescendo gradual.
  menu: [TRACKS.sunrise, TRACKS.townHall],
  // Governo tranquilo: 89 BPM, quentes e cíclicas.
  calm: [TRACKS.cobble, TRACKS.copper, TRACKS.horizons, TRACKS.firstStone, TRACKS.rooftops, TRACKS.townHall],
  // Pressão subindo: mais densas, graves marcados.
  pressure: [TRACKS.foundation, TRACKS.coffee, TRACKS.horizons],
  // Crise ativa: percussão e urgência.
  crisis: [TRACKS.batida, TRACKS.rushHour],
  // Vitória / marcos: metais brilhantes.
  triumph: [TRACKS.fanfare],
};

/** Rótulo humano do mood, para o widget de música. */
export const MOOD_LABEL: Record<Mood, { pt: string; en: string }> = {
  menu:     { pt: "Abertura",         en: "Opening" },
  calm:     { pt: "Gestão tranquila", en: "Calm governance" },
  pressure: { pt: "Pressão subindo",  en: "Rising pressure" },
  crisis:   { pt: "Crise ativa",      en: "Active crisis" },
  triumph:  { pt: "Momento de glória",en: "Triumph" },
};

/** Sinais mínimos que o jogo fornece para escolher o clima musical. */
export interface MoodSignals {
  inMenu: boolean;
  approval: number;
  /** Desastre em andamento (enchente, deslizamento…). */
  activeDisaster: boolean;
  /** Nº de crises de cancelamento abertas no PiuPiu. */
  openCancels: number;
  /** Risco jurídico/impeachment 0..100. */
  legalRisk: number;
  /** Caixa negativo. */
  broke: boolean;
  /** Momento de celebração (eleição vencida, conquista lendária…). */
  celebrating: boolean;
}

/** Regra de seleção do clima musical a partir do estado do jogo. */
export function pickMood(s: MoodSignals): Mood {
  if (s.inMenu) return "menu";
  if (s.celebrating) return "triumph";
  if (s.activeDisaster || s.openCancels >= 2 || s.legalRisk >= 70 || s.approval < 25) return "crisis";
  if (s.openCancels >= 1 || s.legalRisk >= 40 || s.broke || s.approval < 45) return "pressure";
  return "calm";
}

// ── store global de clima musical ──────────────────────────────────────
// O player de música vive acima das telas (menu, seleção de cidade, jogo),
// então o clima é publicado num store simples em vez de props.
let currentMood: Mood = "menu";
const moodSubs = new Set<() => void>();

export function setGlobalMood(m: Mood) {
  if (m === currentMood) return;
  currentMood = m;
  moodSubs.forEach((f) => f());
}
export function getGlobalMood(): Mood {
  return currentMood;
}
export function subscribeMood(f: () => void): () => void {
  moodSubs.add(f);
  return () => { moodSubs.delete(f); };
}

// Idioma exibido no player global (publicado pelo GameShell).
let musicLang: "pt" | "en" = "pt";
const langSubs = new Set<() => void>();

export function setMusicLang(l: "pt" | "en") {
  if (l === musicLang) return;
  musicLang = l;
  langSubs.forEach((f) => f());
}
export function getMusicLang(): "pt" | "en" {
  return musicLang;
}
export function subscribeMusicLang(f: () => void): () => void {
  langSubs.add(f);
  return () => { langSubs.delete(f); };
}
