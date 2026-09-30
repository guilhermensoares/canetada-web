/**
 * Mass Events & Cultural Economy module.
 *
 * Models the Brazilian calendar of large public events (Carnaval, festas
 * juninas, Réveillon, finais esportivas, festivais gastronômicos) and their
 * cross-cutting impact on:
 *  - tourism & commerce revenue (ISS spike, farebox, hotelaria)
 *  - urban resource strain (cleaning, mobility/transit load)
 *  - class-segmented reputation (elite, middle, workers, informal, tourists)
 *  - informal cultural/commercial activity (blocos de rua, camelôs, food
 *    trucks, bailes) with a repress ↔ regulate ↔ promote lever per activity.
 *
 * Interaction with the rest of the sim:
 *  - revenue is credited via tickMassEvents() and folded into lastRevenue by
 *    logic.ts (businessTax bucket).
 *  - cleanup + security appear as expenses under the sustainability bucket.
 *  - happiness/approval move via segmented reputation aggregated by
 *    population weight.
 *  - occasional dilemmas surface as `activeDilemma`, requiring a player
 *    decision that shifts posture + reputation.
 */

import type { GameState, NewsItem } from "./types";
import { t } from "./i18n";

/* ---------------- Types ---------------- */

export type EventFormat =
  | "carnaval"
  | "festaJunina"
  | "reveillon"
  | "sportsFinal"
  | "musicFest"
  | "gastronomia";

export type Posture = "repress" | "regulate" | "promote";

export type ActivityKey = "streetParty" | "streetVendors" | "bailesFunk";

export type ClassSegment = "elite" | "middle" | "workers" | "informal" | "tourists";

export interface MassEventDef {
  id: string;
  nameKey: string;
  format: EventFormat;
  /** Calendar months when this event fires. */
  months: number[];
  /** Base tourists per 100k residents. */
  baseTourists: number;
  /** Cleaning burden 0..1 (share of monthly cleaning capacity consumed). */
  cleanupBurden: number;
  /** Extra mobility load 0..1 (transit + traffic strain). */
  mobilityStrain: number;
  /** Which segments culturally identify with the event (weight 0..1). */
  affinity: Partial<Record<ClassSegment, number>>;
}

export interface EventResult {
  id: string;
  defId: string;
  month: number;
  year: number;
  tourists: number;
  tourismRevenue: number;
  commerceRevenue: number;
  cleanupCost: number;
  securityCost: number;
  incidents: number;
  transitLoad: number;
  segmentDelta: Record<ClassSegment, number>;
  cancelled?: boolean;
}

export interface MassEventDilemma {
  id: string;
  /** Bilingual "pt||en" title/body — rendered via t(). */
  titleKey: string;
  descKey: string;
  activity: ActivityKey;
  choices: {
    posture: Posture;
    labelKey: string;
    /** UI hint on trade-offs. */
    hintKey: string;
  }[];
}

export interface MassEventsState {
  /** Repress ↔ regulate ↔ promote lever per informal cultural activity. */
  posture: Record<ActivityKey, Posture>;
  /** Reputation per class segment, 0..100. */
  reputation: Record<ClassSegment, number>;
  /** 0..100 city cultural identity — grows with promotion and events run. */
  culturalCapital: number;
  /** 0..100 municipal cleaning + sanitation surge capacity. */
  cleaningCapacity: number;
  /** Share of per-event budget spent on security (0..1). */
  securityRatio: number;
  /** Fixed monthly infra budget for cultural venues (R$). */
  monthlyCultureBudget: number;
  /** Camelódromos / feiras / arenas culturais already built. */
  culturalSpotsFunded: number;
  /** Rolling history of executed events (12 latest). */
  history: EventResult[];
  /** Active dilemma pending player decision (blocks nothing else). */
  activeDilemma?: MassEventDilemma;
  /** Turnover from last month for the panel. */
  lastImpact?: {
    tourismRevenue: number;
    commerceRevenue: number;
    cleanupCost: number;
    securityCost: number;
    incidents: number;
    mobilityHit: number;
  };
}

export interface MassEventsTickOutput {
  revenue: number;
  expenses: number;
  approvalDelta: number;
  happinessDelta: number;
  news: Omit<NewsItem, "id" | "day" | "month" | "year">[];
  /** Extra transit demand share for the month (0..1). */
  transitLoad: number;
}

/* ---------------- Catalog ---------------- */

