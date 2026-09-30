/**
 * Deterministic PRNG utilities for the procedural event engine.
 *
 * The game persists a `seed` (string) and an `rngCursor` (number of draws made)
 * in GameState. Reconstructing mulberry32(hashSeed(seed) + cursor) at any point
 * yields the same next value — so a run is fully reproducible from (seed, cursor).
 */

/** FNV-1a-ish 32-bit hash of a string. */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good-enough PRNG for gameplay. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Human-friendly random seed (8 chars, base36). */
export function randomSeed(): string {
  const n = Math.floor(Math.random() * 0xffffffff) >>> 0;
  return n.toString(36).padStart(6, "0").slice(0, 8).toUpperCase();
}

/**
 * Build a stateful RNG that reads from `holder.rngCursor` and increments it on
 * every draw. Pass this to any consumer that expects `() => number`.
 */
export function seededRng(seed: string, holder: { rngCursor: number }): () => number {
  const base = hashSeed(seed);
  return function () {
    const rng = mulberry32((base + holder.rngCursor) >>> 0);
    holder.rngCursor += 1;
    return rng();
  };
}
