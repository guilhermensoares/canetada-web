import { useState, memo } from "react";
import type { GameState } from "@/game/types";
import type { DebateTopic, DebateStrategy } from "@/game/campaign";
import { availablePromises } from "@/game/campaign";
import { PARTIES_TEMPLATE } from "@/game/politics";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tv, Vote, Handshake, MessageSquare, Megaphone, Sparkles, Sword, Shield, Zap, ArrowLeftRight } from "lucide-react";

interface Actions {
  acceptCoalition: (id: string) => void;
  rejectCoalition: (id: string) => void;
  promise: (topic: DebateTopic) => void;
  setTv: (share: number) => void;
  startDebate: (topic: DebateTopic) => void;
  debate: (strategy: DebateStrategy) => void;
}

const TOPICS: DebateTopic[] = ["economy", "security", "health", "education", "transport", "housing", "corruption", "environment"];
const TOPIC_LABEL: Record<DebateTopic, { pt: string; en: string }> = {
  economy: { pt: "Economia", en: "Economy" },
  security: { pt: "Segurança", en: "Security" },
  health: { pt: "Saúde", en: "Health" },
  education: { pt: "Educação", en: "Education" },
  transport: { pt: "Transporte", en: "Transport" },
  housing: { pt: "Habitação", en: "Housing" },
  corruption: { pt: "Corrupção", en: "Corruption" },
  environment: { pt: "Meio Amb.", en: "Environment" },
};

const STRAT_META: Record<DebateStrategy, { pt: string; en: string; icon: React.ReactNode }> = {
  attack:    { pt: "Ataque",   en: "Attack",   icon: <Sword className="w-3 h-3" /> },
  defend:    { pt: "Defesa",   en: "Defend",   icon: <Shield className="w-3 h-3" /> },
  pivot:     { pt: "Desviar",  en: "Pivot",    icon: <ArrowLeftRight className="w-3 h-3" /> },
  populist:  { pt: "Populismo", en: "Populist", icon: <Zap className="w-3 h-3" /> },
  technical: { pt: "Técnico",  en: "Technical", icon: <Sparkles className="w-3 h-3" /> },
};

const fmt = (n: number) => n >= 1e6 ? `R$ ${(n/1e6).toFixed(1)}M/mês` : `R$ ${(n/1000).toFixed(0)}k/mês`;

