import { memo } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { t } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import type { GameState } from "@/game/types";
import { TECH_CENTER_BUILD_COST, TECH_CENTER_MONTHLY_COST } from "@/game/intergenerational";

interface Props {
  state: GameState;
  actions: {
    setTeacherSalary: (value: number) => void;
    setSchoolTransport: (value: number) => void;
    fundTechCenter: () => void;
    closeTechCenter: () => void;
  };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function EducationPanelImpl({ state, actions }: Props) {
  const lang = state.lang;
  const ed = state.education;
  if (!ed) return null;
  const { cohorts } = ed;
  const skilledGap = ed.skilledSupply - ed.skilledDemand;
  const canFund = state.treasury >= TECH_CENTER_BUILD_COST;

  return (
    <div className="rounded-lg border border-border/60 bg-panel/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
          {t(lang, "edu.title")}
        </h3>
        <Badge variant="outline" className={
          ed.publicSchoolQuality >= 65 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          : ed.publicSchoolQuality >= 40 ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
        }>
          {t(lang, "edu.quality")}: {Math.round(ed.publicSchoolQuality)}
        </Badge>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2 text-xs">
        {(["basic", "secondary", "technical", "higher"] as const).map((k) => (
          <div key={k} className="rounded-md border border-border/50 bg-background/40 p-2 text-center">
            <div className="text-[10px] uppercase text-muted-foreground">{t(lang, `edu.cohort.${k}`)}</div>
            <div className="mt-1 text-sm font-medium">{pct(cohorts[k])}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span>{t(lang, "edu.teacherSalary")}</span>
            <span className="text-muted-foreground">{formatMoney(ed.teacherSalary)}</span>
          </div>
          <Slider
            min={800} max={12000} step={100}
            value={[ed.teacherSalary]}
            onValueChange={(v) => actions.setTeacherSalary(v[0])}
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs">
            <span>{t(lang, "edu.schoolTransport")}</span>
            <span className="text-muted-foreground">{ed.schoolTransport}%</span>
          </div>
          <Slider
            min={0} max={100} step={5}
            value={[ed.schoolTransport]}
            onValueChange={(v) => actions.setSchoolTransport(v[0])}
          />
        </div>

        <div className="rounded-md border border-border/50 bg-background/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">{t(lang, "edu.techCenter")}</div>
            <Badge variant="outline">×{ed.techCenters}</Badge>
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            {t(lang, "edu.techCenter.desc")}
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{t(lang, "edu.techCenter.cost")}: {formatMoney(TECH_CENTER_BUILD_COST)}</span>
            <span>{t(lang, "edu.techCenter.opex")}: {formatMoney(TECH_CENTER_MONTHLY_COST)}/mês</span>
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={!canFund} onClick={actions.fundTechCenter}>
              {t(lang, "edu.techCenter.fund")}
            </Button>
            <Button size="sm" variant="outline" disabled={ed.techCenters <= 0} onClick={actions.closeTechCenter}>
              {t(lang, "edu.techCenter.close")}
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border/50 bg-background/40 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium">{t(lang, "edu.labor")}</span>
            <Badge variant="outline" className={
              skilledGap > 200 ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
              : skilledGap < -100 ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
            }>
              {skilledGap > 0 ? `+${skilledGap.toLocaleString()}` : skilledGap.toLocaleString()}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-x-3 text-muted-foreground">
            <div>{t(lang, "edu.supply")}: <span className="text-foreground/90">{ed.skilledSupply.toLocaleString()}</span></div>
            <div>{t(lang, "edu.demand")}: <span className="text-foreground/90">{ed.skilledDemand.toLocaleString()}</span></div>
            <div>{t(lang, "edu.graduates")}: <span className="text-foreground/90">+{ed.lastGraduates.toLocaleString()}</span></div>
            <div>{t(lang, "edu.brainDrain")}: <span className="text-foreground/90">−{ed.lastBrainDrain.toLocaleString()}</span></div>
          </div>
          {skilledGap > 200 && (
            <p className="mt-2 text-[11px] text-rose-300/80">{t(lang, "edu.brainDrain.warn")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export const EducationPanel = /*#__PURE__*/ memo(EducationPanelImpl);
