import house_s from "./house_s.webp";
import house_m from "./house_m.webp";
import house_l from "./house_l.webp";
import shop from "./shop.webp";
import office from "./office.webp";
import tower from "./tower.webp";
import factory from "./factory.webp";
import school from "./school.webp";
import hospital from "./hospital.webp";
import fire_station from "./fire_station.webp";
import university from "./university.webp";
import water_plant from "./water_plant.webp";
import power_plant from "./power_plant.webp";
import farm from "./farm.webp";
import favela_s from "./favela_s.webp";
import favela_m from "./favela_m.webp";
import favela_l from "./favela_l.webp";
import tree from "./tree.webp";
import pracaPointer from "./praca/praca_fountain.webp.asset.json";
import marcoPointer from "./marco/marco_central.webp.asset.json";
import type { BuildingKind } from "@/game/mapGen";

/** Vertical scale multiplier vs the tile diamond. Taller buildings need bigger art. */
export interface SpriteSpec {
  src: string;
  /** How many tile-widths tall to draw (approx). Controls sprite height. */
  scale: number;
  /** Horizontal anchor offset (tile widths). 0.5 = centered. */
  anchorX?: number;
}

export const BUILDING_SPRITES: Partial<Record<BuildingKind, SpriteSpec>> = {
  house_s:      { src: house_s,      scale: 0.95 },
  house_m:      { src: house_m,      scale: 1.20 },
  house_l:      { src: house_l,      scale: 1.50 },
  shop:         { src: shop,         scale: 1.20 },
  office:       { src: office,       scale: 1.80 },
  tower:        { src: tower,        scale: 2.60 },
  factory:      { src: factory,      scale: 1.55 },
  school:       { src: school,       scale: 1.35 },
  school_private:{ src: school,      scale: 1.35 },
  university:   { src: university,   scale: 1.60 },
  hospital:     { src: hospital,     scale: 1.60 },
  fire_station: { src: fire_station, scale: 1.35 },
  water_plant:  { src: water_plant,  scale: 1.30 },
  power_plant:  { src: power_plant,  scale: 1.75 },
  farm:         { src: farm,         scale: 1.30 },
  barn:         { src: farm,         scale: 1.30 },
  favela_s:     { src: favela_s,     scale: 1.05 },
  favela_m:     { src: favela_m,     scale: 1.45 },
  favela_l:     { src: favela_l,     scale: 2.00 },
  tree:         { src: tree,         scale: 1.10 },
  // Marcos cívicos hospedados no CDN — sprite quadrado, footprint 4×4.
  praca:         { src: pracaPointer.url, scale: 1.15 },
  marco_central: { src: marcoPointer.url, scale: 1.80 },
};
