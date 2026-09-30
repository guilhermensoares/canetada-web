/**
 * BiddingPanel.tsx — Painel do Modo Prefeito.
 *
 * Duas seções:
 *   1. Nova Obra — jogador escolhe categoria + distrito e abre licitação.
 *   2. Licitações abertas — 3 propostas, jogador escolhe uma (award) ou cancela.
 *   3. Obras em andamento — barra de progresso por obra.
 *   4. Histórico — últimas entregas.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/game/logic";
import type { GameState, Lang } from "@/game/types";
import {
  CATEGORY_SPEC,
  listDistrictKinds,
  type WorkCategory,
  type Proposal,
} from "@/game/bidding";
import type { DistrictKind } from "@/game/districts";
import { Hammer, X, Check, AlertTriangle, ShieldAlert } from "lucide-react";

const CATEGORY_ORDER: WorkCategory[] = ["health", "education", "mobility", "housing", "infra", "civic"];

const DISTRICT_LABEL_PT: Record<DistrictKind, string> = {
  centro: "Centro", comercial: "Comercial", residencial: "Residencial", periferia: "Periferia", verde: "Área verde",
};
const DISTRICT_LABEL_EN: Record<DistrictKind, string> = {
  centro: "Downtown", comercial: "Commercial", residencial: "Residential", periferia: "Periphery", verde: "Green area",
};

export interface BiddingActions {
  open: (category: WorkCategory, district: DistrictKind) => void;
  award: (bidId: string, proposalId: string) => void;
  cancel: (bidId: string) => void;
}

export function BiddingPanel({ state, actions }: { state: GameState; actions: BiddingActions }) {
  const lang: Lang = state.lang;
  const [cat, setCat] = useState<WorkCategory>("health");
  const districts = useMemo(() => listDistrictKinds(state), [state.seed, state.cityName, state.mapSize]);
  const [dist, setDist] = useState<DistrictKind>(districts[0] ?? "centro");
  const bd = state.bidding ?? { open: [], works: [], history: [] };
  const districtLbl = lang === "pt" ? DISTRICT_LABEL_PT : DISTRICT_LABEL_EN;

  return (
    <div className="flex flex-col gap-3">
      {/* Abertura de nova licitação */}
      <Card className="border-border/60 bg-panel/70 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Hammer className="h-4 w-4 text-primary" />
          {lang === "pt" ? "Nova Obra Pública" : "New Public Work"}
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          {CATEGORY_ORDER.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`rounded border px-2 py-1 text-[11px] font-medium transition ${cat === c ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-background/40 text-muted-foreground hover:border-border"}`}
            >
              {lang === "pt" ? CATEGORY_SPEC[c].labelPt : CATEGORY_SPEC[c].labelEn}
            </button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          {districts.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDist(d)}
              className={`rounded border px-2 py-1 text-[11px] transition ${dist === d ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-background/40 text-muted-foreground hover:border-border"}`}
            >
              {districtLbl[d]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            {lang === "pt" ? "Base:" : "Base:"} {formatMoney(CATEGORY_SPEC[cat].basePrice)} · {CATEGORY_SPEC[cat].baseMonths} {lang === "pt" ? "meses" : "months"}
          </span>
          <Button size="sm" onClick={() => actions.open(cat, dist)}>
            {lang === "pt" ? "Abrir Licitação" : "Open Bidding"}
          </Button>
        </div>
      </Card>

      {/* Licitações abertas */}
      {bd.open.length > 0 && (
        <Card className="border-border/60 bg-panel/70 p-3">
          <div className="mb-2 text-sm font-semibold">
            {lang === "pt" ? "Licitações Abertas" : "Open Biddings"}{" "}
            <Badge variant="secondary" className="ml-1">{bd.open.length}</Badge>
          </div>
          <div className="flex flex-col gap-3">
            {bd.open.map(bid => (
              <div key={bid.id} className="rounded border border-border/50 bg-background/40 p-2">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <div className="font-medium">
                    {lang === "pt" ? CATEGORY_SPEC[bid.category].labelPt : CATEGORY_SPEC[bid.category].labelEn}
                    <span className="ml-2 text-muted-foreground">· {districtLbl[bid.districtKind]}</span>
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => actions.cancel(bid.id)}
                    title={lang === "pt" ? "Cancelar" : "Cancel"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {bid.proposals.map(p => (
                    <ProposalCard
                      key={p.id}
                      lang={lang}
                      proposal={p}
                      onAward={() => actions.award(bid.id, p.id)}
                      canAfford={state.treasury >= p.price * 0.3}
                    />
                  ))}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {lang === "pt" ? "Sinal 30% no ato. Restante distribuído no cronograma." : "30% upfront, remainder over schedule."}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Obras em andamento */}
      {bd.works.length > 0 && (
        <Card className="border-border/60 bg-panel/70 p-3">
          <div className="mb-2 text-sm font-semibold">
            {lang === "pt" ? "Obras em Andamento" : "Works in Progress"}{" "}
            <Badge variant="secondary" className="ml-1">{bd.works.length}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {bd.works.map(w => {
              const pct = Math.min(100, Math.round((w.monthsElapsed / Math.max(1, w.monthsTotal)) * 100));
              return (
                <div key={w.id} className="rounded border border-border/50 bg-background/40 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-medium">
                      {w.company}
                      {w.status === "scandal" && (
                        <ShieldAlert className="ml-1 inline h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {w.monthsElapsed}/{w.monthsTotal} {lang === "pt" ? "meses" : "mo"}
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{lang === "pt" ? CATEGORY_SPEC[w.category].labelPt : CATEGORY_SPEC[w.category].labelEn} · {districtLbl[w.districtKind]}</span>
                    <span>{formatMoney(w.totalPrice)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Histórico */}
      {bd.history.length > 0 && (
        <Card className="border-border/60 bg-panel/70 p-3">
          <div className="mb-2 text-sm font-semibold">
            {lang === "pt" ? "Últimas Entregas" : "Recent Deliveries"}
          </div>
          <div className="flex flex-col gap-1 text-xs">
            {bd.history.slice(0, 8).map(h => (
              <div key={h.id} className="flex items-center justify-between rounded border border-border/40 bg-background/30 px-2 py-1">
                <span className="truncate">
                  {h.company} · {lang === "pt" ? CATEGORY_SPEC[h.category].labelPt : CATEGORY_SPEC[h.category].labelEn}
                </span>
                <span className="ml-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  {h.finishedAt.month}/{h.finishedAt.year}
                  {h.outcome === "scandal" && <ShieldAlert className="h-3 w-3 text-destructive" />}
                  {h.outcome === "delayed" && <AlertTriangle className="h-3 w-3 text-warning" />}
                  {h.outcome === "ok" && <Check className="h-3 w-3 text-success" />}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ProposalCard({
  lang, proposal, onAward, canAfford,
}: { lang: Lang; proposal: Proposal; onAward: () => void; canAfford: boolean }) {
  const q = "★".repeat(proposal.quality) + "☆".repeat(5 - proposal.quality);
  const tag = (v: number) =>
    v > 0.66 ? "text-destructive" : v > 0.33 ? "text-warning" : "text-success";
  return (
    <div className="flex flex-col gap-1 rounded border border-border/40 bg-background/60 p-2 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{proposal.company}</span>
        <span className="text-amber-400">{q}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{lang === "pt" ? "Preço" : "Price"}</span>
        <span className="font-mono">{formatMoney(proposal.price)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{lang === "pt" ? "Prazo" : "Term"}</span>
        <span className="font-mono">{proposal.months} {lang === "pt" ? "meses" : "mo"}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{lang === "pt" ? "Corrupção" : "Corruption"}</span>
        <span className={`font-mono ${tag(proposal.corruptionRisk)}`}>{Math.round(proposal.corruptionRisk * 100)}%</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{lang === "pt" ? "Atraso" : "Delay"}</span>
        <span className={`font-mono ${tag(proposal.delayRisk)}`}>{Math.round(proposal.delayRisk * 100)}%</span>
      </div>
      {proposal.politicalTie && (
        <div className="text-[10px] italic text-muted-foreground">
          {lang === "pt" ? "Vínculo:" : "Ties:"} {proposal.politicalTie}
        </div>
      )}
      <Button
        size="sm"
        variant={canAfford ? "default" : "outline"}
        disabled={!canAfford}
        onClick={onAward}
        className="mt-1 h-7 text-[11px]"
      >
        {lang === "pt" ? "Adjudicar" : "Award"}
      </Button>
    </div>
  );
}
