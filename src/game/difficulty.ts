/**
 * Difficulty profiles — currently applied only in Modo Gerador (procedural
 * cities), but the shape is game-wide so we can plug it into presets/sandbox
 * later without another migration.
 *
 * Each profile tweaks three orthogonal axes:
 *
 *  • eventChanceMult   — multiplies the monthly random-event roll. <1 means
 *                        fewer crises to juggle; >1 piles them on.
 *  • reactionMult      — multiplies NEGATIVE approval/happiness swings coming
 *                        from media herd effects AND from event choice
 *                        resolutions. Positives are left alone so rewards keep
 *                        their punch on easy modes.
 *  • choiceClarity     — 0..2 hint level surfaced in the event card:
 *                          2 = shows "recommended" tag on the safest option;
 *                          1 = shows only the ideology tag (default);
 *                          0 = hides ideology tag entirely (Extreme).
 */

export type DifficultyLevel = "easy" | "normal" | "hard" | "extreme";

export interface DifficultyProfile {
  id: DifficultyLevel;
  labelPt: string;
  labelEn: string;
  emoji: string;
  descPt: string;
  descEn: string;
  eventChanceMult: number;
  reactionMult: number;
  choiceClarity: 0 | 1 | 2;
}

export const DIFFICULTY_PROFILES: Record<DifficultyLevel, DifficultyProfile> = {
  easy: {
    id: "easy",
    labelPt: "Fácil",
    labelEn: "Easy",
    emoji: "🌱",
    descPt: "Menos crises, mídia e povo tolerantes, dicas nas escolhas.",
    descEn: "Fewer crises, forgiving media & voters, hints on choices.",
    eventChanceMult: 0.55,
    reactionMult: 0.55,
    choiceClarity: 2,
  },
  normal: {
    id: "normal",
    labelPt: "Médio",
    labelEn: "Normal",
    emoji: "⚖️",
    descPt: "Balanço padrão — reações realistas, cadência regular.",
    descEn: "Standard balance — realistic reactions, regular cadence.",
    eventChanceMult: 1.0,
    reactionMult: 1.0,
    choiceClarity: 1,
  },
  hard: {
    id: "hard",
    labelPt: "Difícil",
    labelEn: "Hard",
    emoji: "🔥",
    descPt: "Mídia agressiva, população impaciente, crises encadeadas.",
    descEn: "Aggressive press, impatient voters, chained crises.",
    eventChanceMult: 1.45,
    reactionMult: 1.5,
    choiceClarity: 1,
  },
  extreme: {
    id: "extreme",
    labelPt: "Extremo",
    labelEn: "Extreme",
    emoji: "☠️",
    descPt: "Sem dicas nas escolhas, tolerância zero, avalanche de eventos.",
    descEn: "No hints, zero tolerance, avalanche of events.",
    eventChanceMult: 1.9,
    reactionMult: 2.1,
    choiceClarity: 0,
  },
};

export const DIFFICULTY_ORDER: DifficultyLevel[] = ["easy", "normal", "hard", "extreme"];

export function getDifficultyProfile(level: DifficultyLevel | undefined): DifficultyProfile {
  return DIFFICULTY_PROFILES[level ?? "normal"];
}