function CampaignPanelImpl({ state, actions }: { state: GameState; actions: Actions }) {
  const [open, setOpen] = useState(false);
  const [debateTopic, setDebateTopic] = useState<DebateTopic>("economy");
  const pt = state.lang === "pt";
  const c = state.campaign;
  if (!c) return null;

  const inCampaign = c.active;
  const monthsLeft = c.monthsUntilElection;
  const label = inCampaign
    ? (pt ? `CAMPANHA · ${monthsLeft}m` : `CAMPAIGN · ${monthsLeft}m`)
    : (pt ? `Eleição em ${monthsLeft}m` : `Election in ${monthsLeft}m`);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-4 right-32 z-40 rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-2 hover:scale-105 transition ${
          inCampaign
            ? "bg-primary text-primary-foreground animate-pulse"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Vote className="w-5 h-5" />
        <span className="text-sm font-semibold">{label}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[88vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5" /> {pt ? "Campanha Eleitoral" : "Election Campaign"}
            </DialogTitle>
          </DialogHeader>

          {!inCampaign && (
            <Card className="p-4 text-center text-sm opacity-70">
              {pt
                ? `A campanha oficial começa 6 meses antes do fim do mandato (faltam ${monthsLeft} meses). Prepare-se cuidando da aprovação e da lealdade partidária.`
                : `Official campaign starts 6 months before term end (${monthsLeft} months left). Prepare by tending approval and party loyalty.`}
            </Card>
          )}

          {inCampaign && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 overflow-y-auto pr-1">
              {/* Column 1: Polls + TV + Loyalty */}
              <div className="space-y-3">
                <Card className="p-3">
                  <div className="text-xs font-bold uppercase mb-2 opacity-70">{pt ? "Pesquisa" : "Poll"}</div>
                  <PollRow label={pt ? "Prefeito" : "Mayor"} value={c.polls.mayor} color="hsl(var(--primary))" />
                  {c.opponents.map(o => (
                    <PollRow
                      key={o.id}
                      label={pt ? o.namePt : o.nameEn}
                      value={c.polls.opponents[o.id] ?? 0}
                      color="hsl(0 60% 50%)"
                    />
                  ))}
                  <PollRow label={pt ? "Indecisos" : "Undecided"} value={Math.round(c.polls.undecided)} color="hsl(var(--muted-foreground))" />
                </Card>

                <Card className="p-3">
                  <div className="text-xs font-bold uppercase mb-2 opacity-70 flex items-center gap-1">
                    <Tv className="w-3 h-3" /> {pt ? "Horário Eleitoral" : "Air Time"}
                  </div>
                  <div className="text-[11px] opacity-80 mb-1">
                    {pt ? "Seu tempo" : "Your time"}: <b>{Math.round(c.tvTime.mayor * 100)}%</b>
                  </div>
                  <Slider
                    value={[c.tvTime.mayor * 100]}
                    min={5} max={90} step={5}
                    onValueChange={v => actions.setTv(v[0] / 100)}
                  />
                  <div className="text-[10px] mt-1 opacity-60">
                    {pt ? "Mais tempo = maior projeção, mas alia menos partidos." : "More time = better exposure but fewer alliances."}
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="text-xs font-bold uppercase mb-2 opacity-70">
                    {pt ? "Insatisfação popular" : "Public fatigue"}: {Math.round(c.publicFatigue)}%
                  </div>
                  <Progress value={c.publicFatigue} className="h-2" />
                  <div className="text-[10px] mt-1 opacity-60">
                    {pt ? "Alta libera alianças inusitadas." : "High unlocks unusual alliances."}
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="text-xs font-bold uppercase mb-2 opacity-70">
                    {pt ? "Lealdade Partidária" : "Party Loyalty"}
                  </div>
                  {PARTIES_TEMPLATE.map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-[11px] mb-1">
                      <span className="w-16 uppercase font-mono">{p.id}</span>
                      <Progress value={c.partyLoyalty[p.id]} className="h-1.5 flex-1" />
                      <span className="w-8 text-right">{Math.round(c.partyLoyalty[p.id])}</span>
                    </div>
                  ))}
                </Card>
              </div>

              {/* Column 2: Coalitions + Promises */}
              <div className="space-y-3">
                <Card className="p-3">
                  <div className="text-xs font-bold uppercase mb-2 opacity-70 flex items-center gap-1">
                    <Handshake className="w-3 h-3" /> {pt ? "Ofertas de Coligação" : "Coalition Offers"}
                  </div>
                  {c.coalitionOffers.filter(o => o.status === "pending").length === 0 && (
                    <div className="text-[11px] opacity-60 text-center py-2">
                      {pt ? "Nenhuma oferta pendente." : "No pending offers."}
                    </div>
                  )}
                  {c.coalitionOffers.filter(o => o.status === "pending").map(o => (
                    <div key={o.id} className={`p-2 mb-2 rounded border ${o.unusual ? "border-warning bg-warning/10" : "border-border"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs uppercase">{o.party}</span>
                        {o.unusual && <span className="text-[9px] bg-warning text-warning-foreground px-1 rounded">{pt ? "INUSITADA" : "UNUSUAL"}</span>}
                      </div>
                      <div className="text-[10px] opacity-80 mb-2">{pt ? o.demandPt : o.demandEn}</div>
                      <div className="flex items-center justify-between text-[10px] mb-2">
                        <span>{pt ? "Custo" : "Cost"}: <b>{o.pcCost} CP</b></span>
                        <span>TV: <b>+{Math.round(o.tvShare * 100)}%</b></span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => actions.acceptCoalition(o.id)}>
                          {pt ? "Aceitar" : "Accept"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => actions.rejectCoalition(o.id)}>
                          {pt ? "Recusar" : "Reject"}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {c.acceptedCoalition.length > 0 && (
                    <div className="text-[10px] pt-1 border-t">
                      {pt ? "Coligados" : "Allies"}: <b>{c.acceptedCoalition.join(", ").toUpperCase()}</b>
                    </div>
                  )}
                </Card>

                <Card className="p-3">
                  <div className="text-xs font-bold uppercase mb-2 opacity-70">
                    {pt ? "Promessas de Campanha" : "Campaign Promises"}
                  </div>
                  <div className="text-[10px] opacity-70 mb-2">
                    {pt ? "Custo mensal comprometido para o próximo mandato" : "Committed monthly cost next term"}:{" "}
                    <b className="text-warning">{fmt(c.committedMonthlyCost)}</b>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {availablePromises(state).map(p => (
                      <button
                        key={p.topic}
                        onClick={() => actions.promise(p.topic)}
                        className="w-full text-left p-1.5 rounded border hover:bg-accent text-[10px]"
                      >
                        <div className="font-semibold">{pt ? p.textPt : p.textEn}</div>
                        <div className="opacity-60">
                          +{p.pollBoost}% {pt ? "pesq." : "poll"} · {fmt(p.monthlyCost)} · {pt ? "quebra" : "breach"} −{p.breachPenalty}
                        </div>
                      </button>
                    ))}
                  </div>
                  {c.promises.length > 0 && (
                    <div className="mt-2 pt-2 border-t text-[10px]">
                      <div className="opacity-70 mb-1">{pt ? "Já prometidas" : "Made"}:</div>
                      {c.promises.map(p => (
                        <div key={p.id} className="text-success">✓ {pt ? p.textPt : p.textEn}</div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Column 3: Debate */}
              <div className="space-y-3">
                <Card className="p-3">
                  <div className="text-xs font-bold uppercase mb-2 opacity-70 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> {pt ? "Debate" : "Debate"}
                  </div>

                  {!c.debate && (
                    <>
                      <div className="text-[11px] mb-2">{pt ? "Escolha o tema:" : "Pick the topic:"}</div>
                      <div className="grid grid-cols-2 gap-1 mb-2">
                        {TOPICS.map(t => (
                          <Button
                            key={t}
                            size="sm" variant={debateTopic === t ? "default" : "outline"}
                            className="h-6 text-[10px]"
                            onClick={() => setDebateTopic(t)}
                          >
                            {pt ? TOPIC_LABEL[t].pt : TOPIC_LABEL[t].en}
                          </Button>
                        ))}
                      </div>
                      <Button size="sm" className="w-full h-7 text-xs" onClick={() => actions.startDebate(debateTopic)}>
                        {pt ? "Iniciar Debate" : "Start Debate"}
                      </Button>
                    </>
                  )}

                  {c.debate && (
                    <>
                      <div className="text-[10px] opacity-70 mb-1">
                        {pt ? "Tema" : "Topic"}: <b>{pt ? TOPIC_LABEL[c.debate.topic].pt : TOPIC_LABEL[c.debate.topic].en}</b>
                        {" · "} {pt ? "Rodada" : "Round"} {c.debate.round + 1}/{c.debate.maxRounds}
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1 mb-2 border rounded p-1.5 bg-muted/20">
                        {c.debate.exchanges.length === 0 && (
                          <div className="text-[10px] opacity-50 italic text-center py-2">
                            {pt ? "Escolha uma estratégia para falar." : "Pick a strategy to speak."}
                          </div>
                        )}
                        {c.debate.exchanges.map((e, i) => (
                          <div key={i} className={`text-[10px] ${e.speaker === "mayor" ? "text-primary" : ""}`}>
                            <span className="opacity-60">R{e.round}</span>{" "}
                            <span className="inline-flex items-center gap-0.5 opacity-70">
                              {STRAT_META[e.strategy].icon}
                            </span>{" "}
                            {pt ? e.linePt : e.lineEn}{" "}
                            <span className={`font-mono ${e.swing > 0 ? "text-success" : "text-destructive"}`}>
                              {e.swing > 0 ? "+" : ""}{e.swing.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] mb-1 opacity-70">
                        {pt ? "Pontuação: você" : "Score: you"} <b>{c.debate.mayorScore.toFixed(1)}</b>
                        {" · "}
                        {pt ? "opos." : "opp."} <b>{Math.max(...Object.values(c.debate.scores)).toFixed(1)}</b>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {(Object.keys(STRAT_META) as DebateStrategy[]).map(s => (
                          <Button
                            key={s} size="sm" variant="outline"
                            className="h-7 text-[9px] flex flex-col gap-0 p-1"
                            onClick={() => actions.debate(s)}
                          >
                            {STRAT_META[s].icon}
                            <span>{pt ? STRAT_META[s].pt : STRAT_META[s].en}</span>
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                </Card>

                {c.debateHistory.length > 0 && (
                  <Card className="p-2 text-[10px]">
                    <div className="opacity-70 mb-1">{pt ? "Debates anteriores" : "Past debates"}:</div>
                    {c.debateHistory.slice(-3).map((d, i) => {
                      const oppMax = Math.max(...Object.values(d.scores));
                      const won = d.mayorScore > oppMax;
                      return (
                        <div key={i} className={won ? "text-success" : "text-destructive"}>
                          {won ? "✓" : "✗"} {pt ? TOPIC_LABEL[d.topic].pt : TOPIC_LABEL[d.topic].en} {d.mayorScore.toFixed(1)} vs {oppMax.toFixed(1)}
                        </div>
                      );
                    })}
                  </Card>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PollRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="truncate">{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export const CampaignPanel = /*#__PURE__*/ memo(CampaignPanelImpl);
