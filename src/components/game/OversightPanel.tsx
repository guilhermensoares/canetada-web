import { memo } from "react";
import type { GameState } from "@/game/types";
import type { OversightState } from "@/game/oversight";
import { formatMoney } from "@/game/logic";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gavel, Scale, ShieldAlert, Building2, AlertOctagon } from "lucide-react";

interface Props {
  state: GameState;
  actions: {
    payMp: () => void;
    contestTce: () => void;
    resumeWork: (workId: string) => void;
    defendMandate: () => void;
  };
}

function pt(state: GameState) { return state.lang === "pt"; }

function riskTone(v: number) {
  if (v >= 75) return "bg-destructive";
  if (v >= 50) return "bg-warning";
  return "bg-primary";
}

function OversightPanelImpl({ state, actions }: Props) {
  const o = (state as GameState & { oversight?: OversightState }).oversight;
  if (!o) return null;
  const isPt = pt(state);

  const impeach = o.impeachment;
  const totalSeats = state.politics?.council?.totalSeats ?? 21;
  const twoThirds = Math.ceil(totalSeats * (2 / 3));

  return (
    <Card className="mt-3 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Scale className="h-4 w-4 text-primary" />
            {isPt ? "Órgãos de Controle" : "Oversight & Legal Constraints"}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isPt
              ? "MP, TCE e Câmara: contrapesos institucionais à ação do(a) prefeito(a)."
              : "Public Prosecutor, Audit Court and Council: institutional checks on mayoral power."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
          <span>{isPt ? "Ações do MP" : "MP actions"}: <b className="text-foreground">{o.stats.mpActions}</b></span>
          <span>{isPt ? "Julgados TCE" : "TCE rulings"}: <b className="text-foreground">{o.stats.tceRulings}</b></span>
          <span>{isPt ? "Cassações tentadas" : "Impeachment tries"}: <b className="text-foreground">{o.stats.impeachmentAttempts}</b></span>
        </div>
      </div>

      {/* Risk meters */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <RiskMeter
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          label={isPt ? "Risco MP" : "Prosecutor risk"}
          value={o.mpRisk}
          hint={isPt ? "APP, repasses da saúde" : "APP violations, health transfers"}
        />
        <RiskMeter
          icon={<Building2 className="h-3.5 w-3.5" />}
          label={isPt ? "Risco TCE" : "Audit court risk"}
          value={o.tceRisk}
          hint={isPt ? "Dívida, déficit, corrupção" : "Debt, deficit, corruption"}
        />
        <RiskMeter
          icon={<Gavel className="h-3.5 w-3.5" />}
          label={isPt ? "Risco cassação" : "Impeachment risk"}
          value={o.impeachmentRisk}
          hint={isPt ? "Corrupção + baixa aprovação" : "Corruption + low approval"}
        />
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary"
          disabled={state.treasury < 300_000 || (o.mpRisk < 20 && o.injunctions.length === 0)}
          onClick={actions.payMp}>
          {isPt ? "Acordo com MP" : "Settle with MP"} · {formatMoney(300_000)}
        </Button>
        <Button size="sm" variant="secondary"
          disabled={state.treasury < 200_000 || o.tceRisk < 20}
          onClick={actions.contestTce}>
          {isPt ? "Contestar TCE" : "Contest TCE"} · {formatMoney(200_000)} · 8 CP
        </Button>
      </div>

      {/* Active injunctions */}
      {o.injunctions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {isPt ? "Liminares ativas" : "Active injunctions"}
          </div>
          {o.injunctions.map((inj) => (
            <div key={inj.id} className="rounded border border-destructive/30 bg-destructive/5 p-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-medium">{isPt ? inj.reasonPt : inj.reasonEn}</span>
                <Badge variant="outline" className="text-[9px]">
                  {inj.monthsRemaining} {isPt ? "meses" : "months"}
                </Badge>
              </div>
              {inj.freezeFraction && (
                <div className="mt-0.5 text-muted-foreground">
                  {isPt ? "Bloqueio" : "Freeze"}: {Math.round(inj.freezeFraction * 100)}% {isPt ? "da receita" : "of revenue"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stalled works */}
      {o.stalledWorks.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {isPt ? "Elefantes brancos" : "Stalled public works"}
          </div>
          {o.stalledWorks.map((w) => (
            <div key={w.id} className="rounded border border-warning/40 bg-warning/5 p-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium capitalize">{w.buildingKind.replace("_", " ")}</div>
                  <div className="text-muted-foreground">{isPt ? w.causePt : w.causeEn}</div>
                </div>
                <Button size="sm" variant="outline"
                  disabled={state.treasury < w.resumeCost}
                  onClick={() => actions.resumeWork(w.id)}>
                  {isPt ? "Retomar" : "Resume"} · {formatMoney(w.resumeCost)}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Impeachment process */}
      {impeach && impeach.phase !== "closed" && (
        <div className="mt-3 rounded border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertOctagon className="h-4 w-4" />
            {isPt
              ? impeach.phase === "commission"
                ? "Comissão processante instalada"
                : "Plenário: votação de cassação"
              : impeach.phase === "commission"
                ? "Impeachment commission open"
                : "Plenary: impeachment vote"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {isPt ? "Acusações" : "Charges"}:
            <ul className="mt-0.5 list-inside list-disc">
              {(isPt ? impeach.chargesPt : impeach.chargesEn).map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-muted-foreground">{isPt ? "Votos pela cassação" : "Yes votes"}</div>
              <div className="font-semibold text-destructive">{impeach.projectedYes} / {totalSeats}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{isPt ? "Limite (2/3)" : "Threshold (2/3)"}</div>
              <div className="font-semibold">{twoThirds}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {isPt ? "Próximo passo em" : "Next step in"} <b className="text-foreground">{impeach.monthsUntilNextStep}</b> {isPt ? "meses" : "months"}
          </div>
          <Button size="sm" variant="destructive" className="mt-2 w-full"
            disabled={state.treasury < 500_000}
            onClick={actions.defendMandate}>
            {isPt ? "Defender mandato" : "Defend mandate"} · {formatMoney(500_000)} · 20 CP
          </Button>
        </div>
      )}

      {impeach?.verdict && (
        <div className={`mt-3 rounded p-2 text-[11px] ${impeach.verdict === "removed" ? "bg-destructive/20 text-destructive" : "bg-success/20"}`}>
          {impeach.verdict === "removed"
            ? (isPt ? "Mandato CASSADO pela Câmara." : "Mandate REMOVED by Council.")
            : (isPt ? "Prefeito(a) absolvido(a)." : "Mayor acquitted.")}
        </div>
      )}
    </Card>
  );
}

function RiskMeter({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <div className="rounded border border-border/60 p-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 font-medium">{icon}{label}</span>
        <span className="tabular-nums text-muted-foreground">{pct}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
        <div className={`h-full ${riskTone(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

export const OversightPanel = /*#__PURE__*/ memo(OversightPanelImpl);
