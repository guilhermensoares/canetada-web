/**
 * Caixa de E-mails do Gabinete.
 *
 * Os assessores contratados enviam relatórios formais ao prefeito pedindo
 * autorização para tomar decisões na sua pasta (liberar verba, contratar
 * mutirão, abrir licitação emergencial…). O prefeito pode:
 *   - APROVAR       → custo integral, efeito integral, assessor motivado
 *   - APROVAR PARCIAL → metade da verba, metade do efeito, assessor irritado
 *   - INDEFERIR     → não gasta nada, mas o problema segue e a lealdade cai
 *   - IGNORAR       → após o prazo o pedido expira e cobra o preço político
 *
 * Assessores de baixa lealdade podem mandar pedidos SUPERFATURADOS: aprovar
 * sem checar aumenta o risco no MP.
 *
 * Tudo é JSON-serializável (entra no save). Sem dependência de React.
 */
import type { GameState, NewsItem } from "./types";
import {
  ensureAdvisors,
  buildRecommendation,
  PORTFOLIOS,
  PORTFOLIO_LABEL,
  type PortfolioId,
  type AdviceSeverity,
} from "./advisors";

export type InboxDecision = "approve" | "partial" | "reject";
export type InboxStatus = "pending" | InboxDecision | "expired" | "info";
/** Tipo de correspondência: pedido de autorização, ultimato ou carta de demissão. */
export type InboxKind = "request" | "warning" | "resignation";

export interface InboxEmail {
  id: string;
  /** Padrão: "request". Cartas de insatisfação/demissão não têm despacho. */
  kind?: InboxKind;
  portfolio: PortfolioId;
  /** Nome do assessor remetente (snapshot no envio). */
  fromName: string;
  fromOverall: number;
  fromLoyalty: number;
  severity: AdviceSeverity;
  subjectPt: string;
  subjectEn: string;
  bodyPt: string;
  bodyEn: string;
  /** Medida concreta que o assessor quer autorização para executar. */
  askPt: string;
  askEn: string;
  /** Custo integral da autorização (R$). */
  cost: number;
  createdAt: { month: number; year: number };
  /** Meses de prazo até expirar. */
  deadlineMonths: number;
  /** Pedido inflado por assessor desleal — aprovar sem cortar sobe risco MP. */
  suspicious?: boolean;
  status: InboxStatus;
  read?: boolean;
  resolvedAt?: { month: number; year: number };
  outcomePt?: string;
  outcomeEn?: string;
}

export interface InboxState {
  emails: InboxEmail[];
  unread: number;
  approvedTotal: number;
  rejectedTotal: number;
  expiredTotal: number;
  /** Último mês em que um e-mail foi disparado (limita 1 por mês). */
  lastSpawn?: { month: number; year: number };
  /** Pontos de mágoa acumulados por pasta (indeferimentos e pedidos ignorados). */
  grievance?: Partial<Record<PortfolioId, number>>;
  /** Pastas que já mandaram ultimato — evita repetir a carta de advertência. */
  warned?: Partial<Record<PortfolioId, boolean>>;
  /** Pastas que ficaram vagas por pedido de demissão do assessor. */
  vacancies?: PortfolioId[];
  /** Quantos assessores já se demitiram no mandato. */
  resignedTotal?: number;
}

const MAX_EMAILS = 30;
const MAX_PENDING = 3;

export function defaultInbox(): InboxState {
  return { emails: [], unread: 0, approvedTotal: 0, rejectedTotal: 0, expiredTotal: 0 };
}

export function ensureInbox(s: GameState): InboxState {
  if (!s.inbox) s.inbox = defaultInbox();
  const i = s.inbox!;
  i.emails ??= [];
  i.unread ??= 0;
  i.approvedTotal ??= 0;
  i.rejectedTotal ??= 0;
  i.expiredTotal ??= 0;
  i.grievance ??= {};
  i.warned ??= {};
  i.vacancies ??= [];
  i.resignedTotal ??= 0;
  // Uma pasta reocupada deixa de ser vaga.
  if (i.vacancies.length && s.advisors?.hired) {
    i.vacancies = i.vacancies.filter(p => !s.advisors!.hired[p]);
  }
  return i;
}

export function pendingEmails(s: GameState): InboxEmail[] {
  return (s.inbox?.emails ?? []).filter(e => e.status === "pending");
}

/* --------------------------- Conteúdo por pasta --------------------------- */

interface AskTemplate { pt: string; en: string; costMult: number }

