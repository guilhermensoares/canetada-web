import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import type { GameState } from "@/game/types";
import { Activity, Wind, Volume2, Thermometer } from "lucide-react";

interface Props { state: GameState }

function tone(v: number, warn: number, bad: number): string {
  return v >= bad ? "text-rose-300" : v >= warn ? "text-amber-300" : "text-emerald-300";
}

function WellbeingPanelImpl({ state }: Props) {
  const lang = state.lang;
  const W = state.wellbeing;
  if (!W) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-panel/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
          {t(lang, "wb.title")}
        </h3>
        <Badge variant="outline" className={tone(100 - W.thermalComfort, 30, 55)}>
          {t(lang, "wb.comfort")}: {W.thermalComfort}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Commute stress */}
        <div className="rounded-md border border-border/50 bg-background/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-info" />
            {t(lang, "wb.commute")}
          </div>
          <div className={`font-mono text-lg ${tone(W.commuteMinutes, 80, 110)}`}>
            {W.commuteMinutes} min/dia
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {t(lang, "wb.hoursLost")}: {W.hoursLostPerCap} h/mês · {t(lang, "wb.productivity")}: ×{W.productivityMult.toFixed(2)}
          </div>
        </div>

        {/* Air quality */}
        <div className="rounded-md border border-border/50 bg-background/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Wind className="h-3.5 w-3.5 text-primary" />
            {t(lang, "wb.air")}
          </div>
          <div className={`font-mono text-lg ${tone(W.pm25, 25, 40)}`}>
            PM2.5 {W.pm25} µg/m³
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            CO₂ {W.co2Index} · {t(lang, "wb.respiratory")}: {W.respiratoryCases}/1k
          </div>
          {W.healthOverloadCost > 0 && (
            <div className="mt-0.5 text-[10px] text-rose-300">
              {t(lang, "wb.ubsCost")}: {formatMoney(W.healthOverloadCost)}
            </div>
          )}
        </div>

        {/* Noise */}
        <div className="rounded-md border border-border/50 bg-background/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Volume2 className="h-3.5 w-3.5 text-warning" />
            {t(lang, "wb.noise")}
          </div>
          <div className={`font-mono text-lg ${tone(W.noiseDb, 65, 75)}`}>
            {W.noiseDb} dB(A)
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {t(lang, "wb.realestate")}: −{W.noisePenaltyPct.toFixed(1)}% · {t(lang, "wb.insomnia")}: {W.insomniaRate}%
          </div>
        </div>

        {/* Heat island */}
        <div className="rounded-md border border-border/50 bg-background/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Thermometer className="h-3.5 w-3.5 text-destructive" />
            {t(lang, "wb.heat")}
          </div>
          <div className={`font-mono text-lg ${tone(W.heatIslandC, 3, 5)}`}>
            +{W.heatIslandC.toFixed(1)}°C
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {t(lang, "wb.acDemand")}: +{W.heatEnergyDelta} kWh
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        {t(lang, "wb.hint")}
      </p>
    </div>
  );
}

export const WellbeingPanel = /*#__PURE__*/ memo(WellbeingPanelImpl);
