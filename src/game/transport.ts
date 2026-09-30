/**
 * Transport module — commuter simulation, concession bidding, fares & subsidies,
 * informal micro-transit competition, and mass-transit (BRT / metro) assets.
 *
 * The model runs once per monthly tick. It splits the city's commuter demand
 * between four modes (formal bus, informal van, BRT, metro) using attractiveness
 * scores, then produces:
 *   - farebox revenue (formal modes only, informal is off-books)
 *   - subsidy cost (per-trip subsidy + fixed concession fee)
 *   - satisfaction feedback that nudges happiness + transport policy
 *   - informal share, unmet demand and pollution deltas for the environment
 *
 * The design goal: keep the numbers legible for the player while producing
 * distinct equilibria — a low-fare, high-subsidy metro-heavy city looks very
 * different from a laissez-faire city where vans dominate.
 */
import type { GameState } from "./types";

export type TransportModeId = "bus" | "van" | "brt" | "metro";

export interface TransportMode {
  id: TransportModeId;
  /** Trips/month this mode can carry at full deployment. */
  capacity: number;
  /** Fare paid by commuter, R$. Informal vans set their own market fare. */
  fare: number;
  /** Per-trip subsidy the city pays to the operator (formal modes only). */
  subsidy: number;
  /** 0..100 comfort/reliability score influencing rider choice. */
  quality: number;
  /** Trips actually carried last tick. */
  ridership: number;
  /** 0..100 rolling rider satisfaction. */
  satisfaction: number;
}

export interface ConcessionBid {
  id: string;
  operator: string;
  /** Monthly fixed fee the city pays this bidder. */
  monthlyFee: number;
  proposedFare: number;
  /** Quality the operator commits to (0..100). */
  qualityCommit: number;
  /** 0..1 — probability the operator underdelivers. Lower is better. */
  reliabilityRisk: number;
  archetype: "public" | "private" | "cooperative";
  /** Length of contract if awarded (months). */
  termMonths: number;
}

export interface Concession {
  operator: string;
  monthlyFee: number;
  fare: number;
  qualityFloor: number;
  termMonthsRemaining: number;
  archetype: ConcessionBid["archetype"];
}

export interface ModalSplit {
  /** Share of commuters 0..1 by macro-mode. Sum = 1. */
  car: number;
  moto: number;
  transit: number;
  active: number;
  /** Raw trip counts (last tick). */
  carRiders: number;
  motoRiders: number;
  activeRiders: number;
  /** Road congestion index 0..100 (>60 = jam, >85 = gridlock). */
  congestion: number;
  /** Serious accidents last tick (mostly motorcycles). */
  accidents: number;
  /** Extra municipal health cost caused by traffic accidents (R$). */
  healthCost: number;
}

/**
 * Fare & subsidy regime. Encapsulates the three big financial levers:
 *   1) Bilhete Único: integrated fare across bus/BRT/metro within a transfer
 *      window. Boosts transit satisfaction & peripheral access; costs city
 *      because the second leg is compensated to operators.
 *   2) Fare model: who pays for the ride — the rider, split with the city,
 *      or the city entirely (Tarifa Zero). Zero-fare requires alt funding.
 *   3) Electrification: monthly capex converts diesel buses into electric,
 *      reducing pollution and (long-term) operating cost.
 */
export type FareModel = "user" | "partial" | "zero";

export interface FareSystem {
  model: FareModel;
  /** Bilhete Único on/off across bus/BRT/metro. */
  integrationEnabled: boolean;
  /** Free-transfer window in minutes (60..180). */
  transferWindowMin: number;
  /** ISS-like surcharge on medium/large employers to fund the system, 0..3%. */
  corporateMobilityTaxPct: number;
  /** Monthly R$ fee per private car user (mobility levy). */
  vehicleMobilityFee: number;
  /** 0..100 share of formal bus fleet electrified. */
  electrificationPct: number;
  /** Monthly R$ capex directed at fleet electrification. */
  electrifyMonthlyInvestment: number;
  /** New concession bids must commit to ≥50% electric fleet. */
  requireElectricBids: boolean;
}

/**
 * Traffic-engineering interventions layered on top of the modal split.
 * Encapsulates infrastructure levers a traffic engineer would recommend, and
 * their behavioural consequences (Downs-Thomson induced demand, calming
 * safety gains, operational optimisations, and parking-side demand management).
 */
export interface TrafficEngineering {
  /** Avenue-widening + viaduct projects the player has built (cumulative). */
  roadExpansions: number;
  /** Months since the last expansion project — clocks induced-demand ramp. */
  monthsSinceExpansion: number;
  /** 0..30 rolling induced-demand pressure that shifts commuters back to car. */
  inducedDemand: number;
  /** Traffic-calming districts (Zona 30 + chicanes + faixa elevada) built. */
  calmingZones: number;
  /** Reversible-lane program active on peak-hour arterials. */
  reversibleLanes: boolean;
  /** Adaptive signalization on the arterial network (SCOOT/SCATS-like). */
  smartSignals: boolean;
  /** 0..100 share of central curb converted to paid rotating parking. */
  paidParkingCoverage: number;
  /** R$/hour meter fee. */
  parkingHourlyFee: number;
  /** Revenue collected from the parking program last tick. */
  lastParkingRevenue: number;
}

