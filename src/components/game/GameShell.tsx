import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AnimIntensityToggle } from "./AnimIntensityToggle";
import { useGame } from "@/hooks/useGame";
import { useSpritesReady } from "@/game/spritePreloader";
import { t, monthName, type DictKey } from "@/game/i18n";
import { formatMoney, formatNumber, URBANIZE_COST } from "@/game/logic";
import { countFavelas, favelaPressure } from "@/game/zoning";
import { pickMood, setGlobalMood, setMusicLang } from "@/game/soundtrack";
// ────────────────────────────────────────────────────────────────────────
// Todos os painéis do drawer são code-split via React.lazy — só entram no
// bundle e são parseados quando o usuário abre a aba correspondente. Isso
// reduz drasticamente o JS inicial (parse/execução) especialmente no mobile.
// ────────────────────────────────────────────────────────────────────────
const PoliticsPanel        = lazy(() => import("./PoliticsPanel").then(m => ({ default: m.PoliticsPanel })));
const LegislaturePanel     = lazy(() => import("./LegislaturePanel").then(m => ({ default: m.LegislaturePanel })));
const InformalityPanel     = lazy(() => import("./InformalityPanel").then(m => ({ default: m.InformalityPanel })));
const SpatialJusticePanel  = lazy(() => import("./SpatialJusticePanel").then(m => ({ default: m.SpatialJusticePanel })));
const EducationPanel       = lazy(() => import("./EducationPanel").then(m => ({ default: m.EducationPanel })));
const HousingPanel         = lazy(() => import("./HousingPanel").then(m => ({ default: m.HousingPanel })));
const DemographyPanel      = lazy(() => import("./DemographyPanel").then(m => ({ default: m.DemographyPanel })));
const WellbeingPanel       = lazy(() => import("./WellbeingPanel").then(m => ({ default: m.WellbeingPanel })));
const ParallelPowerPanel   = lazy(() => import("./ParallelPowerPanel").then(m => ({ default: m.ParallelPowerPanel })));
const DisasterPanel        = lazy(() => import("./DisasterPanel").then(m => ({ default: m.DisasterPanel })));
const MassEventsPanel      = lazy(() => import("./MassEventsPanel").then(m => ({ default: m.MassEventsPanel })));
const OversightPanel       = lazy(() => import("./OversightPanel").then(m => ({ default: m.OversightPanel })));
const LandConflictPanel    = lazy(() => import("./LandConflictPanel").then(m => ({ default: m.LandConflictPanel })));
const MediaPanel           = lazy(() => import("./MediaPanel").then(m => ({ default: m.MediaPanel })));
const AdvisorsPanel        = lazy(() => import("./AdvisorsPanel").then(m => ({ default: m.AdvisorsPanel })));
const CorruptionPanel      = lazy(() => import("./CorruptionPanel").then(m => ({ default: m.CorruptionPanel })));
const EnvironmentPanel     = lazy(() => import("./EnvironmentPanel").then(m => ({ default: m.EnvironmentPanel })));
const LandUsePanel         = lazy(() => import("./LandUsePanel").then(m => ({ default: m.LandUsePanel })));
const FiscalLedger         = lazy(() => import("./FiscalLedger").then(m => ({ default: m.FiscalLedger })));
const BudgetProjection     = lazy(() => import("./BudgetProjection").then(m => ({ default: m.BudgetProjection })));
const LRFPanel             = lazy(() => import("./LRFPanel").then(m => ({ default: m.LRFPanel })));
const TransportPanel       = lazy(() => import("./TransportPanel").then(m => ({ default: m.TransportPanel })));
const ClimatePanel         = lazy(() => import("./ClimatePanel").then(m => ({ default: m.ClimatePanel })));
const SanitationSNISPanel  = lazy(() => import("./SanitationSNISPanel").then(m => ({ default: m.SanitationSNISPanel })));

// Modais e sobreposições condicionais — também sob demanda.
const InvestigationModal   = lazy(() => import("./InvestigationModal").then(m => ({ default: m.InvestigationModal })));
const ImpeachmentGameOver  = lazy(() => import("./ImpeachmentGameOver").then(m => ({ default: m.ImpeachmentGameOver })));
const PoliceShowModal      = lazy(() => import("./PoliceShowModal").then(m => ({ default: m.PoliceShowModal })));
const InboxPanel           = lazy(() => import("./InboxPanel").then(m => ({ default: m.InboxPanel })));
const ZapZapPanel          = lazy(() => import("./ZapZapPanel").then(m => ({ default: m.ZapZapPanel })));
const NegotiationTable     = lazy(() => import("./NegotiationTable").then(m => ({ default: m.NegotiationTable })));
const CampaignPanel        = lazy(() => import("./CampaignPanel").then(m => ({ default: m.CampaignPanel })));
const PiuPiuApp            = lazy(() => import("./PiuPiuApp").then(m => ({ default: m.PiuPiuApp })));
const BiddingPanel         = lazy(() => import("./BiddingPanel").then(m => ({ default: m.BiddingPanel })));
const CascadeModal         = lazy(() => import("./CascadeModal").then(m => ({ default: m.CascadeModal })));
const ElectionModal        = lazy(() => import("./ElectionModal").then(m => ({ default: m.ElectionModal })));
const LegacyScreen         = lazy(() => import("./LegacyScreen").then(m => ({ default: m.LegacyScreen })));

// Widgets flutuantes leves — ficam eager (aparecem no primeiro paint).
import { TvTicker } from "./TvTicker";
import { RadioFavela } from "./RadioFavela";
import { NeighborhoodPress } from "./NeighborhoodPress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pause,
  Play,
  FastForward,
  Rocket,
  Building2,
  Users,
  HeartPulse,
  GraduationCap,
  Shield,
  Bus,
  Droplets,
  Zap,
  TrendingUp,
  TrendingDown,
  Landmark,
  Newspaper,
  RotateCcw,
  Languages,
  AlertTriangle,
  CircleDollarSign,
  Percent,
  CalendarDays,
  Dices,
  Copy,
  Check,
  Wind,
  Maximize2,
  Minimize2,
} from "lucide-react";