export const EVENT_CATALOG: MassEventDef[] = [
  {
    id: "carnaval", nameKey: "mev.def.carnaval", format: "carnaval",
    months: [2], baseTourists: 4800, cleanupBurden: 0.85, mobilityStrain: 0.7,
    affinity: { workers: 0.9, informal: 1.0, middle: 0.55, tourists: 0.95, elite: 0.25 },
  },
  {
    id: "festaJunina", nameKey: "mev.def.festaJunina", format: "festaJunina",
    months: [6, 7], baseTourists: 1800, cleanupBurden: 0.35, mobilityStrain: 0.25,
    affinity: { workers: 0.85, informal: 0.75, middle: 0.7, tourists: 0.5, elite: 0.4 },
  },
  {
    id: "reveillon", nameKey: "mev.def.reveillon", format: "reveillon",
    months: [12], baseTourists: 3200, cleanupBurden: 0.55, mobilityStrain: 0.5,
    affinity: { workers: 0.65, informal: 0.6, middle: 0.7, tourists: 0.9, elite: 0.55 },
  },
  {
    id: "sportsFinal", nameKey: "mev.def.sportsFinal", format: "sportsFinal",
    months: [5, 11], baseTourists: 1400, cleanupBurden: 0.3, mobilityStrain: 0.55,
    affinity: { workers: 0.9, informal: 0.7, middle: 0.55, tourists: 0.3, elite: 0.35 },
  },
  {
    id: "musicFest", nameKey: "mev.def.musicFest", format: "musicFest",
    months: [4, 10], baseTourists: 2200, cleanupBurden: 0.45, mobilityStrain: 0.4,
    affinity: { workers: 0.6, informal: 0.5, middle: 0.8, tourists: 0.7, elite: 0.65 },
  },
  {
    id: "gastronomia", nameKey: "mev.def.gastronomia", format: "gastronomia",
    months: [8, 9], baseTourists: 1300, cleanupBurden: 0.2, mobilityStrain: 0.2,
    affinity: { workers: 0.4, informal: 0.55, middle: 0.85, tourists: 0.75, elite: 0.8 },
  },
];

/* ---------------- Init ---------------- */

export function initialMassEvents(): MassEventsState {
  return {
    posture: {
      streetParty: "regulate",
      streetVendors: "regulate",
      bailesFunk: "repress",
    },
    reputation: { elite: 55, middle: 58, workers: 55, informal: 45, tourists: 50 },
    culturalCapital: 40,
    cleaningCapacity: 55,
    securityRatio: 0.35,
    monthlyCultureBudget: 60_000,
    culturalSpotsFunded: 0,
    history: [],
  };
}

export function ensureMassEvents(s: GameState): MassEventsState {
  const holder = s as GameState & { massEvents?: MassEventsState };
  if (!holder.massEvents) holder.massEvents = initialMassEvents();
  return holder.massEvents;
}

/* ---------------- Player actions ---------------- */

export function setPosture(s: GameState, activity: ActivityKey, posture: Posture): GameState {
  const m = ensureMassEvents(s);
  m.posture[activity] = posture;
  // Immediate reputation nudge — signals matter.
  const nudge = postureNudge(posture);
  applySegmentDelta(m, nudge);
  return s;
}

export function setSecurityRatio(s: GameState, v: number): GameState {
  const m = ensureMassEvents(s);
  m.securityRatio = clamp01(v);
  return s;
}

export function setCultureBudget(s: GameState, v: number): GameState {
  const m = ensureMassEvents(s);
  m.monthlyCultureBudget = Math.max(0, Math.min(1_000_000, Math.round(v)));
  return s;
}

/** One-off capex: build a cultural venue (arena, camelódromo, feira coberta). */
export function fundCulturalSpot(s: GameState): GameState {
  const cost = 800_000;
  if (s.treasury < cost) return s;
  const m = ensureMassEvents(s);
  s.treasury -= cost;
  m.culturalSpotsFunded += 1;
  m.cleaningCapacity = Math.min(100, m.cleaningCapacity + 6);
  m.culturalCapital  = Math.min(100, m.culturalCapital + 4);
  applySegmentDelta(m, { workers: 2, informal: 3, middle: 1, elite: 0, tourists: 1 });
  return s;
}

/** Resolve an active dilemma by choice index. */
export function resolveDilemma(s: GameState, choiceIdx: number): GameState {
  const m = ensureMassEvents(s);
  const dil = m.activeDilemma;
  if (!dil) return s;
  const choice = dil.choices[choiceIdx];
  if (!choice) return s;
  m.posture[dil.activity] = choice.posture;
  // Strong reputation swing, larger than a simple posture nudge.
  const nudge = postureNudge(choice.posture, 1.8);
  applySegmentDelta(m, nudge);
  if (choice.posture === "repress") {
    m.culturalCapital = Math.max(0, m.culturalCapital - 3);
  } else if (choice.posture === "promote") {
    m.culturalCapital = Math.min(100, m.culturalCapital + 4);
  }
  m.activeDilemma = undefined;
  return s;
}

