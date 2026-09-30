/**
 * Intergenerational income & education cycle.
 *
 * Aggregate-cohort model (not per-NPC) tracking the adult population as
 * shares across four educational levels:
 *   - basic       — fundamental only
 *   - secondary   — high school
 *   - technical   — technical/vocational
 *   - higher      — university
 *
 * Each month a fraction of the lower cohorts progresses upward, gated
 * by public-school quality (education budget, teacher salary funding,
 * school-transport reach) and by the number of vocational centers
 * ("Centros de Formação Profissional") funded by the mayor.
 *
 * Skilled jobs demanded by the local economy come from offices, towers
 * and factories on the map. If graduates outrun those jobs, we get
 * *brain drain*: skilled residents migrate out, dragging population,
 * happiness and future revenue with them.
 *
 * Everything is exposed as a small state on GameState.education and a
 * few actions on useGame — no new building sprites or map tiles.
 */

import type { GameState } from "./types";

export type CohortKey = "basic" | "secondary" | "technical" | "higher";

export interface EducationCohorts {
  basic: number;       // 0..1
  secondary: number;   // 0..1
  technical: number;   // 0..1
  higher: number;      // 0..1
}

export interface EducationState {
  cohorts: EducationCohorts;
  /** Player-set teacher-salary funding, R$/month/teacher (500..8000). */
  teacherSalary: number;
  /** Player-set school-transport reach, 0..100 (0 = many kids can't reach school). */
  schoolTransport: number;
  /** Number of funded Centros de Formação Profissional. */
  techCenters: number;
  /** Derived public-school quality 0..100, smoothed. */
  publicSchoolQuality: number;
  /** Monthly count of skilled workers who left the city (brain drain). */
  lastBrainDrain: number;
  /** Monthly count of new graduates promoted to technical/higher. */
  lastGraduates: number;
  /** Aggregate skilled-job supply/demand snapshot (headcount). */
  skilledSupply: number;
  skilledDemand: number;
}

export const TECH_CENTER_BUILD_COST = 320_000;
export const TECH_CENTER_MONTHLY_COST = 18_000;
/** Minimum teacher-salary that keeps quality from decaying (R$). */
export const TEACHER_SALARY_FLOOR = 2_500;
/** Above this salary, retention hits a plateau. */
export const TEACHER_SALARY_TARGET = 5_500;

export function initialEducation(): EducationState {
  return {
    cohorts: { basic: 0.58, secondary: 0.29, technical: 0.08, higher: 0.05 },
    teacherSalary: 3_200,
    schoolTransport: 55,
    techCenters: 0,
    publicSchoolQuality: 45,
    lastBrainDrain: 0,
    lastGraduates: 0,
    skilledSupply: 0,
    skilledDemand: 0,
  };
}