const ASKS: Record<PortfolioId, AskTemplate[]> = {
  health: [
    { pt: "Autorizar mutirão de consultas nas UBS por 60 dias", en: "Authorize a 60-day clinic task force", costMult: 1 },
    { pt: "Comprar lote emergencial de medicamentos básicos", en: "Emergency purchase of basic medication", costMult: 0.8 },
    { pt: "Abrir plantão noturno em duas unidades de pronto atendimento", en: "Open night shifts at two urgent-care units", costMult: 1.2 },
  ],
  works: [
    { pt: "Contratar operação tapa-buraco em 40 vias coletoras", en: "Hire pothole crews on 40 collector roads", costMult: 0.9 },
    { pt: "Liberar verba de desassoreamento dos piscinões antes da chuva", en: "Release drainage-basin dredging funds before the rains", costMult: 1.3 },
    { pt: "Assinar aditivo para retomar a obra parada da creche", en: "Sign an addendum to resume the halted daycare works", costMult: 1.1 },
  ],
  finance: [
    { pt: "Abrir crédito suplementar para fechar a folha do trimestre", en: "Open supplementary credit to cover the quarter's payroll", costMult: 1.2 },
    { pt: "Contratar auditoria externa dos contratos de limpeza", en: "Hire an external audit of the cleaning contracts", costMult: 0.6 },
    { pt: "Antecipar recebíveis do IPTU com deságio bancário", en: "Advance property-tax receivables at a bank discount", costMult: 0.7 },
  ],
  mobility: [
    { pt: "Subsidiar a tarifa por 3 meses para segurar o reajuste", en: "Subsidize the fare for 3 months to hold the hike", costMult: 1.4 },
    { pt: "Recuperar 12 semáforos e a sinalização da avenida central", en: "Fix 12 traffic lights and central avenue signage", costMult: 0.7 },
    { pt: "Reforçar a frota nos horários de pico com ônibus alugados", en: "Reinforce peak-hour fleet with rented buses", costMult: 1.1 },
  ],
  articulation: [
    { pt: "Liberar emendas de bancada para destravar a votação", en: "Release council earmarks to unlock the vote", costMult: 1 },
    { pt: "Montar força-tarefa de resposta à CPI com advogados externos", en: "Set up an inquiry-response task force with outside counsel", costMult: 0.9 },
    { pt: "Custear caravana de audiências públicas nos bairros", en: "Fund a public-hearing caravan across the districts", costMult: 0.6 },
  ],
};

const SEV_COST: Record<AdviceSeverity, number> = {
  critical: 520_000,
  warning: 260_000,
  info: 110_000,
  ok: 80_000,
};