/* ---------------- Monthly tick ---------------- */

export function tickMassEvents(s: GameState, rng: () => number): MassEventsTickOutput {
  const m = ensureMassEvents(s);
  const out: MassEventsTickOutput = {
    revenue: 0, expenses: 0, approvalDelta: 0, happinessDelta: 0,
    news: [], transitLoad: 0,
  };

  /* --- 1. Fixed monthly cultural budget --- */
  if (m.monthlyCultureBudget > 0 && s.treasury >= m.monthlyCultureBudget) {
    s.treasury -= m.monthlyCultureBudget;
    out.expenses += m.monthlyCultureBudget;
    m.culturalCapital = Math.min(100, m.culturalCapital + m.monthlyCultureBudget / 60_000);
    m.cleaningCapacity = Math.min(100, m.cleaningCapacity + m.monthlyCultureBudget / 120_000);
  } else {
    m.culturalCapital = Math.max(0, m.culturalCapital - 0.4);
    m.cleaningCapacity = Math.max(20, m.cleaningCapacity - 0.5);
  }

  /* --- 2. Passive posture drift on segment reputation --- */
  const posturePulse = combinedPostureNudge(m.posture, 0.25);
  applySegmentDelta(m, posturePulse);

  /* --- 3. Fire scheduled events for the calendar month --- */
  const dueEvents = EVENT_CATALOG.filter((e) => e.months.includes(s.month));
  for (const def of dueEvents) {
    runEvent(s, m, def, rng, out);
  }

  /* --- 4. Roll for a cultural dilemma if none active --- */
  if (!m.activeDilemma && rng() < 0.14) {
    m.activeDilemma = pickDilemma(s, m, rng);
    if (m.activeDilemma) {
      out.news.push({
        kind: "warning",
        titleKey: `Dilema cultural: ${translateInline(s.lang, m.activeDilemma.titleKey)}||Cultural dilemma: ${translateInline(s.lang, m.activeDilemma.titleKey)}`,
      });
    }
  }

  /* --- 5. Aggregate segmented reputation → happiness/approval --- */
  const rep = m.reputation;
  const weighted =
    rep.workers  * 0.35 +
    rep.middle   * 0.28 +
    rep.informal * 0.18 +
    rep.elite    * 0.12 +
    rep.tourists * 0.07;
  const relative = (weighted - 55) / 100;
  out.happinessDelta += relative * 1.6;
  out.approvalDelta  += relative * 1.2;

  return out;
}

/* ---------------- Internals ---------------- */

