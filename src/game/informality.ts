/**
 * Informal Economy module.
 *
 * Models the coexistence between formal and informal city in Brazil:
 *   - vendedores ambulantes (street vendors) occupy commercial areas without
 *     paying ISS/IPTU but absorb part of the workforce and keep prices low;
 *   - evasão fiscal (tax evasion) reduces effective municipal revenue;
 *   - policy levers let the player choose repression (fiscalização),
 *     integration (MEI / formalização) or laissez-faire.
 *
 * Kept as a light, additive overlay on the existing tick — plugs into
 * revenue and expense breakdowns without rewriting core simulation.
 */

import type { GameState } from "./types";
import { countFavelas } from "./zoning";

/** Player-tunable informal-economy policies (0..100 unless noted). */
export interface InformalPolicy {
  /** Fiscalização de comércio ambulante. Higher = fewer vendors, more unhappiness. */
  fiscalize: number;
  /** MEI / formalização program. Higher = less evasion, more cost. */
  formalize: number;
  /** Regularização de camelôdromos / feiras (integration, not eviction). */
  integrate: number;
}

/** Observable informal-economy state (0..100 unless noted). */
export interface InformalityState {
  policy: InformalPolicy;
  /** Share of adult workforce operating in the informal sector (0..100). */
  informalWorkers: number;
  /** Effective tax-evasion rate applied to ISS/IPTU/IR (0..100). */
  evasion: number;
  /** Density of street vendors visible in the commercial grid (0..100). */
  vendors: number;
  /** Last month's fiscal impact (negative = revenue lost, positive = recovered). */
  lastRevenueDelta: number;
  /** Last month's operating cost of informal-economy programs. */
  lastProgramCost: number;
}

const DEFAULT_POLICY: InformalPolicy = { fiscalize: 20, formalize: 15, integrate: 25 };

export function initialInformality(): InformalityState {
  return {
    policy: { ...DEFAULT_POLICY },
    informalWorkers: 42, // BR average lingers ~40%
    evasion: 18,
    vendors: 35,
    lastRevenueDelta: 0,
    lastProgramCost: 0,
  };
}

/** Backfills the field on legacy saves. */
export function ensureInformality(s: GameState): void {
  if (!s.informal) {
    s.informal = initialInformality();
    return;
  }
  if (!s.informal.policy) s.informal.policy = { ...DEFAULT_POLICY };
  const p = s.informal.policy;
  for (const k of ["fiscalize", "formalize", "integrate"] as const) {
    if (typeof p[k] !== "number") p[k] = DEFAULT_POLICY[k];
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Advance the informal-economy state one month, mutating `s`.
 * Returns the fiscal delta (positive = extra revenue, negative = revenue lost)
 * so the caller can fold it into the ledger.
 */
export function tickInformality(s: GameState): { revenueDelta: number; programCost: number } {
  ensureInformality(s);
  const info = s.informal;
  const pol = info.policy;

  // Favelas + unemployment feed informality upstream.
  const favelaWeight = countFavelas(s).count * 1.4; // each favela tile pushes +1.4 pp
  const unemploymentPush = Math.max(0, s.unemployment - 6) * 1.1;

  // Long-run equilibrium of informal workforce share.
  const eqInformal = clamp(
    30 + favelaWeight + unemploymentPush + (100 - s.policies.education) * 0.08
      - pol.formalize * 0.35 - pol.integrate * 0.15,
    5, 85,
  );
  info.informalWorkers = clamp(info.informalWorkers + (eqInformal - info.informalWorkers) * 0.18, 0, 100);

  // Vendors track workforce but respond faster to fiscalization / integration.
  const eqVendors = clamp(
    info.informalWorkers * 0.85 - pol.fiscalize * 0.55 + pol.integrate * 0.25,
    0, 100,
  );
  info.vendors = clamp(info.vendors + (eqVendors - info.vendors) * 0.28, 0, 100);

  // Effective evasion: informal share drives it, formalização suppresses it.
  info.evasion = clamp(
    info.informalWorkers * 0.55 - pol.formalize * 0.35 + (100 - s.policies.security) * 0.05,
    0, 60,
  );

  // Revenue lost to evasion (applied only to city-collected taxes).
  const evadableBase =
    s.lastRevenueBreakdown.incomeTax +
    s.lastRevenueBreakdown.propertyTax +
    s.lastRevenueBreakdown.businessTax;
  const revenueLost = -Math.round(evadableBase * (info.evasion / 100));

  // Program cost: fiscalize cheap, formalize expensive, integrate mid.
  const perCap = s.population / 1000;
  const programCost = Math.round(
    (pol.fiscalize * 55 + pol.formalize * 140 + pol.integrate * 95) * perCap,
  );

  // Feedback on happiness + unemployment.
  //   Heavy repression without integration → unhappiness spike.
  //   Integration + formalização → happiness boost + slight unemployment relief.
  const repressionShock = Math.max(0, pol.fiscalize - pol.integrate - 20) * 0.05;
  const integrationBoost = (pol.integrate + pol.formalize) * 0.015;
  s.happiness = clamp(s.happiness - repressionShock + integrationBoost, 0, 100);

  // Informal jobs cushion unemployment; harsh crackdown erodes that cushion.
  const cushion = (info.vendors + info.informalWorkers) * 0.02;
  s.unemployment = clamp(s.unemployment - cushion * 0.15 + repressionShock * 0.4, 0, 40);

  info.lastRevenueDelta = revenueLost;
  info.lastProgramCost = programCost;
  return { revenueDelta: revenueLost, programCost };
}

/** Reducer helper: patch the policy sliders. */
export function setInformalPolicy(
  state: GameState,
  patch: Partial<InformalPolicy>,
): GameState {
  ensureInformality(state);
  const next = structuredClone(state);
  next.informal.policy = {
    ...next.informal.policy,
    ...Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, clamp(Number(v) || 0, 0, 100)]),
    ),
  } as InformalPolicy;
  return next;
}