export interface TransportState {
  modes: Record<TransportModeId, TransportMode>;
  concession: Concession | null;
  /** Non-empty while an auction is pending player decision. */
  openBids: ConcessionBid[];
  /** 0..100 — enforcement pressure against unlicensed vans. */
  crackdownLevel: number;
  /** True after the player converts the informal fleet into a coop. */
  legalizedInformal: boolean;
  brtCorridors: number;
  metroStations: number;

  /* Physical infrastructure & pricing levers (private/active modes) */
  /** Kilometers of cycleway + accessible sidewalk built by the player. */
  cyclewayKm: number;
  /** Perceived fuel price at the pump (R$/L). Tax-adjustable. */
  fuelPricePerLiter: number;
  /** Effective road capacity index (100 = baseline). BRT corridors carve it. */
  roadCapacityIndex: number;

  /** Telemetry (last tick) */
  lastFarebox: number;
  lastSubsidyCost: number;
  /** Alternative funding raised last tick (corporate + vehicle mobility fee). */
  lastMobilityRevenue: number;
  /** R$ spent on electrification capex last tick. */
  lastElectrificationSpend: number;
  informalShare: number;
  totalCommuters: number;
  unmet: number;
  /** Small pollution delta this mode balance produced last tick (-/+). */
  lastPollutionDelta: number;
  /** Modal split & traffic physics telemetry from the last tick. */
  split: ModalSplit;
  /** Fare & subsidy regime. */
  fareSystem: FareSystem;
  /** Traffic-engineering interventions layer. */
  trafficEng: TrafficEngineering;
}

/* ---------------------- Defaults & factories ---------------------- */

export const BRT_COST = 850_000;
export const METRO_COST = 2_400_000;
export const AUCTION_COST = 40_000;
export const CRACKDOWN_MONTHLY_COST_PER_UNIT = 900;

export function defaultTransport(): TransportState {
  return {
    modes: {
      bus:   { id: "bus",   capacity: 220_000, fare: 4.5, subsidy: 1.2, quality: 55, ridership: 0, satisfaction: 55 },
      van:   { id: "van",   capacity:  90_000, fare: 5.0, subsidy: 0.0, quality: 45, ridership: 0, satisfaction: 50 },
      brt:   { id: "brt",   capacity:       0, fare: 4.5, subsidy: 0.8, quality: 78, ridership: 0, satisfaction: 70 },
      metro: { id: "metro", capacity:       0, fare: 5.5, subsidy: 1.5, quality: 88, ridership: 0, satisfaction: 78 },
    },
    concession: null,
    openBids: [],
    crackdownLevel: 0,
    legalizedInformal: false,
    brtCorridors: 0,
    metroStations: 0,
    lastFarebox: 0,
    lastSubsidyCost: 0,
    lastMobilityRevenue: 0,
    lastElectrificationSpend: 0,
    informalShare: 0,
    totalCommuters: 0,
    unmet: 0,
    lastPollutionDelta: 0,
    cyclewayKm: 0,
    fuelPricePerLiter: 5.8,
    roadCapacityIndex: 100,
    split: emptySplit(),
    fareSystem: defaultFareSystem(),
    trafficEng: defaultTrafficEngineering(),
  };
}

export function defaultTrafficEngineering(): TrafficEngineering {
  return {
    roadExpansions: 0,
    monthsSinceExpansion: 999,
    inducedDemand: 0,
    calmingZones: 0,
    reversibleLanes: false,
    smartSignals: false,
    paidParkingCoverage: 0,
    parkingHourlyFee: 5,
    lastParkingRevenue: 0,
  };
}

export function defaultFareSystem(): FareSystem {
  return {
    model: "user",
    integrationEnabled: false,
    transferWindowMin: 90,
    corporateMobilityTaxPct: 0,
    vehicleMobilityFee: 0,
    electrificationPct: 0,
    electrifyMonthlyInvestment: 0,
    requireElectricBids: false,
  };
}

function emptySplit(): ModalSplit {
  return {
    car: 0.25, moto: 0.10, transit: 0.55, active: 0.10,
    carRiders: 0, motoRiders: 0, activeRiders: 0,
    congestion: 20, accidents: 0, healthCost: 0,
  };
}

export function ensureTransport(s: GameState): void {
  const bag = s as unknown as { transport?: TransportState };
  if (!bag.transport || !bag.transport.modes || !bag.transport.modes.bus) {
    bag.transport = defaultTransport();
    return;
  }
  // Back-fill new fields for saves created before the modal-split expansion.
  const t = bag.transport as Partial<TransportState> & TransportState;
  if (typeof t.cyclewayKm !== "number") t.cyclewayKm = 0;
  if (typeof t.fuelPricePerLiter !== "number") t.fuelPricePerLiter = 5.8;
  if (typeof t.roadCapacityIndex !== "number") t.roadCapacityIndex = 100;
  if (!t.split) t.split = emptySplit();
  if (!t.fareSystem) t.fareSystem = defaultFareSystem();
  if (typeof t.lastMobilityRevenue !== "number") t.lastMobilityRevenue = 0;
  if (typeof t.lastElectrificationSpend !== "number") t.lastElectrificationSpend = 0;
  if (!t.trafficEng) t.trafficEng = defaultTrafficEngineering();
}

