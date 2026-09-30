/**
 * Sistema de Restrições Jurídicas — Ministério Público, Tribunal de Contas
 * e Câmara de Vereadores (cassação de mandato).
 *
 * A ideia central: prefeito no Brasil não tem poder absoluto. Toda decisão
 * fiscal/administrativa gera risco jurídico. Três medidores de sanção:
 *   - mpRisk           → liminares do MP (obras congeladas, contas bloqueadas)
 *   - tceRisk          → apontamentos do TCE (obras contestadas viram elefantes brancos)
 *   - impeachmentRisk  → comissão processante na Câmara, com potencial cassação
 *
 * Regras foram calibradas para valorizar decisões sensatas: manter saúde ≥ 30,
 * não construir em APP, controlar corrupção, e não estourar dívida/déficit.
 */

import type { GameState, BuildingKind } from "./types";
import { coalitionSeats } from "./politics";

export type InjunctionKind = "freeze_accounts" | "halt_work" | "health_transfer_block";

export interface Injunction {
  id: string;
  kind: InjunctionKind;
  openedMonth: number;
  openedYear: number;
  /** How many monthly ticks the measure remains in force. */
  monthsRemaining: number;
  /** Fraction of revenue withheld (freeze_accounts). */
  freezeFraction?: number;
  /** Site (tile index) of a paralyzed work, if applicable. */
  siteIdx?: number;
  reasonPt: string;
  reasonEn: string;
}

export interface StalledWork {
  id: string;
  siteIdx: number;
  buildingKind: BuildingKind;
  stalledMonth: number;
  stalledYear: number;
  /** Reason: TCE apontamento, empreiteira falida, MP liminar. */
  causePt: string;
  causeEn: string;
  /** Cost to resume the work (R$). */
  resumeCost: number;
}

export type ImpeachmentPhase = "commission" | "plenary" | "closed";

export interface ImpeachmentProcess {
  openedMonth: number;
  openedYear: number;
  phase: ImpeachmentPhase;
  /** Vereadores prováveis pelo YES no colegiado (0..totalSeats). */
  projectedYes: number;
  projectedNo: number;
  /** Meses até o próximo passo processual. */
  monthsUntilNextStep: number;
  chargesPt: string[];
  chargesEn: string[];
  verdict?: "acquitted" | "removed";
}

export interface OversightState {
  /** 0..100 — pressão do MP */
  mpRisk: number;
  /** 0..100 — apontamentos do TCE */
  tceRisk: number;
  /** 0..100 — pressão por cassação */
  impeachmentRisk: number;

  injunctions: Injunction[];
  stalledWorks: StalledWork[];
  impeachment?: ImpeachmentProcess;

  /** Cumulative counters for a "governança institucional" scoreboard. */
  stats: {
    mpActions: number;
    tceRulings: number;
    worksStalled: number;
    impeachmentAttempts: number;
  };

  /** Meses de bloqueio de repasses federais (herdado de desastres/gestão). */
  federalTransferBlockMonths: number;
}

export function defaultOversight(): OversightState {
  return {
    mpRisk: 12,
    tceRisk: 15,
    impeachmentRisk: 5,
    injunctions: [],
    stalledWorks: [],
    stats: { mpActions: 0, tceRulings: 0, worksStalled: 0, impeachmentAttempts: 0 },
    federalTransferBlockMonths: 0,
  };
}

