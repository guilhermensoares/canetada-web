import { Eraser, Factory, HeartHandshake, Home, MousePointer2, ShoppingBag, Sprout } from "lucide-react";
import type { Lang, ZoneTool } from "@/game/types";
import { t } from "@/game/i18n";
import { cn } from "@/lib/utils";

const TOOLS: Array<{
  tool: ZoneTool;
  Icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  color: string;
}> = [
  { tool: "off",         Icon: MousePointer2, labelKey: "zone_off",         color: "#94a3b8" },
  { tool: "residential", Icon: Home,          labelKey: "zone_residential", color: "#43c46b" },
  { tool: "commercial",  Icon: ShoppingBag,   labelKey: "zone_commercial",  color: "#3aa5ff" },
  { tool: "industrial",  Icon: Factory,       labelKey: "zone_industrial",  color: "#ff9a3d" },
  { tool: "rural",       Icon: Sprout,        labelKey: "zone_rural",       color: "#e0c62b" },
  { tool: "zeis",        Icon: HeartHandshake,labelKey: "zone_zeis",        color: "#a855f7" },
  { tool: "eraser",      Icon: Eraser,        labelKey: "zone_eraser",      color: "#ef4444" },
];

export function ZoneToolbar({
  lang,
  tool,
  onChange,
  attractiveness,
}: {
  lang: Lang;
  tool: ZoneTool;
  onChange: (tool: ZoneTool) => void;
  attractiveness: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-panel/40 p-2">
      <div className="mr-2 hidden text-xs uppercase tracking-wider text-muted-foreground sm:block">
        {t(lang, "zonesTitle")}
      </div>
      {TOOLS.map(({ tool: k, Icon, labelKey, color }) => {
        const active = tool === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
              active
                ? "border-primary/80 bg-primary/10 text-foreground"
                : "border-border/50 bg-transparent text-muted-foreground hover:bg-panel/70 hover:text-foreground",
            )}
            title={t(lang, labelKey)}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: color, opacity: k === "off" ? 0.3 : 1 }}
              aria-hidden
            />
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t(lang, labelKey)}</span>
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span className="uppercase tracking-wider">{t(lang, "attractiveness")}</span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${attractiveness}%`,
              backgroundColor:
                attractiveness > 65 ? "#43c46b" : attractiveness > 35 ? "#f5d76e" : "#ef4444",
            }}
          />
        </div>
        <span className="text-mono text-foreground">{attractiveness}</span>
      </div>
    </div>
  );
}
