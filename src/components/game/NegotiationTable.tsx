import { useState, useMemo, memo } from "react";
import type { GameState } from "@/game/types";
import type { PartyId } from "@/game/politics";
import { pendingBills, polExt } from "@/game/legislature";
import {
  neg, ministryLabel, pledgedSeats, isMinistryCeded,
  type MinistryId, type Vereador,
} from "@/game/negotiation";
import { TOTAL_SEATS } from "@/game/politics";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Handshake, Building2, Flame, Gavel, AlertTriangle, X } from "lucide-react";

interface Props {
  state: GameState;
  actions: {
    emenda: (billId: string, vereadorId: string, amount: number) => void;
    cedeMinistry: (ministry: MinistryId, party: PartyId) => void;
    revokeMinistry: (ministry: MinistryId) => void;
    investigateCPI: () => void;
  };
}

const MINISTRIES: MinistryId[] = ["transport", "housing", "health", "education", "works", "environment"];
const fmt = (n: number) => n >= 1_000_000 ? `R$ ${(n / 1_000_000).toFixed(1)}M` : `R$ ${(n / 1000).toFixed(0)}k`;

function NegotiationTableImpl({ state, actions }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const pt = state.lang === "pt";

  const n = neg(state);
  const pol = polExt(state);
  const bills = pendingBills(state);
  const activeCpi = n.cpi.active;

  const currentBillId = selectedBill ?? bills[0]?.id ?? null;
  const currentBill = bills.find(b => b.id === currentBillId);

  const yesFromPledges = currentBillId ? pledgedSeats(state, currentBillId) : 0;
  const majorityAt = Math.floor(TOTAL_SEATS / 2) + 1;

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-4 right-4 z-40 rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-2 hover:scale-105 transition ${
          activeCpi
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : bills.length > 0
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
        }`}
        aria-label={pt ? "Mesa de Negociação" : "Bargain Table"}
      >
        {activeCpi ? <AlertTriangle className="w-5 h-5" /> : <Handshake className="w-5 h-5" />}
        <span className="text-sm font-semibold">
          {activeCpi ? (pt ? "CPI ATIVA" : "INQUIRY") : (pt ? "Mesa" : "Bargain")}
        </span>
        {bills.length > 0 && !activeCpi && (
          <span className="ml-1 bg-background text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {bills.length}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              {pt ? "Mesa de Negociação — Câmara Municipal" : "Bargain Table — City Council"}
            </DialogTitle>
          </DialogHeader>

          {/* CPI banner */}
          {activeCpi && (
            <Card className="p-3 border-2 border-destructive bg-destructive/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <div className="flex-1">
                  <div className="font-bold text-destructive text-sm">
                    {pt ? "CPI EM CURSO" : "INQUIRY ONGOING"} — {pt ? n.cpi.reasonPt : n.cpi.reasonEn}
                  </div>
                  <div className="text-xs opacity-80">
                    {pt ? "Progresso do relatório" : "Report progress"}: {Math.round(n.cpi.progress)}%
                    {" · "}
                    {pt ? "Investimentos discricionários congelados" : "Discretionary capex frozen"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => actions.investigateCPI()}
                  disabled={pol.politicalCapital < 12 || state.treasury < 300_000}
                >
                  {pt ? "Defender (12 CP + R$ 300k)" : "Defend (12 PC + R$ 300k)"}
                </Button>
              </div>
              <div className="w-full h-2 bg-destructive/20 rounded overflow-hidden">
                <div
                  className="h-full bg-destructive transition-all"
                  style={{ width: `${n.cpi.progress}%` }}
                />
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1">
            {/* Left column: bills + vereadores */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide opacity-70">
                {pt ? "Projetos pendentes" : "Pending bills"}
              </div>
              {bills.length === 0 && (
                <Card className="p-3 text-xs text-center opacity-60">
                  {pt ? "Nenhum projeto na pauta." : "No bills on the agenda."}
                </Card>
              )}
              {bills.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBill(b.id)}
                  className={`w-full text-left p-2 rounded border transition ${
                    currentBillId === b.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="text-xs font-semibold">{b.titleKey.split("||")[pt ? 0 : 1]}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">
                    {pt ? "Votos garantidos" : "Pledged votes"}:{" "}
                    <span className="font-bold text-primary">
                      {pledgedSeats(state, b.id)}/{majorityAt}
                    </span>
                  </div>
                </button>
              ))}

              {currentBill && (
                <>
                  <div className="text-xs font-bold uppercase tracking-wide opacity-70 mt-3">
                    {pt ? "Vereadores" : "Councillors"}
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {n.vereadores.map(v => (
                      <VereadorRow
                        key={v.id}
                        v={v}
                        state={state}
                        billId={currentBill.id}
                        onOffer={(amount) => actions.emenda(currentBill.id, v.id, amount)}
                        pt={pt}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right column: ministries + districts */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide opacity-70">
                {pt ? "Loteamento de secretarias" : "Ministry patronage"}
              </div>
              {MINISTRIES.map(m => {
                const c = isMinistryCeded(state, m);
                const label = ministryLabel(m);
                return (
                  <div key={m} className="p-2 border rounded flex items-center gap-2 text-xs">
                    <Building2 className="w-4 h-4 opacity-60" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{pt ? label.pt : label.en}</div>
                      {c ? (
                        <div className="text-[10px] text-destructive">
                          {pt ? "Cedida a" : "Held by"} {c.party} · −{Math.round(c.efficiencyPenalty * 100)}% ef.
                        </div>
                      ) : (
                        <div className="text-[10px] opacity-60">
                          {pt ? "Comando técnico" : "Technical command"}
                        </div>
                      )}
                    </div>
                    {c ? (
                      <Button size="sm" variant="outline" className="h-6 text-[10px]"
                        onClick={() => actions.revokeMinistry(m)}>
                        <X className="w-3 h-3" />
                      </Button>
                    ) : (
                      <MinistryOfferPicker
                        parties={pol.council.parties.map(p => p.id)}
                        onPick={(party) => actions.cedeMinistry(m, party)}
                        pt={pt}
                      />
                    )}
                  </div>
                );
              })}

              <div className="text-xs font-bold uppercase tracking-wide opacity-70 mt-3">
                {pt ? "Satisfação por distrito" : "District satisfaction"}
              </div>
              {n.districts.map(d => (
                <div key={d.id} className="p-1.5 border rounded">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold">{pt ? d.namePt : d.nameEn}</span>
                    <span className={d.satisfaction < 40 ? "text-destructive" : d.satisfaction > 65 ? "text-success" : ""}>
                      {d.satisfaction}%
                    </span>
                  </div>
                  <div className="w-full h-1 bg-muted rounded mt-1 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        d.satisfaction < 40 ? "bg-destructive"
                        : d.satisfaction > 65 ? "bg-success" : "bg-primary"
                      }`}
                      style={{ width: `${d.satisfaction}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {currentBill && (
            <div className="pt-2 border-t text-xs flex items-center justify-between">
              <span className="opacity-70">
                {pt ? "Total pledged" : "Total pledged"}: {yesFromPledges}/{TOTAL_SEATS}
              </span>
              <span className={yesFromPledges >= majorityAt ? "text-success font-bold" : "text-warning"}>
                {yesFromPledges >= majorityAt
                  ? (pt ? "✓ Maioria garantida" : "✓ Majority secured")
                  : (pt ? `Faltam ${majorityAt - yesFromPledges} votos` : `${majorityAt - yesFromPledges} votes short`)}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------ Vereador row ------------ */

function VereadorRow({
  v, state, billId, onOffer, pt,
}: { v: Vereador; state: GameState; billId: string; onOffer: (n: number) => void; pt: boolean }) {
  const n = neg(state);
  const pledged = n.pledges.some(p => p.billId === billId && p.vereadorId === v.id);
  const d = n.districts.find(x => x.id === v.district)!;
  const suggested = Math.round(v.emendaPrice * (v.opposition ? 1.4 : 1.0) * (1 - (v.loyalty - 50) / 300) / 50_000) * 50_000;
  const canAfford = state.treasury >= suggested;

  const archIcon = v.archetype === "fireband" ? <Flame className="w-3 h-3" /> : null;

  return (
    <div className={`p-2 border rounded flex items-center gap-2 text-[11px] ${
      pledged ? "bg-success/10 border-success/50" : v.opposition ? "border-destructive/40" : ""
    }`}>
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
        style={{ background: v.opposition ? "hsl(0 60% 45%)" : "hsl(210 60% 45%)" }}
      >
        {v.namePt.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 font-semibold truncate">
          {pt ? v.namePt : v.nameEn} {archIcon}
        </div>
        <div className="text-[10px] opacity-70 truncate">
          {v.party.toUpperCase()} · {pt ? d.namePt : d.nameEn} · {pt ? "lealdade" : "loyalty"} {v.loyalty}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] opacity-60">{v.seats} {pt ? "cad." : "seats"}</div>
        {pledged ? (
          <span className="text-[10px] text-success font-bold">✓ {pt ? "Voto" : "Voted"}</span>
        ) : (
          <Button
            size="sm" variant="outline" className="h-6 text-[10px] mt-0.5"
            disabled={!canAfford}
            onClick={() => onOffer(suggested)}
          >
            {fmt(suggested)}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------ Ministry party picker ------------ */

function MinistryOfferPicker({
  parties, onPick, pt,
}: { parties: PartyId[]; onPick: (p: PartyId) => void; pt: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setOpen(v => !v)}>
        {pt ? "Ceder" : "Cede"}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-popover border rounded shadow-lg p-1 min-w-[100px]">
          {parties.map(p => (
            <button
              key={p}
              className="w-full text-left text-[10px] px-2 py-1 hover:bg-accent rounded"
              onClick={() => { onPick(p); setOpen(false); }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const NegotiationTable = /*#__PURE__*/ memo(NegotiationTableImpl);
