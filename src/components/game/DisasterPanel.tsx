import { memo } from "react";
import type { GameState } from "@/game/types";
import type { RiskCategory, RiskArea } from "@/game/disasters";
import { t } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CloudRain, Mountain, Waves, Siren, AlertTriangle } from "lucide-react";
import { PenButtonIcon } from "./PenButtonIcon";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  actions: {
    invest: (id: string) => void;
    relocate: (id: string, batch?: number) => void;
    threshold: (v: number) => void;
    budget: (v: number) => void;
    evacuate: () => void;
    shelter: () => void;
    donations: () => void;
  };
}

const CAT_TONE: Record<RiskCategory, string> = {
  A: "bg-success/60 text-foreground",
  B: "bg-warning/70 text-foreground",
  C: "bg-orange-500/80 text-white",
  D: "bg-destructive text-destructive-foreground",
};

function AreaRow({
  area, lang, onInvest, onRelocate, disabled,
}: {
  area: RiskArea; lang: GameState["lang"];
  onInvest: () => void; onRelocate: () => void; disabled: boolean;
}) {
  const Icon = area.kind === "hillside" ? Mountain : Waves;
  return (
    <div className="rounded border border-border/50 bg-background/40 p-2">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 font-medium">
          <Icon className="h-3.5 w-3.5" />
          {t(lang, area.nameKey)}
          <span className="text-muted-foreground">· {t(lang, `dsr.kind.${area.kind}`)}</span>
        </span>
        <Badge className={cn("h-4 px-1.5 text-[10px]", CAT_TONE[area.category])}>
          {area.category}
        </Badge>
      </div>
      <div className="mb-1 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
        <span>{t(lang, "dsr.households")}: <b className="text-foreground">{area.households}</b></span>
        <span>{t(lang, "dsr.containment")}: <b className="text-foreground">{Math.round(area.containment)}%</b></span>
      </div>
      <div className="relative mb-1.5 h-1.5 rounded bg-muted/50">
        <div
          className="absolute inset-y-0 left-0 rounded bg-primary"
          style={{ width: `${area.containment}%` }}
        />
      </div>
      <div className="flex gap-1">
        <Button
          size="sm" variant="outline"
          className="h-7 flex-1 text-[10px]"
          onClick={onInvest} disabled={disabled || area.households === 0}
        >
          <PenButtonIcon className="mr-1 h-3 w-3" /> {t(lang, "dsr.invest")}
        </Button>
        <Button
          size="sm" variant="destructive"
          className="h-7 flex-1 text-[10px]"
          onClick={onRelocate} disabled={disabled || area.households < 5}
        >
          <PenButtonIcon className="mr-1 h-3 w-3" /> {t(lang, "dsr.relocate")}
        </Button>
      </div>
      {area.revolt > 15 && (
        <div className="mt-1 text-[10px] text-destructive">
          Revolta: {Math.round(area.revolt)}%
        </div>
      )}
    </div>
  );
}

