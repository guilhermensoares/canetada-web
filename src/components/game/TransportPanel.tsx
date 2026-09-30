import { useState, memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { GameState } from "@/game/types";
import { t, type DictKey } from "@/game/i18n";
import { formatMoney, formatNumber } from "@/game/logic";
import type { TransportModeId, ConcessionBid, FareModel } from "@/game/transport";
import {
  Bus,
  TramFront,
  TrainFront,
  Gavel,
  ShieldAlert,
  Handshake,
  Route as RouteIcon,
  Users,
  Leaf,
  Ticket,
  Zap,
  Building2,
  Car,
  Construction,
  TrafficCone,
  ParkingSquare,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  actions: {
    openBidding: () => void;
    awardBid: (id: string) => void;
    cancelBidding: () => void;
    setFare: (m: TransportModeId, v: number) => void;
    setSubsidy: (m: TransportModeId, v: number) => void;
    buildBrt: () => void;
    buildMetro: () => void;
    setCrackdown: (v: number) => void;
    legalizeInformal: () => void;
    buildCycleway: () => void;
    setFuelPrice: (v: number) => void;
    setFareModel: (m: FareModel) => void;
    toggleIntegration: () => void;
    setTransferWindow: (v: number) => void;
    setCorporateMobilityTax: (v: number) => void;
    setVehicleMobilityFee: (v: number) => void;
    setElectrifyInvestment: (v: number) => void;
    toggleRequireElectricBids: () => void;
    expandRoadway: () => void;
    buildCalmingZone: () => void;
    toggleReversibleLanes: () => void;
    toggleSmartSignals: () => void;
    setPaidParkingCoverage: (v: number) => void;
    setParkingFee: (v: number) => void;
  };
}

const MODE_META: Record<
  TransportModeId,
  { key: DictKey; Icon: typeof Bus; tone: string }
> = {
  bus:   { key: "tp_mode_bus",   Icon: Bus,        tone: "text-primary" },
  van:   { key: "tp_mode_van",   Icon: RouteIcon,  tone: "text-warning" },
  brt:   { key: "tp_mode_brt",   Icon: TramFront,  tone: "text-info" },
  metro: { key: "tp_mode_metro", Icon: TrainFront, tone: "text-success" },
};

function TransportPanelImpl({ state, actions }: Props) {
  const lang = state.lang;
  const T = state.transport;
  const bidding = T.openBids.length > 0;

  return (
    <Card className="border-border/60 bg-panel/70 p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t(lang, "transport")}
          </div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Bus className="h-4 w-4 text-primary" />
            {t(lang, "tp_title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t(lang, "tp_subtitle")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-4">
          <Kpi label={t(lang, "tp_commuters")} value={formatNumber(T.totalCommuters)} icon={<Users className="h-3 w-3" />} />
          <Kpi label={t(lang, "tp_unmet")} value={`${Math.round((T.unmet / Math.max(1, T.totalCommuters)) * 100)}%`} tone={T.unmet > T.totalCommuters * 0.15 ? "danger" : "default"} />
          <Kpi label={t(lang, "tp_informalShare")} value={`${Math.round(T.informalShare * 100)}%`} tone={T.informalShare > 0.35 ? "warning" : "default"} />
          <Kpi label={t(lang, "tp_pollutionDelta")} value={`${T.lastPollutionDelta > 0 ? "+" : ""}${T.lastPollutionDelta}`} icon={<Leaf className="h-3 w-3" />} tone={T.lastPollutionDelta < 0 ? "success" : T.lastPollutionDelta > 0 ? "warning" : "default"} />
        </div>
      </header>

      {/* Modal split & traffic physics */}
      <section className="mb-3 rounded-md border border-border/50 bg-background/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <RouteIcon className="h-4 w-4 text-info" />
            {t(lang, "tp_modalSplit")}
          </div>
          <div className="flex gap-1 text-[10px]">
            <Badge variant="outline">{t(lang, "tp_congestion")}: {T.split.congestion}%</Badge>
            <Badge variant="outline" className={T.split.accidents >= 25 ? "text-destructive" : ""}>
              {t(lang, "tp_accidents")}: {T.split.accidents}
            </Badge>
          </div>
        </div>
        {/* Stacked bar */}
        <div className="mb-2 flex h-3 w-full overflow-hidden rounded border border-border/40">
          <div className="bg-warning" style={{ width: `${T.split.car * 100}%` }} title={`${t(lang, "tp_modalCar")} ${Math.round(T.split.car * 100)}%`} />
          <div className="bg-destructive/70" style={{ width: `${T.split.moto * 100}%` }} title={`${t(lang, "tp_modalMoto")} ${Math.round(T.split.moto * 100)}%`} />
          <div className="bg-primary" style={{ width: `${T.split.transit * 100}%` }} title={`${t(lang, "tp_modalTransit")} ${Math.round(T.split.transit * 100)}%`} />
          <div className="bg-success" style={{ width: `${T.split.active * 100}%` }} title={`${t(lang, "tp_modalActive")} ${Math.round(T.split.active * 100)}%`} />
        </div>
        <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-warning" />{t(lang, "tp_modalCar")} {Math.round(T.split.car * 100)}%</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-destructive/70" />{t(lang, "tp_modalMoto")} {Math.round(T.split.moto * 100)}%</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-primary" />{t(lang, "tp_modalTransit")} {Math.round(T.split.transit * 100)}%</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-success" />{t(lang, "tp_modalActive")} {Math.round(T.split.active * 100)}%</span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[10px] text-muted-foreground">
              {t(lang, "tp_fuelPrice")}: R$ {T.fuelPricePerLiter.toFixed(2)}
            </label>
            <Slider
              value={[T.fuelPricePerLiter]}
              min={3.5}
              max={12}
              step={0.1}
              onValueChange={([v]) => actions.setFuelPrice(v)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="text-[10px] text-muted-foreground">
              {t(lang, "tp_cyclewayKm")}: <span className="text-mono font-semibold text-foreground">{T.cyclewayKm} km</span>
              <div className="text-[10px] text-muted-foreground">{t(lang, "tp_healthCost")}: {formatMoney(T.split.healthCost)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={actions.buildCycleway} disabled={state.treasury < 22_000}>
              {t(lang, "tp_buildCycleway")}
            </Button>
          </div>
        </div>
      </section>

      {/* Fare regime, subsidy model, electrification */}
      <section className="mb-3 rounded-md border border-border/50 bg-background/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Ticket className="h-4 w-4 text-primary" />
            {t(lang, "tp_fare_title")}
          </div>
          <Badge variant="outline" className="text-[10px]">
            {t(lang, "tp_electrifyPct")}: {Math.round(T.fareSystem.electrificationPct)}%
          </Badge>
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">{t(lang, "tp_fare_subtitle")}</p>

        {/* Fare model selector */}
        <div className="mb-2">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {t(lang, "tp_fare_model")}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(["user", "partial", "zero"] as FareModel[]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={T.fareSystem.model === m ? "default" : "outline"}
                onClick={() => actions.setFareModel(m)}
                className="h-7 text-[11px]"
              >
                {t(lang, `tp_fare_model_${m}` as DictKey)}
              </Button>
            ))}
          </div>
          {T.fareSystem.model === "zero" && (
            <p className="mt-1 text-[10px] text-warning">{t(lang, "tp_zeroFare_warn")}</p>
          )}
        </div>

        {/* Bilhete Único */}
        <div className="mb-2 rounded border border-border/40 bg-background/40 p-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium">{t(lang, "tp_integration")}</div>
            <Button
              size="sm"
              variant={T.fareSystem.integrationEnabled ? "default" : "outline"}
              onClick={actions.toggleIntegration}
              className="h-6 text-[10px]"
            >
              {T.fareSystem.integrationEnabled ? t(lang, "tp_integration_on") : t(lang, "tp_integration_off")}
            </Button>
          </div>
          {T.fareSystem.integrationEnabled && (
            <div className="mt-1">
              <label className="text-[10px] text-muted-foreground">
                {t(lang, "tp_transferWindow")}: {T.fareSystem.transferWindowMin} min
              </label>
              <Slider
                value={[T.fareSystem.transferWindowMin]}
                min={60}
                max={180}
                step={15}
                onValueChange={([v]) => actions.setTransferWindow(v)}
                className="mt-1"
              />
            </div>
          )}
        </div>

        {/* Alternative funding levers */}
        <div className="mb-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {t(lang, "tp_corporateTax")}: {T.fareSystem.corporateMobilityTaxPct.toFixed(2)}%
            </label>
            <Slider
              value={[T.fareSystem.corporateMobilityTaxPct]}
              min={0} max={3} step={0.1}
              onValueChange={([v]) => actions.setCorporateMobilityTax(v)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Car className="h-3 w-3" />
              {t(lang, "tp_vehicleFee")}: R$ {T.fareSystem.vehicleMobilityFee.toFixed(0)}
            </label>
            <Slider
              value={[T.fareSystem.vehicleMobilityFee]}
              min={0} max={300} step={5}
              onValueChange={([v]) => actions.setVehicleMobilityFee(v)}
              className="mt-1"
            />
          </div>
        </div>
        <div className="mb-2 flex items-center justify-between rounded border border-success/30 bg-success/5 px-2 py-1 text-[11px]">
          <span className="text-muted-foreground">{t(lang, "tp_mobilityRevenue")}</span>
          <span className="text-mono font-semibold text-success">{formatMoney(T.lastMobilityRevenue)}</span>
        </div>

        {/* Electrification */}
        <div className="rounded border border-border/40 bg-background/40 p-2">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              <Zap className="h-3.5 w-3.5 text-warning" />
              {t(lang, "tp_electrification")}
            </div>
            <Button
              size="sm"
              variant={T.fareSystem.requireElectricBids ? "default" : "outline"}
              onClick={actions.toggleRequireElectricBids}
              className="h-6 text-[10px]"
            >
              {t(lang, "tp_requireElectric")}
            </Button>
          </div>
          <Progress value={T.fareSystem.electrificationPct} className="mb-1.5 h-1.5" />
          <label className="text-[10px] text-muted-foreground">
            {t(lang, "tp_electrifySpend")}: {formatMoney(T.fareSystem.electrifyMonthlyInvestment)}
          </label>
          <Slider
            value={[T.fareSystem.electrifyMonthlyInvestment]}
            min={0} max={800_000} step={20_000}
            onValueChange={([v]) => actions.setElectrifyInvestment(v)}
            className="mt-1"
          />
        </div>
      </section>


      {/* Farebox vs subsidy summary */}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <SummaryBar
          label={t(lang, "tp_farebox")}
          value={formatMoney(T.lastFarebox)}
          tone="success"
        />
        <SummaryBar
          label={t(lang, "tp_subsidyCost")}
          value={formatMoney(T.lastSubsidyCost)}
          tone="danger"
        />
      </div>

      {/* Modes grid */}
      <div className="grid gap-2 md:grid-cols-2">
        {(Object.keys(T.modes) as TransportModeId[]).map((id) => {
          const m = T.modes[id];
          const meta = MODE_META[id];
          const util = m.capacity > 0 ? Math.min(100, (m.ridership / m.capacity) * 100) : 0;
          const disabled = m.capacity <= 0;
          return (
            <div
              key={id}
              className={cn(
                "rounded-md border border-border/50 bg-background/40 p-3",
                disabled && "opacity-60",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <div className={cn("flex items-center gap-1.5 text-sm font-semibold", meta.tone)}>
                  <meta.Icon className="h-4 w-4" />
                  {t(lang, meta.key)}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {formatNumber(m.capacity)} {t(lang, "tp_capacity")}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[11px] text-muted-foreground">
                <MiniStat label={t(lang, "tp_riders")} value={formatNumber(m.ridership)} />
                <MiniStat label={t(lang, "tp_util")} value={`${Math.round(util)}%`} />
                <MiniStat label={t(lang, "tp_satisfaction")} value={`${Math.round(m.satisfaction)}`} />
              </div>
              <Progress value={util} className="mt-1.5 h-1.5" />

              {/* Sliders for fare/subsidy — informal fare is market-set unless legalized */}
              <div className="mt-2 space-y-1.5">
                <SliderRow
                  label={`${t(lang, "tp_fare")}: R$ ${m.fare.toFixed(2)}`}
                  value={m.fare}
                  min={0}
                  max={12}
                  step={0.25}
                  disabled={id === "van" && !T.legalizedInformal}
                  onChange={(v) => actions.setFare(id, v)}
                />
                {id !== "van" || T.legalizedInformal ? (
                  <SliderRow
                    label={`${t(lang, "tp_subsidy")}: R$ ${m.subsidy.toFixed(2)}`}
                    value={m.subsidy}
                    min={0}
                    max={5}
                    step={0.1}
                    onChange={(v) => actions.setSubsidy(id, v)}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Concession + bidding */}
      <section className="mt-4 rounded-md border border-border/50 bg-background/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Gavel className="h-4 w-4 text-primary" />
            {t(lang, "tp_concession")}
          </div>
          {!bidding && (
            <Button size="sm" onClick={actions.openBidding} disabled={state.treasury < 40_000}>
              {t(lang, "tp_openBidding")}
            </Button>
          )}
        </div>
        {T.concession ? (
          <div className="rounded border border-primary/40 bg-primary/5 p-2 text-xs">
            <div className="flex items-center justify-between font-medium">
              <span>{T.concession.operator}</span>
              <Badge>{t(lang, `tp_arch_${T.concession.archetype}` as DictKey)}</Badge>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 text-muted-foreground sm:grid-cols-4">
              <span>{t(lang, "tp_bid_fee")}: {formatMoney(T.concession.monthlyFee)}</span>
              <span>{t(lang, "tp_bid_fare")}: R$ {T.concession.fare.toFixed(2)}</span>
              <span>{t(lang, "tp_bid_quality")}: {T.concession.qualityFloor}</span>
              <span>{t(lang, "tp_bid_term")}: {T.concession.termMonthsRemaining}m</span>
            </div>
          </div>
        ) : !bidding ? (
          <p className="text-xs text-muted-foreground">{t(lang, "tp_noConcession")}</p>
        ) : null}

        {bidding && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t(lang, "tp_bidsTitle")}
              </div>
              <Button size="sm" variant="ghost" onClick={actions.cancelBidding}>
                {t(lang, "tp_reject")}
              </Button>
            </div>
            {T.openBids.map((b) => (
              <BidRow key={b.id} bid={b} lang={lang} onAward={() => actions.awardBid(b.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Mass transit builds */}
      <section className="mt-3 grid gap-2 rounded-md border border-border/50 bg-background/30 p-3 sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <TramFront className="h-4 w-4 text-info" />
            {t(lang, "tp_mass_title")}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
            <span>{t(lang, "tp_brtCount")}: {T.brtCorridors}</span>
            <span>{t(lang, "tp_metroCount")}: {T.metroStations}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button size="sm" variant="outline" onClick={actions.buildBrt} disabled={state.treasury < 850_000}>
            {t(lang, "tp_buildBrt")}
          </Button>
          <Button size="sm" variant="outline" onClick={actions.buildMetro} disabled={state.treasury < 2_400_000}>
            {t(lang, "tp_buildMetro")}
          </Button>
        </div>
      </section>

      {/* Informal transport controls */}
      <section className="mt-3 rounded-md border border-border/50 bg-background/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 text-warning" />
            {t(lang, "tp_informal_title")}
          </div>
          {T.legalizedInformal ? (
            <Badge className="gap-1 bg-success/20 text-success">
              <Handshake className="h-3 w-3" />
              {t(lang, "tp_legalizedBadge")}
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={actions.legalizeInformal} disabled={state.treasury < 180_000}>
              {t(lang, "tp_legalize")}
            </Button>
          )}
        </div>
        <div className="mt-2">
          <label className="text-[11px] text-muted-foreground">
            {t(lang, "tp_crackdown")}: {T.crackdownLevel}
          </label>
          <Slider
            value={[T.crackdownLevel]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => actions.setCrackdown(v)}
            className="mt-1"
          />
        </div>
      </section>

      {/* Traffic engineering interventions */}
      <section className="mb-3 rounded-md border border-border/50 bg-background/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Construction className="h-4 w-4 text-primary" />
            {t(lang, "tp_te_title")}
          </div>
          <Badge variant="outline" className="text-[10px]">
            {t(lang, "tp_te_induced")}: {Math.round(T.trafficEng.inducedDemand)}
          </Badge>
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">{t(lang, "tp_te_subtitle")}</p>

        {/* Road expansions — Downs-Thomson */}
        <div className="mb-2 rounded border border-border/40 bg-background/40 p-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium">
              {t(lang, "tp_te_expansions")}: {T.trafficEng.roadExpansions}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={actions.expandRoadway}
              disabled={state.treasury < 1_600_000}
              className="h-7 text-[10px]"
            >
              {t(lang, "tp_te_expand")}
            </Button>
          </div>
          <p className="mt-1 text-[10px] italic text-muted-foreground">
            {t(lang, "tp_te_induced_hint")}
          </p>
        </div>

        {/* Calming zones */}
        <div className="mb-2 rounded border border-border/40 bg-background/40 p-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 font-medium">
              <TrafficCone className="h-3.5 w-3.5 text-warning" />
              {t(lang, "tp_te_calming_count")}: {T.trafficEng.calmingZones}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={actions.buildCalmingZone}
              disabled={state.treasury < 120_000}
              className="h-7 text-[10px]"
            >
              {t(lang, "tp_te_calming")}
            </Button>
          </div>
        </div>

        {/* Operational levers */}
        <div className="mb-2 grid gap-2 sm:grid-cols-2">
          <Button
            size="sm"
            variant={T.trafficEng.reversibleLanes ? "default" : "outline"}
            onClick={actions.toggleReversibleLanes}
            disabled={!T.trafficEng.reversibleLanes && state.treasury < 90_000}
            className="h-8 justify-between text-[11px]"
          >
            <span className="flex items-center gap-1">
              <RouteIcon className="h-3.5 w-3.5" />
              {t(lang, "tp_te_reversible")}
            </span>
            <span className="text-[10px] opacity-75">
              {T.trafficEng.reversibleLanes ? t(lang, "tp_te_on") : t(lang, "tp_te_off")}
            </span>
          </Button>
          <Button
            size="sm"
            variant={T.trafficEng.smartSignals ? "default" : "outline"}
            onClick={actions.toggleSmartSignals}
            disabled={!T.trafficEng.smartSignals && state.treasury < 320_000}
            className="h-8 justify-between text-[11px]"
          >
            <span className="flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" />
              {t(lang, "tp_te_signals")}
            </span>
            <span className="text-[10px] opacity-75">
              {T.trafficEng.smartSignals ? t(lang, "tp_te_on") : t(lang, "tp_te_off")}
            </span>
          </Button>
        </div>

        {/* Paid parking */}
        <div className="rounded border border-border/40 bg-background/40 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium">
            <ParkingSquare className="h-3.5 w-3.5 text-primary" />
            {t(lang, "tp_te_parking")}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[10px] text-muted-foreground">
                {t(lang, "tp_te_parkCoverage")}: {T.trafficEng.paidParkingCoverage}%
              </label>
              <Slider
                value={[T.trafficEng.paidParkingCoverage]}
                min={0} max={100} step={5}
                onValueChange={([v]) => actions.setPaidParkingCoverage(v)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">
                {t(lang, "tp_te_parkFee")}: R$ {T.trafficEng.parkingHourlyFee.toFixed(2)}
              </label>
              <Slider
                value={[T.trafficEng.parkingHourlyFee]}
                min={0} max={15} step={0.5}
                onValueChange={([v]) => actions.setParkingFee(v)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between rounded border border-success/30 bg-success/5 px-2 py-1 text-[11px]">
            <span className="text-muted-foreground">{t(lang, "tp_te_parkRevenue")}</span>
            <span className="text-mono font-semibold text-success">{formatMoney(T.trafficEng.lastParkingRevenue)}</span>
          </div>
        </div>
      </section>
    </Card>
  );
}

function BidRow({ bid, lang, onAward }: { bid: ConcessionBid; lang: GameState["lang"]; onAward: () => void }) {
  return (
    <div className="rounded border border-border/50 bg-background/40 p-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <div className="font-semibold">{bid.operator}</div>
        <Badge variant="outline">{t(lang, `tp_arch_${bid.archetype}` as DictKey)}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-1 text-muted-foreground sm:grid-cols-5">
        <span>{t(lang, "tp_bid_fee")}: {formatMoney(bid.monthlyFee)}</span>
        <span>{t(lang, "tp_bid_fare")}: R$ {bid.proposedFare.toFixed(2)}</span>
        <span>{t(lang, "tp_bid_quality")}: {bid.qualityCommit}</span>
        <span>{t(lang, "tp_bid_risk")}: {(bid.reliabilityRisk * 100).toFixed(0)}%</span>
        <span>{t(lang, "tp_bid_term")}: {bid.termMonths}m</span>
      </div>
      <div className="mt-1.5 flex justify-end">
        <Button size="sm" onClick={onAward}>{t(lang, "tp_award")}</Button>
      </div>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, disabled, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  disabled?: boolean; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/40 bg-background/30 px-1.5 py-0.5">
      <div className="text-[9px] uppercase tracking-widest">{label}</div>
      <div className="text-mono text-[11px] font-medium text-foreground">{value}</div>
    </div>
  );
}

function Kpi({
  label, value, icon, tone = "default",
}: {
  label: string; value: string; icon?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "danger"  ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded border border-border/40 bg-background/40 px-2 py-1 text-right">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("flex items-center justify-end gap-1 text-sm font-semibold", toneClass)}>
        {icon}{value}
      </div>
    </div>
  );
}

function SummaryBar({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded border px-3 py-1.5 text-xs",
        tone === "success"
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="text-mono font-semibold">{value}</span>
    </div>
  );
}

// avoid unused import warning
void useState;

export const TransportPanel = /*#__PURE__*/ memo(TransportPanelImpl);