function runEvent(
  s: GameState, m: MassEventsState, def: MassEventDef,
  rng: () => number, out: MassEventsTickOutput,
) {
  // Crowd size scales with population, cultural capital and postures.
  const popFactor = s.population / 100_000;
  const cultBoost = 0.6 + m.culturalCapital / 100;      // 0.6 .. 1.6
  const postureBoost = postureCrowdBoost(m.posture, def);
  const tourists = Math.round(def.baseTourists * popFactor * cultBoost * postureBoost);

  // Base revenue: tourism (hotels/food) + commerce spike (retail/ISS).
  const perTouristSpend = 320 + rng() * 180;             // R$
  const tourismRevenue  = tourists * perTouristSpend;
  const commerceRevenue = Math.round(
    (s.businesses * 40 + s.population * 2.4) * def.mobilityStrain * cultBoost,
  );

  // Cleaning + security costs — cleaning capacity dampens the effective cost.
  const capacityMod = 1 + Math.max(0, 0.75 - m.cleaningCapacity / 100);
  const cleanupCost = Math.round(
    (150_000 + tourists * 40) * def.cleanupBurden * capacityMod,
  );
  const perEventBudget = Math.round(150_000 + tourists * 25);
  const securityCost = Math.round(perEventBudget * m.securityRatio);

  // Incidents: fewer with security, more with heavy crowds and repression.
  const repressionOfActivity =
    (def.format === "carnaval" || def.format === "sportsFinal")
      ? m.posture.streetParty
      : def.format === "musicFest" ? m.posture.bailesFunk : m.posture.streetVendors;
  const incidentBase =
    tourists / 1200
    + (repressionOfActivity === "repress" ? 3 : 0)
    - m.securityRatio * 4;
  const incidents = Math.max(0, Math.round(incidentBase + (rng() - 0.5) * 3));

  // Segment shifts driven by affinity, posture and incidents.
  const segmentDelta: Record<ClassSegment, number> = {
    elite: 0, middle: 0, workers: 0, informal: 0, tourists: 0,
  };
  for (const seg of Object.keys(def.affinity) as ClassSegment[]) {
    const a = def.affinity[seg] ?? 0;
    segmentDelta[seg] += a * 3;              // affinity uplift
  }
  // Repression alienates workers/informal for popular events.
  if (repressionOfActivity === "repress") {
    segmentDelta.workers  -= 2;
    segmentDelta.informal -= 3;
    segmentDelta.elite    += 1.5;
  } else if (repressionOfActivity === "promote") {
    segmentDelta.workers  += 2;
    segmentDelta.informal += 3;
    segmentDelta.elite    -= 1.5;
    segmentDelta.tourists += 1.5;
  }
  // Incidents cost everyone, tourists most.
  segmentDelta.tourists -= incidents * 0.7;
  segmentDelta.middle   -= incidents * 0.3;
  segmentDelta.elite    -= incidents * 0.4;

  // Apply cash flow.
  const netRevenue = tourismRevenue + commerceRevenue;
  const netCost    = cleanupCost + securityCost;
  s.treasury += netRevenue;
  s.treasury -= netCost;
  out.revenue  += netRevenue;
  out.expenses += netCost;
  m.cleaningCapacity = Math.max(20, m.cleaningCapacity - def.cleanupBurden * 8);

  // Apply reputation changes and cultural capital gain.
  applySegmentDelta(m, segmentDelta);
  m.culturalCapital = Math.min(100, m.culturalCapital + def.affinity.tourists! * 1.5);

  // Transit load feeds mobility strain (surfaced to callers).
  out.transitLoad = Math.max(out.transitLoad, def.mobilityStrain);

  // Historic record.
  const result: EventResult = {
    id: `${s.year}-${s.month}-${def.id}`,
    defId: def.id, month: s.month, year: s.year,
    tourists, tourismRevenue, commerceRevenue,
    cleanupCost, securityCost, incidents,
    transitLoad: def.mobilityStrain, segmentDelta,
  };
  m.history = [result, ...m.history].slice(0, 12);
  m.lastImpact = {
    tourismRevenue, commerceRevenue, cleanupCost, securityCost,
    incidents, mobilityHit: def.mobilityStrain,
  };

  // Newsroom copy.
  const flavor = incidents > 4
    ? `com ${incidents} incidentes||with ${incidents} incidents`
    : `sem grandes incidentes||without major incidents`;
  out.news.push({
    kind: incidents > 4 ? "warning" : "success",
    titleKey: `${translateInline(s.lang, def.nameKey)} atrai ${tourists.toLocaleString("pt-BR")} turistas ${translateInline(s.lang, flavor)}||${translateInline(s.lang, def.nameKey)} draws ${tourists.toLocaleString("en-US")} tourists ${translateInline(s.lang, flavor)}`,
  });
}

/* ---------------- Dilemmas ---------------- */