const CityPicker = lazy(() => import("./CityPicker").then(m => ({ default: m.CityPicker })));
const MayorCreator = lazy(() => import("./MayorCreator").then(m => ({ default: m.MayorCreator })));
const CabinetSetup = lazy(() => import("./CabinetSetup").then(m => ({ default: m.CabinetSetup })));
const StartScreen = lazy(() => import("./StartScreen").then(m => ({ default: m.StartScreen })));
import { MayorAvatar } from "./MayorAvatar";
import { ShareMandateButton } from "./ShareMandateButton";

// O mapa isométrico foi removido — o jogo é 100% painel/dashboard.
// Ferramentas de zoning/build/road viviam para pintar tiles no mapa; a
// simulação continua rodando via auto-growth e o painel Build ainda expõe
// o catálogo informativo (BuildPalette) para o jogador.
import { BuildPalette } from "./BuildPalette";
import { CityCockpit } from "./CityCockpit";
import { TourGuide } from "./TourGuide";
import { SectionTour } from "./SectionTour";
import { SECTION_TOURS } from "./sectionTours";
import { AchievementsHost } from "./AchievementsHost";
import { CanetadoBurst } from "./CanetadoStamp";

import { DashboardHub, HUB_LABELS, type HubSection } from "./DashboardHub";
import { DashboardDrawer } from "./DashboardDrawer";
import { ProgressionPanel } from "./ProgressionPanel";
import { unlockedSections as computeUnlocked, tierForSection } from "@/game/progression";
import type { PolicyKey, TaxKey, ZoneTool, BuildTool } from "@/game/types";
import type { RoadTool } from "@/game/roads";
import { cn } from "@/lib/utils";


const POLICY_META: Record<PolicyKey, { key: DictKey; Icon: typeof GraduationCap }> = {
  education: { key: "education", Icon: GraduationCap },
  health: { key: "health", Icon: HeartPulse },
  security: { key: "security", Icon: Shield },
  transport: { key: "transport", Icon: Bus },
};

const TAX_META: Record<TaxKey, { key: DictKey; max: number }> = {
  income: { key: "incomeTax", max: 40 },
  property: { key: "propertyTax", max: 20 },
  business: { key: "businessTax", max: 30 },
};

