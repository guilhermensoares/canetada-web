/**
 * CorruptionPanel — mecânicas ilícitas do gabinete.
 *
 * Divisão em três blocos:
 *  - "Rachadinha": cria/exonera cargos fantasmas em pastas com assessor.
 *  - "Empresa de fachada": aprova licitação superfaturada.
 *  - "Propina P-CENTRO": gasta do caixa 2 para governabilidade + bots.
 *
 * O painel exibe caixa 2, heat investigativo e denúncias formalizadas.
 */

import { useMemo, useState, memo } from "react";
import type { GameState } from "@/game/types";
import type { PortfolioId } from "@/game/advisors";
import { PORTFOLIO_LABEL } from "@/game/advisors";
import {
  canCreateGhost, canLaunchShell, canBribeCouncil, ensureCorruption,
} from "@/game/corruption";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatMoney } from "@/game/logic";

interface Props {
  state: GameState;
  actions: {
    ghost: (portfolio: PortfolioId) => void;
    removeGhost: (id: string) => void;
    shell: (portfolio: PortfolioId, baseValue: number, overpricePct: number) => void;
    bribe: (amount: number) => void;
    fundBots: (amount: number) => void;
  };
}

const PORTFOLIOS: PortfolioId[] = ["health", "works", "finance", "mobility", "articulation"];

function CorruptionPanelImpl({ state, actions }: Props) {
  // ensureCorruption is idempotent; guarantees c is present on legacy saves.
  ensureCorruption(state);
  const c = state.corruption!;
  const [shellPortfolio, setShellPortfolio] = useState<PortfolioId>("works");
  const [shellBase, setShellBase] = useState<number>(5_000_000);
  const [shellOver, setShellOver] = useState<number>(0.30);
  const [bribeAmt, setBribeAmt] = useState<number>(300_000);

  const heatColor = c.heat > 60 ? "bg-red-500" : c.heat > 30 ? "bg-amber-500" : "bg-emerald-500";

  const ghostRows = useMemo(() => (
    c.ghosts.map((g) => (
      <div key={g.id} className="flex items-center justify-between text-xs border-l-2 border-red-500/40 pl-2 py-1">
        <div>
          <div className="font-medium">{g.alias}</div>
          <div className="text-muted-foreground">{PORTFOLIO_LABEL[g.portfolio]} · {g.ageMonths}m · {formatMoney(g.monthly)}/mês</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => actions.removeGhost(g.id)}>Exonerar</Button>
      </div>
    ))
  ), [c.ghosts, actions]);

  return (
    <Card className="p-4 space-y-4 border-red-900/40">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            🕵️ Gabinete Paralelo
            {c.everExposed && <Badge variant="destructive" className="text-[10px]">JÁ EXPOSTO</Badge>}
          </div>
          <div className="text-[11px] text-muted-foreground">Ilícitos administrativos — off the record.</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase text-muted-foreground">Caixa 2</div>
          <div className="font-mono text-emerald-600 font-semibold">{formatMoney(c.slushFund)}</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[11px] mb-1">
          <span>Calor investigativo</span>
          <span>{c.heat.toFixed(0)}/100 · {c.denunciations} denúncia(s)</span>
        </div>
        <Progress value={c.heat} className={heatColor} />
      </div>

      {/* Rachadinha */}
      <div className="space-y-2">
        <div className="text-xs font-semibold">Cargos Fantasmas (rachadinha)</div>
        <div className="grid grid-cols-5 gap-1">
          {PORTFOLIOS.map((p) => {
            const chk = canCreateGhost(state, p);
            return (
              <Button
                key={p}
                size="sm"
                variant="outline"
                disabled={!chk.ok}
                title={chk.reason ?? "Nomear fantasma"}
                onClick={() => actions.ghost(p)}
                className="text-[10px] h-7"
              >
                +{PORTFOLIO_LABEL[p].slice(0, 5)}
              </Button>
            );
          })}
        </div>
        {c.ghosts.length > 0 && <div className="space-y-1">{ghostRows}</div>}
      </div>

      {/* Shell contract */}
      <div className="space-y-2 border-t border-border/40 pt-3">
        <div className="text-xs font-semibold">Empresa de Fachada (superfaturamento)</div>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="text-xs bg-background border border-border rounded px-2 h-8"
            value={shellPortfolio}
            onChange={(e) => setShellPortfolio(e.target.value as PortfolioId)}
          >
            {(["works", "finance", "mobility"] as PortfolioId[]).map((p) => (
              <option key={p} value={p}>{PORTFOLIO_LABEL[p]}</option>
            ))}
          </select>
          <Input
            type="number"
            className="h-8 text-xs"
            value={shellBase}
            step={500_000}
            min={500_000}
            onChange={(e) => setShellBase(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sobrepreço</span>
            <span>{Math.round(shellOver * 100)}%</span>
          </div>
          <Slider
            value={[shellOver * 100]}
            min={5} max={40} step={1}
            onValueChange={(v) => setShellOver(v[0] / 100)}
          />
        </div>
        <Button
          size="sm"
          variant="destructive"
          className="w-full"
          disabled={!canLaunchShell(state, shellPortfolio).ok || state.treasury < shellBase * (1 + shellOver)}
          title={canLaunchShell(state, shellPortfolio).reason}
          onClick={() => actions.shell(shellPortfolio, shellBase, shellOver)}
        >
          Direcionar licitação · paga {formatMoney(shellBase * (1 + shellOver))}
        </Button>
        {c.shells.length > 0 && (
          <div className="space-y-1 pt-1">
            {c.shells.map((sh) => (
              <div key={sh.id} className="text-[11px] border-l-2 border-amber-500/40 pl-2 py-1">
                <div className="font-medium">{sh.projectName}</div>
                <div className="text-muted-foreground">
                  +{Math.round(sh.overpricePct * 100)}% · slush {formatMoney(sh.slushPaid)} · {sh.monthsRemaining}m restantes
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bribes */}
      <div className="space-y-2 border-t border-border/40 pt-3">
        <div className="text-xs font-semibold">Compra de Governabilidade (P-CENTRO)</div>
        <Input
          type="number"
          className="h-8 text-xs"
          value={bribeAmt}
          step={100_000}
          min={200_000}
          onChange={(e) => setBribeAmt(Number(e.target.value) || 0)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!canBribeCouncil(state).ok || c.slushFund < bribeAmt}
            title={canBribeCouncil(state).reason}
            onClick={() => actions.bribe(bribeAmt)}
          >
            Propina vereadores
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={c.slushFund < Math.max(50_000, bribeAmt)}
            onClick={() => actions.fundBots(bribeAmt)}
          >
            Financiar bots
          </Button>
        </div>
        {c.bribes.length > 0 && (
          <div className="text-[10px] text-muted-foreground">
            Última: {formatMoney(c.bribes[c.bribes.length - 1].amount)} em {c.bribes[c.bribes.length - 1].month}/{c.bribes[c.bribes.length - 1].year}
          </div>
        )}
      </div>

      {c.events.length > 0 && (
        <div className="border-t border-border/40 pt-2">
          <div className="text-[10px] uppercase text-muted-foreground mb-1">Registro interno</div>
          <ul className="text-[11px] space-y-0.5 max-h-24 overflow-auto">
            {c.events.slice(0, 6).map((e, i) => <li key={i}>· {e}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

export const CorruptionPanel = /*#__PURE__*/ memo(CorruptionPanelImpl);
