import type { ArchetypeId } from "@/assets/archetypes";
import { DEFAULT_ARCHETYPE_ID } from "@/assets/archetypes";

export interface Mayor {
  name: string;
  title: string; // e.g. "Prefeito", "Prefeita" — user-editable
  /** Visual identity for custom mayors. Ignored when `personaId` is set. */
  archetypeId?: ArchetypeId;
  /** Optional caricature preset id — enables persona-specific starting perks. */
  personaId?: string;
}

export const DEFAULT_MAYOR: Mayor = {
  name: "Alex Ribeiro",
  title: "Prefeito(a)",
  archetypeId: DEFAULT_ARCHETYPE_ID,
};