export function GameShell() {
  const { state, actions, showStart, showPicker, pendingStart, pendingCabinet, initialMode, hasSave } = useGame();
  const [editingMayor, setEditingMayor] = useState(false);
  // Se um tour de onboarding está ativo (tutorialStep < 999), começa sem painel
  // aberto para não cobrir os spotlights. Saves antigos (undefined) já vêm com
  // o hub em "overview".
  const [hubSection, setHubSection] = useState<HubSection | null>(
    (state.tutorialStep ?? 999) < 999 ? null : "overview",
  );

  // Carimbo dramático "CANETADO!" exibido quando o prefeito toma uma
  // decisão drástica de crise (evacuação, abrigo, doações, reassentamento,
  // investimento em contenção). Reseta automaticamente após a animação.
  const [canetado, setCanetado] = useState<{
    open: boolean;
    text: string;
    subtitle: string;
    color: string;
  }>({ open: false, text: "CANETADO!", subtitle: "DECRETO PUBLICADO", color: "#DC2626" });
  const triggerCanetado = useCallback(
    (opts?: { text?: string; subtitle?: string; color?: string }) => {
      setCanetado({
        open: true,
        text: opts?.text ?? "CANETADO!",
        subtitle: opts?.subtitle ?? "DECRETO PUBLICADO",
        color: opts?.color ?? "#DC2626",
      });
    },
    [],
  );

  // Ações de crise que merecem o carimbo dramático "CANETADO!".
  const disasterActions = useMemo(
    () => ({
      ...actions.disaster,
      evacuate: () => {
        triggerCanetado({ text: "EVACUADO!", subtitle: "DECRETO DE EMERGÊNCIA" });
        actions.disaster.evacuate();
      },
      shelter: () => {
        triggerCanetado({ text: "ABRIGADO!", subtitle: "DECRETO DE EMERGÊNCIA" });
        actions.disaster.shelter();
      },
      donations: () => {
        triggerCanetado({ text: "SOLIDARIEDADE!", subtitle: "DOAÇÕES COORDENADAS", color: "#059669" });
        actions.disaster.donations();
      },
      relocate: (id: string, batch?: number) => {
        triggerCanetado({ text: "REASSENTADO!", subtitle: "REMOÇÃO FORÇADA — RISCO ZERO" });
        actions.disaster.relocate(id, batch);
      },
      invest: (id: string) => {
        triggerCanetado({ text: "CONTIDO!", subtitle: "OBRAS DE CONTENÇÃO AUTORIZADAS", color: "#2563EB" });
        actions.disaster.invest(id);
      },
    }),
    [actions.disaster, triggerCanetado],
  );

  const lang = state.lang;
  const balance = state.lastRevenue - state.lastExpenses;

  // ── Trilha sonora adaptativa ────────────────────────────────────────
  // Publica o "clima" do mandato (calmo / pressão / crise / glória) para o
  // player global, que faz o crossfade entre as faixas.
  const inMenu = showStart || showPicker || (pendingStart && !pendingCabinet);
  const openCancels = (state.piupiu?.triggers ?? []).filter(
    (tr) => !tr.responded && !tr.expired,
  ).length;
  const mood = pickMood({
    inMenu: !!inMenu,
    approval: state.approval,
    activeDisaster: !!state.disasters?.activeEvent,
    openCancels,
    legalRisk: Math.max(
      state.oversight?.impeachmentRisk ?? 0,
      state.disasters?.legalRisk ?? 0,
    ),
    broke: state.treasury < 0,
    celebrating: !!state.politics?.election?.pendingResult,
  });
  useEffect(() => { setGlobalMood(mood); }, [mood]);
  useEffect(() => { setMusicLang(lang); }, [lang]);




  // Growth-mode progressive unlock. When growthMode is off, `unlocked`
  // contains every section (classic behaviour); when on, it grows with pop.
  const unlockedSet = useMemo(
    () => computeUnlocked({ population: state.population, growthMode: state.growthMode }),
    [state.population, state.growthMode],
  );
  const lockedHints = useMemo<Partial<Record<HubSection, string>>>(() => {
    if (!state.growthMode) return {};
    const hints: Partial<Record<HubSection, string>> = {};
    (["overview","finance","policies","urbanism","mobility","society","politics","crisis","build"] as HubSection[])
      .forEach((sec) => {
        if (unlockedSet.has(sec)) return;
        const tier = tierForSection(sec);
        if (tier) {
          hints[sec] = lang === "pt"
            ? `Desbloqueia em ${formatNumber(tier.minPop)} hab (${tier.label.pt})`
            : `Unlocks at ${formatNumber(tier.minPop)} pop (${tier.label.en})`;
        }
      });
    return hints;
  }, [unlockedSet, state.growthMode, lang]);
  // If the currently-open section becomes locked (shouldn't normally happen
  // — pop only grows — but keeps the UI honest after resets), close it.
  useEffect(() => {
    if (hubSection && !unlockedSet.has(hubSection)) setHubSection("overview");
  }, [hubSection, unlockedSet]);
  // Quando um tour de onboarding começa (novo mandato), fecha o painel lateral
  // para não sobrepor os spotlights do tour.
  const tourActive = (state.tutorialStep ?? 999) < 999;
  useEffect(() => {
    if (tourActive) setHubSection(null);
  }, [tourActive]);

  // (Removido) handleMapPaint / handleMapPaintRoad — o mapa não existe mais.



  if (showStart) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <StartScreen
          lang={lang}
          hasSave={hasSave}
          onContinue={actions.continueGame}
          onNewGame={actions.newGame}
          onToggleLang={() => actions.setLang(lang === "pt" ? "en" : "pt")}
        />
      </Suspense>
    );
  }

  if (showPicker) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <CityPicker
          lang={lang}
          initialMode={initialMode}
          onStart={(opts) => actions.chooseCity({ ...opts, lang })}
          onCancel={actions.backToStart}
        />
      </Suspense>
    );
  }


  if (pendingStart && !pendingCabinet) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <MayorCreator
          lang={lang}
          initial={state.mayor}
          onBack={actions.cancelMayorSetup}
          onConfirm={actions.startGame}
        />
      </Suspense>
    );
  }

  if (pendingCabinet) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <CabinetSetup
          seed={pendingCabinet.seed}
          mayorPersonaId={pendingCabinet.mayor?.personaId}
          lang={lang}
          onBack={actions.cancelCabinetSetup}
          onConfirm={actions.confirmCabinet}
        />
      </Suspense>
    );
  }

  if (editingMayor) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <MayorCreator
          lang={lang}
          initial={state.mayor}
          onBack={() => setEditingMayor(false)}
          onConfirm={(m) => {
            actions.setMayor(m);
            setEditingMayor(false);
          }}
        />
      </Suspense>
    );
  }


  const sectionMeta = hubSection ? HUB_LABELS[hubSection] : null;

  const renderSection = (id: HubSection) => {
    switch (id) {
      case "overview":
        return (
          <>
            <ProgressionPanel state={state} lang={lang} />
            <div className="grid grid-cols-2 gap-2">
              <Kpi label={t(lang, "treasury")}   value={formatMoney(state.treasury)} Icon={CircleDollarSign} tone={state.treasury >= 0 ? "primary" : "danger"} />
              <Kpi label={t(lang, "balance")}    value={formatMoney(balance)} Icon={balance >= 0 ? TrendingUp : TrendingDown} tone={balance >= 0 ? "success" : "danger"} sub={`${formatMoney(state.lastRevenue)} · ${formatMoney(state.lastExpenses)}`} />
              <Kpi label={t(lang, "debt")}       value={formatMoney(state.debt)} Icon={Landmark} tone="warning" />
              <Kpi label={t(lang, "population")} value={formatNumber(state.population)} Icon={Users} tone="info" />
              <Kpi label={t(lang, "happiness")}  value={`${state.happiness.toFixed(0)}%`} Icon={HeartPulse} tone={state.happiness > 55 ? "success" : state.happiness > 35 ? "warning" : "danger"} progress={state.happiness} />
              <Kpi label={t(lang, "approval")}   value={`${state.approval.toFixed(0)}%`} Icon={Rocket} tone={state.approval > 50 ? "primary" : "warning"} progress={state.approval} />
              <Kpi label={t(lang, "businesses")} value={formatNumber(state.businesses)} Icon={Building2} tone="primary" sub={`${state.unemployment.toFixed(1)}% ${t(lang, "unemployment").toLowerCase()}`} />
              <Kpi label={t(lang, "airQuality")} value={`${state.environment.airQuality.toFixed(0)}`} Icon={Wind} tone={state.environment.airQuality > 65 ? "success" : state.environment.airQuality > 40 ? "warning" : "danger"} progress={state.environment.airQuality} sub={`${t(lang, "pollution")} ${state.environment.pollution.toFixed(0)}`} />
            </div>
            <Panel title={t(lang, "news")}>
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {state.news.length === 0 && <p className="text-sm text-muted-foreground">…</p>}
                {state.news.map((n) => (
                  <div key={n.id} className={cn(
                    "rounded border-l-2 bg-panel/60 px-3 py-2 text-sm",
                    n.kind === "success" && "border-success",
                    n.kind === "warning" && "border-warning",
                    n.kind === "danger" && "border-destructive",
                    n.kind === "info" && "border-info",
                  )}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{t(lang, n.titleKey as DictKey, n.titleKey)}</span>
                      <span className="text-mono text-[11px] text-muted-foreground">{monthName(lang, n.month)} {n.year}</span>
                    </div>
                    {n.detail && <div className="mt-0.5 text-xs text-muted-foreground">{t(lang, n.detail as DictKey, n.detail)}</div>}
                  </div>
                ))}
              </div>
            </Panel>
            <FavelaPanel state={state} onUrbanize={actions.urbanizeFavela} />
          </>
        );
      case "finance":
        return (
          <>
            <Panel title={t(lang, "finances")}>
              <dl data-tour="fin-summary" className="grid grid-cols-2 gap-3 text-sm">
                <FinanceRow label={t(lang, "revenue")}      value={formatMoney(state.lastRevenue)} tone="success" />
                <FinanceRow label={t(lang, "expenses")}     value={formatMoney(state.lastExpenses)} tone="danger" />
                <FinanceRow label={t(lang, "treasury")}     value={formatMoney(state.treasury)} />
                <FinanceRow label={t(lang, "debt")}         value={formatMoney(state.debt)} tone="warning" />
                <FinanceRow label={t(lang, "inflation")}    value={`${state.inflation.toFixed(1)}%`} />
                <FinanceRow label={t(lang, "unemployment")} value={`${state.unemployment.toFixed(1)}%`} />
              </dl>
              <div data-tour="fin-actions" className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={actions.takeLoan}>{t(lang, "takeLoan")}</Button>
                <Button size="sm" variant="outline" onClick={actions.payDebt} disabled={state.debt <= 0 || state.treasury < 100_000}>{t(lang, "payDebt")}</Button>
              </div>
            </Panel>
            <div data-tour="fin-ledger">
              <FiscalLedger state={state} />
            </div>
            <div data-tour="fin-lrf">
              <LRFPanel state={state} />
            </div>
          </>
        );
      case "policies":
        return (
          <>
            <div data-tour="pol-services">
              <Panel title={t(lang, "policies")} hint={t(lang, "policyHint")}>
                <div className="mb-3">
                  <Suspense fallback={null}><BudgetProjection state={state} /></Suspense>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(POLICY_META) as PolicyKey[]).map((k) => {
                    const { Icon, key } = POLICY_META[k];
                    const value = state.policies[k];
                    return (
                      <div key={k} className="rounded-md border border-border/60 bg-panel/60 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><span className="font-medium">{t(lang, key)}</span></div>
                          <span className="text-mono text-sm text-muted-foreground">{value}%</span>
                        </div>
                        <Slider value={[value]} min={0} max={100} step={5} onValueChange={(v) => actions.setPolicy(k, v[0])} />
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
            <div data-tour="pol-taxes">
              <Panel title={t(lang, "taxes")}>
                <div className="space-y-4">
                  {(Object.keys(TAX_META) as TaxKey[]).map((k) => {
                    const { key, max } = TAX_META[k];
                    const value = state.taxes[k];
                    return (
                      <div key={k}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-medium"><Percent className="h-3.5 w-3.5 text-accent" />{t(lang, key)}</span>
                          <span className="text-mono text-sm text-accent">{value.toFixed(1)}%</span>
                        </div>
                        <Slider value={[value]} min={0} max={max} step={0.5} onValueChange={(v) => actions.setTax(k, v[0])} />
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
            <div data-tour="pol-infra">
              <Panel title={t(lang, "infrastructure")}>
                <ResourceBar label={t(lang, "water")}  Icon={Droplets} capacity={state.infra.waterCapacity}  demand={state.waterDemand} />
                <div className="mt-4">
                  <ResourceBar label={t(lang, "energy")} Icon={Zap}      capacity={state.infra.energyCapacity} demand={state.energyDemand} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={actions.expandWater}  disabled={state.treasury < 300_000}>{t(lang, "expandWater")}</Button>
                  <Button size="sm" variant="secondary" onClick={actions.expandEnergy} disabled={state.treasury < 400_000}>{t(lang, "expandEnergy")}</Button>
                </div>
              </Panel>
            </div>
            <div data-tour="pol-env">
              <EnvironmentPanel state={state} onChange={actions.setSustainability} />
            </div>
          </>
        );
      case "urbanism":
        return (
          <>
            <div data-tour="urb-landuse"><LandUsePanel state={state} onChange={actions.setLandPolicy} /></div>
            <div data-tour="urb-housing"><HousingPanel state={state} actions={actions.housing} /></div>
            <div data-tour="urb-demog"><DemographyPanel state={state} /></div>
            <div data-tour="urb-conflict"><LandConflictPanel state={state} actions={actions.landConflict} /></div>
            <div data-tour="urb-favela"><FavelaPanel state={state} onUrbanize={actions.urbanizeFavela} /></div>
          </>
        );
      case "mobility":
        return (
          <>
            <div data-tour="mob-transport"><TransportPanel state={state} actions={actions.transport} /></div>
            <div data-tour="mob-climate"><ClimatePanel state={state} actions={actions.climate} /></div>
            <div data-tour="mob-sanit"><SanitationSNISPanel state={state} actions={actions.climate} /></div>
          </>
        );
      case "society":
        return (
          <>
            <div data-tour="soc-wellbeing"><WellbeingPanel state={state} /></div>
            <div data-tour="soc-spatial"><SpatialJusticePanel state={state} /></div>
            <div data-tour="soc-education"><EducationPanel state={state} actions={actions.education} /></div>
            <div data-tour="soc-informal"><InformalityPanel state={state} onChange={actions.setInformalPolicy} /></div>
            <div data-tour="soc-parallel"><ParallelPowerPanel state={state} actions={actions.parallel} /></div>
          </>
        );
      case "politics":
        return (
          <>
            <div data-tour="pl-coalition">
              <PoliticsPanel
                state={state}
                onInvite={actions.inviteParty}
                onEject={actions.ejectParty}
                onRespondGroup={actions.respondGroup}
                onRequestTransfer={actions.requestTransfer}
                onSignSister={actions.signSisterCity}
                onApplyGrant={actions.applyGrant}
                onCampaign={actions.campaign}
                onAcceptDemand={actions.partyDemand.accept}
                onDeclineDemand={actions.partyDemand.decline}
              />
            </div>
            <div data-tour="pl-legislature"><LegislaturePanel state={state} actions={actions.bill} /></div>
            <div data-tour="pl-advisors"><AdvisorsPanel state={state} actions={actions.advisor} /></div>
            <div data-tour="pl-oversight"><OversightPanel state={state} actions={actions.oversight} /></div>
            <div data-tour="pl-corruption"><CorruptionPanel state={state} actions={actions.corruption} /></div>
          </>
        );
      case "crisis":
        return (
          <>
            <div data-tour="cr-disaster"><DisasterPanel state={state} actions={disasterActions} /></div>
            <div data-tour="cr-mass"><MassEventsPanel state={state} actions={actions.massEvent} /></div>
            <div data-tour="cr-media"><MediaPanel state={state} actions={actions.media} /></div>
          </>
        );
      case "build":
        return (
          <>
            <Panel
              title={t(lang, "cityMap", "City Map")}
              hint={lang === "pt"
                ? "Catálogo de construções. O crescimento urbano é automático — priorize impostos e zoneamento pelas políticas."
                : "Construction catalog. Urban growth is automatic — steer it via taxes and zoning policies."}
            >
              <BuildPalette lang={lang} treasury={state.treasury} />
            </Panel>
          </>
        );
      case "bidding":
        return <BiddingPanel state={state} actions={actions.bidding} />;
    }
  };


  return (
    <div className="app-dense flex h-screen flex-col overflow-hidden text-foreground">
      <TopBar
        state={state}
        onSpeed={actions.setSpeed}
        onLang={actions.setLang}
        onName={actions.setCityName}
        onReset={actions.openPicker}
        onSetSeed={actions.setSeed}
        onEditMayor={actions.setMayor}
        onOpenMayorCreator={() => setEditingMayor(true)}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Carimbo dramático "CANETADO!" ao tomar decisões drásticas de crise. */}
        <CanetadoBurst
          open={canetado.open}
          text={canetado.text}
          subtitle={canetado.subtitle}
          color={canetado.color}
          onDone={() => setCanetado((c) => ({ ...c, open: false }))}
        />

        {/* Cockpit — painel-hero que substituiu o mapa isométrico.
            Toda navegação de contexto agora é feita pelo hub à esquerda + drawer à direita. */}
        <div className="absolute inset-0">
          <CityCockpit state={state} onOpenMedia={() => setHubSection("crisis")} />
        </div>

        {/* Trophy button + achievements panel (persistent between runs). */}
        <AchievementsHost state={state} onSecondChance={actions.useSecondChance} />

        {/* Hub — barra vertical à esquerda no desktop, barra inferior no mobile.
            Mayor mode: esconde "build" e libera "bidding"; sandbox: o oposto. */}
        <div
          className="pointer-events-none absolute left-0 right-0 bottom-0 z-30 flex justify-center px-2 pb-safe sm:left-3 sm:right-auto sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:px-0 sm:pb-0 mland:left-auto mland:right-0 mland:top-1/2 mland:bottom-auto mland:-translate-y-1/2 mland:justify-end mland:px-0 mland:pb-0 mland:pr-1 mland:pr-safe"
          data-tour="hub"
        >
          <DashboardHub
            lang={lang}
            active={hubSection}
            onSelect={setHubSection}
            className="max-w-full"
            unlockedSections={(() => {
              const base = state.growthMode
                ? new Set<HubSection>(unlockedSet)
                : new Set<HubSection>(["overview","finance","policies","urbanism","mobility","society","politics","crisis","build","bidding"]);
              if (state.mode === "mayor") { base.delete("build"); base.add("bidding"); }
              else                        { base.delete("bidding"); }
              return base;
            })()}
            lockedHints={lockedHints}
          />
        </div>

        {/* Drawer — painel lateral direito */}
        <DashboardDrawer
          open={hubSection !== null}
          onClose={() => setHubSection(null)}
          title={sectionMeta ? sectionMeta[lang] : ""}
          hint={sectionMeta ? sectionMeta.hint[lang] : undefined}
          lang={lang}
        >
          <Suspense fallback={<div className="h-24 animate-pulse rounded-md bg-muted/40" />}>
            {hubSection && renderSection(hubSection)}
          </Suspense>
        </DashboardDrawer>


        {/* Widgets flutuantes de canto — TV/rádio/pasquim. Ocultos no mobile
            (< sm) para não competir com o hub inferior e o cockpit. */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-20 hidden flex-col items-end gap-2 sm:flex">
          <div className="pointer-events-auto"><TvTicker state={state} /></div>
          <div className="pointer-events-auto"><RadioFavela state={state} /></div>
        </div>

        {/* Pasquim do Bairro — canto inferior esquerdo (desktop apenas) */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden sm:block">
          <div className="pointer-events-auto"><NeighborhoodPress state={state} /></div>
        </div>

        {/* Onboarding tour — invisível para saves legados (tutorialStep === undefined).
            Ao terminar, retomamos o tempo em velocidade 1 (o startGame começa em pause). */}
        <TourGuide
          state={state}
          onStep={actions.tutorialSetStep}
          onFinish={() => actions.setSpeed(1)}
        />

        {/* Tour dedicado a cada seção do hub — dispara na 1ª vez que a
            seção é aberta (persistido por chave em localStorage). Só monta
            depois do onboarding principal terminar, para não atropelar. */}
        {(state.tutorialStep ?? 999) >= 999 && hubSection && SECTION_TOURS[hubSection] && (
          <SectionTour
            lang={lang}
            active={true}
            config={SECTION_TOURS[hubSection]!}
          />
        )}

      </div>


      <Suspense fallback={null}>
        <PoliceShowModal state={state} onDispatch={actions.policeShow.dispatchUnits} />
        <ZapZapPanel state={state} actions={actions.zapzap} />
        <InboxPanel state={state} actions={actions.inbox} />
        <NegotiationTable state={state} actions={actions.negotiation} />
        <CampaignPanel state={state} actions={actions.electionCampaign} />
        <PiuPiuApp state={state} actions={{ ...actions.piupiu, covertOps: actions.covertOps }} />
        <CascadeModal
          state={state}
          lang={lang}
          onTow={actions.cascade.tow}
          onBot={actions.cascade.bot}
          onIgnore={actions.cascade.ignore}
        />
        <EventModal state={state} onDecide={actions.resolveEvent} />
        <ElectionModal
          state={state}
          onAck={actions.acknowledgeElection}
          onReset={() => {
            // Clear the staged election result before ending the career so a
            // return to this state doesn't re-open the "you lost" modal.
            actions.acknowledgeElection();
            actions.endCareerAndPick("defeated");
          }}
        />
        <InvestigationModal state={state} onResolve={actions.corruption.resolvePlea} onDismiss={actions.corruption.dismissPlea} />
        <ImpeachmentGameOver state={state} onReset={() => actions.endCareerAndPick("impeached")} />
        <LegacyScreen state={state} onNewCareer={() => actions.endCareerAndPick("victory")} />
      </Suspense>
    </div>
  );
}


/* -------- sub-components -------- */

function LazyFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      <div className="h-2 w-24 animate-pulse rounded bg-muted" />
    </div>
  );
}


function FullscreenButton({ lang }: { lang: "pt" | "en" }) {
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* user gesture may be required; ignore */
    }
  };
  const label = isFs
    ? lang === "pt" ? "Sair da tela cheia" : "Exit fullscreen"
    : lang === "pt" ? "Tela cheia" : "Fullscreen";
  return (
    <Button size="sm" variant="ghost" onClick={toggle} className="gap-1" title={label} aria-label={label}>
      {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      <span className="hidden text-mono text-xs uppercase md:inline">{isFs ? "esc" : "full"}</span>
    </Button>
  );
}


function TopBar({
  state,
  onSpeed,
  onLang,
  onName,
  onReset,
  onSetSeed,
  onEditMayor,
  onOpenMayorCreator,
}: {
  state: ReturnType<typeof useGame>["state"];
  onSpeed: (s: 0 | 1 | 2 | 3) => void;
  onLang: (l: "pt" | "en") => void;
  onName: (n: string) => void;
  onReset: (seed?: string) => void;
  onSetSeed: (seed: string) => void;
  onEditMayor: (mayor: import("@/game/mayor").Mayor) => void;
  onOpenMayorCreator: () => void;
}) {


  const lang = state.lang;
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="container-dense flex flex-wrap items-center gap-2 py-2">

        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="rounded-full ring-2 ring-primary/30 transition-transform hover:scale-105"
                title={state.mayor.name}
              >
                <MayorAvatar personaId={state.mayor.personaId}
                  archetypeId={state.mayor.archetypeId} size={40} className="rounded-full" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-4 pointer-events-auto">
              <MayorQuickEdit
                lang={lang}
                mayor={state.mayor}
                onSave={onEditMayor}
                onOpenCreator={onOpenMayorCreator}
              />

            </PopoverContent>
          </Popover>
          <div className="min-w-0">
            <div className="hidden text-[11px] uppercase tracking-widest text-muted-foreground sm:block">
              {state.mayor.title} · {t(lang, "appTitle")}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="hidden text-sm font-medium text-primary/90 sm:inline">{state.mayor.name}</span>
              <span className="hidden text-muted-foreground sm:inline">·</span>
              <Input
                value={state.cityName}
                onChange={(e) => onName(e.target.value)}
                className="h-8 min-w-0 max-w-[42vw] border-0 bg-transparent p-0 text-base font-semibold focus-visible:ring-0 sm:h-7 sm:max-w-none sm:text-lg"
              />
            </div>
          </div>
        </div>

        <div className="mx-2 hidden h-8 w-px bg-border md:block" />

        <div data-tour="share" className="hidden sm:block"><ShareMandateButton state={state} /></div>



        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 transition-colors hover:bg-primary/10"
              title={t(lang, "monthlyReport")}
            >
              <CalendarDays className="h-4 w-4 text-primary" />
              <div className="text-mono text-sm font-semibold text-primary">
                {String(state.day).padStart(2, "0")} {monthName(lang, state.month)} {state.year}
              </div>
              <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-primary/15">
                <div
                  className="h-full bg-primary transition-[width] duration-300 ease-linear"
                  style={{ width: `${(state.day / 30) * 100}%` }}
                />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3 pointer-events-auto">
            <MiniCalendar day={state.day} month={state.month} year={state.year} lang={lang} news={state.news} />
          </PopoverContent>
        </Popover>


        <div className="ml-auto flex items-center gap-1 rounded-md border border-border/60 bg-panel/60 p-1" data-tour="time">
          <Button
            size="icon"
            variant={state.speed === 0 ? "default" : "ghost"}
            className="h-7 w-7"
            onClick={() => onSpeed(0)}
            title={t(lang, "pause")}
          >
            <Pause className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant={state.speed === 1 ? "default" : "ghost"}
            className="h-7 w-7"
            onClick={() => onSpeed(1)}
            title={t(lang, "play")}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant={state.speed === 2 ? "default" : "ghost"}
            className="h-7 w-7 text-mono text-[11px]"
            onClick={() => onSpeed(2)}
          >
            2×
          </Button>
          <Button
            size="icon"
            variant={state.speed === 3 ? "default" : "ghost"}
            className="h-7 w-7"
            onClick={() => onSpeed(3)}
          >
            <FastForward className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onLang(lang === "pt" ? "en" : "pt")}
          className="gap-1"
        >
          <Languages className="h-4 w-4" />
          <span className="text-mono text-xs uppercase">{lang}</span>
        </Button>

        <AnimIntensityToggle lang={lang} />

        <FullscreenButton lang={lang} />




        <SeedControl
          lang={lang}
          seed={state.seed}
          cursor={state.rngCursor}
          onSetSeed={onSetSeed}
          onNewGame={(s) => onReset(s)}
        />

        <Button size="sm" variant="ghost" onClick={() => onReset()} className="gap-1">
          <RotateCcw className="h-4 w-4" />
          {t(lang, "newCity")}
        </Button>
      </div>
    </header>
  );
}

function MayorQuickEdit({
  lang,
  mayor,
  onSave,
  onOpenCreator,
}: {
  lang: "pt" | "en";
  mayor: import("@/game/mayor").Mayor;
  onSave: (m: import("@/game/mayor").Mayor) => void;
  onOpenCreator: () => void;
}) {
  const [name, setName] = useState(mayor.name);
  const [title, setTitle] = useState(mayor.title);
  useEffect(() => {
    setName(mayor.name);
    setTitle(mayor.title);
  }, [mayor.name, mayor.title]);
  const dirty = name.trim() !== mayor.name || title.trim() !== mayor.title;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <MayorAvatar personaId={mayor.personaId} archetypeId={mayor.archetypeId} size={56} className="rounded-lg" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{mayor.name}</div>
          <div className="truncate text-xs text-muted-foreground">{mayor.title}</div>
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {t(lang, "mayorName")}
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {t(lang, "mayorTitle")}
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={!dirty || !name.trim()}
          onClick={() => onSave({ ...mayor, name: name.trim(), title: title.trim() || mayor.title })}
        >
          {t(lang, "save").replace(" automaticamente", "").replace("-saved", "")}
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onOpenCreator}>
          {t(lang, "mayorAppearance")}
        </Button>
      </div>
    </div>
  );
}


