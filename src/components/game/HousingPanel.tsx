import { memo } from "react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { t } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import type { GameState } from "@/game/types";
import type { HousingPolicy } from "@/game/housing";

interface Props {
  state: GameState;
  actions: { setPolicy: (patch: Partial<HousingPolicy>) => void };
}

function HousingPanelImpl({ state, actions }: Props) {
  const lang = state.lang;
  const H = state.housing;
  if (!H) return null;
  const rentTone = (v: number) =>
    v > 160 ? "text-rose-300" : v > 125 ? "text-amber-300" : "text-emerald-300";
  const gi = H.gentrificationIndex;

  return (
    <div className="rounded-lg border border-border/60 bg-panel/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
          {t(lang, "hou.title")}
        </h3>
        <Badge variant="outline" className={
          gi >= 65 ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
          : gi >= 40 ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        }>
          {t(lang, "hou.gi")}: {gi}
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4 text-center text-xs">
        {(["core","middle","periphery","informal"] as const).map((k) => (
          <div key={k} className="rounded-md border border-border/50 bg-background/40 p-2">
            <div className="text-muted-foreground uppercase">{t(lang, `hou.strat.${k}`)}</div>
            <div className={`text-lg font-mono ${rentTone(H.rent[k])}`}>{Math.round(H.rent[k])}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>{t(lang, "hou.rentCap")}</span>
            <span className="font-mono">{H.policy.rentControlCap.toFixed(1)}% / mês</span>
          </div>
          <Slider
            min={0} max={8} step={0.5}
            value={[H.policy.rentControlCap]}
            onValueChange={(v) => actions.setPolicy({ rentControlCap: v[0] })}
          />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>{t(lang, "hou.subsidy")}</span>
            <span className="font-mono">{formatMoney(H.policy.socialSubsidy)}</span>
          </div>
          <Slider
            min={0} max={500_000} step={10_000}
            value={[H.policy.socialSubsidy]}
            onValueChange={(v) => actions.setPolicy({ socialSubsidy: v[0] })}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded bg-background/40 p-2">
          <div className="text-muted-foreground">{t(lang, "hou.queue")}</div>
          <div className="font-mono text-foreground">{H.socialQueue.toLocaleString()}</div>
        </div>
        <div className="rounded bg-background/40 p-2">
          <div className="text-muted-foreground">{t(lang, "hou.displaced")}</div>
          <div className="font-mono text-amber-300">{H.displacedLastMonth.toLocaleString()}</div>
        </div>
        <div className="rounded bg-background/40 p-2">
          <div className="text-muted-foreground">{t(lang, "hou.emigrated")}</div>
          <div className="font-mono text-rose-300">{H.emigratedLastMonth.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

export const HousingPanel = /*#__PURE__*/ memo(HousingPanelImpl);
