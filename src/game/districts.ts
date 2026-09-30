/**
 * Districts / Bairros — camada de classificação orgânica dos tiles.
 *
 * Cada tile pertence a exatamente 1 distrito, cujo *kind* define a função
 * urbana (centro comercial, comercial secundário, residencial, periferia,
 * verde). A alocação é feita por Voronoi ponderado: seeds recebem um peso
 * (centro é mais "forte" e domina uma área maior), e cada tile fica com o
 * seed cuja distância / peso é mínima. O resultado tem fronteiras naturais,
 * não geométricas — o centro empurra a região comercial, que empurra a
 * residencial, e as bordas viram periferia.
 *
 * A camada é **puramente determinística** por `seed + cityName + mapSize`,
 * então nunca precisa ir para o `GameState` — os consumidores regenerarem
 * em memória (mesmo padrão de `roadNetwork` e `heightmap`).
 */
import { hashSeed, mulberry32 } from "./rng";

export type DistrictKind = "centro" | "comercial" | "residencial" | "periferia" | "verde";

export interface District {
  id: number;
  kind: DistrictKind;
  cx: number;
  cy: number;
  weight: number;
  name: string;
}

export interface DistrictLayer {
  size: number;
  /** row-major, length = size². Valor = District.id (0..districts.length-1). */
  ownerOf: Uint16Array;
  districts: District[];
}

/* ---------------- Cores + rótulos ---------------- */

/** Cor de tint aplicada ao chão (alpha baixo — só dá coesão espacial). */
export const DISTRICT_TINT: Record<DistrictKind, string> = {
  centro:      "rgba(212, 178, 122, 0.14)", // bege quente / calçadão
  comercial:   "rgba(120, 148, 180, 0.13)", // azul-acinzentado suave
  residencial: "rgba(180, 196, 130, 0.13)", // verde-amarelo pastel
  periferia:   "rgba(150, 118, 84, 0.14)",  // marrom claro / terra
  verde:       "rgba(90,  148, 96,  0.18)", // verde saturado baixo
};

/** Cor sólida usada no minimapa (sem transparência). */
export const DISTRICT_COLOR: Record<DistrictKind, string> = {
  centro:      "#c39a56",
  comercial:   "#5b7fae",
  residencial: "#93a75a",
  periferia:   "#8a6a44",
  verde:       "#3f9250",
};

export const DISTRICT_LABEL_PT: Record<DistrictKind, string> = {
  centro:      "Centro",
  comercial:   "Comercial",
  residencial: "Residencial",
  periferia:   "Periferia",
  verde:       "Área verde",
};

/* ---------------- Nomes procedurais ---------------- */

const PREFIX: Record<DistrictKind, string[]> = {
  centro:      ["Centro Histórico", "Centro", "Centro Cívico"],
  comercial:   ["Distrito Comercial", "Centro Comercial", "Setor Comercial"],
  residencial: ["Jd.", "Vila", "Res.", "Pq.", "Bairro"],
  periferia:   ["Jd.", "Vila", "Núcleo", "Cohab", "Chácaras"],
  verde:       ["Bosque", "Parque", "Pq. Municipal", "Jd. Botânico", "Reserva"],
};

const SUFFIX: Record<DistrictKind, string[]> = {
  centro:      ["", "da Sé", "da República", "Antigo"],
  comercial:   ["Norte", "Sul", "Leste", "Oeste", "Novo", "Central"],
  residencial: [
    "Aurora", "Boa Vista", "das Flores", "dos Ipês", "Nova",
    "das Palmeiras", "Santa Rita", "São João", "das Acácias",
    "do Bosque", "Primavera", "das Rosas", "Bela Vista",
    "do Sol", "Verde", "das Nações",
  ],
  periferia: [
    "Esperança", "Nova União", "Santa Cruz", "São Judas",
    "do Sol Poente", "das Palmeiras", "Vitória", "da Paz",
    "Bela Cintra", "Novo Horizonte", "Progresso",
  ],
  verde: [
    "do Ipê", "das Águas", "Anhanguera", "Trianon",
    "Municipal", "da Aclimação", "do Carmo", "Buenos Aires",
  ],
};