/* ---------------------- Player actions ---------------------- */

export function openBidding(s: GameState, rng: () => number): boolean {
  ensureTransport(s);
  if (s.treasury < AUCTION_COST) return false;
  s.treasury -= AUCTION_COST;

  const pop = s.population;
  const baseFee = Math.max(60_000, Math.round(pop * 0.9));
  const operators = ["Viação Aurora", "Real Metropolitana", "TransUnião", "CoopMob", "Norte Trânsito"];
  const bids: ConcessionBid[] = [];
  // 3–4 bidders, each biased by an archetype.
  const n = 3 + (rng() < 0.5 ? 0 : 1);
  const shuffled = [...operators].sort(() => rng() - 0.5);
  for (let i = 0; i < n; i++) {
    const roll = rng();
    const arch: ConcessionBid["archetype"] =
      roll < 0.45 ? "private" : roll < 0.8 ? "public" : "cooperative";
    const feeMult =
      arch === "public" ? 1.15 + rng() * 0.15 :
      arch === "private" ? 0.85 + rng() * 0.25 :
      0.95 + rng() * 0.15;
    const qualCommit = Math.round(
      (arch === "public" ? 72 : arch === "private" ? 60 : 68) + rng() * 15,
    );
    const risk =
      arch === "private" ? 0.15 + rng() * 0.25 :
      arch === "cooperative" ? 0.12 + rng() * 0.18 :
      0.05 + rng() * 0.15;
    const electricPremium = s.transport.fareSystem?.requireElectricBids ? 1.25 : 1;
    const electricQualBonus = s.transport.fareSystem?.requireElectricBids ? 8 : 0;
    bids.push({
      id: `bid-${s.year}-${s.month}-${i}-${Math.floor(rng() * 9999)}`,
      operator: shuffled[i % shuffled.length],
      monthlyFee: Math.round(baseFee * feeMult * electricPremium),
      proposedFare: Number((3.8 + rng() * 2.4).toFixed(2)),
      qualityCommit: Math.max(40, Math.min(95, qualCommit + electricQualBonus)),
      reliabilityRisk: Number(risk.toFixed(2)),
      archetype: arch,
      termMonths: 24 + Math.floor(rng() * 25),
    });
  }
  s.transport.openBids = bids;
  return true;
}

export function awardBid(s: GameState, bidId: string): boolean {
  ensureTransport(s);
  const bid = s.transport.openBids.find((b) => b.id === bidId);
  if (!bid) return false;
  s.transport.concession = {
    operator: bid.operator,
    monthlyFee: bid.monthlyFee,
    fare: bid.proposedFare,
    qualityFloor: bid.qualityCommit,
    termMonthsRemaining: bid.termMonths,
    archetype: bid.archetype,
  };
  // Adopt the concession's fare/quality on the formal bus.
  s.transport.modes.bus.fare = bid.proposedFare;
  s.transport.modes.bus.quality = Math.round(
    (s.transport.modes.bus.quality + bid.qualityCommit) / 2,
  );
  if (s.transport.fareSystem?.requireElectricBids) {
    // Winning bid commits to 50% electric fleet on day one.
    s.transport.fareSystem.electrificationPct = Math.max(
      s.transport.fareSystem.electrificationPct, 50,
    );
  }
  s.transport.openBids = [];
  return true;
}

export function cancelBidding(s: GameState): void {
  ensureTransport(s);
  s.transport.openBids = [];
}

export function setModeFare(s: GameState, id: TransportModeId, value: number): void {
  ensureTransport(s);
  s.transport.modes[id].fare = Math.max(0, Math.min(20, value));
}

export function setModeSubsidy(s: GameState, id: TransportModeId, value: number): void {
  ensureTransport(s);
  s.transport.modes[id].subsidy = Math.max(0, Math.min(8, value));
}

export function buildBrtCorridor(s: GameState): boolean {
  ensureTransport(s);
  if (s.treasury < BRT_COST) return false;
  s.treasury -= BRT_COST;
  s.transport.brtCorridors += 1;
  s.transport.modes.brt.capacity += 60_000;
  s.transport.modes.brt.quality = Math.min(95, s.transport.modes.brt.quality + 1);
  return true;
}

export function buildMetroStation(s: GameState): boolean {
  ensureTransport(s);
  if (s.treasury < METRO_COST) return false;
  s.treasury -= METRO_COST;
  s.transport.metroStations += 1;
  s.transport.modes.metro.capacity += 80_000;
  s.transport.modes.metro.quality = Math.min(98, s.transport.modes.metro.quality + 1);
  return true;
}

export function setCrackdown(s: GameState, value: number): void {
  ensureTransport(s);
  s.transport.crackdownLevel = Math.max(0, Math.min(100, value));
}