const SEV_LABEL_PT: Record<AdviceSeverity, string> = {
  critical: "URGENTE",
  warning: "Prioritário",
  info: "Rotina",
  ok: "Informativo",
};
const SEV_LABEL_EN: Record<AdviceSeverity, string> = {
  critical: "URGENT",
  warning: "Priority",
  info: "Routine",
  ok: "For information",
};

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${Math.round(n / 1000)}k`;
  return `R$ ${n}`;
}

/* ------------------------ Mágoa, ultimato e demissão ---------------------- */

/** Limiar de pontos para o ultimato formal e para o pedido de demissão. */
const GRIEVANCE_WARN = 2.5;
const GRIEVANCE_QUIT = 4;

/** Soma (ou alivia) pontos de mágoa de uma pasta. Nunca abaixo de zero. */
export function bumpGrievance(inbox: InboxState, portfolio: PortfolioId, delta: number): number {
  inbox.grievance ??= {};
  const next = Math.max(0, Math.round(((inbox.grievance[portfolio] ?? 0) + delta) * 10) / 10);
  inbox.grievance[portfolio] = next;
  if (delta < 0 && next < GRIEVANCE_WARN) {
    inbox.warned ??= {};
    inbox.warned[portfolio] = false;
  }
  return next;
}

function letterEmail(
  s: GameState,
  portfolio: PortfolioId,
  kind: "warning" | "resignation",
  name: string,
  overall: number,
  loyalty: number,
  bodyPt: string,
  bodyEn: string,
): InboxEmail {
  const quit = kind === "resignation";
  return {
    id: `mail-${kind}-${s.year}-${s.month}-${portfolio}`,
    kind,
    portfolio,
    fromName: name,
    fromOverall: overall,
    fromLoyalty: loyalty,
    severity: quit ? "critical" : "warning",
    subjectPt: quit
      ? `[DEMISSÃO] ${PORTFOLIO_LABEL[portfolio]} — carta de exoneração a pedido`
      : `[INSATISFAÇÃO] ${PORTFOLIO_LABEL[portfolio]} — reclamação formal ao gabinete`,
    subjectEn: quit
      ? `[RESIGNATION] ${PORTFOLIO_LABEL[portfolio]} — letter of resignation`
      : `[GRIEVANCE] ${PORTFOLIO_LABEL[portfolio]} — formal complaint to the mayor`,
    bodyPt,
    bodyEn,
    askPt: quit ? "Nomear novo titular para a pasta" : "Rever a política de despachos da pasta",
    askEn: quit ? "Appoint a new portfolio chief" : "Review how the office handles our requests",
    cost: 0,
    createdAt: { month: s.month, year: s.year },
    deadlineMonths: 99,
    status: "info",
    resolvedAt: { month: s.month, year: s.year },
    outcomePt: quit
      ? "A pasta está vaga. Escolha um substituto no painel de Assessores."
      : "Ultimato registrado. Mais um indeferimento e o assessor entrega o cargo.",
    outcomeEn: quit
      ? "The portfolio is vacant. Pick a replacement in the Advisors panel."
      : "Ultimatum filed. One more denial and the advisor walks out.",
  };
}

export interface RevoltResult {
  news: Array<Omit<NewsItem, "id" | "month" | "year" | "day">>;
  approvalDelta: number;
  resigned?: PortfolioId;
}

/**
 * Avalia a mágoa acumulada de uma pasta. Pode gerar um ultimato por escrito e,
 * se o prefeito insistir em ignorar/indeferir, o pedido de demissão do assessor
 * (a pasta fica vaga até o jogador nomear outro).
 *
 * MUTA `s` (usar sempre sobre um estado já clonado).
 */
export function evaluateAdvisorRevolt(s: GameState, portfolio: PortfolioId): RevoltResult {
  const out: RevoltResult = { news: [], approvalDelta: 0 };
  const inbox = ensureInbox(s);
  const adv = s.advisors?.hired?.[portfolio];
  if (!adv) return out;

  const pts = inbox.grievance?.[portfolio] ?? 0;
  const label = PORTFOLIO_LABEL[portfolio];
  const quit = pts >= GRIEVANCE_QUIT || (pts >= 3 && adv.loyalty < 30);

  if (quit) {
    const letter = letterEmail(
      s, portfolio, "resignation", adv.name, adv.overall, adv.loyalty,
      `Prefeito(a),\n\nApresento meu pedido de exoneração da ${label}.\n\n` +
        `Foram pedidos demais engavetados ou indeferidos sem conversa. Não dá para responder ` +
        `pela pasta sem caneta e sem verba — e quem paga o pato na frente da imprensa sou eu.\n\n` +
        `Deixo o cargo ao fim do expediente. Boa sorte com a nomeação do meu substituto.\n\n` +
        `${adv.name} — ex-titular da ${label}`,
      `Mayor,\n\nI hereby resign from the ${label} office.\n\n` +
        `Too many requests were shelved or denied with no conversation. I cannot run this office ` +
        `with no authority and no budget — and I am the one facing the press.\n\n` +
        `I leave at the end of the day. Good luck appointing my replacement.\n\n` +
        `${adv.name} — former head of ${label}`,
    );
    inbox.emails = [letter, ...inbox.emails].slice(0, MAX_EMAILS);
    inbox.unread = Math.min(99, (inbox.unread ?? 0) + 1);
    inbox.grievance![portfolio] = 0;
    inbox.warned![portfolio] = false;
    inbox.vacancies = [...new Set([...(inbox.vacancies ?? []), portfolio])];
    inbox.resignedTotal = (inbox.resignedTotal ?? 0) + 1;

    // Vacância: sai do gabinete e o desgaste bate na aprovação.
    const st = ensureAdvisors(s);
    const leaving = st.hired[portfolio];
    delete st.hired[portfolio];
    st.events = [
      `${leaving?.name ?? "Assessor(a)"} pediu demissão da ${label} — pasta vaga.`,
      ...(st.events ?? []),
    ].slice(0, 20);

    out.approvalDelta -= 2;
    out.resigned = portfolio;
    out.news.push({
      kind: "danger",
      titleKey: `${adv.name} pede demissão da ${label} e alfineta o prefeito||${adv.name} resigns from ${label} and takes a swipe at the mayor`,
      detail:
        `"Cansei de mandar ofício para gaveta", disse ao deixar o prédio. A pasta segue sem titular.` +
        `||"I got tired of writing memos to a drawer," they said on the way out. The office has no chief.`,
    });
    return out;
  }

  if (pts >= GRIEVANCE_WARN && !inbox.warned?.[portfolio]) {
    const letter = letterEmail(
      s, portfolio, "warning", adv.name, adv.overall, adv.loyalty,
      `Prefeito(a),\n\nRegistro formalmente meu descontentamento com a ${label}.\n\n` +
        `Meus últimos ofícios foram indeferidos ou simplesmente venceram na gaveta. ` +
        `Se o próximo pedido tiver o mesmo destino, peço para ser exonerado(a).\n\n` +
        `${adv.name} — ${label}`,
      `Mayor,\n\nI am formally recording my discontent with the ${label} office.\n\n` +
        `My latest memos were denied or simply expired in a drawer. ` +
        `If the next one ends the same way, I will ask to be relieved of my post.\n\n` +
        `${adv.name} — ${label}`,
    );
    inbox.emails = [letter, ...inbox.emails].slice(0, MAX_EMAILS);
    inbox.unread = Math.min(99, (inbox.unread ?? 0) + 1);
    inbox.warned![portfolio] = true;
    if (s.advisors?.hired?.[portfolio]) {
      const a = s.advisors.hired[portfolio]!;
      a.loyalty = Math.max(0, a.loyalty - 5);
    }
    out.news.push({
      kind: "warning",
      titleKey: `Titular da ${label} manda ultimato ao gabinete||${label} chief sends an ultimatum to the mayor's office`,
    });
  }

  return out;
}

