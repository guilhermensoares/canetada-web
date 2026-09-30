/**
 * Registry of satirical logos for TV networks, newspapers and radio.
 * Keys map to MediaOutlet.id defined in src/game/media.ts.
 */
import o1 from "./o1.webp";
import o2 from "./o2.webp";
import o3 from "./o3.webp";
import o4 from "./o4.webp";
import o5 from "./o5.webp";
import tv_cubo from "./tv_cubo.webp";
import tv_sbtv from "./tv_sbtv.webp";
import tv_recordar from "./tv_recordar.webp";
import tv_band from "./tv_band.webp";
import radio_favela from "./radio_favela.webp";
import pasquim from "./pasquim.webp";

export const OUTLET_LOGOS: Record<string, string> = {
  o1, o2, o3, o4, o5,
  tv_cubo, tv_sbtv, tv_recordar, tv_band,
  radio_favela, pasquim,
};

export function outletLogo(id: string): string | undefined {
  return OUTLET_LOGOS[id];
}