export function legalizeInformal(s: GameState): boolean {
  ensureTransport(s);
  if (s.transport.legalizedInformal) return false;
  const cost = 180_000;
  if (s.treasury < cost) return false;
  s.treasury -= cost;
  s.transport.legalizedInformal = true;
  // Bring the fleet under the concession umbrella: capacity survives,
  // quality bumps, and fares stabilize.
  s.transport.modes.van.quality = Math.min(80, s.transport.modes.van.quality + 12);
  s.transport.modes.van.subsidy = Math.max(s.transport.modes.van.subsidy, 0.4);
  return true;
}

export const CYCLEWAY_COST_PER_KM = 22_000;

/** Build 1km of cycleway + accessible sidewalk. Boosts active-mode share and
 *  slightly reduces perceived road capacity (space reallocation). */
export function buildCycleway(s: GameState): boolean {
  ensureTransport(s);
  if (s.treasury < CYCLEWAY_COST_PER_KM) return false;
  s.treasury -= CYCLEWAY_COST_PER_KM;
  s.transport.cyclewayKm += 1;
  return true;
}

/** Player-controlled fuel price (proxy for municipal fuel tax + federal price).
 *  Higher prices push commuters away from cars. Clamped R$ 3.50–R$ 12.00. */
export function setFuelPrice(s: GameState, value: number): void {
  ensureTransport(s);
  s.transport.fuelPricePerLiter = Math.max(3.5, Math.min(12, value));
}

/* ---------------------- Fare, subsidy & electrification actions ---------------------- */

export function setFareModel(s: GameState, model: FareModel): void {
  ensureTransport(s);
  s.transport.fareSystem.model = model;
}
export function toggleFareIntegration(s: GameState): void {
  ensureTransport(s);
  s.transport.fareSystem.integrationEnabled = !s.transport.fareSystem.integrationEnabled;
}
export function setTransferWindow(s: GameState, minutes: number): void {
  ensureTransport(s);
  s.transport.fareSystem.transferWindowMin = Math.max(60, Math.min(180, Math.round(minutes)));
}
export function setCorporateMobilityTax(s: GameState, pct: number): void {
  ensureTransport(s);
  s.transport.fareSystem.corporateMobilityTaxPct = Math.max(0, Math.min(3, pct));
}
export function setVehicleMobilityFee(s: GameState, value: number): void {
  ensureTransport(s);
  s.transport.fareSystem.vehicleMobilityFee = Math.max(0, Math.min(300, value));
}
export function setElectrifyInvestment(s: GameState, value: number): void {
  ensureTransport(s);
  s.transport.fareSystem.electrifyMonthlyInvestment = Math.max(0, Math.min(3_000_000, Math.round(value)));
}
export function toggleRequireElectricBids(s: GameState): void {
  ensureTransport(s);
  s.transport.fareSystem.requireElectricBids = !s.transport.fareSystem.requireElectricBids;
}

/* ---------------------- Traffic-engineering actions ---------------------- */

export const ROAD_EXPANSION_COST = 1_600_000;
export const CALMING_ZONE_COST = 120_000;
export const REVERSIBLE_LANE_SETUP = 90_000;
export const REVERSIBLE_LANE_MONTHLY = 6_000;
export const SMART_SIGNALS_SETUP = 320_000;
export const SMART_SIGNALS_MONTHLY = 12_000;
export const PAID_PARKING_ROLLOUT = 40_000;

/** Widen an avenue / build a viaduct. Bumps road capacity permanently but
 *  triggers induced-demand: over the next ~6 months, more commuters switch
 *  back to the car, saturating the new lanes (Downs-Thomson). */
export function expandRoadway(s: GameState): boolean {
  ensureTransport(s);
  if (s.treasury < ROAD_EXPANSION_COST) return false;
  s.treasury -= ROAD_EXPANSION_COST;
  const te = s.transport.trafficEng;
  te.roadExpansions += 1;
  te.monthsSinceExpansion = 0;
  s.transport.roadCapacityIndex += 8;
  te.inducedDemand = Math.min(30, te.inducedDemand + 4);
  return true;
}

/** Build a Zona 30 / traffic-calming district. Cuts pedestrian/cyclist
 *  accidents; small cost to arterial capacity in that district. */
export function buildCalmingZone(s: GameState): boolean {
  ensureTransport(s);
  if (s.treasury < CALMING_ZONE_COST) return false;
  s.treasury -= CALMING_ZONE_COST;
  s.transport.trafficEng.calmingZones += 1;
  return true;
}

export function toggleReversibleLanes(s: GameState): boolean {
  ensureTransport(s);
  const te = s.transport.trafficEng;
  if (!te.reversibleLanes) {
    if (s.treasury < REVERSIBLE_LANE_SETUP) return false;
    s.treasury -= REVERSIBLE_LANE_SETUP;
  }
  te.reversibleLanes = !te.reversibleLanes;
  return true;
}

export function toggleSmartSignals(s: GameState): boolean {
  ensureTransport(s);
  const te = s.transport.trafficEng;
  if (!te.smartSignals) {
    if (s.treasury < SMART_SIGNALS_SETUP) return false;
    s.treasury -= SMART_SIGNALS_SETUP;
  }
  te.smartSignals = !te.smartSignals;
  return true;
}

