import { useMemo, useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t, type DictKey } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import {
  BILL_TEMPLATES,
  listRoutineTemplates,
  pendingBills,
  polExt,
  type Bill,
} from "@/game/legislature";
import type { GameState } from "@/game/types";
import { cn } from "@/lib/utils";

interface LegislaturePanelProps {
  state: GameState;
  actions: {
    propose: (templateId: string) => void;
    boost: (billId: string, spend: number) => void;
    vote: (billId: string) => void;
    withdraw: (billId: string) => void;
  };
}

function LegislaturePanelImpl({ state, actions }: LegislaturePanelProps) {
  const lang = state.lang;
  const p = polExt(state);
  const pending = pendingBills(state);
  const routine = useMemo(() => listRoutineTemplates(), []);
  const [selected, setSelected] = useState<string>(routine[0]?.id ?? "");
  const selectedTpl = BILL_TEMPLATES.find((x) => x.id === selected);

  const capital = Math.round(p.politicalCapital);

  return (
    <div className="rounded-lg border border-border/60 bg-panel/60 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
            {t(lang, "leg_title")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(lang, "leg_hint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary" className="text-mono">
            {t(lang, "leg_capital")}: {capital}
          </Badge>
          <Badge variant="outline">
            {t(lang, "leg_passed")}: {p.billsPassed}
          </Badge>
          <Badge variant="outline">
            {t(lang, "leg_rejected")}: {p.billsRejected}
          </Badge>
        </div>
      </div>

      {/* Political capital bar */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{t(lang, "leg_capital_label")}</span>
          <span className="text-mono">{capital}/120</span>
        </div>
        <Progress value={(capital / 120) * 100} className="h-1.5" />
      </div>

      {/* Propose new bill */}
      <div className="mb-4 rounded border border-border/50 bg-background/40 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          {t(lang, "leg_propose")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-8 min-w-64 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {routine.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                  [{tpl.capitalCost}pc] {tpl.titleKey.split("||")[lang === "pt" ? 0 : 1]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!selectedTpl || capital < (selectedTpl?.capitalCost ?? 0)}
            onClick={() => selectedTpl && actions.propose(selectedTpl.id)}
          >
            {t(lang, "leg_submit")}
          </Button>
        </div>
        {selectedTpl && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {selectedTpl.descKey.split("||")[lang === "pt" ? 0 : 1]}
          </p>
        )}
      </div>

      {/* Pending bills */}
      {pending.length === 0 && (
        <p className="rounded border border-dashed border-border/50 px-3 py-4 text-center text-xs text-muted-foreground">
          {t(lang, "leg_empty")}
        </p>
      )}
      <div className="space-y-2">
        {pending.map((b) => (
          <BillCard key={b.id} state={state} bill={b} actions={actions} capital={capital} />
        ))}
      </div>

      {/* Recent history */}
      <RecentBills state={state} />
    </div>
  );
}

function BillCard({
  state, bill, actions, capital,
}: {
  state: GameState; bill: Bill;
  actions: LegislaturePanelProps["actions"];
  capital: number;
}) {
  const lang = state.lang;
  const p = polExt(state);
  const title = bill.titleKey.split("||")[lang === "pt" ? 0 : 1];
  const desc = bill.descKey.split("||")[lang === "pt" ? 0 : 1];

  // Live yes-seat forecast.
  const seatsYes = bill.supportGroups.reduce((acc, gid) => {
    const g = p.groups.find((x) => x.id === gid);
    return acc + (g ? g.influence * (g.mood - 40) : 0);
  }, 0);
  const seatsNo = bill.opposeGroups.reduce((acc, gid) => {
    const g = p.groups.find((x) => x.id === gid);
    return acc + (g ? g.influence * (g.mood - 40) : 0);
  }, 0);
  const lobbyBias = seatsYes - seatsNo;

  return (
    <div className={cn(
      "rounded border border-border/50 bg-background/50 p-3",
      bill.crisis && "border-destructive/50 bg-destructive/5",
    )}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          {bill.crisis && (
            <Badge variant="destructive" className="text-[9px] uppercase">
              {t(lang, "leg_crisis")}
            </Badge>
          )}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <span className="text-mono text-[10px] text-muted-foreground">
          {t(lang, "leg_expires")}: {String(bill.expiresMonth).padStart(2, "0")}/{bill.expiresYear}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">{desc}</p>

      <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
        {bill.supportGroups.map((g) => (
          <span key={"s" + g} className="rounded bg-success/20 px-1.5 py-0.5 text-success">
            +{t(lang, `grp_${g}` as DictKey)}
          </span>
        ))}
        {bill.opposeGroups.map((g) => (
          <span key={"o" + g} className="rounded bg-destructive/20 px-1.5 py-0.5 text-destructive">
            −{t(lang, `grp_${g}` as DictKey)}
          </span>
        ))}
        <span className={cn(
          "rounded px-1.5 py-0.5",
          lobbyBias > 0 ? "bg-success/10 text-success" : lobbyBias < 0 ? "bg-destructive/10 text-destructive" : "bg-muted/40 text-muted-foreground",
        )}>
          {t(lang, "leg_lobbyBias")}: {lobbyBias >= 0 ? "+" : ""}{lobbyBias.toFixed(2)}
        </span>
        {bill.boostCapital > 0 && (
          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-accent-foreground">
            {t(lang, "leg_whip")}: {bill.boostCapital}pc
          </span>
        )}
      </div>

      <BillEffectSummary state={state} bill={bill} />

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="default" onClick={() => actions.vote(bill.id)}>
          {t(lang, "leg_callVote")}
        </Button>
        <Button
          size="sm" variant="secondary"
          disabled={capital < 3}
          onClick={() => actions.boost(bill.id, 3)}
        >
          {t(lang, "leg_whip3")}
        </Button>
        <Button
          size="sm" variant="secondary"
          disabled={capital < 8}
          onClick={() => actions.boost(bill.id, 8)}
        >
          {t(lang, "leg_whip8")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.withdraw(bill.id)}>
          {t(lang, "leg_withdraw")}
        </Button>
      </div>
    </div>
  );
}

function BillEffectSummary({ state, bill }: { state: GameState; bill: Bill }) {
  const lang = state.lang;
  const e = bill.effect;
  const bits: string[] = [];
  if (e.treasury) bits.push(`${t(lang, "treasury")} ${e.treasury > 0 ? "+" : ""}${formatMoney(e.treasury)}`);
  if (e.approval) bits.push(`${t(lang, "approval")} ${e.approval > 0 ? "+" : ""}${e.approval}`);
  if (e.happiness) bits.push(`${t(lang, "happiness")} ${e.happiness > 0 ? "+" : ""}${e.happiness}`);
  if (e.polEducation) bits.push(`Educ ${e.polEducation > 0 ? "+" : ""}${e.polEducation}`);
  if (e.polHealth) bits.push(`Saúde ${e.polHealth > 0 ? "+" : ""}${e.polHealth}`);
  if (e.polSecurity) bits.push(`Seg ${e.polSecurity > 0 ? "+" : ""}${e.polSecurity}`);
  if (e.polTransport) bits.push(`Transp ${e.polTransport > 0 ? "+" : ""}${e.polTransport}`);
  if (e.taxIncome) bits.push(`IR ${e.taxIncome > 0 ? "+" : ""}${e.taxIncome}%`);
  if (e.taxProperty) bits.push(`IPTU ${e.taxProperty > 0 ? "+" : ""}${e.taxProperty}%`);
  if (e.taxBusiness) bits.push(`ISS ${e.taxBusiness > 0 ? "+" : ""}${e.taxBusiness}%`);
  if (e.corruption) bits.push(`Corr ${e.corruption > 0 ? "+" : ""}${e.corruption}`);
  if (e.transparency) bits.push(`Transp ${e.transparency > 0 ? "+" : ""}${e.transparency}`);
  return (
    <div className="text-[10px] text-muted-foreground">
      <span className="uppercase tracking-wider">{t(lang, "leg_effects")}: </span>
      {bits.join(" · ")}
    </div>
  );
}

function RecentBills({ state }: { state: GameState }) {
  const lang = state.lang;
  const p = polExt(state);
  const closed = p.bills.filter((b) => b.status !== "pending").slice(-4).reverse();
  if (closed.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {t(lang, "leg_history")}
      </div>
      <div className="space-y-1">
        {closed.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded border border-border/40 bg-background/30 px-2 py-1 text-[11px]">
            <span className="truncate">
              {b.titleKey.split("||")[lang === "pt" ? 0 : 1]}
            </span>
            <span className={cn(
              "text-mono",
              b.status === "passed" ? "text-success"
                : b.status === "rejected" ? "text-destructive"
                : "text-muted-foreground",
            )}>
              {b.status === "passed" && `${b.yesSeats}×${b.noSeats} ✓`}
              {b.status === "rejected" && b.yesSeats !== undefined && `${b.yesSeats}×${b.noSeats} ✗`}
              {b.status === "rejected" && b.yesSeats === undefined && "—"}
              {b.status === "expired" && "…"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const LegislaturePanel = /*#__PURE__*/ memo(LegislaturePanelImpl);