export function ensureEducation(s: GameState): void {
  if (!s.education) s.education = initialEducation();
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Approximate # of public teachers the city needs, from school buildings & pop. */
function teacherHeadcount(s: GameState): number {
  let publicSchools = 0;
  for (const b of s.builtBuildings) {
    if (b === "school" || b === "university") publicSchools++;
  }
  // Baseline of ~1 teacher per 30 students; ~18% of pop is school-age.
  const demand = Math.max(1, Math.round((s.population * 0.18) / 30));
  // Cap by capacity of built schools (~55 teachers each) — no schools, no teachers.
  const capacity = Math.max(0, publicSchools) * 55;
  return Math.min(demand, capacity);
}

/** Monthly education cost delta: teacher payroll + tech-center opex. */
export function educationMonthlyCost(s: GameState): number {
  const ed = s.education;
  if (!ed) return 0;
  const teachers = teacherHeadcount(s);
  const payroll = teachers * ed.teacherSalary;
  const centersOpex = ed.techCenters * TECH_CENTER_MONTHLY_COST;
  return Math.round(payroll + centersOpex);
}

/**
 * Recompute cohorts, brain drain and quality. Returns a fiscal / social
 * delta the main tick folds in.
 */
export function tickEducation(s: GameState): {
  costDelta: number;
  happinessDelta: number;
  unemploymentDelta: number;
  populationDelta: number;
  news?: string;
} {
  ensureEducation(s);
  const ed = s.education;

  // ── School quality ────────────────────────────────────────────────
  const salaryScore = clamp(
    ((ed.teacherSalary - TEACHER_SALARY_FLOOR) /
      (TEACHER_SALARY_TARGET - TEACHER_SALARY_FLOOR)) * 100,
    -30, 110,
  );
  const budgetScore = s.policies.education;                    // 0..100
  const transportScore = ed.schoolTransport;                   // 0..100
  const target = clamp(
    budgetScore * 0.5 + salaryScore * 0.35 + transportScore * 0.15,
    0, 100,
  );
  ed.publicSchoolQuality = clamp(
    ed.publicSchoolQuality + (target - ed.publicSchoolQuality) * 0.18, 0, 100,
  );

  // ── Educational transitions ───────────────────────────────────────
  // Base monthly promotion rates × quality multiplier. Tech centers
  // specifically boost secondary→technical (local vocational path).
  const q = ed.publicSchoolQuality;
  const qMult = 0.4 + q / 90;                     // 0.4 at q=0, ~1.5 at q=100
  const centerBoost = 1 + Math.min(0.6, ed.techCenters * 0.08);

  const basicToSecondary  = ed.cohorts.basic     * 0.010 * qMult;
  const secondaryToTech   = ed.cohorts.secondary * 0.006 * qMult * centerBoost;
  const secondaryToHigher = ed.cohorts.secondary * 0.004 * qMult;
  const techToHigher      = ed.cohorts.technical * 0.002 * qMult;

  ed.cohorts.basic     -= basicToSecondary;
  ed.cohorts.secondary += basicToSecondary - secondaryToTech - secondaryToHigher;
  ed.cohorts.technical += secondaryToTech - techToHigher;
  ed.cohorts.higher    += secondaryToHigher + techToHigher;

  // Normalize to guard against drift.
  const sum = ed.cohorts.basic + ed.cohorts.secondary + ed.cohorts.technical + ed.cohorts.higher;
  if (sum > 0) {
    (Object.keys(ed.cohorts) as CohortKey[]).forEach((k) => {
      ed.cohorts[k] = clamp(ed.cohorts[k] / sum, 0, 1);
    });
  }

  ed.lastGraduates = Math.round(
    (secondaryToTech + secondaryToHigher + techToHigher) * s.population,
  );

  // ── Skilled job demand from map ───────────────────────────────────
  let offices = 0, towers = 0, factories = 0;
  for (const b of s.builtBuildings) {
    if (b === "office") offices++;
    else if (b === "tower") towers++;
    else if (b === "factory") factories++;
  }
  // Offices employ ~120 skilled; towers ~340 (services HQ); factories ~35 skilled.
  ed.skilledDemand = offices * 120 + towers * 340 + factories * 35;
  ed.skilledSupply = Math.round((ed.cohorts.technical + ed.cohorts.higher) * s.population);

  // ── Brain drain ───────────────────────────────────────────────────
  let populationDelta = 0;
  let happinessDelta = 0;
  let unemploymentDelta = 0;
  let news: string | undefined;
  const surplus = ed.skilledSupply - ed.skilledDemand;
  if (surplus > 200) {
    // 1.8% of surplus emigrates per month, capped for pacing.
    const leaving = Math.min(Math.round(surplus * 0.018), Math.round(s.population * 0.006));
    ed.lastBrainDrain = leaving;
    populationDelta = -leaving;
    // Shift the higher cohort down proportionally (they were the ones leaving).
    const share = leaving / Math.max(1, ed.skilledSupply);
    ed.cohorts.higher = clamp(ed.cohorts.higher * (1 - share * 0.6), 0, 1);
    ed.cohorts.technical = clamp(ed.cohorts.technical * (1 - share * 0.4), 0, 1);
    happinessDelta -= Math.min(2.5, leaving / 2500);
    if (leaving > s.population * 0.003) {
      news = "brain_drain_alert";
    }
  } else {
    ed.lastBrainDrain = 0;
    // Skilled workers absorbed → unemployment easing bias.
    if (surplus < -100) {
      unemploymentDelta = 0.25; // unmet demand keeps some skilled jobs unfilled
    } else {
      unemploymentDelta = -0.15;
      happinessDelta += 0.15;
    }
  }

  // Cycle break: rising higher-education share nudges long-run happiness.
  const uplift = (ed.cohorts.technical + ed.cohorts.higher) - 0.20;
  happinessDelta += clamp(uplift * 0.8, -0.4, 1.2);

  return {
    costDelta: educationMonthlyCost(s),
    happinessDelta,
    unemploymentDelta,
    populationDelta,
    news,
  };
}

// ── Actions ────────────────────────────────────────────────────────

export function setTeacherSalary(s: GameState, value: number): GameState {
  ensureEducation(s);
  const next = structuredClone(s);
  next.education.teacherSalary = Math.round(clamp(value, 800, 12_000));
  return next;
}

export function setSchoolTransport(s: GameState, value: number): GameState {
  ensureEducation(s);
  const next = structuredClone(s);
  next.education.schoolTransport = Math.round(clamp(value, 0, 100));
  return next;
}

export function fundTechCenter(s: GameState): GameState {
  ensureEducation(s);
  if (s.treasury < TECH_CENTER_BUILD_COST) return s;
  const next = structuredClone(s);
  next.education.techCenters += 1;
  next.treasury -= TECH_CENTER_BUILD_COST;
  next.lastExpenses += TECH_CENTER_BUILD_COST;
  return next;
}

export function closeTechCenter(s: GameState): GameState {
  ensureEducation(s);
  if (s.education.techCenters <= 0) return s;
  const next = structuredClone(s);
  next.education.techCenters -= 1;
  return next;
}
