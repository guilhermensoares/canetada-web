import { useEffect, useState } from "react";
import type { GameState } from "@/game/types";
import type { MediaState, Headline } from "@/game/media";
import { Card } from "@/components/ui/card";
import { Newspaper, X } from "lucide-react";
import { outletLogo } from "@/assets/media";

interface Props { state: GameState }

/**
 * O Pasquim do Bairro — pequeno jornal impresso que salta como pop-up
 * quando o veículo publica manchetes novas. Baixo impacto geral, mas cria
 * "voz de quarteirão". O jogador pode fechar; ele reaparece com nova edição.
 */
export function NeighborhoodPress({ state }: Props) {
  const isPt = state.lang === "pt";
  const media = (state as GameState & { media?: MediaState }).media;
  const outlet = media?.outlets.find(o => o.bias === "neighborhoodPaper");
  const headlines: Headline[] = (media?.headlines ?? []).filter(h => h.outletId === outlet?.id);

  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [edition, setEdition] = useState(0);
  const latest = headlines[0];

  useEffect(() => {
    if (!latest) return;
    // Nova manchete = nova edição, reabre o pasquim.
    if (dismissedId && dismissedId !== latest.id) {
      setDismissedId(null);
      setEdition(e => e + 1);
    }
  }, [latest?.id, dismissedId]);

  if (!media || !outlet || !latest || dismissedId === latest.id) return null;

  const dateStr = `${String(latest.month).padStart(2,"0")}/${latest.year}`;

  return (
    <Card
      className="p-0 overflow-hidden w-60 shadow-2xl border-2 border-foreground/70 bg-[#f5efe1] text-black"
      style={{
        transform: "rotate(-2.2deg)",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 3px)",
      }}
    >
      <div className="flex items-center justify-between px-2 py-1 border-b border-black/40 bg-[#e8dcc2]">
        <span className="flex items-center gap-1.5 font-serif font-black text-[13px] tracking-tight min-w-0">
          {(() => { const l = outletLogo(outlet.id); return l ? (
            <img src={l} alt="" loading="lazy" className="w-5 h-5 object-contain shrink-0" />
          ) : <Newspaper className="w-3.5 h-3.5 shrink-0" />; })()}
          <span className="truncate">{isPt ? outlet.namePt : outlet.nameEn}</span>
        </span>
        <button
          onClick={() => setDismissedId(latest.id)}
          className="p-0.5 hover:bg-black/10 rounded shrink-0"
          aria-label={isPt ? "Fechar" : "Close"}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="px-2 pt-1 pb-0.5 flex items-center justify-between text-[9px] uppercase tracking-widest opacity-70 border-b border-dashed border-black/40">
        <span>{isPt ? "Edição" : "Issue"} #{edition + 1}</span>
        <span>{dateStr}</span>
      </div>
      <div className="px-3 py-2 font-serif text-[12px] leading-snug italic">
        "{isPt ? latest.textPt : latest.textEn}"
      </div>
      <div className="px-2 py-1 text-[9px] font-serif opacity-70 border-t border-black/30 truncate">
        {isPt ? outlet.sloganPt : outlet.sloganEn}
      </div>
    </Card>
  );
}