function pickName(kind: DistrictKind, rng: () => number, taken: Set<string>): string {
  const pre = PREFIX[kind];
  const suf = SUFFIX[kind];
  for (let attempt = 0; attempt < 24; attempt++) {
    const p = pre[Math.floor(rng() * pre.length)];
    const s = suf[Math.floor(rng() * suf.length)];
    const name = s ? `${p} ${s}`.trim() : p;
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  // fallback numerado
  let n = 2;
  while (taken.has(`${pre[0]} ${n}`)) n++;
  const name = `${pre[0]} ${n}`;
  taken.add(name);
  return name;
}

/* ---------------- Geração ---------------- */

interface Seed { x: number; y: number; kind: DistrictKind; weight: number; }

function placeSeed(
  kind: DistrictKind,
  ring: [number, number],
  angle: number,
  size: number,
  rng: () => number,
  taken: Seed[],
  weight: number,
): Seed {
  // Rejeição amostral pra evitar colar seeds do mesmo tipo.
  const cx = size / 2;
  const cy = size / 2;
  const maxR = Math.min(size, size) / 2;
  for (let attempt = 0; attempt < 12; attempt++) {
    const r = maxR * (ring[0] + rng() * (ring[1] - ring[0]));
    const a = angle + (rng() - 0.5) * 0.6;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    let ok = true;
    for (const s of taken) {
      const dx = s.x - x, dy = s.y - y;
      if (dx * dx + dy * dy < Math.pow(size * 0.09, 2)) { ok = false; break; }
    }
    if (ok || attempt === 11) return { x, y, kind, weight };
  }
  return { x: cx, y: cy, kind, weight };
}

export function generateDistricts(
  size: number,
  seed: string | number,
  cityName = "",
): DistrictLayer {
  const rng = mulberry32(hashSeed(`${seed}|${cityName}|districts|${size}`));
  const seeds: Seed[] = [];

  /* Centro — 1 seed com peso alto, ligeiramente jitter do centro. */
  seeds.push({
    x: size / 2 + (rng() - 0.5) * size * 0.08,
    y: size / 2 + (rng() - 0.5) * size * 0.08,
    kind: "centro",
    weight: 1.55, // domina uma área respeitável mas não gigante
  });

  /* 2–3 comerciais no anel interno (0.18–0.32 do raio). */
  const nCom = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < nCom; i++) {
    const angle = (i / nCom) * Math.PI * 2 + rng() * 0.8;
    seeds.push(placeSeed("comercial", [0.18, 0.34], angle, size, rng, seeds, 1.05));
  }

  /* 4–6 residenciais no anel médio (0.30–0.55). */
  const nRes = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < nRes; i++) {
    const angle = (i / nRes) * Math.PI * 2 + rng() * 0.9;
    seeds.push(placeSeed("residencial", [0.30, 0.55], angle, size, rng, seeds, 1.0));
  }

  /* 2–3 periferias no anel externo (0.55–0.85). */
  const nPer = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < nPer; i++) {
    const angle = (i / nPer) * Math.PI * 2 + Math.PI / nPer + rng() * 0.6;
    seeds.push(placeSeed("periferia", [0.55, 0.85], angle, size, rng, seeds, 0.85));
  }

  /* 3–5 verdes — raio pequeno, espalhados. Peso baixo pra não invadir vizinhos. */
  const nVer = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < nVer; i++) {
    const angle = rng() * Math.PI * 2;
    seeds.push(placeSeed("verde", [0.20, 0.75], angle, size, rng, seeds, 0.55));
  }

  /* Nomes únicos por distrito. */
  const takenNames = new Set<string>();
  const districts: District[] = seeds.map((s, id) => ({
    id,
    kind: s.kind,
    cx: s.x,
    cy: s.y,
    weight: s.weight,
    name: pickName(s.kind, rng, takenNames),
  }));

  /* Voronoi ponderado. */
  const ownerOf = new Uint16Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let best = 0;
      let bestScore = Infinity;
      for (let i = 0; i < districts.length; i++) {
        const d = districts[i];
        const dx = x - d.cx;
        const dy = y - d.cy;
        // distância euclidiana / peso — quanto maior o weight, maior a área capturada.
        const score = Math.sqrt(dx * dx + dy * dy) / d.weight;
        if (score < bestScore) { bestScore = score; best = i; }
      }
      // Jitter de borda: soma um ruído pequeno pra ondular as fronteiras.
      // (Reamostragem só de vizinhos próximos, pra não distorcer o layout global.)
      const noise = ((h32(x, y) & 0xff) - 128) / 128; // -1..1
      // Aplicamos o ruído reavaliando o 2º melhor: se ele estiver dentro de
      // ~8% do melhor, o ruído decide. Sem isso a fronteira é lisa demais.
      let second = 0;
      let secondScore = Infinity;
      for (let i = 0; i < districts.length; i++) {
        if (i === best) continue;
        const d = districts[i];
        const dx = x - d.cx, dy = y - d.cy;
        const s2 = Math.sqrt(dx * dx + dy * dy) / d.weight;
        if (s2 < secondScore) { secondScore = s2; second = i; }
      }
      if (secondScore - bestScore < bestScore * 0.09 && noise > 0.15) {
        best = second;
      }
      ownerOf[y * size + x] = best;
    }
  }

  return { size, ownerOf, districts };
}

/* ---------------- Acessos utilitários ---------------- */

export function districtAt(layer: DistrictLayer, x: number, y: number): District {
  const s = layer.size;
  if (x < 0 || y < 0 || x >= s || y >= s) return layer.districts[0];
  return layer.districts[layer.ownerOf[y * s + x]];
}

export function districtKindAt(layer: DistrictLayer, x: number, y: number): DistrictKind {
  return districtAt(layer, x, y).kind;
}

/** Retorna verdadeiro se o tile é o *seed point* de algum distrito (usado
 *  pra spawnar praças e marco central). */
export function isDistrictSeedTile(layer: DistrictLayer, x: number, y: number): District | null {
  for (const d of layer.districts) {
    if (Math.round(d.cx) === x && Math.round(d.cy) === y) return d;
  }
  return null;
}

/* ---------------- Helpers internos ---------------- */

function h32(x: number, y: number): number {
  let h = 2166136261 >>> 0;
  h ^= x & 0xff; h = Math.imul(h, 16777619);
  h ^= (x >>> 8) & 0xff; h = Math.imul(h, 16777619);
  h ^= y & 0xff; h = Math.imul(h, 16777619);
  h ^= (y >>> 8) & 0xff; h = Math.imul(h, 16777619);
  return h >>> 0;
}
