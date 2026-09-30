/**
 * Player-built road network.
 *
 * Layered on top of the procedurally-generated base map: the player paints
 * new streets, avenues and highways tile-by-tile. Each RoadKind has a
 * distinct cost, visual width and lane-stripe style. Roads render as an
 * overlay in CityMap and — because they occupy the tile — block zone
 * painting on that same tile (so growth won't produce a building there).
 *
 * Curves/turns emerge automatically from the grid: a road segment inspects
 * its four neighbours and draws asphalt fingers to whichever sides also
 * carry a player road (or a base map road). That's how orthogonal grids
 * feel continuous without needing bezier control points on an isometric
 * board.
 */
import type { GameState } from "./types";
import { generateBaseMap } from "./mapGen";

export type RoadKind = "street" | "avenue" | "highway";
export type RoadTool = RoadKind | "eraser" | "off";

export interface RoadSpec {
  /** Per-tile construction cost (R$). */
  cost: number;
  /** Per-tile monthly upkeep (R$). Rolled into infra maintenance. */
  upkeep: number;
  /** Asphalt fill colour. */
  asphalt: string;
  /** Curb/edge colour. */
  curb: string;
  /** Lane-stripe colour (yellow for avenues/highways, white dashed for streets). */
  stripe: string;
  /** Relative width of the paved band (0..1 of tile). */
  band: number;
  /** How many lane stripes to draw down the middle. */
  lanes: number;
}

export const ROAD_SPECS: Record<RoadKind, RoadSpec> = {
  street:  { cost:   8_000, upkeep:  60, asphalt: "#4a4a52", curb: "#2a2a2f", stripe: "#f2f2f2", band: 0.55, lanes: 1 },
  avenue:  { cost:  22_000, upkeep: 160, asphalt: "#3f3f47", curb: "#1f1f24", stripe: "#f5d76e", band: 0.78, lanes: 2 },
  highway: { cost:  45_000, upkeep: 320, asphalt: "#2f2f36", curb: "#151519", stripe: "#f5d76e", band: 0.95, lanes: 3 },
};

/* ---------------- Ensure / init ---------------- */

export function ensureRoads(s: GameState): void {
  const size = s.mapSize;
  if (!Array.isArray(s.playerRoads) || s.playerRoads.length !== size * size) {
    s.playerRoads = new Array(size * size).fill(null);
  }
}

/* ---------------- Paint / erase ---------------- */

/** Tile kinds where the player can lay a new road segment. */
function isPaveable(kind: string): boolean {
  return kind === "grass" || kind === "park" || kind === "plaza" || kind === "dirt" || kind === "industrial";
}

export function paintRoad(state: GameState, x: number, y: number, tool: RoadTool): GameState {
  if (tool === "off") return state;
  const size = state.mapSize;
  if (x < 0 || y < 0 || x >= size || y >= size) return state;
  const i = y * size + x;

  ensureRoads(state);
  const roads = state.playerRoads!.slice();

  if (tool === "eraser") {
    if (!roads[i]) return state;
    roads[i] = null;
    return { ...state, playerRoads: roads };
  }

  // Cannot pave over water / existing base roads / any building.
  const base = generateBaseMap(state, size).tiles[i];
  if (!isPaveable(base.kind)) return state;
  if (state.builtBuildings[i]) return state;

  // Already the same road kind — no-op (avoids drag re-charging on stationary tiles).
  if (roads[i] === tool) return state;

  const spec = ROAD_SPECS[tool];
  // Charge the delta: upgrading counts full new cost minus 40% credit for the
  // old surface. Fresh paves pay full price.
  const prev = roads[i];
  const cost = prev ? Math.max(2_000, spec.cost - ROAD_SPECS[prev].cost * 0.4) : spec.cost;
  if (state.treasury < cost) return state;

  roads[i] = tool;
  // Painting a road removes any pending zone on that tile so growth won't
  // fight the road for the plot.
  const zones = state.zones.slice();
  if (zones[i] !== "none") zones[i] = "none";

  return {
    ...state,
    treasury: state.treasury - cost,
    playerRoads: roads,
    zones,
  };
}

/** Total monthly upkeep of the player-built network (added to infra costs). */
export function roadUpkeep(state: GameState): number {
  const roads = state.playerRoads;
  if (!roads) return 0;
  let total = 0;
  for (const r of roads) if (r) total += ROAD_SPECS[r].upkeep;
  return total;
}

/** How many tiles carry a player road (used for KPIs / stats panels). */
export function roadCount(state: GameState, kind?: RoadKind): number {
  const roads = state.playerRoads;
  if (!roads) return 0;
  let n = 0;
  for (const r of roads) if (r && (!kind || r === kind)) n++;
  return n;
}
