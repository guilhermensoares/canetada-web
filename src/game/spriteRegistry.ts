/**
 * Sprite Registry — replaces the old procedural building renderer.
 *
 * Sprites live under `src/assets/sprites/<category>/*.png`. Vite's
 * `import.meta.glob` picks them up at build time, so dropping a new PNG in
 * the right folder is enough — no manual list to maintain.
 *
 * Selection is deterministic per tile via a seeded RNG (mulberry32), so a
 * given (x, y, kind) always shows the same variant across renders/frames.
 */
import type { BuildingKind } from "@/game/types";

export type SpriteCategory =
  | "commerce"
  | "favela"
  | "normal_house"
  | "luxury_house"
  | "luxury_building"
  | "industry"
  | "hospital"
  | "school"
  | "police"
  | "power_plant"
  | "water_plant"
  | "piscinao"
  | "praca"
  | "marco";

/* ---------- Auto-discovery via Vite glob ---------- */

// Sprites in-repo: importados como URL final (via ?url).
const RAW = import.meta.glob("/src/assets/sprites/**/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// Sprites hospedados no CDN (Lovable Assets): o pointer .webp.asset.json carrega
// { url, ... } — usamos o `.url` como se fosse a URL final.
const RAW_ASSETS = import.meta.glob("/src/assets/sprites/**/*.webp.asset.json", {
  eager: true,
  import: "default",
}) as Record<string, { url: string }>;

const POOLS: Record<SpriteCategory, string[]> = {
  commerce: [],
  favela: [],
  normal_house: [],
  luxury_house: [],
  luxury_building: [],
  industry: [],
  hospital: [],
  school: [],
  police: [],
  power_plant: [],
  water_plant: [],
  piscinao: [],
  praca: [],
  marco: [],
};

for (const [path, url] of Object.entries(RAW)) {
  const parts = path.split("/");
  const category = parts[parts.length - 2] as SpriteCategory;
  if (category in POOLS) POOLS[category].push(url);
}
for (const [path, pointer] of Object.entries(RAW_ASSETS)) {
  const parts = path.split("/");
  const category = parts[parts.length - 2] as SpriteCategory;
  if (category in POOLS && pointer?.url) POOLS[category].push(pointer.url);
}
// Keep pools stable across sessions.
for (const cat of Object.keys(POOLS) as SpriteCategory[]) POOLS[cat].sort();

/* ---------- Kind → Category mapping ---------- */

export const KIND_TO_CATEGORY: Partial<Record<BuildingKind, SpriteCategory>> = {
  shop: "commerce",
  favela_s: "favela",
  favela_m: "favela",
  favela_l: "favela",
  house_s: "normal_house",
  house_m: "normal_house",
  house_l: "luxury_house",
  office: "luxury_building",
  tower: "luxury_building",
  factory: "industry",
  barn: "industry",
  hospital: "hospital",
  school: "school",
  school_private: "school",
  university: "school",
  fire_station: "police",
  power_plant: "power_plant",
  water_plant: "water_plant",
  praca: "praca",
  marco_central: "marco",
};

/* ---------- Seeded RNG ---------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-tile seed. */
export function tileSpriteSeed(x: number, y: number, kind: string): number {
  let h = 2166136261 >>> 0;
  const s = `${x}|${y}|${kind}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick a sprite URL for a given tile. Returns null when the category has no
 * sprites yet (renderer falls back to a placeholder box).
 */
export function pickSpriteUrl(kind: BuildingKind, seed: number): string | null {
  const cat = KIND_TO_CATEGORY[kind];
  if (!cat) return null;
  const pool = POOLS[cat];
  if (!pool || pool.length === 0) return null;
  const rng = mulberry32(seed);
  rng(); rng(); // warm up
  const idx = Math.floor(rng() * pool.length);
  return pool[idx] ?? null;
}

/** Returns true when the game should route this building through the sprite canvas. */
export function isSpriteKind(kind: BuildingKind): boolean {
  return kind in KIND_TO_CATEGORY;
}

/** Debug helper — how many sprites exist per category. */
export function spritePoolCounts(): Record<SpriteCategory, number> {
  const out = {} as Record<SpriteCategory, number>;
  for (const cat of Object.keys(POOLS) as SpriteCategory[]) out[cat] = POOLS[cat].length;
  return out;
}