/* ------------------------------ Tick mensal ------------------------------- */

export interface InboxTickResult {
  approvalDelta: number;
  happinessDelta: number;
  news: Array<Omit<NewsItem, "id" | "month" | "year" | "day">>;
}

/** Chamado no tick MENSAL: expira pedidos vencidos e envia no máximo 1 novo. */
export function tickInboxMonthly(
  s: GameState,
  rng: () => number,
): InboxTickResult {
  const inbox = ensureInbox(s);
  const out: InboxTickResult = { approvalDelta: 0, happinessDelta: 0, news: [] };
  const now = s.year * 12 + s.month;
  const expiredPortfolios = new Set<PortfolioId>();

  // 1) Expira pendências vencidas.
  for (const e of inbox.emails) {
    if (e.status !== "pending") continue;
    const age = now - (e.createdAt.year * 12 + e.createdAt.month);
    if (age < e.deadlineMonths) continue;
    e.status = "expired";
    e.resolvedAt = { month: s.month, year: s.year };
    e.outcomePt = "Pedido arquivado sem resposta do gabinete.";
    e.outcomeEn = "Request archived with no reply from the mayor's office.";
    inbox.expiredTotal += 1;
    out.approvalDelta -= e.severity === "critical" ? 2 : 1;
    out.happinessDelta -= e.severity === "critical" ? 1 : 0;
    const adv = s.advisors?.hired?.[e.portfolio];
    if (adv) adv.loyalty = Math.max(0, adv.loyalty - 8);
    // Ofício engavetado dói mais do que um "não" na cara.
    bumpGrievance(inbox, e.portfolio, e.severity === "critical" ? 2 : 1.5);
    expiredPortfolios.add(e.portfolio);
    out.news.push({
      kind: "danger",
      titleKey:
        `Pasta de ${PORTFOLIO_LABEL[e.portfolio]} cobra resposta: pedido do gabinete venceu sem despacho.` +
        `||${PORTFOLIO_LABEL[e.portfolio]} office complains: request expired with no decision.`,
    });
  }

  // 1b) Assessores ignorados podem mandar ultimato ou entregar o cargo.
  for (const p of expiredPortfolios) {
    const rev = evaluateAdvisorRevolt(s, p);
    out.approvalDelta += rev.approvalDelta;
    out.news.push(...rev.news);
  }

  // 2) Envio de novos relatórios — 1 por mês no máximo.
  if (inbox.lastSpawn && inbox.lastSpawn.year === s.year && inbox.lastSpawn.month === s.month) {
    return out;
  }
  const pending = inbox.emails.filter(e => e.status === "pending");
  if (pending.length >= MAX_PENDING) return out;

  const st = ensureAdvisors(s);
  const busy = new Set(pending.map(e => e.portfolio));
  const candidates = PORTFOLIOS
    .filter(p => st.hired[p] && !busy.has(p))
    .map(p => ({ p, rec: buildRecommendation(s, p) }))
    .filter(c => c.rec.severity !== "ok");

  if (candidates.length === 0) return out;
  candidates.sort((a, b) => b.rec.priority - a.rec.priority);
  // Chance de escrever: crítico quase sempre, alerta às vezes.
  const top = candidates[0];
  const chance = top.rec.severity === "critical" ? 0.75 : top.rec.severity === "warning" ? 0.45 : 0.2;
  if (rng() > chance) return out;

  const email = composeEmail(s, top.p, top.rec.severity, top.rec.headline, top.rec.rationale, rng);
  inbox.emails = [email, ...inbox.emails].slice(0, MAX_EMAILS);
  inbox.unread = Math.min(99, inbox.unread + 1);
  inbox.lastSpawn = { month: s.month, year: s.year };
  return out;
}

