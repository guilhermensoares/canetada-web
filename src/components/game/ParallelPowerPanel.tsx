import { memo } from "react";
import type { GameState } from "@/game/types";
import type { Stratum } from "@/game/spatialJustice";
import type { EnforcementDoctrine } from "@/game/parallelPower";
import { t } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Shield, Skull, Sprout, Eye, Swords, ShieldAlert, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  actions: {
    setDoctrine: (d: EnforcementDoctrine) => void;
    setSocialInvestment: (v: number) => void;
    runOperation: () => void;
  };
}

const STRATA: Stratum[] = ["core", "middle", "periphery", "informal"];
const STRAT_KEY: Record<Stratum, string> = {
  core: "pp.strat.core",
  middle: "pp.strat.middle",
  periphery: "pp.strat.periphery",
  informal: "pp.strat.informal",
};

function controlTone(value: number): string {
  if (value < 25) return "bg-success/60";
  if (value < 55) return "bg-warning/70";
  if (value < 75) return "bg-orange-500/80";
  return "bg-destructive";
}

function doctrineIcon(d: EnforcementDoctrine) {
  if (d === "blindEye") return Eye;
  if (d === "ostensive") return Swords;
  return Sprout;
}

function ParallelPowerPanelImpl({ state, actions }: Props) {
  const lang = state.lang;
  const pp = state.parallelPower;
  if (!pp) {
    return (
      <Card className="p-4 text-xs text-muted-foreground">
        {t(lang, "pp.notEmerged")}
      </Card>
    );
  }

  const archetypeKey =
    pp.archetype === "milicia" ? "pp.archetype.milicia" :
    pp.archetype === "faccao"  ? "pp.archetype.faccao"  : "pp.archetype.hybrid";
  const ArchetypeIcon = pp.archetype === "milicia" ? ShieldAlert :
                        pp.archetype === "faccao"  ? Skull : Shield;

  return (
    <Card className="mt-3 p-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4 text-destructive" />
            {t(lang, "pp.title")}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t(lang, "pp.subtitle")}</p>
        </div>
        <Badge
          variant={pp.emerged ? "destructive" : "outline"}
          className="flex items-center gap-1 text-[10px]"
        >
          <ArchetypeIcon className="h-3 w-3" />
          {t(lang, archetypeKey)}
        </Badge>
      </div>

      {/* Aggregate summary */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <MetricCell label={t(lang, "pp.aggregate")} value={`${pp.aggregateControl}%`} />
        <MetricCell
          label={t(lang, "pp.blocked")}
          value={String(pp.blockedZones)}
          danger={pp.blockedZones > 0}
        />
        <MetricCell
          label={t(lang, "pp.extortion")}
          value={formatMoney(pp.lastExtortion)}
          danger={pp.lastExtortion > 0}
        />
        <MetricCell
          label={t(lang, "pp.leakage")}
          value={formatMoney(pp.lastRevenueDelta)}
          danger={pp.lastRevenueDelta < 0}
        />
      </div>

      {/* Doctrine selector */}
      <div className="mb-3 rounded-md border border-border/50 bg-background/30 p-2">
        <div className="mb-1.5 text-[11px] font-medium">{t(lang, "pp.doctrine")}</div>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {(["blindEye", "ostensive", "socialUrbanism"] as EnforcementDoctrine[]).map((d) => {
            const Icon = doctrineIcon(d);
            const active = pp.policy.doctrine === d;
            const labelKey =
              d === "blindEye" ? "pp.doct.blindEye" :
              d === "ostensive" ? "pp.doct.ostensive" : "pp.doct.social";
            const hintKey  =
              d === "blindEye" ? "pp.doct.blindEye.hint" :
              d === "ostensive" ? "pp.doct.ostensive.hint" : "pp.doct.social.hint";
            return (
              <button
                key={d}
                type="button"
                onClick={() => actions.setDoctrine(d)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded border p-2 text-left transition",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border/40 bg-background/40 hover:border-border/70",
                )}
              >
                <span className="flex items-center gap-1 text-[11px] font-semibold">
                  <Icon className="h-3.5 w-3.5" />
                  {t(lang, labelKey)}
                </span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {t(lang, hintKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Operation button + cooldown */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border/50 bg-background/30 p-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={actions.runOperation}
          disabled={pp.opsCooldown > 0 || state.treasury < 1_200_000 || pp.aggregateControl < 10}
          className="h-8 text-[11px]"
        >
          <Swords className="mr-1 h-3.5 w-3.5" />
          {t(lang, "pp.operation")}
        </Button>
        <span className="text-[10px] text-muted-foreground">
          {t(lang, "pp.opCooldown")}: {pp.opsCooldown} mo
        </span>
        {pp.lastCasualties > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {t(lang, "pp.casualties")}: {pp.lastCasualties}
          </Badge>
        )}
      </div>

      {/* Social urbanism slider (only meaningful under that doctrine) */}
      <div
        className={cn(
          "mb-3 rounded-md border p-2 transition",
          pp.policy.doctrine === "socialUrbanism"
            ? "border-primary/40 bg-primary/5"
            : "border-border/40 bg-background/20 opacity-70",
        )}
      >
        <label className="mb-1 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 font-medium">
            <Sprout className="h-3.5 w-3.5 text-success" />
            {t(lang, "pp.social.invest")}
          </span>
          <span className="tabular-nums">{pp.policy.socialInvestment}%</span>
        </label>
        <Slider
          value={[pp.policy.socialInvestment]}
          min={0} max={100} step={5}
          onValueChange={([v]) => actions.setSocialInvestment(v)}
          className="mt-1"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{t(lang, "pp.programCost")}: {formatMoney(pp.lastProgramCost)}</span>
        </div>
      </div>

      {/* Per-stratum territory bars */}
      <div className="rounded-md border border-border/50 bg-background/30 p-2">
        <div className="mb-1.5 text-[11px] font-medium">{t(lang, "pp.stratum")}</div>
        <div className="grid gap-1.5">
          {STRATA.map((k) => {
            const v = Math.round(pp.control[k]);
            const dis = pp.disruption[k];
            return (
              <div key={k} className="grid grid-cols-[80px_1fr_auto] items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">{t(lang, STRAT_KEY[k])}</span>
                <div className="relative h-2 rounded bg-muted/50">
                  <div
                    className={cn("absolute inset-y-0 left-0 rounded", controlTone(v))}
                    style={{ width: `${v}%` }}
                  />
                </div>
                <span className="w-16 text-right tabular-nums">
                  {v}%{dis > 0 ? ` · ${dis}mo` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent operations log */}
      {pp.operations.length > 0 && (
        <div className="mt-3 rounded-md border border-border/50 bg-background/20 p-2 text-[10px]">
          <div className="mb-1 font-medium text-muted-foreground">
            {t(lang, "pp.recentOps")}
          </div>
          <ul className="space-y-0.5">
            {pp.operations.slice(0, 4).map((op, i) => (
              <li key={i} className="flex justify-between text-muted-foreground">
                <span>{t(lang, STRAT_KEY[op.stratum])} · −{op.controlReduced}%</span>
                <span className="text-destructive">†{op.casualties}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function MetricCell({
  label, value, danger,
}: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 p-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-mono text-xs font-semibold tabular-nums",
          danger && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export const ParallelPowerPanel = /*#__PURE__*/ memo(ParallelPowerPanelImpl);