const DILEMMA_POOL: MassEventDilemma[] = [
  {
    id: "bloco-nao-autorizado",
    titleKey: "Bloco de rua não autorizado no bairro nobre||Unauthorised street bloco in an upscale district",
    descKey: "Moradores do centro reclamam de barulho e sujeira; foliões defendem tradição.||Downtown residents complain about noise and litter; revellers defend tradition.",
    activity: "streetParty",
    choices: [
      { posture: "repress",  labelKey: "Dispersar com PM||Disperse with police",
        hintKey: "Elite feliz, trabalhadores/informais furiosos.||Elite pleased, workers/informals furious." },
      { posture: "regulate", labelKey: "Autorizar com regras||Authorise with rules",
        hintKey: "Custo médio, todos moderadamente satisfeitos.||Middle cost, everyone moderately pleased." },
      { posture: "promote",  labelKey: "Patrocinar como turismo||Sponsor as tourism",
        hintKey: "Turistas e periferia felizes, elite descontente.||Tourists and periphery happy, elite unhappy." },
    ],
  },
  {
    id: "camelo-avenida",
    titleKey: "Camelódromo espontâneo na avenida principal||Spontaneous street market on the main avenue",
    descKey: "Camelôs ocupam calçadas do centro; lojistas exigem operação de fiscalização.||Vendors occupy downtown sidewalks; shop owners demand a crackdown.",
    activity: "streetVendors",
    choices: [
      { posture: "repress",  labelKey: "Operação de fiscalização||Fiscalisation raid",
        hintKey: "Comércio formal aliviado, informais em revolta.||Formal shops relieved, informals in revolt." },
      { posture: "regulate", labelKey: "Área permitida + taxa||Permitted zone + fee",
        hintKey: "Receita moderada, satisfação equilibrada.||Moderate revenue, balanced satisfaction." },
      { posture: "promote",  labelKey: "Feira cultural oficial||Official cultural fair",
        hintKey: "Boost cultural, elite reclama de gentrificação reversa.||Cultural boost, elite complains of reverse gentrification." },
    ],
  },
  {
    id: "baile-comunidade",
    titleKey: "Baile funk atrai 3 mil na periferia||Baile funk draws 3k in the periphery",
    descKey: "Vizinhança dividida entre lazer comunitário e reclamações de barulho.||Neighbourhood split between community leisure and noise complaints.",
    activity: "bailesFunk",
    choices: [
      { posture: "repress",  labelKey: "Encerrar operação||Shut it down",
        hintKey: "Elite tranquila, jovens/informais em conflito com PM.||Elite calmed, youth/informals clash with police." },
      { posture: "regulate", labelKey: "Alvará noturno com limite||Night permit with limits",
        hintKey: "Solução técnica, satisfação distribuída.||Technical fix, distributed satisfaction." },
      { posture: "promote",  labelKey: "Reconhecer como cultura||Recognise as culture",
        hintKey: "Cena cultural explode, elite se afasta.||Cultural scene explodes, elite retreats." },
    ],
  },
];

function pickDilemma(s: GameState, _m: MassEventsState, rng: () => number): MassEventDilemma | undefined {
  // Bias by season — Carnaval/Réveillon → street party dilemmas etc.
  const seasonal = DILEMMA_POOL.filter((d) => {
    if (d.activity === "streetParty" && (s.month === 2 || s.month === 12)) return true;
    if (d.activity === "streetVendors" && (s.month >= 6 && s.month <= 10)) return true;
    if (d.activity === "bailesFunk") return true;
    return rng() < 0.4;
  });
  const pool = seasonal.length ? seasonal : DILEMMA_POOL;
  return pool[Math.floor(rng() * pool.length)];
}

/* ---------------- Reputation helpers ---------------- */

function postureNudge(posture: Posture, scale = 1): Partial<Record<ClassSegment, number>> {
  if (posture === "repress") return {
    elite: 1.2 * scale, middle: 0.4 * scale,
    workers: -0.8 * scale, informal: -1.6 * scale, tourists: -0.3 * scale,
  };
  if (posture === "promote") return {
    elite: -0.9 * scale, middle: 0.3 * scale,
    workers: 1.2 * scale, informal: 1.8 * scale, tourists: 0.9 * scale,
  };
  return { middle: 0.4 * scale, workers: 0.2 * scale, informal: 0.3 * scale };
}

function combinedPostureNudge(
  postures: MassEventsState["posture"], scale = 1,
): Partial<Record<ClassSegment, number>> {
  const acc: Record<ClassSegment, number> = {
    elite: 0, middle: 0, workers: 0, informal: 0, tourists: 0,
  };
  for (const key of Object.keys(postures) as ActivityKey[]) {
    const n = postureNudge(postures[key], scale / 3);
    (Object.keys(acc) as ClassSegment[]).forEach((seg) => {
      acc[seg] += n[seg] ?? 0;
    });
  }
  return acc;
}

function postureCrowdBoost(postures: MassEventsState["posture"], def: MassEventDef): number {
  const key: ActivityKey =
    def.format === "carnaval" || def.format === "sportsFinal" ? "streetParty"
    : def.format === "musicFest" ? "bailesFunk"
    : "streetVendors";
  const p = postures[key];
  return p === "promote" ? 1.25 : p === "regulate" ? 1.0 : 0.65;
}

function applySegmentDelta(m: MassEventsState, delta: Partial<Record<ClassSegment, number>>) {
  (Object.keys(m.reputation) as ClassSegment[]).forEach((seg) => {
    const d = delta[seg] ?? 0;
    m.reputation[seg] = Math.max(0, Math.min(100, m.reputation[seg] + d));
  });
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function translateInline(lang: GameState["lang"], key: string): string {
  if (key.includes("||")) {
    const [pt, en] = key.split("||");
    return lang === "pt" ? pt : en;
  }
  // Resolve dictionary keys (e.g. "mev.def.carnaval") so news headlines
  // never leak raw i18n identifiers into the player-facing feed.
  return t(lang, key, key);
}
