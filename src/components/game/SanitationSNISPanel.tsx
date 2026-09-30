/**
 * Sanitation SNIS Panel — Sistema Nacional de Informações sobre Saneamento.
 *
 * Monitora:
 *  - Rede de água (km) e perda de distribuição (%) — média BR ≈ 35%
 *  - Investimento em Troca de Tubulação & Automação
 *  - Cobertura de esgoto vs. gatilho de 60% (multiplicador de saúde até +40%)
 *  - Gráfico comparativo: Investimento em Saneamento × Economia em Leitos de UTI
 */
import { useMemo, memo } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/game/logic";
import type { GameState } from "@/game/types";
import { Droplets, Wrench, Activity, BarChart3, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  actions: { setPipeReplacement: (v: number) => void };
}

function SanitationSNISPanelImpl({ state, actions }: Props) {
  const san = state.climate.sanitation;
  const lang = state.lang;
  const pt = lang === "pt";

  const sewageBelow60 = san.sewageCoverage < 60;
  const healthSurchargePct = Math.round((san.lastHealthMultiplier - 1) * 100);

  // Bar chart data.
  const { invBar, saveBar, ratio } = useMemo(() => {
    const inv = san.cumulativeInvestment;
    const save = san.cumulativeIcuSavings;
    const max = Math.max(inv, save, 1);
    return {
      invBar: (inv / max) * 100,
      saveBar: (save / max) * 100,
      ratio: inv > 0 ? save / inv : 0,
    };
  }, [san.cumulativeInvestment, san.cumulativeIcuSavings]);

  return (
    <Card className="border-border/60 bg-panel/70 p-4">
      <header className="mb-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {pt ? "SNIS · Saneamento Básico" : "SNIS · Sanitation"}
        </div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Droplets className="h-4 w-4 text-sky-400" />
          {pt ? "Rede de Água & Saúde Pública" : "Water Network & Public Health"}
        </h3>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {/* ---------- Water network / losses ---------- */}
        <section className="rounded-md border border-border/50 bg-background/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Droplets className="h-3.5 w-3.5 text-sky-400" />
            {pt ? "Rede de Água" : "Water Network"}
          </div>
          <MiniRow label={pt ? "Extensão da rede" : "Network length"}
                   value={`${Math.round(san.pipeNetworkKm)} km`} />
          <MiniRow label={pt ? "Cobertura água" : "Water coverage"}
                   value={`${Math.round(san.waterCoverage)}%`} />

          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {pt ? "Perda na distribuição" : "Distribution loss"}
              </span>
              <span className={cn(
                "font-mono tabular-nums",
                san.waterLossPct >= 35 ? "text-red-400" :
                san.waterLossPct >= 25 ? "text-amber-300" : "text-emerald-400",
              )}>
                {san.waterLossPct.toFixed(1)}%
              </span>
            </div>
            <Progress value={san.waterLossPct} className="h-1.5" />
            <div className="mt-1 text-[10px] text-muted-foreground">
              {pt
                ? `≈ ${san.lastWaterLostM3.toLocaleString("pt-BR")} m³ perdidos/mês · média BR: 35%`
                : `≈ ${san.lastWaterLostM3.toLocaleString("en-US")} m³ lost/month · BR average: 35%`}
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold">
              <Wrench className="h-3 w-3" />
              {pt ? "Troca de Tubulação & Automação" : "Pipe Replacement & Automation"}
            </div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {formatMoney(san.pipeReplacementInvestment)} / {pt ? "mês" : "month"}
              </span>
              <span className="text-muted-foreground">
                {pt ? "Manut. mínima:" : "Min upkeep:"}{" "}
                {formatMoney(Math.round((san.pipeNetworkKm / 100) * 60_000))}
              </span>
            </div>
            <Slider
              value={[san.pipeReplacementInvestment]}
              min={0} max={200_000} step={10_000}
              onValueChange={(v) => actions.setPipeReplacement(v[0])}
            />
            <div className="mt-1 text-[10px] text-muted-foreground">
              {pt
                ? "Investir acima da manutenção reduz a perda até 15%. Sub-investir degrada a rede."
                : "Investing above upkeep drops losses toward 15%. Under-investing degrades the network."}
            </div>
          </div>
        </section>

        {/* ---------- Sewage / health trigger ---------- */}
        <section className="rounded-md border border-border/50 bg-background/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Activity className="h-3.5 w-3.5 text-rose-400" />
            {pt ? "Esgoto & SUS Municipal" : "Sewage & Municipal Health"}
          </div>

          <MiniRow label={pt ? "Cobertura esgoto" : "Sewage coverage"}
                   value={`${Math.round(san.sewageCoverage)}%`} />
          <MiniRow label={pt ? "Meta epidemiológica" : "Epidemic threshold"} value="60%" />

          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {pt ? "Cobertura vs. gatilho" : "Coverage vs. threshold"}
              </span>
              <span className="font-mono tabular-nums">
                {Math.round(san.sewageCoverage)}% / 60%
              </span>
            </div>
            <Progress value={Math.min(100, (san.sewageCoverage / 60) * 100)} className="h-1.5" />
          </div>

          <div className={cn(
            "mt-3 rounded border p-2 text-[11px]",
            sewageBelow60
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
          )}>
            <div className="flex items-center gap-1.5 font-semibold">
              {sewageBelow60 && <AlertTriangle className="h-3 w-3" />}
              {sewageBelow60
                ? (pt ? "Risco epidêmico elevado" : "Elevated epidemic risk")
                : (pt ? "Cobertura adequada" : "Adequate coverage")}
            </div>
            <div className="mt-0.5">
              {pt
                ? `Multiplicador de custo do SUS: ×${san.lastHealthMultiplier.toFixed(2)} (+${healthSurchargePct}%)`
                : `SUS cost multiplier: ×${san.lastHealthMultiplier.toFixed(2)} (+${healthSurchargePct}%)`}
            </div>
            {san.lastOutbreak && (
              <div className="mt-1">
                {pt ? "Surto ativo:" : "Active outbreak:"}{" "}
                <Badge variant="outline" className="text-[10px]">
                  {san.lastOutbreak.disease} · sev {san.lastOutbreak.severity}
                </Badge>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ---------- Bar-chart: Investment vs ICU savings ---------- */}
      <section className="mt-3 rounded-md border border-border/50 bg-background/30 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          {pt ? "Investimento × Economia em Leitos de UTI" : "Investment × ICU Bed Savings"}
        </div>

        <div className="space-y-2">
          <BarRow
            label={pt ? "Investimento em Saneamento (acumulado)" : "Sanitation Investment (cumulative)"}
            value={san.cumulativeInvestment}
            pct={invBar}
            color="bg-sky-500"
          />
          <BarRow
            label={pt ? "Economia em Leitos de UTI (acumulado)" : "ICU Bed Savings (cumulative)"}
            value={san.cumulativeIcuSavings}
            pct={saveBar}
            color="bg-emerald-500"
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {pt ? "Razão economia/investimento:" : "Savings-to-investment ratio:"}{" "}
            <span className={cn(
              "font-mono tabular-nums",
              ratio >= 1 ? "text-emerald-300" :
              ratio >= 0.5 ? "text-amber-300" : "text-red-300",
            )}>
              {ratio.toFixed(2)}×
            </span>
          </span>
          <span>
            {pt
              ? "Baseline: 35% perdas / 40% esgoto"
              : "Baseline: 35% losses / 40% sewage"}
          </span>
        </div>
      </section>
    </Card>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function BarRow({ label, value, pct, color }: {
  label: string; value: number; pct: number; color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{formatMoney(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-background/60">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

export const SanitationSNISPanel = /*#__PURE__*/ memo(SanitationSNISPanelImpl);