export function ensureOversight(s: GameState): void {
  const anyS = s as GameState & { oversight?: OversightState };
  if (!anyS.oversight) anyS.oversight = defaultOversight();
  const o = anyS.oversight;
  if (!Array.isArray(o.injunctions)) o.injunctions = [];
  if (!Array.isArray(o.stalledWorks)) o.stalledWorks = [];
  if (!o.stats) o.stats = { mpActions: 0, tceRulings: 0, worksStalled: 0, impeachmentAttempts: 0 };
  if (typeof o.federalTransferBlockMonths !== "number") o.federalTransferBlockMonths = 0;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/** Big civic works that can be "paralyzed" and become elefantes brancos. */
const BIG_WORK_KINDS: BuildingKind[] = [
  "hospital", "university", "school", "water_plant", "power_plant",
];

function findRandomBigWork(s: GameState, rng: () => number): number {
  const idxs: number[] = [];
  for (let i = 0; i < s.builtBuildings.length; i++) {
    const b = s.builtBuildings[i];
    if (b && BIG_WORK_KINDS.includes(b)) {
      // skip if already stalled
      const o = (s as GameState & { oversight?: OversightState }).oversight;
      if (o?.stalledWorks.some((w) => w.siteIdx === i)) continue;
      idxs.push(i);
    }
  }
  if (idxs.length === 0) return -1;
  return idxs[Math.floor(rng() * idxs.length)];
}

function appViolations(s: GameState): number {
  const mask = s.landUse?.hazardMask;
  if (!mask) return 0;
  let n = 0;
  for (let i = 0; i < s.builtBuildings.length; i++) {
    if (mask[i] && s.builtBuildings[i]) n++;
  }
  return n;
}

export interface OversightTickOut {
  news: { kind: "info" | "warning" | "danger" | "success"; titleKey: string }[];
  /** Direct treasury adjustment applied this tick (bloqueio, custos processuais, etc.). */
  treasuryDelta: number;
  approvalDelta: number;
  happinessDelta: number;
  /** Fração adicional de despesa "carimbada" — reduz caixa útil sem alterar o ledger. */
  frozenFraction: number;
  /** True se o processo terminou com CASSAÇÃO no mês. */
  removedFromOffice: boolean;
}

export function tickOversight(s: GameState, rng: () => number): OversightTickOut {
  ensureOversight(s);
  const o = (s as GameState & { oversight: OversightState }).oversight;
  const news: OversightTickOut["news"] = [];
  let treasuryDelta = 0;
  let approvalDelta = 0;
  let happinessDelta = 0;
  let removedFromOffice = false;

  /* -------- 1) Acumular pontos de sanção -------- */

  const app = appViolations(s);
  if (app > 0) {
    o.mpRisk = clamp(o.mpRisk + app * 4, 0, 100);
  }
  // Atraso em repasses da saúde: política < 30 sinaliza subfinanciamento.
  if (s.policies.health < 30) {
    o.mpRisk = clamp(o.mpRisk + (30 - s.policies.health) * 0.35, 0, 100);
  }
  // Descontrole fiscal → TCE
  const monthlyRev = Math.max(1, s.lastRevenue);
  const debtRatio = s.debt / monthlyRev; // meses de receita
  if (debtRatio > 6) o.tceRisk = clamp(o.tceRisk + (debtRatio - 6) * 1.2, 0, 100);
  if (s.lastExpenses > s.lastRevenue * 1.15) o.tceRisk = clamp(o.tceRisk + 3, 0, 100);
  if (s.treasury < -300_000) o.tceRisk = clamp(o.tceRisk + 4, 0, 100);
  // Corrupção alta pressiona tanto o TCE quanto abre caminho para cassação.
  const corr = s.politics?.institutional?.corruption ?? 30;
  if (corr > 55) {
    o.tceRisk = clamp(o.tceRisk + (corr - 55) * 0.25, 0, 100);
    o.impeachmentRisk = clamp(o.impeachmentRisk + (corr - 55) * 0.18, 0, 100);
  }
  // Baixa aprovação + corrupção: catalisador para impeachment.
  if (s.approval < 25 && corr > 50) {
    o.impeachmentRisk = clamp(o.impeachmentRisk + 3.5, 0, 100);
  }
  // Descarga natural (esquecimento, arquivamentos): risco decai devagar.
  o.mpRisk = clamp(o.mpRisk - 0.8, 0, 100);
  o.tceRisk = clamp(o.tceRisk - 0.6, 0, 100);
  o.impeachmentRisk = clamp(o.impeachmentRisk - 0.5, 0, 100);

  /* -------- 2) Tique das medidas ativas -------- */

  o.injunctions = o.injunctions
    .map((inj) => ({ ...inj, monthsRemaining: inj.monthsRemaining - 1 }))
    .filter((inj) => inj.monthsRemaining > 0);

  let frozenFraction = 0;
  for (const inj of o.injunctions) {
    if (inj.kind === "freeze_accounts" && inj.freezeFraction) {
      frozenFraction += inj.freezeFraction;
    }
    if (inj.kind === "health_transfer_block") {
      treasuryDelta -= 90_000; // repasse retido
    }
  }
  frozenFraction = Math.min(0.6, frozenFraction);

  // Elefantes brancos: cada obra parada pesa mensalmente
  if (o.stalledWorks.length > 0) {
    happinessDelta -= o.stalledWorks.length * 0.6;
    approvalDelta -= o.stalledWorks.length * 0.4;
    // Foco de doenças / degradação visível
    if (s.environment) {
      s.environment.pollution = clamp(s.environment.pollution + o.stalledWorks.length * 0.5, 0, 100);
    }
  }

  if (o.federalTransferBlockMonths > 0) {
    o.federalTransferBlockMonths -= 1;
    treasuryDelta -= 120_000;
  }

  /* -------- 3) Gatilhos de ação dos órgãos de controle -------- */

  // MP: liminar quando risco alto
  if (o.mpRisk >= 60 && rng() < 0.32) {
    o.stats.mpActions += 1;
    const rollHalt = rng() < 0.55 && findRandomBigWork(s, rng) >= 0;
    if (rollHalt) {
      const site = findRandomBigWork(s, rng);
      if (site >= 0) {
        const bk = s.builtBuildings[site]!;
        const id = `mpi-${s.year}-${s.month}-${site}`;
        o.injunctions.push({
          id, kind: "halt_work",
          openedMonth: s.month, openedYear: s.year,
          monthsRemaining: 4,
          siteIdx: site,
          reasonPt: "Liminar do MP suspende obra irregular",
          reasonEn: "Prosecutor injunction halts irregular work",
        });
        // Também vira elefante branco temporariamente
        o.stalledWorks.push({
          id: `sw-${id}`,
          siteIdx: site,
          buildingKind: bk,
          stalledMonth: s.month, stalledYear: s.year,
          causePt: "Liminar do Ministério Público (APP/licenciamento)",
          causeEn: "Public Prosecutor injunction (APP/permits)",
          resumeCost: 380_000,
        });
        o.stats.worksStalled += 1;
        o.mpRisk = clamp(o.mpRisk - 20, 0, 100);
        news.push({ kind: "danger", titleKey:
          `MP obtém liminar e paralisa obra pública||Prosecutor obtains injunction and halts public work` });
      }
    } else {
      const id = `mpf-${s.year}-${s.month}-${Math.round(rng() * 1e4)}`;
      o.injunctions.push({
        id, kind: "freeze_accounts",
        openedMonth: s.month, openedYear: s.year,
        monthsRemaining: 3,
        freezeFraction: 0.20,
        reasonPt: "Bloqueio judicial de 20% das contas municipais",
        reasonEn: "Court freezes 20% of municipal accounts",
      });
      approvalDelta -= 2.5;
      o.mpRisk = clamp(o.mpRisk - 15, 0, 100);
      news.push({ kind: "danger", titleKey:
        `MP bloqueia contas: repasses da saúde em atraso||Prosecutor freezes accounts over health transfer delays` });
    }
  }

  // TCE: apontamento converte obra em elefante branco (empreiteira contestada)
  if (o.tceRisk >= 65 && rng() < 0.28) {
    const site = findRandomBigWork(s, rng);
    if (site >= 0) {
      const bk = s.builtBuildings[site]!;
      o.stalledWorks.push({
        id: `sw-tce-${s.year}-${s.month}-${site}`,
        siteIdx: site,
        buildingKind: bk,
        stalledMonth: s.month, stalledYear: s.year,
        causePt: rng() < 0.5
          ? "Empreiteira em falência após operação anticorrupção"
          : "Apontamento do TCE suspende pagamento à empreiteira",
        causeEn: rng() < 0.5
          ? "Contractor bankrupted by anti-corruption operation"
          : "TCE audit suspends payments to contractor",
        resumeCost: 460_000,
      });
      o.stats.tceRulings += 1;
      o.stats.worksStalled += 1;
      o.tceRisk = clamp(o.tceRisk - 22, 0, 100);
      happinessDelta -= 1.5;
      news.push({ kind: "warning", titleKey:
        `TCE aponta irregularidades: obra vira canteiro abandonado||TCE flags irregularities: work becomes abandoned site` });
    }
  }

  /* -------- 4) Processo de cassação -------- */

  if (!o.impeachment && o.impeachmentRisk >= 75 && rng() < 0.45) {
    // Abertura de comissão processante
    const totalSeats = s.politics?.council?.totalSeats ?? 21;
    const coalition = s.politics ? coalitionSeats(s.politics) : Math.round(totalSeats * 0.4);
    // Projeção inicial: oposição + fração da própria base que abandona por corrupção
    const defectFromBase = Math.round(coalition * clamp((corr - 50) / 60, 0, 0.5));
    const projYes = Math.min(totalSeats, totalSeats - coalition + defectFromBase);
    const projNo = totalSeats - projYes;
    o.impeachment = {
      openedMonth: s.month, openedYear: s.year,
      phase: "commission",
      projectedYes: projYes,
      projectedNo: projNo,
      monthsUntilNextStep: 3,
      chargesPt: buildCharges(s, "pt"),
      chargesEn: buildCharges(s, "en"),
    };
    o.stats.impeachmentAttempts += 1;
    approvalDelta -= 4;
    happinessDelta -= 1;
    news.push({ kind: "danger", titleKey:
      `Câmara instala comissão processante contra o(a) prefeito(a)||Council opens impeachment commission against the mayor` });
  }

  if (o.impeachment && o.impeachment.phase !== "closed") {
    o.impeachment.monthsUntilNextStep -= 1;
    if (o.impeachment.monthsUntilNextStep <= 0) {
      if (o.impeachment.phase === "commission") {
        // Passa para o plenário se maioria simples aprovar admissibilidade
        const totalSeats = s.politics?.council?.totalSeats ?? 21;
        const admissibilityYes = o.impeachment.projectedYes + Math.round((rng() - 0.5) * 3);
        if (admissibilityYes * 2 > totalSeats) {
          o.impeachment.phase = "plenary";
          o.impeachment.monthsUntilNextStep = 2;
          news.push({ kind: "danger", titleKey:
            `Comissão aprova admissibilidade — processo vai a plenário||Commission approves admissibility — case goes to plenary` });
        } else {
          o.impeachment.phase = "closed";
          o.impeachment.verdict = "acquitted";
          approvalDelta += 3;
          news.push({ kind: "success", titleKey:
            `Comissão arquiva processo de cassação||Impeachment case dismissed by commission` });
        }
      } else if (o.impeachment.phase === "plenary") {
        // Cassação exige 2/3 dos votos
        const totalSeats = s.politics?.council?.totalSeats ?? 21;
        const finalYes = o.impeachment.projectedYes + Math.round((rng() - 0.5) * 4);
        const threshold = Math.ceil(totalSeats * (2 / 3));
        if (finalYes >= threshold) {
          o.impeachment.phase = "closed";
          o.impeachment.verdict = "removed";
          removedFromOffice = true;
          news.push({ kind: "danger", titleKey:
            `CASSAÇÃO: Câmara afasta o(a) prefeito(a) do cargo||IMPEACHMENT: Council removes the mayor from office` });
        } else {
          o.impeachment.phase = "closed";
          o.impeachment.verdict = "acquitted";
          approvalDelta += 5;
          news.push({ kind: "success", titleKey:
            `Plenário rejeita cassação — mandato preservado||Plenary rejects impeachment — mandate preserved` });
        }
      }
    }
  }

  return { news, treasuryDelta, approvalDelta, happinessDelta, frozenFraction, removedFromOffice };
}

function buildCharges(s: GameState, lang: "pt" | "en"): string[] {
  const c: string[] = [];
  const corr = s.politics?.institutional?.corruption ?? 30;
  if (corr > 55) c.push(lang === "pt"
    ? "Improbidade administrativa (corrupção institucional)"
    : "Administrative improbity (institutional corruption)");
  if (s.treasury < -200_000) c.push(lang === "pt"
    ? "Descumprimento da LRF — déficit fiscal recorrente"
    : "Fiscal Responsibility Law breach — recurring deficit");
  if (s.policies.health < 30) c.push(lang === "pt"
    ? "Descumprimento do piso constitucional da saúde"
    : "Violation of the constitutional health floor");
  if (s.debt > s.lastRevenue * 8) c.push(lang === "pt"
    ? "Endividamento acima do limite prudencial"
    : "Debt above the prudential ceiling");
  if (c.length === 0) c.push(lang === "pt" ? "Crime de responsabilidade" : "Crime of responsibility");
  return c;
}

/* -------------------- Player actions -------------------- */

/** Prefeito paga multa e negocia com o MP: baixa risco e derruba uma liminar. */
export function payMpSettlement(s: GameState): GameState {
  ensureOversight(s);
  const o = (s as GameState & { oversight: OversightState }).oversight;
  const cost = 300_000;
  if (s.treasury < cost) return s;
  const ns = structuredClone(s);
  const no = (ns as GameState & { oversight: OversightState }).oversight;
  ns.treasury -= cost;
  no.mpRisk = clamp(no.mpRisk - 25, 0, 100);
  if (no.injunctions.length > 0) no.injunctions.shift();
  void o;
  return ns;
}

/** Defesa técnica contra apontamento do TCE. Custa capital político + caixa. */
export function contestTceRuling(s: GameState): GameState {
  ensureOversight(s);
  const pol = s.politics as unknown as { politicalCapital?: number };
  const pc = pol.politicalCapital ?? 0;
  const cost = 200_000;
  if (s.treasury < cost || pc < 8) return s;
  const ns = structuredClone(s);
  ns.treasury -= cost;
  (ns.politics as unknown as { politicalCapital: number }).politicalCapital = pc - 8;
  const no = (ns as GameState & { oversight: OversightState }).oversight;
  no.tceRisk = clamp(no.tceRisk - 20, 0, 100);
  return ns;
}

/** Retomar obra parada — paga custo de reestruturação e limpa o elefante branco. */
export function resumeStalledWork(s: GameState, workId: string): GameState {
  ensureOversight(s);
  const o = (s as GameState & { oversight: OversightState }).oversight;
  const w = o.stalledWorks.find((x) => x.id === workId);
  if (!w) return s;
  if (s.treasury < w.resumeCost) return s;
  const ns = structuredClone(s);
  const no = (ns as GameState & { oversight: OversightState }).oversight;
  ns.treasury -= w.resumeCost;
  no.stalledWorks = no.stalledWorks.filter((x) => x.id !== workId);
  // Se havia liminar do MP amarrada a essa obra, também derruba
  no.injunctions = no.injunctions.filter((inj) => inj.siteIdx !== w.siteIdx);
  ns.happiness = clamp(ns.happiness + 2, 0, 100);
  ns.approval = clamp(ns.approval + 3, 0, 100);
  return ns;
}

/** Defender o mandato: gasta caixa + capital político para minar votos yes. */
export function defendMandate(s: GameState): GameState {
  ensureOversight(s);
  const o = (s as GameState & { oversight: OversightState }).oversight;
  if (!o.impeachment || o.impeachment.phase === "closed") return s;
  const pol = s.politics as unknown as { politicalCapital?: number };
  const pc = pol.politicalCapital ?? 0;
  const cost = 500_000;
  if (s.treasury < cost || pc < 20) return s;
  const ns = structuredClone(s);
  ns.treasury -= cost;
  (ns.politics as unknown as { politicalCapital: number }).politicalCapital = pc - 20;
  const no = (ns as GameState & { oversight: OversightState }).oversight;
  if (no.impeachment) {
    // Converte 4 votos yes em no (barganha com base aliada)
    const shift = Math.min(4, no.impeachment.projectedYes);
    no.impeachment.projectedYes -= shift;
    no.impeachment.projectedNo += shift;
  }
  no.impeachmentRisk = clamp(no.impeachmentRisk - 20, 0, 100);
  return ns;
}
