import { useMemo } from "react";
import { projectBudget, formatMoney } from "@/game/logic";
import type { GameState } from "@/game/types";

/**
 * Projeção orçamentária "ao vivo": recalcula receita/despesa com os valores
 * atuais dos sliders, sem esperar a virada do mês. Resolve a percepção de que
 * mexer nas políticas não muda nada — o painel só lia `lastRevenue`/
 * `lastExpenses`, gravados apenas no fechamento mensal.
 */
export function BudgetProjection({ state }: { state: GameState }) {
  const p = useMemo(() => projectBudget(state), [state]);
  const rows: Array<[string, number]> = [
    ["Educação", p.education],
    ["Saúde", p.health],
    ["Segurança", p.security],
    ["Transporte", p.transport],
    ["Sustentabilidade", p.sustainability],
    ["Infraestrutura", p.infra],
    ["Juros da dívida", p.debtInterest],
  ];
  const max = Math.max(1, ...rows.map(([, v]) => v));
  const positive = p.balance >= 0;

  return (
    <div className="rounded-md border border-border/60 bg-panel/60 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold">Projeção do mês (ao vivo)</span>
        <span
          className={`text-mono text-sm font-semibold ${positive ? "text-primary" : "text-destructive"}`}
        >
          {positive ? "+" : "−"}{formatMoney(Math.abs(p.balance))}
        </span>
      </div>
      <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Receita própria</dt>
          <dd className="text-mono">{formatMoney(p.incomeTax + p.propertyTax + p.businessTax)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Repasses (FPM/ICMS)</dt>
          <dd className="text-mono">{formatMoney(p.transfers)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Receita total</dt>
          <dd className="text-mono">{formatMoney(p.revenue)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Despesa corrente</dt>
          <dd className="text-mono">{formatMoney(p.expenses)}</dd>
        </div>
      </dl>
      <div className="space-y-1">
        {rows.map(([label, v]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-[11px] text-muted-foreground">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/50">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${Math.round((v / max) * 100)}%` }}
              />
            </div>
            <span className="text-mono w-24 shrink-0 text-right text-[11px]">{formatMoney(v)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Capital humano acumulado: {(p.humanCapitalIndex).toFixed(0)}/100 · multiplicador da base
        tributária ×{p.peripheryMiddleClass.toFixed(2)}
      </p>
    </div>
  );
}
