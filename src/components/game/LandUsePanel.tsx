import { memo } from "react";
import type { GameState, LandPolicy } from "@/game/types";
import { t } from "@/game/i18n";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

/**
 * Plano Diretor panel — exposes the Brazilian-inspired land-use levers:
 *   • Outorga Onerosa do Direito de Construir (price per tower FAR).
 *   • IPTU progressivo em vazios urbanos (progressive property tax on retention).
 *   • Regularização Fundiária effort (monthly upgrade of favela tiles into formal housing).
 *
 * Also surfaces live KPIs: current urban voids, favelas sitting on hazard areas,
 * outorgas sold and plots regularized since campaign start.
 */
function LandUsePanelImpl({
  state,
  onChange,
}: {
  state: GameState;
  onChange: (patch: Partial<LandPolicy>) => void;
}) {
  const { lang, landPolicy, landUse } = state;
  const fmt = (n: number) =>
    n.toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 0 });

  return (
    <section className="rounded-lg border border-border/60 bg-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t(lang, "landUseTitle")}
        </h2>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>
            {t(lang, "vazioTiles")}:{" "}
            <span className="font-mono text-foreground">{landUse.vazioTiles}</span>
          </span>
          <span>
            {t(lang, "hazardFavelas")}:{" "}
            <span className="font-mono text-foreground">{landUse.hazardFavelas}</span>
          </span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Outorga Onerosa */}
        <div className="rounded-md border border-border/60 bg-panel/40 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t(lang, "outorgaPrice")}
            </label>
            <span className="font-mono text-sm text-foreground">
              R$ {fmt(landPolicy.outorgaPrice)}
            </span>
          </div>
          <Slider
            min={0}
            max={500_000}
            step={10_000}
            value={[landPolicy.outorgaPrice]}
            onValueChange={(v) => onChange({ outorgaPrice: v[0] })}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t(lang, "outorgaSold")}:{" "}
            <span className="font-mono text-foreground">{landUse.outorgaSold}</span> · R${" "}
            <span className="font-mono text-foreground">{fmt(landUse.outorgaRevenue)}</span>
          </p>
        </div>

        {/* IPTU progressivo */}
        <div className="rounded-md border border-border/60 bg-panel/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t(lang, "progressiveIptu")}
            </label>
            <Switch
              checked={landPolicy.progressiveIptu}
              onCheckedChange={(c) => onChange({ progressiveIptu: c })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            R${" "}
            <span className="font-mono text-foreground">{fmt(landUse.vazioRevenue)}</span>{" "}
            {lang === "pt" ? "arrecadados no total" : "collected in total"}
          </p>
        </div>

        {/* Regularização fundiária */}
        <div className="rounded-md border border-border/60 bg-panel/40 p-3 md:col-span-2">
          <div className="mb-2 flex items-baseline justify-between">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t(lang, "regularizationRate")}
            </label>
            <span className="font-mono text-sm text-foreground">{landPolicy.regularizationRate}</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[landPolicy.regularizationRate]}
            onValueChange={(v) => onChange({ regularizationRate: v[0] })}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t(lang, "regularizedCount")}:{" "}
            <span className="font-mono text-foreground">{landUse.regularized}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

export const LandUsePanel = /*#__PURE__*/ memo(LandUsePanelImpl);
