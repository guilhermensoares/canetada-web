import { memo } from "react";
import type { GameState } from "@/game/types";
import type { LandConflictState, Occupation } from "@/game/landConflict";
import { formatMoney } from "@/game/logic";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, Handshake, Siren, TrendingUp } from "lucide-react";

interface Props {
  state: GameState;
  actions: {
    negotiate: (id: string) => void;
    evict: (id: string) => void;
  };
}

function isPt(s: GameState) { return s.lang === "pt"; }

function negotiateCost(o: Occupation): number {
  const perFamily = o.ownerType === "public" ? 3_800 : 6_400;
  return Math.round(perFamily * o.families + 80_000);
}
function evictCost(o: Occupation): number {
  return Math.round(45_000 + o.families * 220);
}

function LandConflictPanelImpl({ state, actions }: Props) {
  const L = (state as GameState & { landConflict?: LandConflictState }).landConflict;
  if (!L) return null;
  const pt = isPt(state);

  const active = L.occupations.filter((o) => o.status === "active");
  const resolved = L.occupations.filter((o) => o.status !== "active").slice(-3).reverse();
  const openWaves = L.waves.filter((w) => !w.resolved);

  return (
    <Card className="mt-3 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Home className="h-4 w-4 text-primary" />
            {pt ? "Conflito Fundiário & Gentrificação" : "Land Conflict & Gentrification"}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {pt
              ? "Ocupações no centro e ondas de valorização em torno de grandes obras."
              : "Downtown occupations and land-value waves around major public works."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
          <span>{pt ? "Ocupações" : "Occupations"}: <b className="text-foreground">{L.stats.spawnedTotal}</b></span>
          <span>{pt ? "Negociadas" : "Negotiated"}: <b className="text-foreground">{L.stats.negotiated}</b></span>
          <span>{pt ? "Reintegradas" : "Evicted"}: <b className="text-foreground">{L.stats.evicted}</b></span>
          <span>{pt ? "Deslocados" : "Displaced"}: <b className="text-foreground">{L.stats.familiesDisplacedByWaves.toLocaleString(pt ? "pt-BR" : "en-US")}</b></span>
        </div>
      </div>

      {/* Active occupations */}
      {active.length === 0 ? (
        <div className="rounded border border-border/60 bg-muted/30 p-2 text-[11px] text-muted-foreground">
          {pt ? "Nenhuma ocupação ativa no momento." : "No active occupations right now."}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {pt ? "Ocupações ativas" : "Active occupations"}
          </div>
          {active.map((o) => {
            const negCost = negotiateCost(o);
            const evCost = evictCost(o);
            return (
              <div key={o.id} className="rounded border border-warning/40 bg-warning/5 p-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {pt
                        ? `${o.families} famílias · imóvel ${o.ownerType === "public" ? "público" : "privado"}`
                        : `${o.families} families · ${o.ownerType} building`}
                    </div>
                    <div className="text-muted-foreground">
                      {pt ? "Há" : "For"} {o.ageMonths} {pt ? "meses" : "months"}
                      {o.ownerType === "private" && o.ageMonths >= 6 && (
                        <> · <span className="text-destructive">{pt ? "risco MP" : "MP risk"}</span></>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px]">
                    {pt ? "Ativa" : "Active"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary"
                    disabled={state.treasury < negCost}
                    onClick={() => actions.negotiate(o.id)}>
                    <Handshake className="mr-1 h-3.5 w-3.5" />
                    {pt ? "Negociar → habitação social" : "Negotiate → social housing"} · {formatMoney(negCost)}
                  </Button>
                  <Button size="sm" variant="destructive"
                    disabled={state.treasury < evCost}
                    onClick={() => actions.evict(o.id)}>
                    <Siren className="mr-1 h-3.5 w-3.5" />
                    {pt ? "Reintegração de posse" : "Police eviction"} · {formatMoney(evCost)}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {pt ? "Histórico recente" : "Recent history"}
          </div>
          {resolved.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-[10px]">
              <span>
                {o.families} {pt ? "famílias" : "families"} · {o.month}/{o.year}
              </span>
              <Badge variant={o.status === "negotiated" ? "secondary" : "destructive"} className="text-[9px]">
                {o.status === "negotiated"
                  ? pt ? "Negociada" : "Negotiated"
                  : o.status === "evicted"
                    ? pt ? "Reintegrada" : "Evicted"
                    : pt ? "Abandonada" : "Abandoned"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Displacement waves */}
      {openWaves.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {pt ? "Ondas de valorização em curso" : "Upcoming displacement waves"}
          </div>
          {openWaves.map((w) => (
            <div key={w.id} className="rounded border border-primary/30 bg-primary/5 p-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 font-medium">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  {pt ? w.triggerLabelPt : w.triggerLabelEn}
                </span>
                <Badge variant="outline" className="text-[9px]">
                  {w.monthsUntilPeak} {pt ? "meses ao pico" : "months to peak"}
                </Badge>
              </div>
              <div className="mt-1 text-muted-foreground">
                {pt ? "Alvo" : "Target"}: <b className="text-foreground">{w.stratum === "informal" ? (pt ? "informal" : "informal") : (pt ? "periferia" : "periphery")}</b>
                {" · "}
                {pt ? "Aluguel" : "Rent"}: +{w.rentSpikePct}%
                {" · "}
                {pt ? "Expulsão prevista" : "Projected displacement"}: {w.familiesDisplaced} {pt ? "famílias" : "families"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {pt ? "IPTU/ISS extra estimado no pico" : "Estimated tax catch-up at peak"}: {formatMoney(w.iptuBonus)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export const LandConflictPanel = /*#__PURE__*/ memo(LandConflictPanelImpl);
