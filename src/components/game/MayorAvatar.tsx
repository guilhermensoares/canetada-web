import { portraitFor } from "@/assets/politicians";
import { portraitForArchetype, type ArchetypeId } from "@/assets/archetypes";
import { User } from "lucide-react";

/**
 * Portrait renderer. Resolves the sprite in this order:
 *  1. `personaId` → caricature politician portrait.
 *  2. `archetypeId` → generic pixel-art archetype portrait.
 *  3. Fallback icon (should never happen in practice).
 */
export function MayorAvatar({
  size = 96,
  className,
  personaId,
  archetypeId,
}: {
  size?: number;
  className?: string;
  personaId?: string | null;
  archetypeId?: ArchetypeId | null;
}) {
  const portrait = portraitFor(personaId) ?? portraitForArchetype(archetypeId);

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    background: "linear-gradient(180deg, #164a63, #0e2436)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (!portrait) {
    return (
      <div className={className} style={wrapperStyle} aria-label="Mayor portrait">
        <User style={{ width: size * 0.55, height: size * 0.55, color: "rgba(255,255,255,0.6)" }} />
      </div>
    );
  }

  return (
    <div className={className} style={wrapperStyle} aria-label="Mayor portrait">
      <img
        src={portrait}
        alt=""
        loading="lazy"
        width={size}
        height={size}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}
