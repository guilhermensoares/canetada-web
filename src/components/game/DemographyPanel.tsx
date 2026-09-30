import { memo } from "react";
import type { GameState } from "@/game/types";
import { computeIncomeBrackets } from "@/game/demography";
import { cn } from "@/lib/utils";

function DemographyPanelImpl({ state }: { state: GameState }) {
  const lang = state.lang;
  const D = state.demography ?? {
    brackets: computeIncomeBrackets(state),
    housingDeficit: 0,
    inadequacyIndex: 0,
    rentBurdenLow: 0,
    burdenStreak: 0,
    spawnedLastMonth: 0,
    householdSize: 3.1,
  };
  const B = D.brackets;
  const total = Math.max(1, B.low + B.middle + B.high);
  const pct = (n: number) => Math.round((n / total) * 100);

  const burdenPct = Math.round(D.rentBurdenLow * 100);
  const burdenBad = D.rentBurdenLow > 0.3;

  const deficitPct = Math.min(100, Math.round((D.housingDeficit / Math.max(1, state.population / D.householdSize)) * 100));
  const deficitTone =
    deficitPct >= 15 ? "bg-rose-500" : deficitPct >= 7 ? "bg-amber-400" : "bg-emerald-500";
  const inadeqTone =
    D.inadequacyIndex >= 30 ? "bg-rose-500" : D.inadequacyIndex >= 15 ? "bg-amber-400" : "bg-emerald-500";

  const t = (pt: string, en: string) => (lang === "pt" ? pt : en);

  return (
    <section className="rounded-xl border border-border/60 bg-panel/70 p-4">
      <header className="mb-3">
        <h3 className="text-sm font-semibold tracking-wide text-foreground/90">
          {t("Demografia Habitacional (FJP)", "Housing Demography (FJP)")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "Faixas de renda por SM, déficit e inadequação urbana.",
            "Income brackets by MW, deficit and urban inadequacy.",
          )}
        </p>
      </header>

      {/* Income bracket bar */}
      <div className="mb-3">
        <div className="flex text-[10px] tracking-wide uppercase text-muted-foreground justify-between mb-1">
          <span>{t("0–2 SM", "0–2 MW")}</span>
          <span>{t("2–5 SM", "2–5 MW")}</span>
          <span>{t("> 5 SM", "> 5 MW")}</span>
        </div>
        <div className="flex h-2 rounded overflow-hidden bg-black/40">
          <div className="bg-rose-500" style={{ width: `${pct(B.low)}%` }} />
          <div className="bg-amber-400" style={{ width: `${pct(B.middle)}%` }} />
          <div className="bg-emerald-500" style={{ width: `${pct(B.high)}%` }} />
        </div>
        <div className="flex text-xs font-mono tabular-nums text-foreground/80 justify-between mt-1">
          <span>{B.low.toLocaleString(lang === "pt" ? "pt-BR" : "en-US")} ({pct(B.low)}%)</span>
          <span>{B.middle.toLocaleString(lang === "pt" ? "pt-BR" : "en-US")} ({pct(B.middle)}%)</span>
          <span>{B.high.toLocaleString(lang === "pt" ? "pt-BR" : "en-US")} ({pct(B.high)}%)</span>
        </div>
      </div>

      {/* Deficit + Inadequação gauges */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Gauge
          label={t("Déficit Habitacional", "Housing Deficit")}
          value={`${D.housingDeficit.toLocaleString(lang === "pt" ? "pt-BR" : "en-US")}`}
          hint={t("moradias faltantes", "missing dwellings")}
          pct={deficitPct}
          tone={deficitTone}
        />
        <Gauge
          label={t("Índice de Inadequação", "Inadequacy Index")}
          value={`${D.inadequacyIndex}%`}
          hint={t("moradia informal/risco", "informal/hazard housing")}
          pct={D.inadequacyIndex}
          tone={inadeqTone}
        />
      </div>

      {/* Rent burden */}
      <div className={cn(
        "rounded-md border p-2 text-xs",
        burdenBad
          ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-200",
      )}>
        <div className="flex justify-between items-baseline">
          <span className="uppercase tracking-wide text-[10px]">
            {t("Ônus com aluguel (baixa renda)", "Rent burden (low income)")}
          </span>
          <span className="font-mono tabular-nums text-sm">{burdenPct}%</span>
        </div>
        <div className="mt-1 h-1.5 rounded bg-black/40 overflow-hidden relative">
          <div
            className={burdenBad ? "h-full bg-rose-500" : "h-full bg-emerald-500"}
            style={{ width: `${Math.min(100, burdenPct)}%` }}
          />
          <span
            className="absolute top-0 bottom-0 w-px bg-white/60"
            style={{ left: "30%" }}
            title="30%"
          />
        </div>
        <p className="mt-1 text-[11px] opacity-80">
          {burdenBad
            ? t(
                `Aluguel > 30% da renda por ${D.burdenStreak} mês(es): risco de ocupação urbana.`,
                `Rent > 30% for ${D.burdenStreak} month(s): urban-occupation risk rising.`,
              )
            : t("Custo do aluguel dentro do limite recomendado.", "Rent cost within recommended threshold.")}
        </p>
      </div>

      {D.spawnedLastMonth > 0 && (
        <p className="mt-2 text-[11px] text-amber-300">
          {t(
            `${D.spawnedLastMonth} assentamento(s) informal(is) surgiram por déficit.`,
            `${D.spawnedLastMonth} informal settlement(s) emerged from unmet demand.`,
          )}
        </p>
      )}
    </section>
  );
}

function Gauge({ label, value, hint, pct, tone }: {
  label: string; value: string; hint: string; pct: number; tone: string;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-black/20 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold font-mono tabular-nums text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground mb-1">{hint}</div>
      <div className="h-1.5 rounded bg-black/40 overflow-hidden">
        <div className={cn("h-full", tone)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}

export const DemographyPanel = /*#__PURE__*/ memo(DemographyPanelImpl);
