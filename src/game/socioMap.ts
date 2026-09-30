/**
 * socioMap.ts — Camada socioeconômica (SES) por tile.
 *
 * Traduz a distribuição espacial de renda observada em mapas reais das
 * cidades pré-definidas para o grid do jogo. O modelo é um Voronoi
 * ponderado sobre sementes normalizadas (0..1) — assim o mesmo layout
 * escala para qualquer `mapSize`.
 *
 * Referência principal (Santo Bernardo do Field): mapa da Bia Mapas
 * de São Bernardo do Campo, com marcação manual de renda:
 *   • AZUL  (rica)   → Centro, Rudge Ramos, Nova Petrópolis, Anchieta,
 *                       Jardim do Mar, Jordanópolis, Planalto, Assunção.
 *   • VERDE (mediana) → Ferrazópolis, Baeta Neves, orlas do Centro.
 *   • VERMELHO (pobre) → Alvarenga, Batistini, Balneária, Montanhão,
 *                        Botujuru, Rio Grande, Varginha, Cooperativa.
 *
 * A camada é determinística por `seed + cityId + mapSize` e vive apenas
 * em memória — regenerada pelos consumidores (mesmo padrão de
 * `heightmap` e `districts`).
 */

export type SES = "rich" | "middle" | "poor";

export interface SocioSeed {
  /** Coordenadas normalizadas 0..1 (x → leste, y → sul). */
  nx: number;
  ny: number;
  ses: SES;
  /** Peso relativo — >1 domina mais tiles. */
  weight: number;
  /** Rótulo (bairro real que inspirou a semente). */
  label?: string;
}

export interface SocioLayer {
  size: number;
  /** row-major, length = size². 0 = rich, 1 = middle, 2 = poor. */
  ownerOf: Uint8Array;
}

export const SES_LABEL_PT: Record<SES, string> = {
  rich:   "Renda Alta",
  middle: "Renda Média",
  poor:   "Renda Baixa",
};

/** Cores do overlay (sólidas — usadas no minimapa). */
export const SES_COLOR: Record<SES, string> = {
  rich:   "#3a7bd5", // azul
  middle: "#3fa860", // verde
  poor:   "#d9443a", // vermelho
};

/** Tint suave para o chão isométrico. */
export const SES_TINT: Record<SES, string> = {
  rich:   "rgba(58,123,213,0.14)",
  middle: "rgba(63,168,96,0.13)",
  poor:   "rgba(217,68,58,0.15)",
};

/* ------------------------------------------------------------------ */
/*  Layouts por cidade                                                 */
/* ------------------------------------------------------------------ */

/**
 * Semeadura fiel ao mapa real de SBC. Y=0 é o norte (Rudge Ramos),
 * Y=1 é o sul (Rio Grande / Represa Billings).
 */
const SBC_SEEDS: SocioSeed[] = [
  // ── Norte rico (Rudge Ramos, Anchieta, Nova Petrópolis, Centro).
  { nx: 0.42, ny: 0.10, ses: "rich",   weight: 1.15, label: "Rudge Ramos" },
  { nx: 0.55, ny: 0.14, ses: "rich",   weight: 1.05, label: "Paulicéia" },
  { nx: 0.48, ny: 0.24, ses: "rich",   weight: 1.10, label: "Anchieta" },
  { nx: 0.40, ny: 0.30, ses: "rich",   weight: 1.05, label: "Jordanópolis" },
  { nx: 0.52, ny: 0.34, ses: "rich",   weight: 1.20, label: "Centro" },
  { nx: 0.62, ny: 0.36, ses: "rich",   weight: 1.05, label: "Nova Petrópolis" },
  { nx: 0.44, ny: 0.40, ses: "rich",   weight: 1.00, label: "Independência" },
  { nx: 0.50, ny: 0.44, ses: "rich",   weight: 1.05, label: "Planalto" },
  { nx: 0.45, ny: 0.52, ses: "rich",   weight: 1.00, label: "Assunção" },
  { nx: 0.55, ny: 0.50, ses: "rich",   weight: 1.05, label: "Jardim do Mar" },

  // ── Meia-encosta média (Ferrazópolis, Baeta Neves, Vila Vivaldi).
  { nx: 0.58, ny: 0.58, ses: "middle", weight: 0.95, label: "Baeta Neves" },
  { nx: 0.52, ny: 0.62, ses: "middle", weight: 0.95, label: "Ferrazópolis" },
  { nx: 0.42, ny: 0.60, ses: "middle", weight: 0.90, label: "Alves Dias" },
  { nx: 0.60, ny: 0.66, ses: "middle", weight: 0.90, label: "Nova Petrópolis Sul" },

  // ── Sul pobre (pós-Anchieta, mananciais e represa).
  { nx: 0.30, ny: 0.55, ses: "poor",   weight: 0.90, label: "Cooperativa" },
  { nx: 0.36, ny: 0.68, ses: "poor",   weight: 1.05, label: "Alvarenga" },
  { nx: 0.48, ny: 0.72, ses: "poor",   weight: 1.00, label: "Demarchi" },
  { nx: 0.68, ny: 0.68, ses: "poor",   weight: 1.00, label: "Montanhão" },
  { nx: 0.32, ny: 0.80, ses: "poor",   weight: 1.05, label: "Batistini" },
  { nx: 0.52, ny: 0.82, ses: "poor",   weight: 1.05, label: "Botujuru" },
  { nx: 0.42, ny: 0.90, ses: "poor",   weight: 1.05, label: "Balneária" },
  { nx: 0.60, ny: 0.90, ses: "poor",   weight: 1.00, label: "Varginha" },
  { nx: 0.52, ny: 0.97, ses: "poor",   weight: 1.10, label: "Rio Grande" },
];

