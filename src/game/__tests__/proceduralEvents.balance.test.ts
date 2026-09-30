import { describe, it, expect } from "vitest";
import { initialState } from "../logic";
import {
  archetypeWeights,
  generateEvent,
  severityProbabilities,
  stressScore,
} from "../proceduralEvents";
import { mulberry32, hashSeed } from "../rng";
import type { GameState } from "../types";

/**
 * These tests treat the procedural generator as a stochastic system and assert
 * distributional properties across many simulated cities, rather than exact
 * outputs. Runs are seeded (mulberry32) so results are stable across CI.
 */

const SAMPLES = 4000;

/** Deterministic sampler over a large N. */
function sample(seed: string, fn: (rng: () => number) => string): Record<string, number> {
  const rng = mulberry32(hashSeed(seed));
  const counts: Record<string, number> = {};
  for (let i = 0; i < SAMPLES; i++) {
    const id = fn(rng);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

function ratio(counts: Record<string, number>, id: string): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (counts[id] ?? 0) / total;
}

/** Build a city state biased toward a given stress profile. */
function makeCity(partial: Partial<GameState>): GameState {
  return { ...initialState("Test City", "TESTSEED"), ...partial };
}

/* ---------- fixtures ---------- */

const BALANCED = makeCity({});
const INFRA_STRAINED = makeCity({
  waterDemand: 260, // > 200 capacity
  energyDemand: 380, // > 300 capacity
});
const UNHAPPY = makeCity({
  happiness: 20,
  approval: 25,
  unemployment: 14,
  policies: { education: 30, health: 30, security: 30, transport: 30 },
});
const INFLATED = makeCity({ inflation: 12 });
const RICH_AND_HAPPY = makeCity({
  happiness: 85,
  approval: 80,
  treasury: 2_000_000,
  taxes: { income: 8, property: 4, business: 8 },
});
const INDEBTED = makeCity({ debt: 900_000 });

/* ---------- archetype distribution ---------- */

describe("archetype weight distribution", () => {
  it("normalized weights sum to ~1 and all archetypes stay reachable", () => {
    for (const city of [BALANCED, INFRA_STRAINED, UNHAPPY, INFLATED, RICH_AND_HAPPY, INDEBTED]) {
      const weights = archetypeWeights(city);
      const sum = weights.reduce((s, w) => s + w.normalized, 0);
      expect(sum).toBeGreaterThan(0.999);
      expect(sum).toBeLessThan(1.001);
      // No archetype should ever be fully starved — floor is 0.05 raw.
      for (const w of weights) {
        expect(w.normalized).toBeGreaterThan(0);
        expect(w.rawWeight).toBeGreaterThanOrEqual(0.05);
      }
    }
  });

  it("no single archetype dominates a balanced city (< 25% share)", () => {
    const weights = archetypeWeights(BALANCED);
    for (const w of weights) {
      expect(w.normalized).toBeLessThan(0.25);
    }
  });

  it("infra failure becomes more likely under water/energy strain", () => {
    const base = archetypeWeights(BALANCED).find((w) => w.id === "infra_failure")!;
    const stressed = archetypeWeights(INFRA_STRAINED).find((w) => w.id === "infra_failure")!;
    expect(stressed.normalized).toBeGreaterThan(base.normalized * 2);
  });

  it("health outbreak becomes more likely when health funding is low", () => {
    const funded = makeCity({ policies: { education: 70, health: 80, security: 60, transport: 60 } });
    const starved = makeCity({ policies: { education: 30, health: 20, security: 30, transport: 30 } });
    const fundedW = archetypeWeights(funded).find((w) => w.id === "health_outbreak")!;
    const starvedW = archetypeWeights(starved).find((w) => w.id === "health_outbreak")!;
    expect(starvedW.normalized).toBeGreaterThan(fundedW.normalized);
  });

  it("creditor pressure only becomes prominent for indebted cities", () => {
    const clean = archetypeWeights(BALANCED).find((w) => w.id === "creditor")!;
    const indebted = archetypeWeights(INDEBTED).find((w) => w.id === "creditor")!;
    expect(indebted.normalized).toBeGreaterThan(clean.normalized * 3);
  });
});

/* ---------- empirical sampling matches declared weights ---------- */

describe("generateEvent honors the declared distribution", () => {
  it("empirical archetype frequencies stay within tolerance of weights", () => {
    const expected = new Map(
      archetypeWeights(BALANCED).map((w) => [w.id, w.normalized]),
    );
    const counts = sample("balanced", (rng) => generateEvent(BALANCED, rng).id);
    for (const [id, exp] of expected) {
      const observed = ratio(counts, id);
      // Allow +/- 5 percentage points for N = 4000.
      expect(Math.abs(observed - exp)).toBeLessThan(0.05);
    }
  });

  it("stressed cities produce more danger/warning events than a happy one", () => {
    const dangerKinds = new Set(["danger", "warning"]);
    const kindShare = (state: GameState, seed: string) => {
      const counts = sample(seed, (rng) => generateEvent(state, rng).kind);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return (
        [...dangerKinds].reduce((s, k) => s + (counts[k] ?? 0), 0) / total
      );
    };
    const happyShare = kindShare(RICH_AND_HAPPY, "happy");
    const strainedShare = kindShare(INFRA_STRAINED, "strained");
    expect(strainedShare).toBeGreaterThan(happyShare);
  });
});

/* ---------- severity distribution ---------- */

describe("severity distribution", () => {
  it("declared probabilities always sum to 100%", () => {
    for (const city of [BALANCED, UNHAPPY, INFLATED, INFRA_STRAINED]) {
      const p = severityProbabilities(city);
      const total = p.minor + p.major + p.critical;
      expect(total).toBeGreaterThan(99.9);
      expect(total).toBeLessThan(100.1);
    }
  });

  it("critical never exceeds 15% and minor stays majority", () => {
    for (const city of [BALANCED, UNHAPPY, INFLATED, INFRA_STRAINED]) {
      const p = severityProbabilities(city);
      expect(p.minor).toBeGreaterThanOrEqual(50);
      expect(p.critical).toBeLessThanOrEqual(15);
    }
  });

  it("higher stress score shifts probability mass toward major/critical", () => {
    const stressOrdered = [RICH_AND_HAPPY, BALANCED, UNHAPPY, INFRA_STRAINED].sort(
      (a, b) => stressScore(a) - stressScore(b),
    );
    let previousBadShare = -1;
    for (const city of stressOrdered) {
      const p = severityProbabilities(city);
      const badShare = p.major + p.critical;
      expect(badShare).toBeGreaterThanOrEqual(previousBadShare);
      previousBadShare = badShare;
    }
  });
});

/* ---------- structural invariants across many cities ---------- */

describe("generated events are always well-formed", () => {
  it("every generated event has 2 choices, non-empty text, and finite effects", () => {
    const cities = [BALANCED, INFRA_STRAINED, UNHAPPY, INFLATED, RICH_AND_HAPPY, INDEBTED];
    const rng = mulberry32(hashSeed("wellformed"));
    for (let i = 0; i < 1500; i++) {
      const city = cities[i % cities.length];
      const evt = generateEvent(city, rng);
      expect(evt.id).toBeTruthy();
      expect(evt.titleKey).toContain("||"); // PT||EN inline
      expect(evt.descriptionKey).toContain("||");
      expect(evt.choices).toHaveLength(2);
      for (const c of evt.choices) {
        expect(c.labelKey).toContain("||");
        expect(c.resultKey).toContain("||");
        if (c.cost != null) {
          expect(Number.isFinite(c.cost)).toBe(true);
          expect(c.cost).toBeGreaterThanOrEqual(0);
        }
        for (const v of Object.values(c.effects)) {
          expect(Number.isFinite(v as number)).toBe(true);
        }
      }
    }
  });
});
