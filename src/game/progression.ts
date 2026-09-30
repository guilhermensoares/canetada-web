/**
 * Progression system for "Modo Crescimento" (SimCity-2000-style sandbox).
 *
 * The player starts a village with tiny population + budget. As the city
 * grows, new administrative panels unlock in tiers, matching the fiction
 * that a small town simply doesn't need (or legally can't have) a full
 * secretariat of urbanism, a Câmara, a crisis cabinet, etc.
 *
 * `growthMode` on GameState is the on/off flag. When false, every section is
 * unlocked (the classic "scenario" experience is unchanged).
 */

import type { GameState } from "./types";
import type { HubSection } from "@/components/game/DashboardHub";

export interface ProgressionTier {
  id: string;
  /** Minimum population to enter this tier. */
  minPop: number;
  /** Human label per language. */
  label: { pt: string; en: string };
  /** Sections unlocked at (or below) this tier. */
  sections: HubSection[];
  /** Short blurb of what the tier introduces. */
  blurb: { pt: string; en: string };
}

/**
 * Tiers are cumulative — a city at tier N unlocks every section from tiers
 * 1..N. Thresholds picked to reward ~30 minutes of steady growth each.
 */
export const PROGRESSION_TIERS: ProgressionTier[] = [
  {
    id: "vila",
    minPop: 0,
    label: { pt: "Vila", en: "Village" },
    sections: ["overview", "build"],
    blurb: {
      pt: "Loteie o solo, trace ruas e cobre um IPTU simbólico.",
      en: "Zone the land, draw streets, collect a token property tax.",
    },
  },
  {
    id: "bairro",
    minPop: 5_000,
    label: { pt: "Distrito", en: "District" },
    sections: ["finance"],
    blurb: {
      pt: "Abre o razão fiscal: receitas por fonte, despesas e teto da LRF.",
      en: "Opens the fiscal ledger: revenue by source, expenses and the LRF cap.",
    },
  },
  {
    id: "cidade",
    minPop: 20_000,
    label: { pt: "Cidade", en: "City" },
    sections: ["urbanism", "mobility"],
    blurb: {
      pt: "Plano diretor, habitação, transporte coletivo e saneamento.",
      en: "Zoning master plan, housing, transit and sanitation.",
    },
  },
  {
    id: "municipio",
    minPop: 60_000,
    label: { pt: "Município", en: "Municipality" },
    sections: ["policies", "society"],
    blurb: {
      pt: "Políticas públicas, meio ambiente, justiça espacial e educação.",
      en: "Public policy, environment, spatial justice and education.",
    },
  },
  {
    id: "metropole",
    minPop: 150_000,
    label: { pt: "Metrópole", en: "Metropolis" },
    sections: ["politics"],
    blurb: {
      pt: "Câmara Municipal, gabinete e controle de corrupção.",
      en: "City council, cabinet and corruption oversight.",
    },
  },
  {
    id: "megacidade",
    minPop: 400_000,
    label: { pt: "Megacidade", en: "Megacity" },
    sections: ["crisis"],
    blurb: {
      pt: "Defesa Civil, grandes eventos e sala de imprensa.",
      en: "Civil defense, mass events and press room.",
    },
  },
];

/** All sections used by the hub. */
export const ALL_SECTIONS: HubSection[] = [
  "overview", "finance", "policies", "urbanism",
  "mobility", "society", "politics", "crisis", "build",
];

/** Highest tier the city currently qualifies for. */
export function currentTier(state: Pick<GameState, "population">): ProgressionTier {
  let t = PROGRESSION_TIERS[0];
  for (const tier of PROGRESSION_TIERS) {
    if (state.population >= tier.minPop) t = tier;
    else break;
  }
  return t;
}

/** Next tier the player is progressing towards, or null if maxed. */
export function nextTier(state: Pick<GameState, "population">): ProgressionTier | null {
  const cur = currentTier(state);
  const idx = PROGRESSION_TIERS.findIndex((t) => t.id === cur.id);
  return PROGRESSION_TIERS[idx + 1] ?? null;
}

/**
 * Set of hub sections the player has access to. When `growthMode` is false,
 * everything is unlocked so the classic scenario experience is untouched.
 */
export function unlockedSections(
  state: Pick<GameState, "population" | "growthMode">,
): ReadonlySet<HubSection> {
  if (!state.growthMode) return new Set<HubSection>(ALL_SECTIONS);
  const cur = currentTier(state);
  const idx = PROGRESSION_TIERS.findIndex((t) => t.id === cur.id);
  const out = new Set<HubSection>();
  for (let i = 0; i <= idx; i++) {
    for (const s of PROGRESSION_TIERS[i].sections) out.add(s);
  }
  return out;
}

/** Which tier first unlocks the given section, if any. */
export function tierForSection(section: HubSection): ProgressionTier | null {
  return PROGRESSION_TIERS.find((t) => t.sections.includes(section)) ?? null;
}
