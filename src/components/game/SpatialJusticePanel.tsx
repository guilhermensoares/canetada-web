import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/game/i18n";
import type { GameState } from "@/game/types";
import type { Stratum } from "@/game/spatialJustice";

interface Props { state: GameState }

const ORDER: Stratum[] = ["core", "middle", "periphery", "informal"];

const scoreColor = (n: number) =>
  n >= 70 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
  : n >= 45 ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
  : "bg-rose-500/20 text-rose-300 border-rose-500/40";

function SpatialJusticePanelImpl({ state }: Props) {
  const lang = state.lang;
  const sj = state.mobility;
  if (!sj) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-panel/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
          {t(lang, "spatial.title")}
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={scoreColor(sj.cityMobility)}>
            {t(lang, "spatial.city")}: {sj.cityMobility}
          </Badge>
          <Badge variant="outline" className={
            sj.mobilityGap >= 35 ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
            : sj.mobilityGap >= 18 ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          }>
            {t(lang, "spatial.gap")}: {sj.mobilityGap}
          </Badge>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {t(lang, "spatial.intro")}
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ORDER.map((k) => {
          const s = sj.strata[k];
          return (
            <div key={k} className="rounded-md border border-border/50 bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">{t(lang, `spatial.stratum.${k}`)}</div>
                <Badge variant="outline" className={scoreColor(s.mobility)}>
                  {t(lang, "spatial.mobility")}: {s.mobility}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <div>{t(lang, "spatial.pop")}: <span className="text-foreground/90">{s.population.toLocaleString()}</span></div>
                <div>{t(lang, "spatial.commute")}: <span className="text-foreground/90">{s.commuteMinutes}m</span></div>
                <div>{t(lang, "spatial.infra")}: <span className="text-foreground/90">{s.infraAccess}%</span></div>
                <div>{t(lang, "spatial.services")}: <span className="text-foreground/90">{s.serviceAccess}%</span></div>
                <div className="col-span-2">
                  {t(lang, "spatial.child")}: <span className="text-foreground/90">−{s.childPenalty}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const SpatialJusticePanel = /*#__PURE__*/ memo(SpatialJusticePanelImpl);
