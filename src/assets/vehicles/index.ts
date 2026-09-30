/**
 * Registry de sprites de veículos brasileiros (sátira, sem marcas licenciadas).
 * Cada sprite é 512×512 PNG transparente em perspectiva 3/4 isométrica,
 * frente virada pra LESTE (canonical). O renderer rotaciona/espelha no canvas
 * para cobrir as 8 direções — evita gerar 8 assets por modelo.
 */
import gol_quadrado from "./gol_quadrado.webp";
import celta from "./celta.webp";
import palio_g1 from "./palio_g1.webp";
import clio_2001 from "./clio_2001.webp";
import uno_quadrado from "./uno_quadrado.webp";
import onix from "./onix.webp";
import hb20 from "./hb20.webp";
import polo from "./polo.webp";
import siena_app from "./siena_app.webp";
import strada_moderna from "./strada_moderna.webp";
import compass_suv from "./compass_suv.webp";
import hilux from "./hilux.webp";
import dolphin_ev from "./dolphin_ev.webp";
import corolla_exec from "./corolla_exec.webp";
import uno_escada from "./uno_escada.webp";
import strada_firma from "./strada_firma.webp";
import bongo_entrega from "./bongo_entrega.webp";
import kwid from "./kwid.webp";
import peugeot_206 from "./peugeot_206.webp";

export type VehicleSpriteId =
  | "gol_quadrado" | "celta" | "palio_g1" | "clio_2001" | "uno_quadrado"
  | "onix" | "hb20" | "polo" | "siena_app" | "strada_moderna"
  | "compass_suv" | "hilux" | "dolphin_ev" | "corolla_exec"
  | "uno_escada" | "strada_firma" | "bongo_entrega" | "kwid" | "peugeot_206";

export interface VehicleSpriteSpec {
  src: string;
  /** Comprimento base em pixels de mundo (zoom=1). Modelos grandes desenham maior. */
  length: number;
  /** true = ignora paleta BR e mantém pintura branca (frotas de serviço/firma). */
  fixedWhite?: boolean;
}

export const VEHICLE_SPRITES: Record<VehicleSpriteId, VehicleSpriteSpec> = {
  // Classe baixa — carros antigos, silhuetas compactas
  gol_quadrado:   { src: gol_quadrado,   length: 11 },
  celta:          { src: celta,          length: 10 },
  palio_g1:       { src: palio_g1,       length: 10 },
  clio_2001:      { src: clio_2001,      length: 10 },
  uno_quadrado:   { src: uno_quadrado,   length: 10 },
  // Classe média — hatches e sedans modernos
  onix:           { src: onix,           length: 11 },
  hb20:           { src: hb20,           length: 11 },
  polo:           { src: polo,           length: 11 },
  siena_app:      { src: siena_app,      length: 12, fixedWhite: true }, // prata fixo (identidade de app)
  strada_moderna: { src: strada_moderna, length: 12 },
  // Classe alta — SUVs, picapes 4x4, EV, executivos
  compass_suv:    { src: compass_suv,    length: 13 },
  hilux:          { src: hilux,          length: 14 },
  dolphin_ev:     { src: dolphin_ev,     length: 11, fixedWhite: true },
  corolla_exec:   { src: corolla_exec,   length: 13 },
  // Serviço — sempre brancos, com bônus mecânico no Uno Escada
  uno_escada:     { src: uno_escada,     length: 11, fixedWhite: true },
  strada_firma:   { src: strada_firma,   length: 12, fixedWhite: true },
  bongo_entrega:  { src: bongo_entrega,  length: 13, fixedWhite: true },
  // Popular moderno — hatch entry-level; carrega o Easter Egg da antena gigante.
  kwid:           { src: kwid,           length: 10 },
  // Peugeot 206 — fama de quebrar; carrega o Easter Egg do capô aberto + bloqueio de via.
  peugeot_206:    { src: peugeot_206,    length: 11 },
};

export const ALL_VEHICLE_SRCS: string[] = Object.values(VEHICLE_SPRITES).map((v) => v.src);
