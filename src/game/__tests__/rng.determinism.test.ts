import { describe, it, expect } from "vitest";
import { hashSeed, mulberry32, seededRng } from "../rng";
import { initialState, tick } from "../logic";

describe("seeded RNG", () => {
  it("same seed produces the same stream", () => {
    const a = mulberry32(hashSeed("ABC123"));
    const b = mulberry32(hashSeed("ABC123"));
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("different seeds diverge", () => {
    const a = mulberry32(hashSeed("ABC123"));
    const b = mulberry32(hashSeed("XYZ999"));
    let diffs = 0;
    for (let i = 0; i < 100; i++) if (a() !== b()) diffs++;
    expect(diffs).toBeGreaterThan(90);
  });

  it("seededRng advances the cursor on the holder", () => {
    const holder = { rngCursor: 0 };
    const rng = seededRng("SEED", holder);
    for (let i = 0; i < 10; i++) rng();
    expect(holder.rngCursor).toBe(10);
  });
});

describe("tick reproducibility", () => {
  it("two games with the same seed evolve identically over 24 months", () => {
    const runMonths = (seed: string) => {
      let s = initialState("Repro", seed);
      for (let i = 0; i < 24; i++) s = tick(s);
      return s;
    };
    const a = runMonths("REPRO01");
    const b = runMonths("REPRO01");
    expect(a.rngCursor).toBe(b.rngCursor);
    expect(a.happiness).toBe(b.happiness);
    expect(a.treasury).toBe(b.treasury);
    expect(a.inflation).toBe(b.inflation);
    expect(a.population).toBe(b.population);
    expect(a.activeEvent?.def.id ?? null).toBe(b.activeEvent?.def.id ?? null);
  });

  it("different seeds produce different trajectories", () => {
    let a = initialState("A", "SEED_AAA");
    let b = initialState("B", "SEED_BBB");
    for (let i = 0; i < 24; i++) {
      a = tick(a);
      b = tick(b);
    }
    // At least one macro variable should diverge.
    const diverged =
      a.happiness !== b.happiness ||
      a.treasury !== b.treasury ||
      a.inflation !== b.inflation;
    expect(diverged).toBe(true);
  });
});
