/**
 * Journey — "Dois Mandatos" arc.
 *
 * Tracks how well the player's event choices align with the chosen persona's
 * ideology and persists a Hall dos Prefeitos across careers via localStorage.
 * Kept intentionally lightweight so it can be initialized on legacy saves.
 */
import type { GameState, GameEventChoice } from "./types";
import { findPolitician } from "./politicianPresets";

export type CareerEndReason = "victory" | "defeated" | "impeached";

export interface KeyDecision {
  month: number;
  year: number;
  titleKey: string;
  lean: number;
  matched: number;
}

export interface JourneyState {
  /** 0..100 — how aligned recent tagged choices are with the persona's ideology. */
  coherenceScore: number;
  /** Total number of resolved event choices (any kind). */
  choicesMade: number;
  /** Number of tagged (ideology-relevant) choices seen. */
  taggedChoices: number;
  /** Recent high-impact decisions (|lean| > 0.4), capped to 12. */
  keyDecisions: KeyDecision[];
  /** Streak of months with low coherence (<40). */
  monthsLowCoherence: number;
  /** Set when the career ends — drives the LegacyScreen / GameOver flow. */
  careerEnded?: CareerEndReason;
}

export function defaultJourney(): JourneyState {
  return {
    coherenceScore: 50,
    choicesMade: 0,
    taggedChoices: 0,
    keyDecisions: [],
    monthsLowCoherence: 0,
    careerEnded: undefined,
  };
}

/** Ensure `state.journey` exists (legacy save migration). Mutates. */
export function ensureJourney(s: GameState): JourneyState {
  if (!s.journey) s.journey = defaultJourney();
  return s.journey;
}

/**
 * Called on every resolveEvent. Returns metadata for optional UI feedback.
 * Mutates state.journey in place — safe because resolveEvent already clones.
 */
export function updateCoherence(
  state: GameState,
  choice: GameEventChoice,
  titleKey: string,
): { matched: number | null; lean: number | null; delta: number } {
  const j = ensureJourney(state);
  j.choicesMade += 1;

  const lean = choice.ideologyLean;
  if (typeof lean !== "number") return { matched: null, lean: null, delta: 0 };

  const mayorIdeo = findPolitician(state.mayor.personaId ?? "")?.ideology ?? 0;
  // Distance 0..2 → matched 0..1.
  const matched = 1 - Math.abs(mayorIdeo - lean) / 2;
  const before = j.coherenceScore;
  // Rolling weighted average — recent choices weigh 20%.
  const target = matched * 100;
  j.coherenceScore = before * 0.8 + target * 0.2;
  j.taggedChoices += 1;

  if (Math.abs(lean) > 0.4) {
    j.keyDecisions = [
      { month: state.month, year: state.year, titleKey, lean, matched },
      ...j.keyDecisions,
    ].slice(0, 12);
  }

  return { matched, lean, delta: j.coherenceScore - before };
}

/* ------------------- Hall dos Prefeitos (localStorage) ------------------- */

const HALL_KEY = "lovable.mayorHall";
const MAX_HALL_ENTRIES = 24;

export interface HallEntry {
  personaId?: string;
  name: string;
  cityName: string;
  endReason: CareerEndReason;
  monthsInOffice: number;
  finalApproval: number;
  finalTreasury: number;
  coherenceScore: number;
  endedAt: number; // Date.now()
}

export function loadHall(): HallEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HALL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HALL_ENTRIES);
  } catch {
    return [];
  }
}

export function saveCareerToHall(
  state: GameState,
  endReason: CareerEndReason,
): HallEntry {
  const monthsInOffice =
    (state.year - 2026) * 12 + (state.month - 1);
  const entry: HallEntry = {
    personaId: state.mayor.personaId,
    name: state.mayor.name,
    cityName: state.cityName,
    endReason,
    monthsInOffice: Math.max(0, monthsInOffice),
    finalApproval: Math.round(state.approval),
    finalTreasury: Math.round(state.treasury),
    coherenceScore: Math.round(state.journey?.coherenceScore ?? 50),
    endedAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    try {
      const prev = loadHall();
      const next = [entry, ...prev].slice(0, MAX_HALL_ENTRIES);
      window.localStorage.setItem(HALL_KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked — silent */
    }
  }
  return entry;
}

/** Persona ids that were already played (from Hall). */
export function playedPersonaIds(): Set<string> {
  const out = new Set<string>();
  for (const e of loadHall()) if (e.personaId) out.add(e.personaId);
  return out;
}

/* ------------------- Term helpers ------------------- */

export function monthsUntilElection(state: GameState): number {
  const el = state.politics?.election;
  if (!el) return 999;
  const electionYear = el.termStartYear + el.termLengthYears;
  return (electionYear - state.year) * 12 + (10 - state.month);
}

export function currentTermNumber(state: GameState): 1 | 2 {
  return (state.politics?.election?.timesElected ?? 1) >= 2 ? 2 : 1;
}
