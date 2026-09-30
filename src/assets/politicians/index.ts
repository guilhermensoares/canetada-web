/**
 * Pixel-art portraits for the caricature politicians.
 *
 * Each key matches a `PoliticianPreset.id` from `src/game/politicianPresets.ts`.
 * `MayorAvatar` renders the image when a matching `personaId` is present and
 * falls back to the procedural SVG otherwise (e.g. custom mayors).
 */
import sarack_ojama from "./sarack_ojama.png";
import zuza from "./zuza.png";
import facir_bonossauro from "./facir_bonossauro.png";
import zeitu_vargas from "./zeitu_vargas.png";
import jusselino from "./jusselino.png";
import jango_gular from "./jango_gular.png";
import terzredo from "./terzredo.png";
import sarney_norte from "./sarney_norte.png";
import collor_melao from "./collor_melao.png";
import fhc_carvalho from "./fhc_carvalho.png";
import dilmara from "./dilmara.png";
import temerario from "./temerario.png";
import marina_prata from "./marina_prata.png";
import vitinho_viana from "./vitinho_viana.png";
import chupetikolas from "./chupetikolas.png";
import kenny_katacoco from "./kenny_katacoco.png";

export const POLITICIAN_PORTRAITS: Record<string, string> = {
  sarack_ojama,
  zuza,
  facir_bonossauro,
  zeitu_vargas,
  jusselino,
  jango_gular,
  terzredo,
  sarney_norte,
  collor_melao,
  // Preset id has an accent-free underscore variant.
  collor_melão: collor_melao,
  fhc_carvalho,
  dilmara,
  temerario,
  marina_prata,
  vitinho_viana,
  chupetikolas,
  kenny_katacoco,
};


export function portraitFor(personaId?: string | null): string | null {
  if (!personaId) return null;
  return POLITICIAN_PORTRAITS[personaId] ?? null;
}
