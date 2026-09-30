import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { t } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import type { GameState } from "@/game/types";
import type { SanitationModel, WasteMode } from "@/game/climate";
import {
  DRAINAGE_PIPE_COST,
  PISCINAO_COST,
  SANITATION_MODEL_SWITCH_COST,
  WASTE_MODE_SWITCH_COST,
  COOPERATIVE_COST,
} from "@/game/climate";
import { CloudRain, Droplets, Recycle, Trash2, AlertTriangle, Waves, Factory } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  actions: {
    buildDrainage: () => void;
    buildPiscinao: () => void;
    setSanModel: (m: SanitationModel) => void;
    setSanInvestment: (v: number) => void;
    setSanTariff: (v: number) => void;
    setWasteMode: (m: WasteMode) => void;
    fundCooperative: () => void;
  };
}

const SAN_MODELS: SanitationModel[] = ["state", "concession", "ppp"];
const WASTE_MODES: WasteMode[] = ["dump", "landfill", "recycling"];

function ClimatePanelImpl({ state, actions }: Props) {
  const lang = state.lang;
  const C = state.climate;
  const D = C.drainage;
  const S = C.sanitation;
  const W = C.waste;
  const capacity = 25 + D.drainagePipes * 8 + D.piscinoes * 18;
  const rainy = state.month === 12 || state.month <= 3;

  return (
    <Card className="border-border/60 bg-panel/70 p-4">
      <header className="mb-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {t(lang, "cl_subtitle")}
        </div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CloudRain className="h-4 w-4 text-primary" />
          {t(lang, "cl_title")}
        </h3>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {/* ---------------- Drainage ---------------- */}
        <section className="rounded-md border border-border/50 bg-background/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Waves className="h-3.5 w-3.5 text-sky-400" />
              {t(lang, "cl_drainage")}
            </div>
            {rainy && (
              <Badge variant="outline" className="border-sky-500/40 text-[10px] text-sky-300">
                {t(lang, "cl_rainySeason")}
              </Badge>
            )}
          </div>
          <MiniRow label={t(lang, "cl_pipes")} value={String(D.drainagePipes)} />
          <MiniRow label={t(lang, "cl_piscinao")} value={String(D.piscinoes)} />
          <MiniRow label={t(lang, "cl_capacity")} value={String(capacity)} />
          <MiniRow
            label={t(lang, "cl_impermeability")}
            value={`${Math.round(impermPct(state))}%`}
          />
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{t(lang, "cl_floodRisk")}</span>
              <span className={cn("font-semibold", D.lastFloodRisk > 50 ? "text-destructive" : "text-foreground")}>
                {D.lastFloodRisk}
              </span>
            </div>
            <Progress value={D.lastFloodRisk} className="h-1.5" />
          </div>
          {D.lastFlooded && (
            <div className="mt-2 flex items-center gap-1.5 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {t(lang, "cl_lastFlood")}: {formatMoney(D.lastFloodDamage)}
            </div>
          )}
          <div className="mt-3 flex flex-col gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={state.treasury < DRAINAGE_PIPE_COST}
              onClick={actions.buildDrainage}
            >
              {t(lang, "cl_buildPipe")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={state.treasury < PISCINAO_COST}
              onClick={actions.buildPiscinao}
            >
              {t(lang, "cl_buildPiscinao")}
            </Button>
          </div>
        </section>

        {/* ---------------- Sanitation ---------------- */}
        <section className="rounded-md border border-border/50 bg-background/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Droplets className="h-3.5 w-3.5 text-blue-400" />
            {t(lang, "cl_sanitation")}
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1">
            {SAN_MODELS.map((m) => (
              <button
                key={m}
                onClick={() => actions.setSanModel(m)}
                disabled={S.model !== m && state.treasury < SANITATION_MODEL_SWITCH_COST}
                className={cn(
                  "rounded border px-1.5 py-1 text-[10px] font-medium transition-colors",
                  S.model === m
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground disabled:opacity-40",
                )}
              >
                {t(lang, `cl_model_${m}`)}
              </button>
            ))}
          </div>
          <div className="mb-2 text-[10px] text-muted-foreground">
            {S.model !== "state" ? t(lang, "cl_switchModel") : ""}
          </div>

          <CoverageBar label={t(lang, "cl_waterCov")}  value={S.waterCoverage} />
          <CoverageBar label={t(lang, "cl_sewageCov")} value={S.sewageCoverage} />

          <div className="mt-2">
            <label className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{t(lang, "cl_investment")}</span>
              <span className="font-medium">{formatMoney(S.monthlyInvestment)}</span>
            </label>
            <Slider
              value={[S.monthlyInvestment]}
              min={0}
              max={200_000}
              step={5_000}
              onValueChange={(v) => actions.setSanInvestment(v[0])}
            />
          </div>
          <div className="mt-2">
            <label className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{t(lang, "cl_tariff")}</span>
              <span className="font-medium">R$ {S.tariff}</span>
            </label>
            <Slider
              value={[S.tariff]}
              min={0}
              max={120}
              step={1}
              onValueChange={(v) => actions.setSanTariff(v[0])}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-border/40 bg-background/40 px-2 py-1">
              <div className="text-muted-foreground">{t(lang, "cl_tariffRevenue")}</div>
              <div className="font-semibold text-success">{formatMoney(S.lastTariffRevenue)}</div>
            </div>
            <div className="rounded border border-border/40 bg-background/40 px-2 py-1">
              <div className="text-muted-foreground">{t(lang, "cl_sanCost")}</div>
              <div className="font-semibold text-destructive">-{formatMoney(S.lastOperatingCost)}</div>
            </div>
          </div>
          {S.lastOutbreak && (
            <div className="mt-2 flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
              <AlertTriangle className="h-3 w-3" />
              {t(lang, "cl_outbreak")}: {S.lastOutbreak.disease} · sev {S.lastOutbreak.severity}
            </div>
          )}
        </section>

        {/* ---------------- Waste ---------------- */}
        <section className="rounded-md border border-border/50 bg-background/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Recycle className="h-3.5 w-3.5 text-emerald-400" />
            {t(lang, "cl_waste")}
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1">
            {WASTE_MODES.map((m) => (
              <button
                key={m}
                onClick={() => actions.setWasteMode(m)}
                disabled={W.mode !== m && state.treasury < WASTE_MODE_SWITCH_COST}
                className={cn(
                  "rounded border px-1.5 py-1 text-[10px] font-medium transition-colors",
                  W.mode === m
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground disabled:opacity-40",
                )}
              >
                {m === "dump" && <Trash2 className="mx-auto mb-0.5 h-3 w-3" />}
                {m === "landfill" && <Factory className="mx-auto mb-0.5 h-3 w-3" />}
                {m === "recycling" && <Recycle className="mx-auto mb-0.5 h-3 w-3" />}
                {t(lang, `cl_waste_${m}`)}
              </button>
            ))}
          </div>
          <div className="mb-2 text-[10px] text-muted-foreground">
            {t(lang, "cl_switchWaste")}
          </div>

          <CoverageBar label={t(lang, "cl_collection")} value={W.collectionCoverage} />

          <MiniRow label={t(lang, "cl_cooperatives")} value={String(W.cooperatives)} />
          <Button
            size="sm"
            variant="secondary"
            className="mt-2 w-full"
            disabled={state.treasury < COOPERATIVE_COST || W.mode !== "recycling"}
            onClick={actions.fundCooperative}
          >
            {t(lang, "cl_fundCoop")}
          </Button>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-border/40 bg-background/40 px-2 py-1">
              <div className="text-muted-foreground">{t(lang, "cl_wasteCost")}</div>
              <div className="font-semibold text-destructive">-{formatMoney(W.lastCost)}</div>
            </div>
            <div className="rounded border border-border/40 bg-background/40 px-2 py-1">
              <div className="text-muted-foreground">{t(lang, "cl_wastePoll")}</div>
              <div className={cn("font-semibold", W.lastPollutionDelta > 0 ? "text-destructive" : "text-success")}>
                {W.lastPollutionDelta > 0 ? "+" : ""}
                {W.lastPollutionDelta.toFixed(2)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function CoverageBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function impermPct(s: GameState): number {
  let built = 0;
  let total = 0;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const z = s.zones[i];
    if (z && z !== "none") {
      total++;
      if (s.builtBuildings[i]) built++;
    }
  }
  return total === 0 ? 0 : (built / total) * 100;
}

export const ClimatePanel = /*#__PURE__*/ memo(ClimatePanelImpl);
