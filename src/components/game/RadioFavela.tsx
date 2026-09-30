import { useEffect, useState } from "react";
import type { GameState } from "@/game/types";
import type { MediaState, Headline } from "@/game/media";
import { Card } from "@/components/ui/card";
import { Radio } from "lucide-react";
import { countFavelas } from "@/game/zoning";
import { outletLogo } from "@/assets/media";

interface Props { state: GameState }

/**
 * Rádio Favela FM — só aparece quando existem favelas na malha urbana
 * (proxy para "câmera perto da comunidade"). Baixa potência: card pequeno,
 * com estática e volume proporcional ao nº de favelas.
 */
export function RadioFavela({ state }: Props) {
  const isPt = state.lang === "pt";
  const media = (state as GameState & { media?: MediaState }).media;
  const favCount = countFavelas(state).count;
  const [idx, setIdx] = useState(0);

  const outlet = media?.outlets.find(o => o.bias === "favelaRadio");
  const headlines: Headline[] = outlet
    ? media!.headlines.filter(h => h.outletId === outlet.id).slice(0, 6)
    : [];

  useEffect(() => {
    if (headlines.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % headlines.length), 14000);
    return () => clearInterval(t);
  }, [headlines.length]);

  if (!media || favCount === 0 || !outlet) return null;

  const signal = Math.min(1, favCount / 8); // 0..1 força do sinal
  const bars = Math.max(1, Math.round(signal * 4));
  const h = headlines[idx % Math.max(1, headlines.length)];

  return (
    <Card className="p-0 overflow-hidden border-2 border-success/60 shadow-xl w-64">
      <div className="flex items-center justify-between px-2 py-1 bg-success text-success-foreground text-[10px] uppercase tracking-widest">
        <span className="flex items-center gap-1.5 font-bold min-w-0">
          <Radio className="w-3 h-3 animate-pulse shrink-0" />
          {(() => { const l = outletLogo(outlet.id); return l ? (
            <img src={l} alt="" loading="lazy" className="w-4 h-4 object-contain shrink-0 bg-background/20 rounded-sm p-[1px]" />
          ) : null; })()}
          <span className="truncate">{isPt ? outlet.namePt : outlet.nameEn}</span>
        </span>
        <span className="flex gap-[2px] items-end h-3 shrink-0">
          {[1,2,3,4].map(i => (
            <span
              key={i}
              className={`w-[3px] ${i <= bars ? "bg-success-foreground" : "bg-success-foreground/30"}`}
              style={{ height: `${i * 22}%` }}
            />
          ))}
        </span>
      </div>
      <div className="px-3 py-2 min-h-[46px] text-[11px] leading-snug font-semibold bg-card text-card-foreground">
        {h ? (isPt ? h.textPt : h.textEn) : (isPt
          ? "Alô, alô comunidade! Mutirão neste sábado."
          : "Hello, community! Group effort this Saturday.")}
      </div>
      <div className="px-2 py-1 text-[9px] italic border-t border-border truncate bg-muted text-muted-foreground">
        {isPt ? outlet.sloganPt : outlet.sloganEn} · {isPt ? "sinal" : "signal"} {Math.round(signal*100)}%
      </div>
    </Card>
  );
}
