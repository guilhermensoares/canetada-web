import { useMemo, memo } from "react";
import type { GameState } from "@/game/types";
import {
  LRF_LIMITS,
  computeRevenueMix,
  classifyCityScale,
  evaluateLRF,
} from "@/game/economicEngine";
import { formatMoney } from "@/game/logic";
import { cn } from "@/lib/utils";

const STAGE_STYLES: Record<
  ReturnType<typeof evaluateLRF>["stage"],
  { label: { pt: string; en: string }; bar: string; badge: string }
> = {
  clean:      { label: { pt: "Regular",     en: "Compliant" }, bar: "bg-emerald-500",  badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  alert:      { label: { pt: "Alerta TCE",  en: "TCE alert" }, bar: "bg-amber-400",    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30"      },
  prudencial: { label: { pt: "Prudencial",  en: "Prudential" },bar: "bg-orange-500",   badge: "bg-orange-500/15 text-orange-300 border-orange-500/30"    },
  infracao:   { label: { pt: "INFRAÇÃO LRF",en: "LRF BREACH" },bar: "bg-rose-500",     badge: "bg-rose-500/15 text-rose-300 border-rose-500/30"          },
};

function LRFPanelImpl({ state }: { state: GameState }) {
  const lang = state.lang;
  const lrf = state.fiscal ?? evaluateLRF(state);
  const mix = useMemo(() => computeRevenueMix(state.population), [state.population]);
  const scaleTag = classifyCityScale(state.population);
  const style = STAGE_STYLES[lrf.stage];
  const pct = Math.min(100, lrf.ratio * 100);

  const rev = state.lastRevenueBreakdown;
  const ownActual = rev.incomeTax + rev.propertyTax + rev.businessTax + rev.iptuProgressive;
  const monthTotal = ownActual + rev.transfers + rev.farebox + rev.sanitationTariff;
  const ownPct = monthTotal > 0 ? (ownActual / monthTotal) * 100 : 0;

  return (
    <section className="rounded-xl border border-border/60 bg-panel/70 p-4">
      <header className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground/90">
            {lang === "pt" ? "Motor Fiscal — SICONFI / LRF" : "Fiscal Engine — SICONFI / LRF"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {lang === "pt"
              ? "Composição de receita por porte e trava de folha de pagamento."
              : "Revenue composition by scale and payroll cap."}
          </p>
        </div>
        <span
          className={cn(
            "text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border",
            style.badge,
          )}
        >
          {style.label[lang]}
        </span>
      </header>

      {/* Payroll / RCL gauge */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between text-xs mb-1">
          <span className="text-muted-foreground">
            {lang === "pt" ? "Folha / RCL" : "Payroll / RCL"}
          </span>
          <span className="font-mono tabular-nums text-foreground">
            {(lrf.ratio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="relative h-2 rounded bg-black/40 overflow-hidden">
          <div
            className={cn("h-full transition-all", style.bar)}
            style={{ width: `${pct}%` }}
          />
          {/* Threshold marks */}
          {[LRF_LIMITS.alert, LRF_LIMITS.prudencial, LRF_LIMITS.hard].map((v) => (
            <span
              key={v}
              className="absolute top-0 bottom-0 w-px bg-white/50"
              style={{ left: `${v * 100}%` }}
              title={`${(v * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
          <span>0%</span>
          <span>48,6%</span>
          <span>51,3%</span>
          <span>54%</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          <div className="rounded bg-black/20 px-2 py-1">
            <div className="text-muted-foreground">RCL (12m)</div>
            <div className="font-mono">{formatMoney(lrf.rcl)}</div>
          </div>
          <div className="rounded bg-black/20 px-2 py-1">
            <div className="text-muted-foreground">
              {lang === "pt" ? "Folha (12m)" : "Payroll (12m)"}
            </div>
            <div className="font-mono">{formatMoney(lrf.personnel)}</div>
          </div>
        </div>
      </div>

      {/* Revenue mix */}
      <div>
        <div className="flex items-baseline justify-between text-xs mb-1">
          <span className="text-muted-foreground">
            {lang === "pt" ? "Mix de receita" : "Revenue mix"} · {scaleTag}
          </span>
          <span className="font-mono tabular-nums text-foreground">
            {ownPct.toFixed(0)}% {lang === "pt" ? "próprias" : "own"}
          </span>
        </div>
        <div className="flex h-2 rounded overflow-hidden bg-black/40">
          <div className="bg-sky-500" style={{ width: `${ownPct}%` }} />
          <div className="bg-violet-500" style={{ width: `${100 - ownPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
          <span>
            {lang === "pt" ? "IPTU/ISS/ITBI" : "Property/Service/Transfer taxes"}
          </span>
          <span>FPM · ICMS · SUS · FUNDEB</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
          {lang === "pt"
            ? `Alvo SICONFI para este porte: ${Math.round(mix.ownShare * 100)}% próprias / ${Math.round(mix.transferShare * 100)}% transferências.`
            : `SICONFI target for this scale: ${Math.round(mix.ownShare * 100)}% own / ${Math.round(mix.transferShare * 100)}% transfers.`}
        </p>
      </div>

      {lrf.infracaoFiscal && (
        <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {lang === "pt"
            ? "Novos investimentos, expansão de infraestrutura e obras estão bloqueados até a folha voltar abaixo de 54% da RCL."
            : "New investments, infrastructure expansions and public works are blocked until payroll drops below 54% of RCL."}
        </div>
      )}
    </section>
  );
}

export const LRFPanel = /*#__PURE__*/ memo(LRFPanelImpl);
