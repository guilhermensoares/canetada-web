import { memo } from "react";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Leaf, Wind, Factory, Zap, Bus } from "lucide-react";
import { t, type DictKey } from "@/game/i18n";
import type { GameState, SustainabilityKey } from "@/game/types";

interface Props {
  state: GameState;
  onChange: (key: SustainabilityKey, value: number) => void;
}

const META: Record<
  SustainabilityKey,
  { label: DictKey; desc: DictKey; Icon: typeof Zap }
> = {
  renewables: { label: "sust_renewables", desc: "sust_renewables_desc", Icon: Zap },
  emissions: { label: "sust_emissions", desc: "sust_emissions_desc", Icon: Factory },
  greenTransit: { label: "sust_greenTransit", desc: "sust_greenTransit_desc", Icon: Bus },
};

function EnvironmentPanelImpl({ state, onChange }: Props) {
  const lang = state.lang;
  const env = state.environment;
  const sust = state.sustainability;

  // Sources snapshot for the operator's mental model.
  let factories = 0, power = 0, trees = 0;
  for (const b of state.builtBuildings) {
    if (b === "factory") factories++;
    else if (b === "power_plant") power++;
    else if (b === "tree") trees++;
  }

  const airTone =
    env.airQuality > 70 ? "text-success"
    : env.airQuality > 45 ? "text-warning"
    : "text-destructive";

  return (
    <div className="rounded-lg border border-border/60 bg-panel/60 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <Leaf className="h-4 w-4" />
            {t(lang, "environmentTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(lang, "environmentHint")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className={airTone}>
            <Wind className="mr-1 h-3 w-3" />
            {t(lang, "airQuality")}: {env.airQuality.toFixed(0)}
          </Badge>
          <Badge
            variant={env.pollution > 60 ? "destructive" : "secondary"}
          >
            {t(lang, "pollution")}: {env.pollution.toFixed(0)}
          </Badge>
        </div>
      </div>

      {env.pollution > 65 && (
        <div className="mb-3 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t(lang, "env_warningBad")}
        </div>
      )}
      {env.airQuality > 78 && (
        <div className="mb-3 rounded border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
          {t(lang, "env_praiseGood")}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          {(Object.keys(META) as SustainabilityKey[]).map((k) => {
            const { label, desc, Icon } = META[k];
            const value = sust[k];
            return (
              <div key={k} className="rounded-md border border-border/60 bg-background/40 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t(lang, label)}</span>
                  </div>
                  <span className="text-mono text-xs text-muted-foreground">{value}%</span>
                </div>
                <p className="mb-2 text-[11px] text-muted-foreground">{t(lang, desc)}</p>
                <Slider
                  value={[value]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => onChange(k, v[0])}
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{t(lang, "airQuality")}</span>
              <span className={`text-mono text-sm ${airTone}`}>
                {env.airQuality.toFixed(0)} / 100
              </span>
            </div>
            <Progress value={env.airQuality} className="h-2" />
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{t(lang, "pollution")}</span>
              <span
                className={`text-mono text-sm ${
                  env.pollution > 60 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {env.pollution.toFixed(0)} / 100
              </span>
            </div>
            <Progress value={env.pollution} className="h-2" />
          </div>

          <div className="rounded border border-border/50 bg-background/40 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              {t(lang, "env_sourcesTitle")}
            </div>
            <ul className="space-y-1 text-xs">
              <SourceRow icon={<Factory className="h-3 w-3" />} label={t(lang, "env_industry")} value={factories} />
              <SourceRow icon={<Zap className="h-3 w-3" />} label={t(lang, "env_power")} value={power} />
              <SourceRow
                icon={<Bus className="h-3 w-3" />}
                label={t(lang, "env_traffic")}
                value={Math.round(state.population / 1000)}
                suffix="k"
              />
              <SourceRow
                icon={<Leaf className="h-3 w-3 text-success" />}
                label={t(lang, "env_greenCover")}
                value={trees}
              />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceRow({
  icon, label, value, suffix,
}: { icon: React.ReactNode; label: string; value: number; suffix?: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-mono">{value}{suffix ?? ""}</span>
    </li>
  );
}

export const EnvironmentPanel = /*#__PURE__*/ memo(EnvironmentPanelImpl);
