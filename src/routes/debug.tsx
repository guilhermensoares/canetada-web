import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { GameState } from "@/game/types";
import { initialState, STORAGE_KEY } from "@/game/logic";
import {
  archetypeWeights,
  severityProbabilities,
  stressBreakdown,
} from "@/game/proceduralEvents";
import { t } from "@/game/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Beaker, Dices } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/debug")({
  head: () => ({
    meta: [
      { title: "Debug — Gerador de eventos" },
      {
        name: "description",
        content:
          "Visualização em tempo real dos pesos por arquétipo e do cálculo de severidade dos eventos procedurais.",
      },
      { property: "og:title", content: "Debug — Gerador de eventos" },
      {
        property: "og:description",
        content:
          "Inspeção dos pesos e severidade do gerador procedural de eventos.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: import.meta.env.DEV ? DebugPage : NotFound,
});

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <p className="text-sm">404</p>
    </div>
  );
}

function loadState(): GameState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    return JSON.parse(raw) as GameState;
  } catch {
    return initialState();
  }
}

function DebugPage() {
  const [state, setState] = useState<GameState>(() => loadState());
  const [tick, setTick] = useState(0);

  // Live-refresh from localStorage every second so the game loop's writes
  // reflect here without hard-coupling to the reducer.
  useEffect(() => {
    const id = window.setInterval(() => {
      setState(loadState());
      setTick((v) => v + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const lang = state.lang;
  const weights = archetypeWeights(state);
  const sev = severityProbabilities(state);
  const stress = stressBreakdown(state);

  const sorted = [...weights].sort((a, b) => b.normalized - a.normalized);

  const kindColor: Record<string, string> = {
    danger: "text-red-400 border-red-500/40 bg-red-500/10",
    warning: "text-amber-400 border-amber-500/40 bg-amber-500/10",
    info: "text-sky-400 border-sky-500/40 bg-sky-500/10",
    success: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-panel/60 px-3 py-1.5 text-sm hover:bg-panel"
          >
            <ArrowLeft className="h-4 w-4" />
            {lang === "pt" ? "Voltar ao jogo" : "Back to game"}
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Beaker className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Debug · Procedural events
              </div>
              <div className="text-lg font-semibold">
                {state.cityName} ·{" "}
                <span className="text-mono text-primary">
                  {String(state.day).padStart(2, "0")}/{state.month}/{state.year}
                </span>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className={cn("h-3.5 w-3.5", tick % 2 === 0 && "animate-spin-slow")} />
            {lang === "pt" ? "Atualiza a cada 1s" : "Refreshes every 1s"}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-6 lg:grid-cols-[2fr_1fr]">
        {/* Archetype weights */}
        <Card className="p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {lang === "pt" ? "Pesos por arquétipo" : "Archetype weights"}
            </h2>
            <div className="text-[11px] text-muted-foreground">
              {lang === "pt"
                ? "Probabilidade de cada arquétipo ser sorteado no próximo evento."
                : "Probability of each archetype firing on the next event."}
            </div>
          </div>
          <div className="space-y-2">
            {sorted.map((w) => (
              <div key={w.id} className="rounded-md border border-border/60 bg-panel/40 p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-mono text-[10px] uppercase", kindColor[w.kind])}
                  >
                    {w.kind}
                  </Badge>
                  <div className="text-sm font-medium">{w.id}</div>
                  <div className="text-mono ml-auto text-xs text-muted-foreground">
                    raw {w.rawWeight.toFixed(2)}
                  </div>
                  <div className="text-mono w-14 text-right text-sm font-semibold text-primary">
                    {(w.normalized * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${w.normalized * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Severity */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {lang === "pt" ? "Severidade" : "Severity"}
            </h2>
            <div className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
              {lang === "pt" ? (
                <>
                  Após um sorteio uniforme (0–100):
                  <br />• &lt; 55 → <b>minor</b>
                  <br />• &lt; 85 + min(10, stress×0.05) → <b>major</b>
                  <br />• restante → <b>critical</b>
                </>
              ) : (
                <>
                  With a uniform roll (0–100):
                  <br />• &lt; 55 → <b>minor</b>
                  <br />• &lt; 85 + min(10, stress×0.05) → <b>major</b>
                  <br />• otherwise → <b>critical</b>
                </>
              )}
            </div>
            <SeverityBar label="minor" pct={sev.minor} color="bg-emerald-500" />
            <SeverityBar label="major" pct={sev.major} color="bg-amber-500" />
            <SeverityBar label="critical" pct={sev.critical} color="bg-red-500" />
          </Card>

          {/* Stress breakdown */}
          <Card className="p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {lang === "pt" ? "Índice de estresse" : "Stress score"}
              </h2>
              <div className="text-mono text-lg font-semibold text-primary">
                {stress.total.toFixed(1)}
              </div>
            </div>
            <StressRow
              label={lang === "pt" ? "Felicidade" : "Happiness"}
              formula={`(100 − ${state.happiness.toFixed(0)}) × 0.4`}
              value={stress.happiness}
              total={stress.total}
            />
            <StressRow
              label={lang === "pt" ? "Água" : "Water"}
              formula={`max(0, ${state.waterDemand}/${state.infra.waterCapacity} − 1) × 60`}
              value={stress.water}
              total={stress.total}
            />
            <StressRow
              label={lang === "pt" ? "Energia" : "Energy"}
              formula={`max(0, ${state.energyDemand}/${state.infra.energyCapacity} − 1) × 60`}
              value={stress.energy}
              total={stress.total}
            />
            <StressRow
              label={lang === "pt" ? "Inflação" : "Inflation"}
              formula={`max(0, ${state.inflation.toFixed(1)} − 4) × 5`}
              value={stress.inflation}
              total={stress.total}
            />
          </Card>

          {/* Seed */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {t(lang, "seed")}
              </h2>
              <Dices className="h-4 w-4 text-primary" />
            </div>
            <div className="text-mono text-lg font-semibold tracking-wider text-primary">
              {state.seed ?? "—"}
            </div>
            <div className="mt-1 flex items-baseline justify-between text-[11px] text-muted-foreground">
              <span>{t(lang, "seedCursor")}</span>
              <span className="text-mono font-semibold text-foreground">
                #{state.rngCursor ?? 0}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {lang === "pt"
                ? "mulberry32(hash(seed) + cursor) determina cada sorteio. Reproduzir uma partida = restaurar (seed, cursor) e refazer as mesmas decisões."
                : "mulberry32(hash(seed) + cursor) drives each draw. Reproducing a run = restore (seed, cursor) and repeat the same choices."}
            </p>
          </Card>

          {/* State snapshot */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {lang === "pt" ? "Estado atual" : "Current state"}
            </h2>
            <dl className="text-mono grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <StatLine k={t(lang, "happiness")} v={state.happiness.toFixed(0)} />
              <StatLine k={t(lang, "approval")} v={state.approval.toFixed(0)} />
              <StatLine k={t(lang, "unemployment")} v={`${state.unemployment.toFixed(1)}%`} />
              <StatLine k={t(lang, "inflation")} v={`${state.inflation.toFixed(1)}%`} />
              <StatLine
                k={t(lang, "water")}
                v={`${state.waterDemand}/${state.infra.waterCapacity}`}
              />
              <StatLine
                k={t(lang, "energy")}
                v={`${state.energyDemand}/${state.infra.energyCapacity}`}
              />
              <StatLine k={t(lang, "treasury")} v={state.treasury.toFixed(0)} />
              <StatLine k={t(lang, "debt")} v={state.debt.toFixed(0)} />
            </dl>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setState(loadState());
              setTick((v) => v + 1);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {lang === "pt" ? "Atualizar agora" : "Refresh now"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function SeverityBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-mono uppercase text-muted-foreground">{label}</span>
        <span className="text-mono font-semibold">{pct.toFixed(1)}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn("h-full transition-[width] duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StressRow({
  label,
  formula,
  value,
  total,
}: {
  label: string;
  formula: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-mono text-primary">{value.toFixed(1)}</span>
      </div>
      <div className="text-mono text-[10px] text-muted-foreground">{formula}</div>
      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-primary/10">
        <div
          className="h-full bg-primary/70 transition-[width] duration-500"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function StatLine({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="truncate text-muted-foreground">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </>
  );
}