function SeedControl({
  lang,
  seed,
  cursor,
  onSetSeed,
  onNewGame,
}: {
  lang: "pt" | "en";
  seed: string;
  cursor: number;
  onSetSeed: (seed: string) => void;
  onNewGame: (seed: string) => void;
}) {
  const [draft, setDraft] = useState(seed);
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(seed), [seed]);

  const random = () => {
    const s = Math.floor(Math.random() * 0xffffffff)
      .toString(36)
      .toUpperCase()
      .padStart(6, "0")
      .slice(0, 8);
    setDraft(s);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(seed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-panel/60 px-2.5 text-xs hover:bg-panel"
          title={t(lang, "seed")}
        >
          <Dices className="h-4 w-4 text-primary" />
          <span className="text-mono font-semibold tracking-wider">{seed}</span>
          <span className="text-mono text-[10px] text-muted-foreground">#{cursor}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 pointer-events-auto">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t(lang, "seed")}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t(lang, "seedHint")}</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            className="text-mono h-9 flex-1 tracking-wider"
            placeholder="ABC123"
          />
          <Button size="icon" variant="outline" onClick={random} title={t(lang, "seedRandom")}>
            <Dices className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={copy} title={t(lang, "seedCopy")}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <div className="text-mono flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t(lang, "seedCursor")}</span>
          <span className="font-semibold text-foreground">#{cursor}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => draft.trim() && onSetSeed(draft)}
            disabled={!draft.trim() || draft === seed}
          >
            {t(lang, "seedApply")}
          </Button>
          <Button size="sm" onClick={() => draft.trim() && onNewGame(draft)} disabled={!draft.trim()}>
            {t(lang, "seedNewGame")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type Tone = "primary" | "success" | "warning" | "danger" | "info";

function toneColor(tone: Tone) {
  switch (tone) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "danger":
      return "text-destructive";
    case "info":
      return "text-info";
    default:
      return "text-primary";
  }
}

function Kpi({
  label,
  value,
  Icon,
  tone = "primary",
  sub,
  progress,
}: {
  label: string;
  value: string;
  Icon: typeof Users;
  tone?: Tone;
  sub?: string;
  progress?: number;
}) {
  return (
    <Card className="border-border/60 bg-panel/70 p-3">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={cn("h-4 w-4", toneColor(tone))} />
      </div>
      <div className={cn("mt-1 text-mono text-xl font-semibold", toneColor(tone))}>{value}</div>
      {progress !== undefined && (
        <Progress value={progress} className="mt-2 h-1" />
      )}
      {sub && <div className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function Panel({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("border-border/60 bg-panel/70 p-4", className)}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

function ResourceBar({
  label,
  Icon,
  capacity,
  demand,
}: {
  label: string;
  Icon: typeof Droplets;
  capacity: number;
  demand: number;
}) {
  const pct = Math.min(100, (demand / capacity) * 100);
  const critical = pct > 100 || demand > capacity;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icon className={cn("h-4 w-4", critical ? "text-destructive" : "text-info")} />
          {label}
        </span>
        <span className="text-mono text-xs text-muted-foreground">
          {demand} / {capacity}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-muted">
        <div
          className={cn(
            "h-full transition-all",
            critical ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-info",
          )}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function FinanceRow({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between rounded border border-border/50 bg-panel/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-mono text-sm font-medium", tone ? toneColor(tone) : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function EventModal({
  state,
  onDecide,
}: {
  state: ReturnType<typeof useGame>["state"];
  onDecide: (choice: number) => void;
}) {
  const lang = state.lang;
  const evt = state.activeEvent;
  const open = !!evt;
  return (
    <Dialog open={open}>
      <DialogContent className="border-border/70 bg-panel" onEscapeKeyDown={(e) => e.preventDefault()}>
        {evt && (
          <>
            <DialogHeader>
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    evt.def.kind === "danger" && "text-destructive",
                    evt.def.kind === "warning" && "text-warning",
                    evt.def.kind === "info" && "text-info",
                    evt.def.kind === "success" && "text-success",
                  )}
                />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {t(lang, "eventTitle")} · {monthName(lang, evt.triggeredAt.month)} {evt.triggeredAt.year}
                </span>
              </div>
              <DialogTitle>{t(lang, evt.def.titleKey as DictKey)}</DialogTitle>
              <DialogDescription>{t(lang, evt.def.descriptionKey as DictKey)}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              {evt.def.choices.map((c, i) => (
                <Button
                  key={i}
                  variant={i === 0 ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => onDecide(i)}
                >
                  {t(lang, c.labelKey as DictKey)}
                </Button>
              ))}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MiniCalendar({
  day,
  month,
  year,
  lang,
  news,
}: {
  day: number;
  month: number;
  year: number;
  lang: "pt" | "en";
  news: import("@/game/types").NewsItem[];
}) {
  // Game uses fixed 30-day months (see DAYS_PER_MONTH). Render a 6×5 grid.
  const [viewOffset, setViewOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(day);
  const totalIdx = (year * 12 + (month - 1)) + viewOffset;
  const viewYear = Math.floor(totalIdx / 12);
  const viewMonth = (totalIdx % 12) + 1;
  const isCurrent = viewOffset === 0;

  // Keep selection glued to "today" while we're on the current month.
  useEffect(() => {
    if (isCurrent) setSelectedDay(day);
  }, [day, isCurrent]);

  // Group news by day for the currently viewed month.
  const newsByDay = new Map<number, typeof news>();
  for (const n of news) {
    if (n.year === viewYear && n.month === viewMonth && n.day) {
      const list = newsByDay.get(n.day) ?? [];
      list.push(n);
      newsByDay.set(n.day, list);
    }
  }

  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const weekLabel = lang === "pt" ? "Semana" : "Week";
  const todayLabel = lang === "pt" ? "Hoje" : "Today";
  const selectedNews = newsByDay.get(selectedDay) ?? [];

  return (
    <div className="w-[300px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewOffset((v) => v - 1)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          title={lang === "pt" ? "Mês anterior" : "Previous month"}
        >
          ‹
        </button>
        <div className="text-sm font-semibold text-foreground">
          {monthName(lang, viewMonth)} {viewYear}
        </div>
        <button
          type="button"
          onClick={() => setViewOffset((v) => v + 1)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          title={lang === "pt" ? "Próximo mês" : "Next month"}
        >
          ›
        </button>
      </div>
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>
          {isCurrent
            ? `${weekLabel} ${Math.ceil(day / 6)}/5`
            : lang === "pt"
              ? "Visualização"
              : "Preview"}
        </span>
        <button
          type="button"
          onClick={() => {
            setViewOffset(0);
            setSelectedDay(day);
          }}
          disabled={isCurrent && selectedDay === day}
          className={cn(
            "rounded border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors",
            isCurrent && selectedDay === day
              ? "cursor-default opacity-40"
              : "bg-primary/10 text-primary hover:bg-primary/20",
          )}
        >
          {todayLabel}
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {days.map((d) => {
          const isToday = isCurrent && d === day;
          const isPast = isCurrent && d < day;
          const isOtherMonth = !isCurrent;
          const isSelected = d === selectedDay;
          const dayNews = newsByDay.get(d);
          const hasNews = !!dayNews?.length;
          const worstKind = hasNews
            ? dayNews!.some((n) => n.kind === "danger")
              ? "danger"
              : dayNews!.some((n) => n.kind === "warning")
                ? "warning"
                : dayNews!.some((n) => n.kind === "success")
                  ? "success"
                  : "info"
            : null;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(d)}
              className={cn(
                "text-mono relative flex h-8 items-center justify-center rounded text-[11px] transition-colors",
                isToday
                  ? "bg-primary text-primary-foreground font-semibold shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]"
                  : isPast
                    ? "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                    : isOtherMonth
                      ? "border border-border/40 text-muted-foreground/70 hover:border-border"
                      : "border border-border/60 text-foreground/80 hover:border-primary/50",
                isSelected && !isToday && "ring-2 ring-primary/60",
              )}
              title={`${String(d).padStart(2, "0")} ${monthName(lang, viewMonth)}`}
            >
              {String(d).padStart(2, "0")}
              {worstKind && (
                <span
                  className={cn(
                    "absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full",
                    worstKind === "danger" && "bg-destructive",
                    worstKind === "warning" && "bg-warning",
                    worstKind === "success" && "bg-success",
                    worstKind === "info" && "bg-info",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected-day event panel */}
      <div className="mt-3 border-t border-border/60 pt-2">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t(lang, "dayEvents")}
          </div>
          <div className="text-mono text-[11px] font-semibold text-foreground">
            {String(selectedDay).padStart(2, "0")} {monthName(lang, viewMonth)} {viewYear}
          </div>
        </div>
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {selectedNews.length === 0 ? (
            <p className="rounded border border-dashed border-border/50 bg-panel/30 px-2 py-3 text-center text-[11px] text-muted-foreground">
              {t(lang, "dayEventsEmpty")}
            </p>
          ) : (
            selectedNews.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "rounded border-l-2 bg-panel/60 px-2 py-1.5 text-[11px]",
                  n.kind === "success" && "border-success",
                  n.kind === "warning" && "border-warning",
                  n.kind === "danger" && "border-destructive",
                  n.kind === "info" && "border-info",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {t(lang, n.titleKey as DictKey, n.titleKey)}
                  </span>
                  <span
                    className={cn(
                      "text-mono text-[9px] font-semibold uppercase tracking-widest",
                      n.kind === "success" && "text-success",
                      n.kind === "warning" && "text-warning",
                      n.kind === "danger" && "text-destructive",
                      n.kind === "info" && "text-info",
                    )}
                  >
                    {t(lang, `status_${n.kind}` as DictKey, n.kind)}
                  </span>
                </div>
                {n.detail && (
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {t(lang, n.detail as DictKey, n.detail)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
          {lang === "pt" ? "Hoje" : "Today"}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
          {lang === "pt" ? "Com eventos" : "Has events"}
        </span>
      </div>
    </div>
  );
}

/* -------- Favela panel -------- */

function FavelaPanel({
  state,
  onUrbanize,
}: {
  state: ReturnType<typeof useGame>["state"];
  onUrbanize: () => void;
}) {
  const lang = state.lang;
  const fav = countFavelas(state);
  const pressure = favelaPressure(state);
  // Pick the tier that will be urbanized next (largest available) to preview cost.
  const nextTier: "favela_s" | "favela_m" | "favela_l" | null =
    fav.large > 0 ? "favela_l" : fav.medium > 0 ? "favela_m" : fav.small > 0 ? "favela_s" : null;
  const nextCost = nextTier ? URBANIZE_COST[nextTier] : 0;
  const canUrbanize = nextTier !== null && state.treasury >= nextCost;
  const pressureTone = pressure > 65 ? "danger" : pressure > 35 ? "warning" : "success";
  const tierLabel = nextTier === "favela_l" ? (lang === "pt" ? "grande" : "large")
    : nextTier === "favela_m" ? (lang === "pt" ? "média" : "medium")
    : nextTier === "favela_s" ? (lang === "pt" ? "pequena" : "small")
    : "—";

  return (
    <section className="mt-4">
      <Panel title={t(lang, "favelas")} hint={t(lang, "urbanizeHint")}>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
          <div className="grid grid-cols-4 gap-2 text-sm">
            <FavelaStat label={lang === "pt" ? "Total" : "Total"} value={fav.count} tone="warning" />
            <FavelaStat label="S" value={fav.small} />
            <FavelaStat label="M" value={fav.medium} />
            <FavelaStat label="L" value={fav.large} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t(lang, "favelaPressure")}</span>
              <span className={cn(
                "text-mono",
                pressureTone === "danger" && "text-destructive",
                pressureTone === "warning" && "text-warning",
                pressureTone === "success" && "text-success",
              )}>{pressure.toFixed(0)}</span>
            </div>
            <Progress value={pressure} />
            <div className="mt-2 text-[11px] text-muted-foreground">
              {t(lang, "favelaUrbanized")}: <span className="text-mono">{state.favelaUrbanized}</span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <Button
              size="sm"
              variant="secondary"
              disabled={!canUrbanize}
              onClick={onUrbanize}
            >
              {t(lang, "urbanize")}{nextTier ? ` · ${tierLabel} (${formatMoney(nextCost)})` : ""}
            </Button>
            {!nextTier && (
              <span className="text-[11px] text-muted-foreground">
                {lang === "pt" ? "Nenhuma comunidade informal no momento." : "No informal community right now."}
              </span>
            )}
          </div>
        </div>
      </Panel>
    </section>
  );
}

function FavelaStat({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <div className={cn(
      "rounded-md border border-border/60 bg-panel/60 px-3 py-2",
      tone === "warning" && "border-warning/40",
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-mono text-lg font-semibold">{value}</div>
    </div>
  );
}