function composeEmail(
  s: GameState,
  portfolio: PortfolioId,
  severity: AdviceSeverity,
  headline: string,
  rationale: string,
  rng: () => number,
): InboxEmail {
  const adv = s.advisors!.hired[portfolio]!;
  const asks = ASKS[portfolio];
  const ask = asks[Math.floor(rng() * asks.length) % asks.length];
  const scale = 1 + Math.min(1.5, (s.population ?? 50_000) / 250_000);
  const suspicious = adv.loyalty < 35 && rng() < 0.5;
  const inflation = suspicious ? 1.6 + rng() * 0.5 : 1;
  const cost = Math.round((SEV_COST[severity] * ask.costMult * scale * inflation) / 10_000) * 10_000;

  const sevPt = SEV_LABEL_PT[severity];
  const sevEn = SEV_LABEL_EN[severity];

  return {
    id: `mail-${s.year}-${s.month}-${portfolio}-${Math.floor(rng() * 9999)}`,
    portfolio,
    fromName: adv.name,
    fromOverall: adv.overall,
    fromLoyalty: adv.loyalty,
    severity,
    subjectPt: `[${sevPt}] ${PORTFOLIO_LABEL[portfolio]} — solicitação de autorização`,
    subjectEn: `[${sevEn}] ${PORTFOLIO_LABEL[portfolio]} — authorization request`,
    bodyPt:
      `Prefeito(a),\n\n${headline}\n\n${rationale}\n\n` +
      `Solicito autorização formal para ${ask.pt.toLowerCase()}, com impacto orçamentário estimado de ${fmtBRL(cost)}.\n\n` +
      `Aguardo despacho. Atenciosamente,\n${adv.name} — ${PORTFOLIO_LABEL[portfolio]}`,
    bodyEn:
      `Mayor,\n\n${headline}\n\n${rationale}\n\n` +
      `I request formal authorization to ${ask.en.toLowerCase()}, with an estimated budget impact of ${fmtBRL(cost)}.\n\n` +
      `Awaiting your decision. Sincerely,\n${adv.name} — ${PORTFOLIO_LABEL[portfolio]}`,
    askPt: ask.pt,
    askEn: ask.en,
    cost,
    createdAt: { month: s.month, year: s.year },
    deadlineMonths: severity === "critical" ? 2 : 3,
    suspicious,
    status: "pending",
  };
}

/* --------------------------------- Ações --------------------------------- */

/** Marca a caixa como lida. */
export function markInboxRead(s: GameState): GameState {
  ensureInbox(s);
  return { ...s, inbox: { ...s.inbox!, unread: 0 } };
}

/**
 * Despacha um pedido. Retorna novo estado com custo, efeitos políticos,
 * ajuste de lealdade do assessor e risco no MP quando há superfaturamento.
 */