export function setPaidParkingCoverage(s: GameState, value: number): boolean {
  ensureTransport(s);
  const te = s.transport.trafficEng;
  const wasZero = te.paidParkingCoverage <= 0;
  const next = Math.max(0, Math.min(100, Math.round(value)));
  if (wasZero && next > 0) {
    if (s.treasury < PAID_PARKING_ROLLOUT) return false;
    s.treasury -= PAID_PARKING_ROLLOUT;
  }
  te.paidParkingCoverage = next;
  return true;
}

export function setParkingFee(s: GameState, value: number): void {
  ensureTransport(s);
  s.transport.trafficEng.parkingHourlyFee = Math.max(0, Math.min(15, value));
}

/* ---------------------- Monthly simulation ---------------------- */


interface TickOutput {
  farebox: number;
  subsidy: number;
  pollutionDelta: number;
  happinessDelta: number;
  /** Extra municipal health cost from traffic accidents (R$). */
  healthCost: number;
  /** Serious accidents this month (mostly motorcycles). */
  accidents: number;
}

export function tickTransport(s: GameState, rng: () => number): TickOutput {
  ensureTransport(s);
  const T = s.transport;
  // Total monthly commuter trips: two trips per employed adult, roughly.
  const employed = s.population * (1 - s.unemployment / 100);
  const totalCommuters = Math.round(employed * 1.8);
  T.totalCommuters = totalCommuters;

  // Concession contract countdown + monthly fee.
  let fixedFees = 0;
  if (T.concession) {
    fixedFees = T.concession.monthlyFee;
    T.concession.termMonthsRemaining -= 1;
    if (T.concession.termMonthsRemaining <= 0) T.concession = null;
  }

  /* Traffic-engineering pressure (Downs-Thomson).
   * After each avenue widening, induced demand climbs toward a target that
   * scales with the number of past expansions, then decays slowly. The value
   * feeds carScore below, so brand-new lanes fill up over ~6 months. */
  const TE = T.trafficEng;
  TE.monthsSinceExpansion = Math.min(999, TE.monthsSinceExpansion + 1);
  const inducedTarget = Math.min(30, TE.roadExpansions * 6);
  // Ramp up if we're below target (first 6 months feel free), decay slowly after.
  if (TE.inducedDemand < inducedTarget) {
    TE.inducedDemand = Math.min(inducedTarget, TE.inducedDemand + inducedTarget / 6);
  } else {
    TE.inducedDemand = Math.max(0, TE.inducedDemand - 0.4);
  }


  // Green Transit sustainability lever provides a small quality tailwind for
  // formal modes (electrification, priority lanes, integrated ticketing).
  const green = (s.sustainability?.greenTransit ?? 0) / 100;
  const transportPolicy = s.policies.transport / 100;

  /* ============================================================
   * PHASE 1 — Macro modal split (private / transit / active).
   *
   * Split commuter trips into five modes across two layers:
   *   Layer A (macro):   car / moto / transit / active
   *   Layer B (transit): bus / van / brt / metro (existing model)
   *
   * Drivers per macro mode:
   *   - Income proxy: high income → more cars, more active-of-leisure.
   *   - Fuel price: higher fuel → fewer cars, some spillover to moto.
   *   - Transit quality: better transit → less car dependency.
   *   - Infrastructure: cycleways + green transit → more active mode.
   *   - Informality/unemployment: pushes toward moto (app delivery, mototáxi).
   *   - Comfort/status: baseline preference for private cars in Brazil.
   * ============================================================ */
  const incomeProxy = Math.max(0.4, Math.min(1.4,
    ((s.peripheryMiddleClass ?? 1) - 1) * 0.6 + 1 + (60 - s.unemployment) * 0.006,
  ));
  const informalPressure = (((s.informal?.informalWorkers ?? 30) / 100) + s.unemployment / 100) / 2;
  const cyclewayCoverage = Math.min(1, T.cyclewayKm / Math.max(1, s.population / 1200));
  const activeInfra = cyclewayCoverage * 0.6 + green * 0.35 + transportPolicy * 0.15;

  // Average transit "goodness" — capacity-weighted quality of served modes.
  const transitCap = T.modes.bus.capacity + T.modes.brt.capacity + T.modes.metro.capacity + T.modes.van.capacity;
  const transitQuality = transitCap > 0
    ? (T.modes.bus.quality   * T.modes.bus.capacity   +
       T.modes.brt.quality   * T.modes.brt.capacity   +
       T.modes.metro.quality * T.modes.metro.capacity +
       T.modes.van.quality   * T.modes.van.capacity) / transitCap
    : 20;

  // Base scores, then normalize.
  const fuelSqueeze = (T.fuelPricePerLiter - 5.5) * 0.08; // ±R$1 → ±0.08
  // Paid-parking demand cap: coverage × fee shifts short central trips away
  // from private cars (up to ~0.06 shift at full coverage + R$ 5/h).
  const parkingSuppression = (TE.paidParkingCoverage / 100) * (TE.parkingHourlyFee / 5) * 0.06;
  const carScore = clamp(
    0.32 * incomeProxy - fuelSqueeze - (transitQuality - 55) * 0.004 + 0.06
      + TE.inducedDemand * 0.004    // Downs-Thomson induced demand
      - parkingSuppression,
    0.05, 0.75,
  );
  const motoScore = clamp(
    0.10 + informalPressure * 0.35 + Math.max(0, fuelSqueeze) * 0.6 + (T.split.congestion - 30) * 0.002,
    0.02, 0.45,
  );
  const activeScore = clamp(0.06 + activeInfra * 0.35, 0.02, 0.35);
  // Transit gets what's left of the appetite pool, before capacity checks.
  const rawSum = carScore + motoScore + activeScore;
  const transitScore = Math.max(0.10, 1 - rawSum);
  const denom = carScore + motoScore + activeScore + transitScore;

  let carShare     = carScore     / denom;
  let motoShare    = motoScore    / denom;
  let activeShare  = activeScore  / denom;
  let transitShare = transitScore / denom;

  // Fare-model demand pull: partial fare pulls a slice of car/moto users into
  // transit; Tarifa Zero produces a much larger shock (bounded to avoid meltdown).
  const F = T.fareSystem;
  const fareModelPull =
    F.model === "zero"    ? 0.14 :
    F.model === "partial" ? 0.06 : 0;
  if (fareModelPull > 0) {
    const donor = carShare * 0.6 + motoShare * 0.4;
    const shift = Math.min(donor, fareModelPull);
    const carCut  = shift * (carShare  / Math.max(0.0001, carShare + motoShare));
    const motoCut = shift * (motoShare / Math.max(0.0001, carShare + motoShare));
    carShare  -= carCut;
    motoShare -= motoCut;
    transitShare += shift;
  }
  // Bilhete Único gives a small additional pull (easier multi-leg journeys).
  if (F.integrationEnabled) {
    const bump = 0.03 + Math.max(0, F.transferWindowMin - 90) * 0.00035;
    const cut = Math.min(carShare * 0.5, bump);
    carShare -= cut;
    transitShare += cut;
  }

  // Cycleway coverage caps active share so cities without infra can't walk.
  activeShare = Math.min(activeShare, 0.05 + activeInfra * 0.4);
  // Redistribute residual to transit (car substitution happens via fuel/policy).
  const residual = 1 - (carShare + motoShare + activeShare + transitShare);
  transitShare += residual;

  const carRiders    = Math.round(totalCommuters * carShare);
  const motoRiders   = Math.round(totalCommuters * motoShare);
  const activeRiders = Math.round(totalCommuters * activeShare);
  const transitDemand = Math.max(0, totalCommuters - carRiders - motoRiders - activeRiders);

  /* ============================================================
   * PHASE 2 — Traffic physics (congestion + accidents).
   * Car-equivalents load the road network; BRT corridors carve out
   * exclusive lanes, easing surface bus traffic proportionally.
   * ============================================================ */
  // Car ~ 1.0 PCE, moto ~ 0.35, bus ~ 3.0 (but only 15% still on shared lanes
  // once BRT corridors are built).
  // Operational levers: reversible lanes add peak-hour capacity, smart signals
  // smooth arterial flow, calming zones remove a bit of arterial throughput.
  const reversibleBonus = TE.reversibleLanes ? 8 : 0;
  const smartBonus      = TE.smartSignals    ? 12 : 0;
  const calmingCost     = TE.calmingZones * 1;
  const roadCapacity = Math.max(60,
    T.roadCapacityIndex + T.brtCorridors * 6 - T.cyclewayKm * 0.3
      + reversibleBonus + smartBonus - calmingCost,
  );
  const busSurfaceShare = Math.max(0.15, 1 - T.brtCorridors * 0.12);
  const busPCE = T.modes.bus.capacity > 0 ? (totalCommuters * 0.05) * busSurfaceShare : 0;
  const pce = carRiders * 1.0 + motoRiders * 0.35 + busPCE;
  let congestion = clamp((pce / Math.max(1, roadCapacity * (s.population / 1500))) * 55 + 12, 0, 100);
  // Smart signals shave 8% off the congestion index (green-wave smoothing).
  if (TE.smartSignals) congestion = Math.max(0, congestion * 0.92);

  // Moto accidents scale with moto ridership × congestion. Traffic-calming
  // zones cut both moto and pedestrian/cyclist crashes proportionally.
  const calmingSafety = TE.calmingZones / (TE.calmingZones + 5); // 0..~0.55
  const motoAccidentRate = 0.00035 * (1 + congestion / 80) * (1 - calmingSafety * 0.55);
  const accidents = Math.round(motoRiders * motoAccidentRate + rng() * 3 * (1 - calmingSafety * 0.4));
  const healthCost = Math.round(accidents * 1800 + motoRiders * 0.4); // hospital ER + rehab

  /* ============================================================
   * PHASE 3 — Distribute transitDemand across bus/van/brt/metro
   * using the existing attractiveness model, but with congestion
   * penalizing surface bus (efeito comboio) unless BRT is present.
   * ============================================================ */
  const modeIds: TransportModeId[] = ["bus", "van", "brt", "metro"];
  const attractiveness: Record<TransportModeId, number> = { bus: 0, van: 0, brt: 0, metro: 0 };
  for (const id of modeIds) {
    const m = T.modes[id];
    if (m.capacity <= 0) continue;
    let q = m.quality;
    if (id === "bus" || id === "brt" || id === "metro") q += green * 12 + transportPolicy * 6;
    if (id === "bus") {
      // Efeito comboio: surface buses lose speed and reliability under jams.
      const jamPenalty = Math.max(0, congestion - 40) * 0.6 * busSurfaceShare;
      q -= jamPenalty;
    }
    if (id === "van") {
      q -= T.crackdownLevel * 0.15;
      if (T.legalizedInformal) q += 6;
    }
    const fareScore = Math.max(0.2, 1 - m.fare / 10);
    attractiveness[id] = Math.max(0, q) * fareScore;
  }
  const attractSum = modeIds.reduce((a, id) => a + attractiveness[id], 0) || 1;

  const desired: Record<TransportModeId, number> = { bus: 0, van: 0, brt: 0, metro: 0 };
  for (const id of modeIds) {
    desired[id] = transitDemand * (attractiveness[id] / attractSum);
  }

  let unmet = 0;
  const actual: Record<TransportModeId, number> = { bus: 0, van: 0, brt: 0, metro: 0 };
  for (const id of modeIds) {
    const cap = T.modes[id].capacity;
    if (cap <= 0) { unmet += desired[id]; continue; }
    const carried = Math.min(desired[id], cap);
    actual[id] = carried;
    unmet += desired[id] - carried;
  }
  const vanElastic = Math.min(unmet, T.modes.van.capacity * 0.4);
  actual.van += vanElastic;
  unmet -= vanElastic;

  // Farebox / satisfaction pass.
  // The fare regime rescales what the rider actually pays; the shortfall
  // becomes a per-trip subsidy the city owes the operator.
  const fareMultiplier = F.model === "user" ? 1 : F.model === "partial" ? 0.5 : 0;
  // Bilhete Único: about 30% of formal-transit trips involve a transfer that
  // would otherwise pay a second fare; the city compensates 65% of that leg.
  const integrationSharePerLeg = F.integrationEnabled ? 0.30 : 0;
  const integrationCityCoverage = 0.65;

  let farebox = 0;
  let variableSubsidy = 0;
  let integrationCost = 0;
  for (const id of modeIds) {
    const m = T.modes[id];
    m.ridership = Math.round(actual[id]);
    const formalRider = id !== "van" || T.legalizedInformal;
    const informalDiscount = id === "van" && T.legalizedInformal ? 0.5 : 1;
    const effectiveFareRider = formalRider ? m.fare * fareMultiplier * informalDiscount : m.fare;
    if (formalRider) {
      // Rider pays the effective fare; the city compensates the operator
      // for (a) the fare-model shortfall and (b) the integration transfer leg.
      const paidByRider = m.ridership * effectiveFareRider;
      const shortfall   = m.ridership * (m.fare * informalDiscount - effectiveFareRider);
      farebox += paidByRider;
      variableSubsidy += m.ridership * m.subsidy + shortfall;
      if (id === "bus" || id === "brt" || id === "metro") {
        integrationCost += m.ridership * integrationSharePerLeg * m.fare * integrationCityCoverage;
      }
    }
    const util = m.capacity > 0 ? m.ridership / m.capacity : 0;
    // Satisfaction uses effective (paid) fare so Tarifa Zero feels great;
    // over-utilization still bites.
    const perceivedFare = formalRider ? effectiveFareRider : m.fare;
    const integrationBonus = F.integrationEnabled && (id === "bus" || id === "brt" || id === "metro") ? 4 : 0;
    const satTarget = Math.max(0, Math.min(100,
      m.quality + integrationBonus
        - (util > 0.85 ? (util - 0.85) * 120 : 0)
        - Math.max(0, (perceivedFare - 6) * 4),
    ));
    m.satisfaction = m.satisfaction + (satTarget - m.satisfaction) * 0.3;
  }
  const crackdownCost = T.crackdownLevel * CRACKDOWN_MONTHLY_COST_PER_UNIT;
  farebox += Math.round((T.crackdownLevel / 100) * T.modes.van.ridership * 0.15 * (0.6 + rng() * 0.8));

  /* ---------- Alternative funding: corporate + vehicle mobility levy ---------- */
  // Corporate levy proxy: percentage on the local economic base.
  // The base is roughly monthly private wage bill ≈ population * R$ 900.
  const corporateBase = s.population * 900;
  const corporateRevenue = corporateBase * (F.corporateMobilityTaxPct / 100);
  // Vehicle levy: ~1 unique car per 40 monthly car trips (2 trips/day × 20 workdays).
  const carUsers = carRiders / 40;
  const vehicleRevenue = carUsers * F.vehicleMobilityFee;
  // A high car tax reduces car use next tick via the fuel-squeeze proxy —
  // model that by nudging the fuel price perceived by drivers upward slightly.
  if (F.vehicleMobilityFee > 20) {
    T.fuelPricePerLiter = Math.min(12, T.fuelPricePerLiter + 0.005);
  }
  // Paid-parking (Zona Azul) revenue: ~20% of car trips park centrally,
  // average 2h stay × R$/h × coverage%. Feeds the mobility fund.
  const centralCarTrips = carRiders * 0.2 * (TE.paidParkingCoverage / 100);
  const parkingRevenue = Math.round(centralCarTrips * 2 * TE.parkingHourlyFee);
  TE.lastParkingRevenue = parkingRevenue;
  const mobilityRevenue = Math.round(corporateRevenue + vehicleRevenue + parkingRevenue);
  // Corporate levy above 1.5% mildly slows the economy (mobility policy has trade-offs).
  if (F.corporateMobilityTaxPct > 1.5) {
    s.unemployment = Math.min(30, s.unemployment + 0.02);
  }

  /* ---------- Fleet electrification capex ---------- */
  let electrificationSpend = 0;
  if (F.electrifyMonthlyInvestment > 0 && s.treasury >= F.electrifyMonthlyInvestment) {
    electrificationSpend = F.electrifyMonthlyInvestment;
    // Fleet size proxy: 1 electric bus per ~R$ 900k (bus + charger amortized).
    const pctGain = (electrificationSpend / (s.population * 12 + 200_000)) * 100;
    F.electrificationPct = Math.min(100, F.electrificationPct + pctGain);
    // Electric fleet lifts bus quality slightly (quieter, smoother).
    T.modes.bus.quality = Math.min(95, T.modes.bus.quality + pctGain * 0.02);
  }
  // Electric buses cut operating cost: below the line, we subtract 20% of the
  // formal-bus variable subsidy at 100% electrification.
  variableSubsidy -= T.modes.bus.ridership * T.modes.bus.subsidy * 0.20 * (F.electrificationPct / 100);

  const trafficEngMonthly =
    (TE.reversibleLanes ? REVERSIBLE_LANE_MONTHLY : 0) +
    (TE.smartSignals    ? SMART_SIGNALS_MONTHLY   : 0);
  const subsidyCost = Math.max(0, Math.round(
    variableSubsidy + fixedFees + crackdownCost + integrationCost + electrificationSpend + trafficEngMonthly,
  ));
  // Fold mobility revenue into the transport ledger via farebox line.
  T.lastFarebox = Math.round(farebox + mobilityRevenue);
  T.lastSubsidyCost = subsidyCost;
  T.lastMobilityRevenue = mobilityRevenue;
  T.lastElectrificationSpend = electrificationSpend;
  T.unmet = Math.max(0, Math.round(unmet));
  T.informalShare = totalCommuters > 0 ? actual.van / totalCommuters : 0;

  // Store split telemetry.
  T.split = {
    car: Math.round(carShare * 1000) / 1000,
    moto: Math.round(motoShare * 1000) / 1000,
    transit: Math.round(transitShare * 1000) / 1000,
    active: Math.round(activeShare * 1000) / 1000,
    carRiders, motoRiders, activeRiders,
    congestion: Math.round(congestion),
    accidents, healthCost,
  };

  // Happiness feedback: transit satisfaction, congestion pain, accident grief.
  const weighted =
    (T.modes.bus.satisfaction   * actual.bus   +
     T.modes.van.satisfaction   * actual.van   +
     T.modes.brt.satisfaction   * actual.brt   +
     T.modes.metro.satisfaction * actual.metro) /
    Math.max(1, actual.bus + actual.van + actual.brt + actual.metro);
  const unmetPenalty = (T.unmet / Math.max(1, totalCommuters)) * 100;
  const congestionPenalty = Math.max(0, congestion - 55) * 0.03;
  const accidentGrief = Math.min(1.5, accidents * 0.02);
  const activeReward = activeShare * 1.0;
  const happinessDelta =
    (weighted - 55) * 0.02 - unmetPenalty * 0.06 - congestionPenalty - accidentGrief + activeReward;

  s.policies.transport = Math.max(0, Math.min(100,
    s.policies.transport + (weighted - s.policies.transport) * 0.03,
  ));

  // Pollution: cars & motos add, active/mass cut. Fuel-price nudge amplifies.
  // Bus electrification removes diesel emissions proportionally.
  const massShare = (actual.brt + actual.metro) / Math.max(1, totalCommuters);
  const vanShare = T.informalShare;
  const busShareLocal = actual.bus / Math.max(1, totalCommuters);
  const carPoll = carShare * 1.4 + motoShare * 0.5;
  const busDieselPoll = busShareLocal * 0.7 * (1 - F.electrificationPct / 100);
  const pollutionDelta = carPoll + busDieselPoll - massShare * 1.6 - activeShare * 0.8 + vanShare * 0.4;
  T.lastPollutionDelta = Number(pollutionDelta.toFixed(2));

  return {
    farebox: T.lastFarebox,
    subsidy: subsidyCost,
    pollutionDelta,
    happinessDelta,
    healthCost,
    accidents,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
