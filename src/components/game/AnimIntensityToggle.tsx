/**
 * Controle compacto para ajustar a intensidade global das animações do mapa.
 * Três níveis: leve, normal, vivo. Não altera fontes, espaçamentos ou UI.
 */
import { Feather, Activity, Sparkles } from "lucide-react";
import {
  type AnimIntensity,
  useAnimIntensity,
  setAnimIntensity,
} from "@/game/animIntensity";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{
  value: AnimIntensity;
  icon: typeof Feather;
  labelPt: string;
  labelEn: string;
}> = [
  { value: "light",  icon: Feather,  labelPt: "Leve",   labelEn: "Light" },
  { value: "normal", icon: Activity, labelPt: "Normal", labelEn: "Normal" },
  { value: "lively", icon: Sparkles, labelPt: "Vivo",   labelEn: "Lively" },
];

export function AnimIntensityToggle({ lang = "pt" }: { lang?: "pt" | "en" }) {
  const current = useAnimIntensity();
  const title = lang === "pt" ? "Intensidade das animações" : "Animation intensity";
  return (
    <div
      role="radiogroup"
      aria-label={title}
      title={title}
      className="inline-flex h-9 items-center gap-0.5 rounded-md border border-border/60 bg-panel/40 p-0.5"
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = current === o.value;
        const label = lang === "pt" ? o.labelPt : o.labelEn;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setAnimIntensity(o.value)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-sm transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-panel hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