/**
 * Fallback radial: centro rico, anel médio, periferia pobre — com
 * ligeiro viés ao sul (padrão comum em cidades brasileiras da RMSP).
 */
function radialFallbackSeeds(): SocioSeed[] {
  const seeds: SocioSeed[] = [
    { nx: 0.50, ny: 0.45, ses: "rich",   weight: 1.30, label: "Centro" },
    { nx: 0.40, ny: 0.40, ses: "rich",   weight: 1.00 },
    { nx: 0.60, ny: 0.42, ses: "rich",   weight: 1.00 },
  ];
  const ring = 0.30;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    seeds.push({
      nx: 0.50 + Math.cos(a) * ring,
      ny: 0.50 + Math.sin(a) * ring * 0.9,
      ses: "middle",
      weight: 0.95,
    });
  }
  const outer = 0.48;
  // 5 pobres, concentradas no sul.
  const southAngles = [Math.PI * 0.35, Math.PI * 0.55, Math.PI * 0.75, Math.PI * 0.95, Math.PI * 0.15];
  for (const a of southAngles) {
    seeds.push({
      nx: 0.50 + Math.cos(a) * outer,
      ny: 0.55 + Math.sin(a) * outer,
      ses: "poor",
      weight: 1.00,
    });
  }
  return seeds;
}

/** Retorna sementes SES para uma cidade dada (aceita id do preset ou nome). */
export function socioSeedsFor(cityKey: string | undefined): SocioSeed[] {
  const k = (cityKey ?? "").toLowerCase();
  if (k.includes("santo_bernardo") || k.includes("santo bernardo") || k.includes("bernardo do field")) {
    return SBC_SEEDS;
  }
  return radialFallbackSeeds();
}

/* ------------------------------------------------------------------ */
/*  Geração                                                            */
/* ------------------------------------------------------------------ */

const SES_INDEX: Record<SES, number> = { rich: 0, middle: 1, poor: 2 };
const INDEX_SES: SES[] = ["rich", "middle", "poor"];

export function generateSocioMap(
  size: number,
  cityKey: string | undefined,
): SocioLayer {
  const seeds = socioSeedsFor(cityKey);
  const owner = new Uint8Array(size * size);
  const sx = seeds.map((s) => s.nx * size);
  const sy = seeds.map((s) => s.ny * size);
  const sw = seeds.map((s) => s.weight);
  const ss = seeds.map((s) => SES_INDEX[s.ses]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let best = 0;
      let bestScore = Infinity;
      for (let i = 0; i < seeds.length; i++) {
        const dx = x - sx[i];
        const dy = y - sy[i];
        const score = Math.sqrt(dx * dx + dy * dy) / sw[i];
        if (score < bestScore) { bestScore = score; best = i; }
      }
      owner[y * size + x] = ss[best];
    }
  }
  return { size, ownerOf: owner };
}

/* ------------------------------------------------------------------ */
/*  Acessos                                                            */
/* ------------------------------------------------------------------ */

export function sesAt(layer: SocioLayer, x: number, y: number): SES {
  const s = layer.size;
  if (x < 0 || y < 0 || x >= s || y >= s) return "middle";
  return INDEX_SES[layer.ownerOf[y * s + x]];
}
