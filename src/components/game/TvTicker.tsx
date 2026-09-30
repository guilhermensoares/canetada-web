import { useEffect, useState } from "react";
import type { GameState } from "@/game/types";
import type { MediaState, Headline, MediaOutlet } from "@/game/media";
import { Card } from "@/components/ui/card";
import { Tv, Radio } from "lucide-react";
import { outletLogo } from "@/assets/media";

interface Props { state: GameState }

/** TV corner: cicla manchetes dos canais parodiados (Rede Cubo, TVN Família, Recordar, Cidade 24h). */
export function TvTicker({ state }: Props) {
  const media = (state as GameState & { media?: MediaState }).media;
  const isPt = state.lang === "pt";
  const [idx, setIdx] = useState(0);

  const tvOutlets: MediaOutlet[] = media?.outlets.filter(o => o.kind === "tv") ?? [];
  const tvIds = new Set(tvOutlets.map(o => o.id));
  const tvHeadlines: Headline[] = (media?.headlines ?? []).filter(h => tvIds.has(h.outletId)).slice(0, 8);

  useEffect(() => {
    if (tvHeadlines.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % tvHeadlines.length), 12000);
    return () => clearInterval(t);
  }, [tvHeadlines.length]);

  if (tvOutlets.length === 0) return null;

  // Fallback: sem manchete ainda, mostra grade de canais.
  if (tvHeadlines.length === 0) {
    return (
      <Card className="p-3 border-primary/30 bg-card/95 shadow-lg w-72">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary mb-2">
          <Tv className="w-3.5 h-3.5" /> {isPt ? "Grade de TV" : "TV Guide"}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {tvOutlets.map(o => {
            const logo = outletLogo(o.id);
            return (
              <div key={o.id} className="text-[10px] leading-tight border border-border rounded px-1.5 py-1 flex items-center gap-1.5">
                {logo && (
                  <img src={logo} alt="" loading="lazy" className="w-6 h-6 object-contain shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate">{isPt ? o.namePt : o.nameEn}</div>
                  <div className="opacity-60 truncate">{isPt ? o.sloganPt : o.sloganEn}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  const h = tvHeadlines[idx % tvHeadlines.length];
  const outlet = tvOutlets.find(o => o.id === h.outletId)!;
  const tone =
    h.angle < 0 ? { border: "border-destructive/60", bar: "bg-destructive text-destructive-foreground", body: "bg-card text-card-foreground", foot: "text-muted-foreground" }
    : h.angle > 0 ? { border: "border-success/60", bar: "bg-success text-success-foreground", body: "bg-card text-card-foreground", foot: "text-muted-foreground" }
    : { border: "border-border", bar: "bg-foreground text-background", body: "bg-card text-card-foreground", foot: "text-muted-foreground" };

  return (
    <Card className={`p-0 overflow-hidden border-2 ${tone.border} shadow-xl w-72`}>
      {/* Barra do canal */}
      <div className={`flex items-center justify-between px-2 py-1 ${tone.bar} text-[10px] uppercase tracking-widest`}>
        <span className="flex items-center gap-1.5 min-w-0">
          <Radio className="w-3 h-3 animate-pulse shrink-0" />
          {(() => { const l = outletLogo(outlet.id); return l ? (
            <img src={l} alt="" loading="lazy" className="w-4 h-4 object-contain shrink-0 bg-background/20 rounded-sm p-[1px]" />
          ) : null; })()}
          <span className="font-bold truncate">{isPt ? outlet.namePt : outlet.nameEn}</span>
        </span>
        <span className="opacity-90 font-semibold shrink-0">AO VIVO</span>
      </div>
      {/* Manchete */}
      <div className={`px-3 py-2 min-h-[54px] flex items-center text-[12px] font-semibold leading-snug ${tone.body}`}>
        {isPt ? h.textPt : h.textEn}
      </div>
      {/* Rodapé com slogan */}
      <div className={`px-2 py-1 text-[9px] italic border-t border-border truncate bg-muted ${tone.foot}`}>
        {isPt ? outlet.sloganPt : outlet.sloganEn} · {String(h.month).padStart(2, "0")}/{h.year}
      </div>
    </Card>
  );
}
