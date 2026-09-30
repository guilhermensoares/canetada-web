import { memo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { t, type DictKey } from "@/game/i18n";
import type { GameState } from "@/game/types";
import type { GroupId, PartyId } from "@/game/politics";
import {
  coalitionSeats,
  coalitionStrength,
  hasMajority,
  coalitionAcceptanceOdds,
  INVITE_PC_COST,
} from "@/game/politics";
import { formatMoney } from "@/game/logic";
import { cn } from "@/lib/utils";

interface PoliticsPanelProps {
  state: GameState;
  onInvite: (id: PartyId) => void;
  onEject: (id: PartyId) => void;
  onRespondGroup: (id: GroupId, mode: "concede" | "confront") => void;
  onRequestTransfer: (kind: "state" | "federal") => void;
  onSignSister: () => void;
  onApplyGrant: () => void;
  onCampaign: (amount: number) => void;
  onAcceptDemand: () => void;
  onDeclineDemand: () => void;
}

function PoliticsPanelImpl(props: PoliticsPanelProps) {
  const { state, onInvite, onEject, onRespondGroup, onRequestTransfer,
    onSignSister, onApplyGrant, onCampaign, onAcceptDemand, onDeclineDemand } = props;
  const lang = state.lang;
  const p = state.politics;
  const seats = coalitionSeats(p);
  const strength = coalitionStrength(p);
  const majority = hasMajority(p);
  const yearsToElection = Math.max(
    0,
    p.election.termStartYear + p.election.termLengthYears - state.year,
  );

  return (
    <div className="rounded-lg border border-border/60 bg-panel/60 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
            {t(lang, "politicsTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(lang, "politicsHint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={majority ? "default" : "destructive"}>
            {t(lang, "council_coalitionSeats")}: {seats}/{p.council.totalSeats}
          </Badge>
          <Badge variant="secondary">
            {t(lang, "electionCountdown")}: {yearsToElection} {lang === "pt" ? "ano(s)" : "yr(s)"}
          </Badge>
          {p.election.campaignBudget > 0 && (
            <Badge variant="outline">
              {t(lang, "campaignSpend")}: {formatMoney(p.election.campaignBudget)}
            </Badge>
          )}
        </div>
      </div>

      {!majority && (
        <div className="mb-3 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t(lang, "noMajorityWarning")}
        </div>
      )}

      <Tabs defaultValue="council" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="council">{t(lang, "tab_council")}</TabsTrigger>
          <TabsTrigger value="groups">{t(lang, "tab_groups")}</TabsTrigger>
          <TabsTrigger value="intergov">{t(lang, "tab_intergov")}</TabsTrigger>
          <TabsTrigger value="diplomacy">{t(lang, "tab_diplomacy")}</TabsTrigger>
        </TabsList>

        {/* -------- Council -------- */}
        <TabsContent value="council" className="mt-3 space-y-2">
          <div className="mb-2 text-xs text-muted-foreground">
            {t(lang, "council_mayorParty")}:{" "}
            <span className="text-primary">{t(lang, `party_${p.council.mayorParty}` as DictKey)}</span>
            {" · "}
            {(strength * 100).toFixed(0)}%
          </div>

          {/* Feedback da última tentativa de convite — some sozinho depois de ~24 meses. */}
          {p.council.lastInvite && (state.year * 12 + state.month) - (p.council.lastInvite.year * 12 + p.council.lastInvite.month) <= 24 && (
            <div
              className={cn(
                "mb-2 rounded border px-3 py-2 text-xs",
                p.council.lastInvite.accepted
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200"
                  : "border-red-500/40 bg-red-500/5 text-red-200",
              )}
            >
              <div className="font-medium">
                {p.council.lastInvite.accepted ? "✓ " : "✗ "}
                {t(lang, `party_${p.council.lastInvite.partyId}` as DictKey)}
                {" — "}
                {p.council.lastInvite.accepted
                  ? (lang === "pt" ? "aceitou entrar na base" : "joined the coalition")
                  : (lang === "pt" ? "recusou o convite" : "declined the invite")}
              </div>
              <div className="mt-0.5 text-[10px] opacity-80">
                {(lang === "pt" ? "Chance calculada: " : "Estimated odds: ")}
                {(p.council.lastInvite.chance * 100).toFixed(0)}%
                {p.council.lastInvite.reason && ` · ${p.council.lastInvite.reason}`}
              </div>
            </div>
          )}

          {p.council.pendingDemand && (
            <PartyDemandCard
              state={state}
              onAccept={onAcceptDemand}
              onDecline={onDeclineDemand}
            />
          )}


          <div className="space-y-1.5">
            {p.council.parties.map((party) => {
              const inCoalition = p.council.coalition.includes(party.id);
              const isMayor = party.id === p.council.mayorParty;
              const gw = p.council.goodwill[party.id];
              const odds = !inCoalition && !isMayor ? coalitionAcceptanceOdds(state, party.id) : null;
              const oddsPct = odds ? Math.round(odds.chance * 100) : 0;
              const oddsColor =
                oddsPct >= 65 ? "text-emerald-400" :
                oddsPct >= 40 ? "text-amber-400" :
                "text-red-400";
              return (
                <div
                  key={party.id}
                  className={cn(
                    "flex items-center gap-3 rounded border border-border/50 bg-background/40 px-3 py-2",
                    inCoalition && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: partyColor(party.leaning) }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium">
                        {t(lang, party.nameKey as DictKey)}
                      </span>
                      <span className="text-mono text-[10px] text-muted-foreground">
                        {party.seats}
                      </span>
                      {isMayor && <Badge variant="outline" className="text-[9px]">★</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary/70"
                          style={{ width: `${gw}%` }}
                        />
                      </div>
                      <span className="text-mono text-[10px] text-muted-foreground">
                        {gw.toFixed(0)}
                      </span>
                      {odds && !odds.blocked && (
                        <span className={cn("text-mono text-[10px]", oddsColor)}
                          title={odds.hint || (lang === "pt" ? "Chance de aceitar o convite" : "Odds of accepting")}>
                          · {oddsPct}%
                        </span>
                      )}
                    </div>
                  </div>
                  {!isMayor && (
                    inCoalition ? (
                      <Button size="sm" variant="ghost" onClick={() => onEject(party.id)}>
                        {t(lang, "council_leave")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!!odds?.blocked}
                        title={
                          odds?.blocked === "no_capital"
                            ? (lang === "pt" ? `Precisa de ${INVITE_PC_COST} de capital político` : `Needs ${INVITE_PC_COST} political capital`)
                            : odds?.blocked === "hostile"
                              ? (lang === "pt" ? "Partido hostil — recuperar confiança primeiro" : "Party is hostile — rebuild trust first")
                              : odds?.hint
                                ? `${(lang === "pt" ? "Chance: " : "Odds: ")}${oddsPct}% (${odds.hint})`
                                : `${(lang === "pt" ? "Chance: " : "Odds: ")}${oddsPct}%`
                        }
                        onClick={() => onInvite(party.id)}
                      >
                        {t(lang, "council_join")}
                        {odds && !odds.blocked && (
                          <span className={cn("ml-1.5 text-[10px] font-mono", oddsColor)}>
                            {oddsPct}%
                          </span>
                        )}
                      </Button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>


        {/* -------- Groups -------- */}
        <TabsContent value="groups" className="mt-3 space-y-2">
          {p.groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 rounded border border-border/50 bg-background/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{t(lang, g.nameKey as DictKey)}</span>
                  <span className="text-mono text-[10px] text-muted-foreground">
                    {t(lang, "grp_influence")} {(g.influence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Progress value={g.mood} className="h-1.5 flex-1" />
                  <span
                    className={cn(
                      "text-mono text-[11px]",
                      g.mood > 60 ? "text-success"
                        : g.mood > 40 ? "text-muted-foreground"
                        : "text-destructive",
                    )}
                  >
                    {g.mood.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => onRespondGroup(g.id, "concede")}>
                  {t(lang, "grp_concede")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onRespondGroup(g.id, "confront")}>
                  {t(lang, "grp_confront")}
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* -------- Intergov -------- */}
        <TabsContent value="intergov" className="mt-3 grid gap-3 md:grid-cols-2">
          <IntergovBox
            label={t(lang, "intergov_state")}
            alignLabel={t(lang, "intergov_alignment")}
            alignment={p.intergov.stateAlignment}
            actionLabel={t(lang, "intergov_request")}
            onClick={() => onRequestTransfer("state")}
          />
          <IntergovBox
            label={t(lang, "intergov_federal")}
            alignLabel={t(lang, "intergov_alignment")}
            alignment={p.intergov.federalAlignment}
            actionLabel={t(lang, "intergov_request")}
            onClick={() => onRequestTransfer("federal")}
          />
          <div className="rounded border border-border/50 bg-background/40 px-3 py-2 md:col-span-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{t(lang, "intergov_transfers")}</span>
              <span className="text-mono text-sm text-success">{formatMoney(p.intergov.transfers)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{t(lang, "intergov_earmarks")}</span>
              <span className="text-mono">{formatMoney(p.intergov.earmarks)}</span>
            </div>
          </div>
        </TabsContent>

        {/* -------- Diplomacy -------- */}
        <TabsContent value="diplomacy" className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <DiploStat label={t(lang, "diplo_reputation")}
              value={`${p.diplomacy.reputation.toFixed(0)}%`} />
            <DiploStat label={t(lang, "diplo_sisterCities")}
              value={String(p.diplomacy.sisterCities)} />
            <DiploStat label={t(lang, "diplo_fdi")}
              value={formatMoney(p.diplomacy.foreignInvestment)} />
            <DiploStat label={t(lang, "diplo_programs")}
              value={String(p.diplomacy.multilateralPrograms)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onSignSister}
              disabled={state.treasury < 90_000}>
              {t(lang, "diplo_signSister")}
            </Button>
            <Button size="sm" variant="secondary" onClick={onApplyGrant}
              disabled={state.treasury < 40_000}>
              {t(lang, "diplo_applyGrant")}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Campaign controls — only in election year for context */}
      {yearsToElection <= 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-accent/40 bg-accent/5 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {t(lang, "campaignSpend")}: {formatMoney(p.election.campaignBudget)}
          </span>
          <Button size="sm" variant="outline"
            disabled={state.treasury < 25_000}
            onClick={() => onCampaign(25_000)}
          >
            {t(lang, "campaignSpend25")}
          </Button>
          <Button size="sm" variant="outline"
            disabled={state.treasury < 100_000}
            onClick={() => onCampaign(100_000)}
          >
            {t(lang, "campaignSpend100")}
          </Button>
        </div>
      )}
    </div>
  );
}

function IntergovBox({
  label, alignLabel, alignment, actionLabel, onClick,
}: {
  label: string; alignLabel: string; alignment: number;
  actionLabel: string; onClick: () => void;
}) {
  const tone = alignment > 20 ? "success" : alignment < -20 ? "destructive" : "muted";
  return (
    <div className="rounded border border-border/50 bg-background/40 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn(
            "text-mono text-xs",
            tone === "success" && "text-success",
            tone === "destructive" && "text-destructive",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {alignment > 0 ? "+" : ""}{alignment.toFixed(0)}
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {alignLabel}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full",
            alignment >= 0 ? "bg-success" : "bg-destructive",
          )}
          style={{
            width: `${Math.min(100, Math.abs(alignment))}%`,
            marginLeft: alignment >= 0 ? "50%" : `${50 - Math.min(50, Math.abs(alignment) / 2)}%`,
          }}
        />
      </div>
      <Button size="sm" variant="ghost" className="mt-2 h-7 w-full" onClick={onClick}>
        {actionLabel}
      </Button>
    </div>
  );
}

function DiploStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/50 bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-mono text-sm">{value}</div>
    </div>
  );
}

function partyColor(leaning: number): string {
  // -1 (red/left) → +1 (blue/right)
  if (leaning < -0.5) return "hsl(0 70% 55%)";
  if (leaning < -0.1) return "hsl(15 65% 55%)";
  if (leaning < 0.1) return "hsl(48 70% 55%)";
  if (leaning < 0.5) return "hsl(210 60% 55%)";
  return "hsl(220 70% 45%)";
}

function PartyDemandCard({
  state, onAccept, onDecline,
}: {
  state: GameState; onAccept: () => void; onDecline: () => void;
}) {
  const lang = state.lang;
  const d = state.politics.council.pendingDemand;
  if (!d) return null;
  const party = state.politics.council.parties.find((p) => p.id === d.partyId);
  const partyName = party ? t(lang, party.nameKey as DictKey) : d.partyId;
  const hasArt = state.advisors?.hired?.articulation;
  const isHire = d.kind === "hireMember";
  const monthly = d.candidate.salary;
  const bonus = d.signingBonus;
  const totalYearOne = bonus + monthly * 12;
  const affinityPct = Math.round(d.articulationAffinity * 100);
  const artPct = Math.round(d.articulationScore * 100);
  const affColor =
    d.articulationAffinity >= 0.3 ? "text-emerald-300"
    : d.articulationAffinity >= -0.1 ? "text-amber-300"
    : "text-red-300";
  const portfolioLabel = ({
    health: lang === "pt" ? "Saúde" : "Health",
    works: lang === "pt" ? "Obras / Urbanismo" : "Public Works",
    finance: lang === "pt" ? "Finanças" : "Finance",
    mobility: lang === "pt" ? "Mobilidade" : "Mobility",
    articulation: lang === "pt" ? "Articulação Política" : "Political Articulation",
  } as const)[d.targetPortfolio];
  return (
    <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold text-amber-200">
          {lang === "pt" ? "◈ Pedido de contrapartida" : "◈ Coalition demand"}
          {" — "}
          <span className="text-amber-100">{partyName}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-amber-400/80">
          {isHire
            ? (lang === "pt" ? "Contratação" : "Hire member")
            : (lang === "pt" ? "Indicação" : "Cabinet nomination")}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        {isHire
          ? (lang === "pt"
              ? `O ${partyName} exige um assento no gabinete: quer ${d.candidate.name} em ${portfolioLabel}.`
              : `${partyName} demands a cabinet seat: wants ${d.candidate.name} in ${portfolioLabel}.`)
          : (lang === "pt"
              ? `O ${partyName} sugere ${d.candidate.name} para o pool de candidatos de ${portfolioLabel}.`
              : `${partyName} suggests ${d.candidate.name} for the ${portfolioLabel} candidate pool.`)}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 rounded border border-border/40 bg-background/50 p-2 sm:grid-cols-4">
        <StatBit label={lang === "pt" ? "Capacidade" : "Skill"} value={`${d.candidate.overall}★`} />
        <StatBit label={lang === "pt" ? "Salário / mês" : "Monthly"} value={formatMoney(monthly)} />
        <StatBit label={lang === "pt" ? "Bônus assinatura" : "Signing bonus"}
                 value={bonus > 0 ? formatMoney(bonus) : "—"} />
        <StatBit label={lang === "pt" ? "Ano 1 (total)" : "Year 1 total"} value={formatMoney(totalYearOne)} />
      </div>

      {d.candidate.bio && (
        <p className="mt-1.5 text-[10px] italic text-muted-foreground">{d.candidate.bio}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border/40 bg-background/40 px-2 py-1.5 text-[10px]">
        <span className="uppercase tracking-wider text-muted-foreground">
          {lang === "pt" ? "Articulação Política" : "Political Articulation"}:
        </span>
        {hasArt ? (
          <>
            <span className="text-mono">{hasArt.name} · {hasArt.overall}★</span>
            <span className={cn("text-mono", affColor)}>
              {lang === "pt" ? "afinidade" : "affinity"} {affinityPct >= 0 ? "+" : ""}{affinityPct}
            </span>
            <span className="text-mono text-muted-foreground">
              {lang === "pt" ? "alavancagem" : "leverage"} {artPct}%
            </span>
          </>
        ) : (
          <span className="text-red-300">
            {lang === "pt"
              ? "sem titular na pasta — partido dita os termos"
              : "no minister — party dictates the terms"}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={isHire && bonus > 0 && state.treasury < bonus}
          onClick={onAccept}
          title={
            isHire && bonus > 0 && state.treasury < bonus
              ? (lang === "pt" ? "Tesouro insuficiente para o bônus" : "Treasury too low for signing bonus")
              : undefined
          }
        >
          {lang === "pt" ? "Aceitar" : "Accept"}
          <span className="ml-1.5 text-[10px] text-emerald-300">
            +{d.goodwillOnAccept} {lang === "pt" ? "conf." : "trust"}
          </span>
        </Button>
        <Button size="sm" variant="ghost" onClick={onDecline}>
          {lang === "pt" ? "Recusar" : "Decline"}
          <span className="ml-1.5 text-[10px] text-red-300">
            {d.goodwillOnDecline} {lang === "pt" ? "conf." : "trust"}
            {d.approvalOnDecline ? ` · ${d.approvalOnDecline} apr.` : ""}
          </span>
        </Button>
      </div>
    </div>
  );
}

function StatBit({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-mono text-[11px]">{value}</div>
    </div>
  );
}

export const PoliticsPanel = /*#__PURE__*/ memo(PoliticsPanelImpl);
