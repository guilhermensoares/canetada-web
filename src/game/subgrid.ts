/**
 * Subgrid — Fase 1 do mapa denso (Cities: Skylines-like).
 *
 * O state do jogo permanece 1 building por tile do grid principal (mapSize²).
 * Aqui definimos como cada tile é **visualmente** subdividido em uma malha
 * SUB × SUB de "lotes", permitindo que o renderer coloque múltiplos sprites
 * menores por tile — criando a impressão de quarteirão povoado.
 *
 * Determinístico: dado (tileX, tileY, kind) sempre retorna o mesmo layout.
 */

export const SUB = 4; // 4x4 lotes por tile
export const SUB_COUNT = SUB * SUB;

/** Footprint em lotes (largura = altura) por categoria de sprite. */
export const FOOTPRINT: Record<string, number> = {
  commerce: 2,
  favela: 1,
  normal_house: 2,
  luxury_house: 3,
  luxury_building: 4, // torres tomam o bloco todo
  industry: 3,
  hospital: 4,
  school: 3,
  police: 2,
  power_plant: 4,
  water_plant: 3,
  piscinao: 4,
  praca: 4,   // praça ocupa o tile inteiro (peça cívica única)
  marco: 4,   // marco central idem
};

/** Quantos sprites tentar posicionar em um tile, por categoria. */
export const DENSITY: Record<string, number> = {
  commerce: 3,
  favela: 6,
  normal_house: 3,
  luxury_house: 1,
  luxury_building: 1,
  industry: 1,
  hospital: 1,
  school: 1,
  police: 2,
  power_plant: 1,
  water_plant: 1,
  piscinao: 1,
  praca: 1,
  marco: 1,
};

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

function h32(x: number, y: number, salt: string): number {
  let h = 2166136261 >>> 0;
  const s = `${x}|${y}|${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface ParcelSlot {
  /** Sub-coord dentro do tile (0..SUB-1). */
  sx: number;
  sy: number;
  /** Footprint em lotes. */
  fw: number;
  /** Seed do sprite (para variação). */
  seed: number;
  /** Escala extra (0.9..1.05) para quebrar uniformidade. */
  scale: number;
}

/**
 * Retorna os slots de sprite dentro de um tile, respeitando footprint sem
 * sobreposição via bitmask 4x4. Se um footprint > SUB, retorna 1 slot central.
 */
export function parcelLayout(
  tileX: number,
  tileY: number,
  category: string,
): ParcelSlot[] {
  const fw = Math.min(SUB, FOOTPRINT[category] ?? 2);
  if (fw >= SUB) {
    return [
      {
        sx: 0,
        sy: 0,
        fw: SUB,
        seed: h32(tileX, tileY, category + ":c"),
        scale: 1,
      },
    ];
  }
  const density = DENSITY[category] ?? 2;
  const rng = mulberry32(h32(tileX, tileY, category + ":l"));
  const occupied = new Uint8Array(SUB * SUB);
  const slots: ParcelSlot[] = [];
  const maxTries = density * 4;
  let tries = 0;

  while (slots.length < density && tries < maxTries) {
    tries++;
    const sx = Math.floor(rng() * (SUB - fw + 1));
    const sy = Math.floor(rng() * (SUB - fw + 1));
    // Checa colisão
    let free = true;
    for (let yy = 0; yy < fw && free; yy++) {
      for (let xx = 0; xx < fw && free; xx++) {
        if (occupied[(sy + yy) * SUB + (sx + xx)]) free = false;
      }
    }
    if (!free) continue;
    for (let yy = 0; yy < fw; yy++) {
      for (let xx = 0; xx < fw; xx++) {
        occupied[(sy + yy) * SUB + (sx + xx)] = 1;
      }
    }
    slots.push({
      sx,
      sy,
      fw,
      seed: h32(tileX * 31 + sx, tileY * 31 + sy, category),
      scale: 0.9 + rng() * 0.15,
    });
  }
  return slots;
}

/** Slots de detalhes urbanos (árvore/poste) em lotes livres. */
export function ambientSlots(
  tileX: number,
  tileY: number,
  usedMask: Uint8Array,
  count: number,
): Array<{ sx: number; sy: number; kind: "tree" | "pole" }> {
  const rng = mulberry32(h32(tileX, tileY, "amb"));
  const out: Array<{ sx: number; sy: number; kind: "tree" | "pole" }> = [];
  let tries = 0;
  while (out.length < count && tries < count * 6) {
    tries++;
    const sx = Math.floor(rng() * SUB);
    const sy = Math.floor(rng() * SUB);
    if (usedMask[sy * SUB + sx]) continue;
    usedMask[sy * SUB + sx] = 1;
    out.push({ sx, sy, kind: rng() < 0.7 ? "tree" : "pole" });
  }
  return out;
}
