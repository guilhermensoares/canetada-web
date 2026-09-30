import { memo } from "react";
import { Lock, Sparkles, TrendingUp } from "lucide-react";
import type { GameState, Lang } from "@/game/types";
import { PROGRESSION_TIERS, currentTier, nextTier } from "@/game/progression";
import { formatNumber } from "@/game/logic";
import { cn } from "@/lib/utils";

/**
 * Shows the growth-mode ladder: current tier, progress to next unlock,
 * and what admin systems each tier will open. Rendered inside the Overview
 * drawer whenever `state.growthMode` is on.
 */
function ProgressionPanelImpl({ state, lang }: { state: GameState; lang: Lang }) {
  if (!state.growthMode) return null;
  const cur = currentTier(state);
  const next = nextTier(state);
  const pct = next
    ? Math.min(100, Math.max(0, ((state.population - cur.minPop) / (next.minPop - cur.minPop)) * 100))
    : 100;

  return (
    <section className="rounded-lg border border-border/60 bg-card/60 p-3 text-xs">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-widest text-[10px] text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          {lang === "pt" ? "Modo Crescimento" : "Growth Mode"}
        </div>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {cur.label[lang]}
        </span>
      </header>

      <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{cur.blurb[lang]}</p>

      {next ? (
        <>
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {formatNumber(state.population)} / {formatNumber(next.minPop)} hab
            </span>
            <span>
              {lang === "pt" ? "Próx.: " : "Next: "}
              <span className="font-semibold text-foreground">{next.label[lang]}</span>
            </span>
          </div>
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      ) : (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {lang === "pt" ? "Todas as pastas desbloqueadas." : "All departments unlocked."}
        </div>
      )}

      <ol className="mt-1 space-y-1">
        {PROGRESSION_TIERS.map((t) => {
          const unlocked = state.population >= t.minPop;
          const isCurrent = t.id === cur.id;
          return (
            <li
              key={t.id}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2 py-1.5 text-[10.5px] leading-snug",
                unlocked
                  ? isCurrent
                    ? "border-primary/60 bg-primary/10"
                    : "border-border/40 bg-muted/30"
                  : "border-border/30 bg-background/40 text-muted-foreground opacity-70",
              )}
            >
              <span className="mt-0.5">
                {unlocked ? (
                  <Sparkles className="h-3 w-3 text-primary" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-foreground">{t.label[lang]}</span>
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    {t.minPop === 0 ? (lang === "pt" ? "início" : "start") : `${formatNumber(t.minPop)}+`}
                  </span>
                </div>
                <div className="text-muted-foreground">{t.blurb[lang]}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export const ProgressionPanel = /*#__PURE__*/ memo(ProgressionPanelImpl);
