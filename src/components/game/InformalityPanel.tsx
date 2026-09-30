import { memo } from "react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { t } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import type { GameState } from "@/game/types";
import type { InformalPolicy } from "@/game/informality";

interface Props {
  state: GameState;
  onChange: (patch: Partial<InformalPolicy>) => void;
}

function InformalityPanelImpl({ state, onChange }: Props) {
  const lang = state.lang;
  const inf = state.informal;
  if (!inf) return null;
  const pol = inf.policy;

  return (
    <div className="rounded-lg border border-border/60 bg-panel/60 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
            {t(lang, "inf_title")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(lang, "inf_hint")}</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
        <Metric label={t(lang, "inf_workers")} value={`${Math.round(inf.informalWorkers)}%`} />
        <Metric label={t(lang, "inf_vendors")} value={`${Math.round(inf.vendors)}%`} />
        <Metric label={t(lang, "inf_evasion")} value={`${Math.round(inf.evasion)}%`} tone={inf.evasion > 30 ? "bad" : undefined} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 text-[10px]">
        <Badge variant="outline" className="text-mono">
          {t(lang, "inf_revLost")}: {formatMoney(inf.lastRevenueDelta)}
        </Badge>
        <Badge variant="outline" className="text-mono">
          {t(lang, "inf_cost")}: {formatMoney(-inf.lastProgramCost)}
        </Badge>
      </div>

      <SliderRow
        label={t(lang, "inf_fiscalize")}
        hint={t(lang, "inf_fiscalize_hint")}
        value={pol.fiscalize}
        onChange={(v) => onChange({ fiscalize: v })}
      />
      <SliderRow
        label={t(lang, "inf_formalize")}
        hint={t(lang, "inf_formalize_hint")}
        value={pol.formalize}
        onChange={(v) => onChange({ formalize: v })}
      />
      <SliderRow
        label={t(lang, "inf_integrate")}
        hint={t(lang, "inf_integrate_hint")}
        value={pol.integrate}
        onChange={(v) => onChange({ integrate: v })}
      />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded border border-border/50 bg-background/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"text-mono text-sm " + (tone === "bad" ? "text-destructive" : "text-foreground")}>
        {value}
      </div>
    </div>
  );
}

function SliderRow({
  label, hint, value, onChange,
}: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium">{label}</span>
        <span className="text-mono text-muted-foreground">{Math.round(value)}</span>
      </div>
      <Slider
        value={[value]} min={0} max={100} step={1}
        onValueChange={(vals) => onChange(vals[0] ?? 0)}
      />
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

export const InformalityPanel = /*#__PURE__*/ memo(InformalityPanelImpl);