export function decideEmail(s: GameState, id: string, decision: InboxDecision): GameState {
  ensureInbox(s);
  const inbox = s.inbox!;
  const idx = inbox.emails.findIndex(e => e.id === id);
  if (idx < 0) return s;
  const mail = inbox.emails[idx];
  if (mail.status !== "pending") return s;

  const sevWeight = mail.severity === "critical" ? 3 : mail.severity === "warning" ? 2 : 1;
  let spend = 0;
  let approval = 0;
  let happiness = 0;
  let loyalty = 0;
  let mpRisk = 0;
  let outPt = "";
  let outEn = "";

  if (decision === "approve") {
    // Não autoriza o que não cabe no caixa.
    if (s.treasury < mail.cost) return s;
    spend = mail.cost;
    approval = sevWeight;
    happiness = sevWeight;
    loyalty = 8;
    if (mail.suspicious) {
      mpRisk = 4 + sevWeight * 2;
      outPt = "Autorizado integralmente. O valor acima do mercado chamou atenção do Ministério Público.";
      outEn = "Fully authorized. The above-market price drew the prosecutor's attention.";
    } else {
      outPt = "Autorizado integralmente. A pasta executou a medida no prazo.";
      outEn = "Fully authorized. The office delivered on schedule.";
    }
  } else if (decision === "partial") {
    const half = Math.round(mail.cost / 2);
    if (s.treasury < half) return s;
    spend = half;
    approval = Math.round(sevWeight / 2);
    happiness = Math.round(sevWeight / 2);
    loyalty = -3;
    mpRisk = mail.suspicious ? 1 : 0;
    outPt = "Autorizado pela metade. A pasta reclamou do corte, mas tocou o essencial.";
    outEn = "Half approved. The office grumbled about the cut but delivered the essentials.";
  } else {
    approval = -Math.max(1, sevWeight - 1);
    happiness = -Math.max(1, sevWeight - 1);
    loyalty = -12;
    if (mail.suspicious) {
      approval += 1;
      mpRisk = -3;
      outPt = "Indeferido. O corte evitou um contrato superfaturado — a imprensa registrou a economia.";
      outEn = "Denied. The cut avoided an inflated contract — the press noted the savings.";
    } else {
      outPt = "Indeferido. O problema segue na pasta e o assessor ficou exposto.";
      outEn = "Denied. The problem remains and the advisor was left exposed.";
    }
  }

  const emails = inbox.emails.slice();
  emails[idx] = {
    ...mail,
    status: decision,
    resolvedAt: { month: s.month, year: s.year },
    outcomePt: outPt,
    outcomeEn: outEn,
  };

  const next: GameState = {
    ...s,
    treasury: s.treasury - spend,
    approval: clamp(s.approval + approval, 0, 100),
    happiness: clamp(s.happiness + happiness, 0, 100),
    inbox: {
      ...inbox,
      emails,
      approvedTotal: inbox.approvedTotal + (decision === "reject" ? 0 : 1),
      rejectedTotal: inbox.rejectedTotal + (decision === "reject" ? 1 : 0),
    },
  };

  if (spend) {
    next.lastExpenses = (next.lastExpenses ?? 0) + spend;
  }

  // Mágoa acumulada: deferir alivia, cortar incomoda, indeferir queima.
  const grievanceDelta =
    decision === "approve" ? -1.5 :
    decision === "partial" ? 0.4 :
    (mail.suspicious ? 0.4 : 1.2 + (mail.severity === "critical" ? 0.6 : 0));

  if (loyalty && next.advisors?.hired?.[mail.portfolio]) {
    const hired = { ...next.advisors.hired };
    const a = { ...hired[mail.portfolio]! };
    a.loyalty = clamp(a.loyalty + loyalty, 0, 100);
    hired[mail.portfolio] = a;
    next.advisors = { ...next.advisors, hired };
  }

  // Clona a caixa antes de mutar mágoa/cartas dentro do estado novo.
  next.inbox = { ...next.inbox!, grievance: { ...(inbox.grievance ?? {}) }, warned: { ...(inbox.warned ?? {}) } };
  bumpGrievance(next.inbox, mail.portfolio, grievanceDelta);
  if (grievanceDelta > 0) {
    if (next.advisors) {
      next.advisors = { ...next.advisors, hired: { ...next.advisors.hired } };
      const cur = next.advisors.hired[mail.portfolio];
      if (cur) next.advisors.hired[mail.portfolio] = { ...cur };
    }
    const rev = evaluateAdvisorRevolt(next, mail.portfolio);
    if (rev.approvalDelta) next.approval = clamp(next.approval + rev.approvalDelta, 0, 100);
    for (const item of rev.news) pushRevoltNews(next, item);
  }

  if (mpRisk && next.oversight) {
    next.oversight = {
      ...next.oversight,
      mpRisk: clamp(next.oversight.mpRisk + mpRisk, 0, 100),
    };
  }

  return next;
}

/** Empurra a manchete da revolta direto na timeline (decideEmail é fora do tick). */
function pushRevoltNews(s: GameState, item: Omit<NewsItem, "id" | "month" | "year" | "day">) {
  const news = (s.news ?? []).slice();
  news.unshift({
    ...item,
    id: `news-revolt-${s.year}-${s.month}-${news.length}`,
    month: s.month,
    year: s.year,
    day: s.day ?? 1,
  } as NewsItem);
  s.news = news.slice(0, 60);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
