/**
 * autoGrowth.ts — Zoneamento e crescimento autônomo (Modo Prefeito).
 *
 * No modo "mayor" o jogador não pinta zonas nem constrói. Este módulo:
 *   1. Auto-pinta zonas em tiles vazios, com viés pelo distrito Voronoi
 *      (centro → comercial, residencial → residential/zeis, periferia → zeis,
 *      verde → rural).
 *   2. Delega o crescimento de sprites ao `growCity()` já existente, que roda
 *      no mesmo tick — assim reaproveitamos toda a lógica de attractiveness,
 *      outorga e ZEIS.
 *   3. Fornece `placeAwardedWork()` que planta o sprite entregue por uma
 *      licitação num tile válido dentro do distrito-alvo.
 *
 * O ritmo de auto-zoneamento é modesto (baseado em atratividade × população)
 * pra que o crescimento fique perceptível mas não descontrolado.
 */
import type { BuildingKind, GameState, ZoneKind } from "./types";
import type { DistrictKind, DistrictLayer } from "./districts";
import { generateDistricts, districtKindAt } from "./districts";
import { generateBaseMap } from "./mapGen";
import { isZoneableTileKind } from "./zoning";
import type { PublicWork } from "./bidding";

/** Bias de zoneamento por kind de distrito. Soma dos pesos por linha = 1. */
const ZONE_BIAS: Record<DistrictKind, Partial<Record<ZoneKind, number>>> = {
  centro:      { commercial: 0.55, residential: 0.35, industrial: 0.10 },
  comercial:   { commercial: 0.70, residential: 0.25, industrial: 0.05 },
  residencial: { residential: 0.75, commercial: 0.15, zeis: 0.10 },
  periferia:   { residential: 0.35, zeis: 0.55, rural: 0.10 },
  verde:       { rural: 0.80, residential: 0.20 },
};

function pickZone(kind: DistrictKind, rng: () => number): ZoneKind {
  const bias = ZONE_BIAS[kind] ?? {};
  const entries = Object.entries(bias) as Array<[ZoneKind, number]>;
  const r = rng();
  let acc = 0;
  for (const [z, w] of entries) {
    acc += w;
    if (r < acc) return z;
  }
  return entries[entries.length - 1]?.[0] ?? "residential";
}

/**
 * Executa 1 passo de auto-zoneamento pré-`growCity`. Só faz sentido no modo
 * "mayor"; o chamador deve gatekeepar. `rng` deve ser o RNG do tick.
 *
 * Retorna número de tiles zoneados.
 */
export function autoZonePass(s: GameState, rng: () => number): number {
  const size = s.mapSize;
  const base = generateBaseMap(s, size);
  const districts: DistrictLayer = generateDistricts(size, s.seed, s.cityName);

  // Orçamento por tick: proporcional à atratividade + população, limitado
  // pra evitar picos irreais.
  const attr = s.attractiveness ?? 50;
  const budget = Math.max(4, Math.min(40, Math.round(6 + attr / 8 + s.population / 25_000)));

  // Coleta candidatos: tile zoneável, sem zona e sem edifício.
  const candidates: number[] = [];
  for (let i = 0; i < size * size; i++) {
    if (s.zones[i] && s.zones[i] !== "none") continue;
    if (s.builtBuildings[i]) continue;
    const tk = base.tiles[i]?.kind;
    if (!tk || !isZoneableTileKind(tk)) continue;
    candidates.push(i);
  }

  if (!candidates.length) return 0;

  // Embaralha (Fisher–Yates) e pega os primeiros N.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  let painted = 0;
  for (const idx of candidates) {
    if (painted >= budget) break;
    const x = idx % size;
    const y = Math.floor(idx / size);
    const dk = districtKindAt(districts, x, y);
    // Skip tiles em risco de hazard pra zonas formais — o motor de favelas
    // já usa esses tiles.
    if (s.landUse?.hazardMask?.[idx]) continue;
    const zone = pickZone(dk, rng);
    s.zones[idx] = zone;
    painted++;
  }
  return painted;
}

/**
 * Coloca o edifício entregue por uma licitação (obra pública) no melhor tile
 * disponível dentro do distrito-alvo. Estratégia:
 *   1. Enumera tiles vazios e zoneáveis dentro do distrito com o `kind` dado.
 *   2. Prefere tiles adjacentes a algum edifício já existente (concentra
 *      infraestrutura em vez de espalhar aleatório).
 *   3. Fallback: qualquer tile zoneável do distrito. Último fallback: qualquer
 *      tile zoneável do mapa.
 *
 * Retorna true se conseguiu plantar.
 */
export function placeAwardedWork(s: GameState, work: PublicWork, rng: () => number): boolean {
  const size = s.mapSize;
  const base = generateBaseMap(s, size);
  const districts = generateDistricts(size, s.seed, s.cityName);

  const inDistrict: number[] = [];
  const anywhere: number[] = [];
  for (let i = 0; i < size * size; i++) {
    if (s.builtBuildings[i]) continue;
    const tk = base.tiles[i]?.kind;
    if (!tk || !isZoneableTileKind(tk)) continue;
    if (s.landUse?.hazardMask?.[i]) continue;
    anywhere.push(i);
    const x = i % size;
    const y = Math.floor(i / size);
    if (districtKindAt(districts, x, y) === work.districtKind) inDistrict.push(i);
  }

  const pool = inDistrict.length ? inDistrict : anywhere;
  if (!pool.length) return false;

  // Score: +2 se tem vizinho construído (concentração), +1 se tem estrada
  // adjacente (visualmente lê melhor).
  const scored = pool.map(i => {
    const x = i % size, y = Math.floor(i / size);
    let sc = rng();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (s.builtBuildings[ni]) sc += 2;
      const nk = base.tiles[ni]?.kind;
      if (nk === "road_h" || nk === "road_v" || nk === "road_x") sc += 1;
    }
    return { i, sc };
  });
  scored.sort((a, b) => b.sc - a.sc);
  const chosen = scored[0].i;

  s.builtBuildings[chosen] = work.buildingKind as BuildingKind;
  s.buildingOwners[chosen] = "state";
  // Marca zona compatível pra não regenerar por cima.
  if (!s.zones[chosen] || s.zones[chosen] === "none") {
    s.zones[chosen] = zoneForBuilding(work.buildingKind);
  }
  if (s.landUse?.speculationAge) s.landUse.speculationAge[chosen] = 0;
  return true;
}

function zoneForBuilding(k: BuildingKind): ZoneKind {
  switch (k) {
    case "hospital":
    case "school":
    case "university":
    case "fire_station":
    case "praca":
    case "marco_central":
      return "commercial";
    case "water_plant":
    case "power_plant":
      return "industrial";
    case "house_l":
    case "house_m":
    case "house_s":
      return "residential";
    default:
      return "residential";
  }
}
