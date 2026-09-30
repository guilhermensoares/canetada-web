import { Building2, Flame, GraduationCap, HeartPulse, Droplets, Zap, MousePointer2, School } from "lucide-react";
import type { BuildTool, Lang, StateBuildKind } from "@/game/types";
import { BUILD_DEFS } from "@/game/logic";
import { formatMoney } from "@/game/logic";
import { t } from "@/game/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{
  tool: StateBuildKind;
  Icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  color: string;
}> = [
  { tool: "fire_station", Icon: Flame,         labelKey: "build_fire_station", color: "#c93c2a" },
  { tool: "hospital",     Icon: HeartPulse,    labelKey: "build_hospital",     color: "#3a6ea5" },
  { tool: "school",       Icon: School,        labelKey: "build_school",       color: "#8a3c2f" },
  { tool: "university",   Icon: GraduationCap, labelKey: "build_university",   color: "#5b3a2f" },
  { tool: "water_plant",  Icon: Droplets,      labelKey: "build_water_plant",  color: "#2f6b86" },
  { tool: "power_plant",  Icon: Zap,           labelKey: "build_power_plant",  color: "#f0b429" },
];

export function BuildToolbar({
  lang,
  tool,
  onChange,
  treasury,
}: {
  lang: Lang;
  tool: BuildTool;
  onChange: (t: BuildTool) => void;
  treasury: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-panel/40 p-2">
      <div className="mr-2 hidden items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground sm:flex">
        <Building2 className="h-3.5 w-3.5" />
        {t(lang, "buildTitle")}
      </div>
      <button
        type="button"
        onClick={() => onChange("off")}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
          tool === "off"
            ? "border-primary/80 bg-primary/10 text-foreground"
            : "border-border/50 bg-transparent text-muted-foreground hover:bg-panel/70 hover:text-foreground",
        )}
        title={t(lang, "build_off")}
      >
        <MousePointer2 className="h-3.5 w-3.5" />
        <span className="hidden md:inline">{t(lang, "build_off")}</span>
      </button>
      {OPTIONS.map(({ tool: k, Icon, labelKey, color }) => {
        const active = tool === k;
        const cost = BUILD_DEFS[k].cost;
        const affordable = treasury >= cost;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            disabled={!affordable}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45",
              active
                ? "border-primary/80 bg-primary/10 text-foreground"
                : "border-border/50 bg-transparent text-muted-foreground hover:bg-panel/70 hover:text-foreground",
            )}
            title={`${t(lang, labelKey)} · ${t(lang, "cost")}: ${formatMoney(cost)}`}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t(lang, labelKey)}</span>
            <span className="text-mono text-[10px] text-muted-foreground">
              {formatMoney(cost)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
