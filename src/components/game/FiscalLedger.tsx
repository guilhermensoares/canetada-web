import { Card } from "@/components/ui/card";
import type { GameState } from "@/game/types";
import { t } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import { findScenario } from "@/game/scenarios";
import { ArrowRight, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fiscal Ledger — decomposes the last monthly tick into revenue sources on the
 * left and expense categories on the right, with driver hints in the middle so
 * players can see WHY a number moved.
 */
export function FiscalLedger({ state }: { state: GameState }) {
  const lang = state.lang;
  const scen = findScenario(state.scenarioId);
  const rev = state.lastRevenueBreakdown;
  const exp = state.lastExpensesBreakdown;
  const balance = state.lastRevenue - state.lastExpenses;

  const revItems = [
    { k: "ledger_incomeTax",   v: rev.incomeTax,       d: "ledger_driver_income"   },
    { k: "ledger_propertyTax", v: rev.propertyTax,     d: "ledger_driver_property" },
    { k: "ledger_businessTax", v: rev.businessTax,     d: "ledger_driver_business" },
    { k: "ledger_outorga",     v: rev.outorga,         d: "ledger_driver_outorga"  },
    { k: "ledger_iptu_prog",   v: rev.iptuProgressive, d: "ledger_driver_iptu_prog" },
    { k: "ledger_farebox",     v: rev.farebox,         d: "ledger_driver_farebox"  },
    { k: "ledger_sanitationTariff", v: rev.sanitationTariff, d: "ledger_driver_sanTariff" },
    { k: "ledger_transfers",   v: rev.transfers,       d: "" },
  ].filter((r) => r.v > 0);

  const expItems = [
    { k: "education",       v: exp.education,       d: "ledger_driver_policy" },
    { k: "health",          v: exp.health,          d: "ledger_driver_policy" },
    { k: "security",        v: exp.security,        d: "ledger_driver_policy" },
    { k: "transport",       v: exp.transport,       d: "ledger_driver_policy" },
    { k: "ledger_transitSubsidy", v: exp.transitSubsidy, d: "ledger_driver_transitSubsidy" },
    { k: "ledger_sanitation", v: exp.sanitation,    d: "ledger_driver_sanitation" },
    { k: "ledger_waste",    v: exp.waste,           d: "ledger_driver_waste" },
    { k: "ledger_climateDamage", v: exp.climateDamage, d: "ledger_driver_climate" },
    { k: "ledger_sust",     v: exp.sustainability,  d: "" },
    { k: "ledger_infra",    v: exp.infra,           d: "" },
    { k: "ledger_debtInterest", v: exp.debtInterest,d: "ledger_driver_debt" },
  ].filter((r) => r.v > 0);

  const totalRev = state.lastRevenue || 1;
  const totalExp = state.lastExpenses || 1;

  return (
    <Card className="border-border/60 bg-panel/70 p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t(lang, "finances")}
          </div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Scale className="h-4 w-4 text-primary" />
            {t(lang, "ledger_title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t(lang, "ledger_subtitle")}</p>
        </div>
        <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1 text-right">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t(lang, "ledger_scenarioActive")}
          </div>
          <div className="text-sm font-semibold">
            {scen.emoji} {t(lang, scen.labelKey)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            ×{scen.modifiers.revenueMult.toFixed(2)} · juros {(scen.modifiers.debtInterestRate * 100).toFixed(2)}%
          </div>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        <Column
          title={t(lang, "ledger_revenues")}
          total={state.lastRevenue}
          tone="success"
          icon={<TrendingUp className="h-4 w-4" />}
        >
          {revItems.map((r) => (
            <Row
              key={r.k}
              label={t(lang, r.k)}
              value={r.v}
              share={r.v / totalRev}
              hint={r.d ? t(lang, r.d) : undefined}
              tone="success"
            />
          ))}
        </Column>

        <div className="hidden items-center justify-center md:flex">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        <Column
          title={t(lang, "ledger_expenses")}
          total={state.lastExpenses}
          tone="danger"
          icon={<TrendingDown className="h-4 w-4" />}
        >
          {expItems.map((r) => (
            <Row
              key={r.k}
              label={t(lang, r.k)}
              value={r.v}
              share={r.v / totalExp}
              hint={r.d ? t(lang, r.d) : undefined}
              tone="danger"
            />
          ))}
        </Column>
      </div>

      <div
        data-tour="fin-ledger-balance"
        className={cn(
          "mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-sm font-semibold",
          balance >= 0
            ? "border-success/40 bg-success/10 text-success"
            : "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        <span>{t(lang, "ledger_balance")}</span>
        <span>{formatMoney(balance)}</span>
      </div>
    </Card>
  );
}

function Column({
  title, total, tone, icon, children,
}: {
  title: string; total: number; tone: "success" | "danger";
  icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/30 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest",
            tone === "success" ? "text-success" : "text-destructive",
          )}
        >
          {icon}
          {title}
        </div>
        <div className="text-mono text-sm font-semibold">{formatMoney(total)}</div>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  label, value, share, hint, tone,
}: {
  label: string; value: number; share: number; hint?: string; tone: "success" | "danger";
}) {
  const pct = Math.max(2, Math.round(share * 100));
  return (
    <div className="rounded border border-border/40 bg-background/40 px-2 py-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="truncate">{label}</span>
        <span className="text-mono font-medium">{formatMoney(value)}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded bg-muted/50">
        <div
          className={cn("h-full", tone === "success" ? "bg-success/70" : "bg-destructive/70")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
