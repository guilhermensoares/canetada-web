import { Eraser, MousePointer2, Route, Milestone, TrafficCone } from "lucide-react";
import type { Lang } from "@/game/types";
import { t } from "@/game/i18n";
import { ROAD_SPECS, type RoadTool } from "@/game/roads";
import { cn } from "@/lib/utils";

const TOOLS: Array<{
  tool: RoadTool;
  Icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  color: string;
  cost?: number;
}> = [
  { tool: "off",     Icon: MousePointer2, labelKey: "road_off",     color: "#94a3b8" },
  { tool: "street",  Icon: Route,         labelKey: "road_street",  color: "#6b7280", cost: ROAD_SPECS.street.cost },
  { tool: "avenue",  Icon: Milestone,     labelKey: "road_avenue",  color: "#4b5563", cost: ROAD_SPECS.avenue.cost },
  { tool: "highway", Icon: TrafficCone,   labelKey: "road_highway", color: "#1f2937", cost: ROAD_SPECS.highway.cost },
  { tool: "eraser",  Icon: Eraser,        labelKey: "road_eraser",  color: "#ef4444" },
];

function formatK(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

export function RoadToolbar({
  lang,
  tool,
  onChange,
  treasury,
}: {
  lang: Lang;
  tool: RoadTool;
  onChange: (tool: RoadTool) => void;
  treasury: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-panel/40 p-2">
      <div className="mr-2 hidden text-xs uppercase tracking-wider text-muted-foreground sm:block">
        {t(lang, "roadsTitle")}
      </div>
      {TOOLS.map(({ tool: k, Icon, labelKey, color, cost }) => {
        const active = tool === k;
        const disabled = cost != null && treasury < cost;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
              active
                ? "border-primary/80 bg-primary/10 text-foreground"
                : "border-border/50 bg-transparent text-muted-foreground hover:bg-panel/70 hover:text-foreground",
              disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
            title={cost ? `${t(lang, labelKey)} · R$ ${formatK(cost)}` : t(lang, labelKey)}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: color, opacity: k === "off" ? 0.3 : 1 }}
              aria-hidden
            />
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t(lang, labelKey)}</span>
            {cost != null && (
              <span className="hidden font-mono text-[10px] text-muted-foreground xl:inline">
                R${formatK(cost)}
              </span>
            )}
          </button>
        );
      })}
      <div className="ml-auto text-xs text-muted-foreground">
        <span className="font-mono">{t(lang, "roadHint")}</span>
      </div>
    </div>
  );
}