function DisasterPanelImpl({ state, actions }: Props) {
  const lang = state.lang;
  const d = state.disasters;
  if (!d) return null;

  const active = d.activeEvent && d.activeEvent.active ? d.activeEvent : null;
  const rainPct = Math.min(100, Math.round((d.rainAccumMm / d.landslideThresholdMm) * 100));
  const rainTone =
    rainPct < 60 ? "bg-success/60" :
    rainPct < 90 ? "bg-warning/70" : "bg-destructive";

  return (
    <Card className="mt-3 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CloudRain className="h-4 w-4 text-primary" />
            {t(lang, "dsr.title")}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t(lang, "dsr.subtitle")}</p>
        </div>
        {d.legalRisk > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {t(lang, "dsr.legalRisk")}: {Math.round(d.legalRisk)}%
          </Badge>
        )}
      </div>

      {/* Rain gauge */}
      <div className="mb-3 rounded-md border border-border/50 bg-background/30 p-2">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="font-medium">{t(lang, "dsr.rainAccum")}</span>
          <span className="tabular-nums">
            {d.rainAccumMm} / {d.landslideThresholdMm} mm
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded bg-muted/50">
          <div className={cn("absolute inset-y-0 left-0", rainTone)} style={{ width: `${rainPct}%` }} />
          <div className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: "100%" }} />
        </div>
        <div className="mt-2">
          <label className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{t(lang, "dsr.threshold")}</span>
            <span className="tabular-nums">{d.landslideThresholdMm} mm</span>
          </label>
          <Slider
            value={[d.landslideThresholdMm]}
            min={80} max={400} step={10}
            onValueChange={([v]) => actions.threshold(v)}
          />
        </div>
        <div className="mt-2">
          <label className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{t(lang, "dsr.budget")}</span>
            <span className="tabular-nums">{formatMoney(d.monthlyContainmentBudget)}/mo</span>
          </label>
          <Slider
            value={[d.monthlyContainmentBudget]}
            min={0} max={2_000_000} step={50_000}
            onValueChange={([v]) => actions.budget(v)}
          />
        </div>
        {(d.lastFederalPenalty > 0 || d.lastLegalCost > 0) && (
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
            {d.lastFederalPenalty > 0 && (
              <div className="text-destructive">
                {t(lang, "dsr.federalPenalty")}: −{formatMoney(d.lastFederalPenalty)}
              </div>
            )}
            {d.lastLegalCost > 0 && (
              <div className="text-destructive">
                {t(lang, "dsr.legalCost")}: −{formatMoney(d.lastLegalCost)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CRISIS ROOM (only while an event is active) */}
      {active && (
        <div className="mb-3 rounded-md border-2 border-destructive/70 bg-destructive/10 p-2 shadow-[0_0_0_1px_hsl(var(--destructive))]">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-destructive">
              <Siren className="h-4 w-4 animate-pulse" />
              {t(lang, "dsr.crisis.title")}
            </span>
            <Badge variant="destructive" className="text-[10px]">
              {t(lang, active.areaNameKey)}
            </Badge>
          </div>
          <div className="mb-2 grid grid-cols-4 gap-1 text-[10px]">
            <MiniStat label={t(lang, "dsr.severity")}   value={`${active.severity}%`} tone="danger" />
            <MiniStat label={t(lang, "dsr.households")} value={String(active.households)} />
            <MiniStat label={t(lang, "dsr.evacuated")}  value={String(active.evacuated)} tone="ok" />
            <MiniStat label={t(lang, "dsr.shelterCap")} value={String(active.shelterCapacity)} tone="ok" />
          </div>
          <div className="grid gap-1 sm:grid-cols-3">
            <Button
              size="sm" variant="secondary" className="h-8 text-[10px]"
              disabled={active.actionsUsed.includes("evacuate") || state.treasury < 200_000}
              onClick={actions.evacuate}
            >
              <PenButtonIcon className="mr-1 h-3.5 w-3.5" /> {t(lang, "dsr.crisis.evac")}
            </Button>
            <Button
              size="sm" variant="secondary" className="h-8 text-[10px]"
              disabled={active.actionsUsed.includes("shelter") || state.treasury < 400_000}
              onClick={actions.shelter}
            >
              <PenButtonIcon className="mr-1 h-3.5 w-3.5" /> {t(lang, "dsr.crisis.shelter")}
            </Button>
            <Button
              size="sm" variant="secondary" className="h-8 text-[10px]"
              disabled={active.actionsUsed.includes("donations") || state.treasury < 50_000}
              onClick={actions.donations}
            >
              <PenButtonIcon className="mr-1 h-3.5 w-3.5" /> {t(lang, "dsr.crisis.donate")}
            </Button>
          </div>
        </div>
      )}

      {/* Areas grid */}
      <div className="rounded-md border border-border/50 bg-background/30 p-2">
        <div className="mb-1.5 text-[11px] font-medium">{t(lang, "dsr.areas")}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {d.areas.map((a) => (
            <AreaRow
              key={a.id} area={a} lang={lang}
              onInvest={() => actions.invest(a.id)}
              onRelocate={() => actions.relocate(a.id, 20)}
              disabled={!!active}
            />
          ))}
        </div>
      </div>

      {/* History */}
      {d.history.length > 0 && (
        <div className="mt-3 rounded-md border border-border/50 bg-background/20 p-2 text-[10px]">
          <div className="mb-1 flex items-center gap-1 font-medium text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            {t(lang, "dsr.history")}
          </div>
          <ul className="space-y-0.5">
            {d.history.slice(0, 4).map((e) => (
              <li key={e.id} className="flex justify-between text-muted-foreground">
                <span>
                  {String(e.month).padStart(2, "0")}/{e.year} · {t(lang, e.areaNameKey)}
                </span>
                <span className={cn(
                  e.outcome === "handled"    && "text-success",
                  e.outcome === "mismanaged" && "text-warning",
                  e.outcome === "tragedy"    && "text-destructive",
                )}>
                  {t(lang, `dsr.outcome.${e.outcome ?? "handled"}`)} · †{e.victims} · {e.responseScore}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function MiniStat({
  label, value, tone,
}: { label: string; value: string; tone?: "danger" | "ok" }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 p-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        "text-xs font-semibold tabular-nums",
        tone === "danger" && "text-destructive",
        tone === "ok"     && "text-success",
      )}>{value}</div>
    </div>
  );
}

export const DisasterPanel = /*#__PURE__*/ memo(DisasterPanelImpl);
