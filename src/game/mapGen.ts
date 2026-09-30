import { hashSeed, mulberry32 } from "./rng";
import type { GameState, TileKind, BuildingKind } from "./types";
import { generateDistricts, districtKindAt, type DistrictLayer } from "./districts";

export type { TileKind, BuildingKind } from "./types";

export interface Tile {
  kind: TileKind;
  building?: BuildingKind;
  /** small height variation for terrain (0..2) */
  elev: number;
  /** deterministic per-tile jitter 0..1 (used by renderer for tint variation) */
  jitter: number;
}

export interface CityMap {
  size: number;
  tiles: Tile[];
  /** Cached lists so the renderer can draw in correct z-order easily. */
  buildingCoords: Array<{ x: number; y: number; kind: BuildingKind }>;
}

/**
 * Generate the deterministic BASE map (terrain + roads + rivers + plaza).
 * Buildings are NOT placed here — they live in GameState.builtBuildings and
 * grow over time from zoning + attractiveness.
 */
export function generateBaseMap(state: GameState, size = 18): CityMap {
  const rand = mulberry32(hashSeed(`${state.seed}|${state.cityName}|map`));
  const tiles: Tile[] = new Array(size * size);
  const idx = (x: number, y: number) => y * size + x;

  // Base terrain: grama por padrão + rio + cinturão industrial (concreto/óleo)
  // logo abaixo do rio + anel de periferia/favela (terra) nas bordas.
  const riverY1 = Math.floor(size * 0.68);
  const riverY2 = riverY1 + 1;
  const industrialY = Math.min(size - 2, riverY2 + 2);
  const peripheryBand = Math.max(2, Math.floor(size * 0.09));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const isRiver = (y === riverY1 || y === riverY2) && x > 1 && x < size - 1;
      const inPeriphery =
        x < peripheryBand || y < peripheryBand ||
        x >= size - peripheryBand || y >= size - peripheryBand;
      const isIndustrialBelt = y >= industrialY && !isRiver;

      let kind: TileKind = "grass";
      if (isRiver) kind = "water";
      else if (isIndustrialBelt) {
        // concreto contínuo no cinturão + manchas de terra
        kind = rand() < 0.72 ? "industrial" : "dirt";
      } else if (inPeriphery && rand() < 0.55) {
        // terra batida / periferia irregular
        kind = "dirt";
      }
      tiles[idx(x, y)] = {
        kind,
        elev: isRiver ? 0 : rand() < 0.15 ? 1 : 0,
        jitter: rand(),
      };
    }
  }

  // Bridge across river
  const bridgeX = Math.floor(size / 2);
  tiles[idx(bridgeX, riverY1)] = { kind: "road_v", elev: 0, jitter: rand() };
  tiles[idx(bridgeX, riverY2)] = { kind: "road_v", elev: 0, jitter: rand() };

  // Road grid — main avenues every 4 tiles, above the river only.
  const roadYs: number[] = [];
  const roadXs: number[] = [];
  for (let y = 2; y < riverY1; y += 4) roadYs.push(y);
  for (let x = 2; x < size - 1; x += 4) roadXs.push(x);
  const belowRoadY = Math.min(size - 3, riverY2 + 2);
  roadYs.push(belowRoadY);

  for (const y of roadYs) {
    for (let x = 1; x < size - 1; x++) {
      if (tiles[idx(x, y)].kind === "water") continue;
      tiles[idx(x, y)].kind = "road_h";
      tiles[idx(x, y)].elev = 0;
    }
  }
  for (const x of roadXs) {
    for (let y = 1; y < size - 1; y++) {
      const t = tiles[idx(x, y)];
      if (t.kind === "water") continue;
      t.kind = t.kind === "road_h" ? "road_x" : "road_v";
      t.elev = 0;
    }
  }

  // Central plaza
  const cx = Math.floor(size / 2);
  const cy = Math.max(3, Math.floor(riverY1 / 2));
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const t = tiles[idx(cx + dx, cy + dy)];
      if (!t || t.kind === "water") continue;
      t.kind = "plaza";
      t.elev = 0;
    }
  }

  return { size, tiles, buildingCoords: [] };
}

/**
 * Full seed generator — produces the STARTING city (base terrain + an initial
 * building layout) so a new game already looks lived-in. From then on, the
 * player's zoning drives further growth through zoning.ts.
 */
export function generateMap(state: GameState, size = 18): CityMap {
  const map = generateBaseMap(state, size);
  const { tiles } = map;
  const rand = mulberry32(hashSeed(`${state.seed}|${state.cityName}|seed-build`));
  const idx = (x: number, y: number) => y * size + x;

  const riverY1 = Math.floor(size * 0.68);
  const belowRoadY = Math.min(size - 3, riverY1 + 3);
  const cx = Math.floor(size / 2);
  const cy = Math.max(3, Math.floor(riverY1 / 2));

  // Distritos orgânicos (Voronoi ponderado). Enviesa a mistura de prédios
  // por região: centro concentra torres, comercial vira shops/offices,
  // residencial vira casas médias, periferia vira favelas + casas pequenas,
  // e áreas verdes ficam intocadas (só árvores e parque).
  const districts: DistrictLayer = generateDistricts(size, state.seed, state.cityName);
  const kindAt = (x: number, y: number) => districtKindAt(districts, x, y);

  const popTier = state.population / 15_000;
  const bizDensity = Math.min(1, state.businesses / 600);
  const towerChance = Math.min(0.35, Math.max(0, (state.population - 60_000) / 250_000));

  const isBuildable = (x: number, y: number) => {
    const t = tiles[idx(x, y)];
    if (!t) return false;
    if (t.kind !== "grass" && t.kind !== "dirt" && t.kind !== "industrial") return false;
    if (t.building) return false;
    return true;
  };

  const place = (x: number, y: number, k: BuildingKind) => {
    if (!isBuildable(x, y)) return false;
    tiles[idx(x, y)].building = k;
    map.buildingCoords.push({ x, y, kind: k });
    return true;
  };

  /* ---------- Marcos cívicos: 1 por seed de distrito ---------- */
  // O marco central vai no seed do "centro"; cada distrito comercial e cada
  // 2º distrito residencial ganha uma praça no seu seed point. Isso cria
  // referências visuais espalhadas pela cidade — "onde é o centro do bairro".
  let placedMarco = false;
  let resSeedIdx = 0;
  for (const d of districts.districts) {
    const dx = Math.round(d.cx);
    const dy = Math.round(d.cy);
    if (dy >= riverY1) continue; // não plantar marcos no cinturão industrial
    if (d.kind === "centro" && !placedMarco) {
      // Limpa espaço 3×3 ao redor do marco (remove building pré-existente).
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const t = tiles[idx(dx + ox, dy + oy)];
          if (t && (t.kind === "grass" || t.kind === "dirt")) { t.building = undefined; }
        }
      }
      if (place(dx, dy, "marco_central")) placedMarco = true;
    } else if (d.kind === "comercial") {
      const t = tiles[idx(dx, dy)];
      if (t) { t.building = undefined; place(dx, dy, "praca"); }
    } else if (d.kind === "residencial") {
      resSeedIdx++;
      if (resSeedIdx % 2 === 0) {
        const t = tiles[idx(dx, dy)];
        if (t) { t.building = undefined; place(dx, dy, "praca"); }
      }
    }
  }

  /* ---------- Cinturão residencial + comercial (enviesado por distrito) ---------- */
  for (let y = 1; y < riverY1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (!isBuildable(x, y)) continue;
      if (!neighborRoad(tiles, x, y, size)) continue;
      const dk = kindAt(x, y);

      // Distritos verdes: quase só árvores e nada de construção.
      if (dk === "verde") {
        if (rand() < 0.22) place(x, y, "tree");
        else if (rand() < 0.08) tiles[idx(x, y)].kind = "park";
        continue;
      }

      // Comercial: alta densidade de shops/offices.
      if (dk === "comercial") {
        if (rand() < 0.72 + bizDensity * 0.2) {
          const roll = rand();
          if (roll < 0.15 + towerChance) place(x, y, "office");
          else if (roll < 0.55) place(x, y, "shop");
          else place(x, y, "house_l");
        } else if (rand() < 0.1) place(x, y, "tree");
        continue;
      }

      // Centro: mix denso, muitas torres e ofícios.
      if (dk === "centro") {
        const roll = rand();
        if (roll < 0.30 + towerChance) place(x, y, "tower");
        else if (roll < 0.55) place(x, y, "office");
        else if (roll < 0.75) place(x, y, "shop");
        else place(x, y, "house_l");
        continue;
      }

      // Periferia: predominância de favelas e casas pequenas.
      if (dk === "periferia") {
        const roll = rand();
        const p = Math.min(0.9, 0.55 + 0.1 * popTier);
        if (roll > p) continue;
        const r2 = rand();
        if (r2 < 0.55) place(x, y, r2 < 0.2 ? "favela_l" : r2 < 0.42 ? "favela_m" : "favela_s");
        else if (r2 < 0.85) place(x, y, "house_s");
        else place(x, y, "house_m");
        continue;
      }

      // Residencial padrão: casas médias com um pouco de casas grandes.
      const r = rand();
      const p = Math.min(0.85, 0.35 + 0.12 * popTier);
      if (r < p) {
        const roll = rand();
        let kind: BuildingKind;
        if (roll < towerChance * 0.5) kind = "tower";
        else if (roll < 0.35 + popTier * 0.1) kind = "house_l";
        else if (roll < 0.75) kind = "house_m";
        else kind = "house_s";
        place(x, y, kind);
      } else if (r < p + 0.10) {
        place(x, y, "tree");
      }
    }
  }

  // Comercial extra ao redor da praça central legada (compatível com layout antigo).
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!isBuildable(x, y)) continue;
      if (rand() < 0.35 + bizDensity * 0.3) {
        place(x, y, rand() < 0.55 ? "shop" : "office");
      }
    }
  }

  // Civic
  if (state.policies.education > 30) tryPlaceNear(tiles, size, place, cx - 3, cy - 1, "school", rand);
  if (state.policies.health > 30) tryPlaceNear(tiles, size, place, cx + 3, cy - 1, "hospital", rand);

  // Industrial belt below river
  const industCount = Math.round(Math.min(8, 2 + bizDensity * 6));
  let placedInd = 0;
  for (let y = belowRoadY + 1; y < size - 1 && placedInd < industCount; y++) {
    for (let x = 1; x < size - 1 && placedInd < industCount; x++) {
      if (!isBuildable(x, y)) continue;
      if (rand() < 0.55) {
        place(x, y, "factory");
        placedInd++;
      }
    }
  }

  // Utility plants
  const waterPlants = Math.max(1, Math.round(state.infra.waterCapacity / 250));
  const powerPlants = Math.max(1, Math.round(state.infra.energyCapacity / 300));
  let wp = 0, pp = 0;
  for (let y = size - 2; y >= belowRoadY && (wp < waterPlants || pp < powerPlants); y--) {
    for (let x = size - 2; x >= 1 && (wp < waterPlants || pp < powerPlants); x--) {
      if (!isBuildable(x, y)) continue;
      if (pp < powerPlants && rand() < 0.4) { place(x, y, "power_plant"); pp++; }
      else if (wp < waterPlants && rand() < 0.4) { place(x, y, "water_plant"); wp++; }
    }
  }

  // Parques: extras nos distritos verdes.
  const parkTarget = 2 + Math.floor(popTier);
  let parks = 0;
  for (let attempts = 0; attempts < 60 && parks < parkTarget; attempts++) {
    const x = 1 + Math.floor(rand() * (size - 2));
    const y = 1 + Math.floor(rand() * (riverY1 - 1));
    if (!isBuildable(x, y)) continue;
    tiles[idx(x, y)].kind = "park";
    parks++;
  }

  // Árvores esparsas — densidade maior nos distritos verdes.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = tiles[idx(x, y)];
      if (t.kind !== "grass" || t.building) continue;
      const dk = kindAt(x, y);
      const chance = dk === "verde" ? 0.32 : dk === "periferia" ? 0.04 : 0.06;
      if (rand() < chance) {
        t.building = "tree";
        map.buildingCoords.push({ x, y, kind: "tree" });
      }
    }
  }

  return map;
}

function neighborRoad(tiles: Tile[], x: number, y: number, size: number): boolean {
  const idx = (xx: number, yy: number) => yy * size + xx;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
    const k = tiles[idx(nx, ny)].kind;
    if (k === "road_h" || k === "road_v" || k === "road_x") return true;
  }
  return false;
}

function tryPlaceNear(
  tiles: Tile[],
  size: number,
  place: (x: number, y: number, k: BuildingKind) => boolean,
  x: number,
  y: number,
  kind: BuildingKind,
  rand: () => number,
) {
  const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  offsets.sort(() => rand() - 0.5);
  for (const [dx, dy] of offsets) {
    if (place(x + dx, y + dy, kind)) return;
  }
  void tiles;
}
