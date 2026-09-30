import { useMemo, useState, memo } from "react";
import type { GameState } from "@/game/types";
import {
  PORTFOLIOS,
  PORTFOLIO_LABEL,
  buildRecommendation,
  getTopRecommendations,
  getAdviceHistory,
  ensureAdvisors,
  type PortfolioId,
  type Advisor,
  type Recommendation,
  type AdviceHistoryEntry,
} from "@/game/advisors";

interface Props {
  state: GameState;
  actions: {
    hire: (candidateId: string, portfolio: PortfolioId) => void;
    fire: (portfolio: PortfolioId) => void;
    train: (portfolio: PortfolioId) => void;
    retain: (portfolio: PortfolioId) => void;
    release: (portfolio: PortfolioId) => void;
  };
}

const fmtBRL = (v: number) =>
  `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-500" aria-label={`${n} estrelas`}>
      {"★".repeat(n)}
      <span className="text-muted-foreground">{"☆".repeat(5 - n)}</span>
    </span>
  );
}

const SEV_STYLES: Record<Recommendation["severity"], { border: string; bg: string; label: string; icon: string }> = {
  critical: { border: "border-red-500/50", bg: "bg-red-500/10", label: "Crítico", icon: "🔥" },
  warning:  { border: "border-amber-500/50", bg: "bg-amber-500/10", label: "Atenção", icon: "⚠" },
  info:     { border: "border-blue-500/40", bg: "bg-blue-500/10", label: "Sugestão", icon: "💡" },
  ok:       { border: "border-emerald-500/40", bg: "bg-emerald-500/10", label: "Ok", icon: "✓" },
};

function AdviceBlock({ rec }: { rec: Recommendation }) {
  const s = SEV_STYLES[rec.severity];
  return (
    <div className={`rounded border ${s.border} ${s.bg} p-2 text-xs space-y-1`}>
      <div className="flex items-center gap-1.5">
        <span>{s.icon}</span>
        <span className="font-semibold">{rec.headline}</span>
      </div>
      <div className="text-muted-foreground leading-snug">{rec.rationale}</div>
      <div className="text-[11px] font-medium">👉 {rec.action}</div>
    </div>
  );
}

function AdvisorCard({
  a,
  rec,
  onFire,
  onTrain,
  onRetain,
  onRelease,
}: {
  a: Advisor;
  rec: Recommendation;
  onFire: () => void;
  onTrain: () => void;
  onRetain: () => void;
  onRelease: () => void;
}) {
  const loyaltyColor =
    a.loyalty >= 70 ? "bg-emerald-500" : a.loyalty >= 45 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{a.name}</div>
          <div className="text-xs text-muted-foreground">
            {PORTFOLIO_LABEL[a.portfolio]} · {a.age} anos · {a.party}
          </div>
        </div>
        <Stars n={a.overall} />
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-16 text-muted-foreground">Lealdade</span>
          <div className="h-1.5 flex-1 rounded bg-muted overflow-hidden">
            <div className={`h-full ${loyaltyColor}`} style={{ width: `${a.loyalty}%` }} />
          </div>
          <span className="w-8 text-right">{a.loyalty}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 text-muted-foreground">XP</span>
          <div className="h-1.5 flex-1 rounded bg-muted overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${a.xp}%` }} />
          </div>
          <span className="w-8 text-right">{a.xp}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 text-muted-foreground">Potencial</span>
          <div className="h-1.5 flex-1 rounded bg-muted overflow-hidden">
            <div className="h-full bg-purple-500" style={{ width: `${a.potential}%` }} />
          </div>
          <span className="w-8 text-right">{a.potential}</span>
        </div>
      </div>

      <AdviceBlock rec={rec} />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground">
          Salário: {fmtBRL(a.salary)}/mês · {a.monthsInOffice}m no cargo
        </span>
        <div className="flex gap-1">
          <button
            className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80"
            onClick={onTrain}
          >
            Capacitar
          </button>
          <button
            className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20"
            onClick={onFire}
          >
            Demitir
          </button>
        </div>
      </div>

      {a.poached && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs space-y-2">
          <div>
            <strong>{a.poached.by}</strong> está assediando {a.name}. Restam {a.poached.monthsLeft} meses.
          </div>
          <div className="flex gap-2">
            <button
              className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30"
              onClick={onRetain}
            >
              Reter ({fmtBRL(a.salary * 3)})
            </button>
            <button
              className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
              onClick={onRelease}
            >
              Liberar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VacantCard({
  portfolio,
  candidates,
  onHire,
}: {
  portfolio: PortfolioId;
  candidates: Advisor[];
  onHire: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">{PORTFOLIO_LABEL[portfolio]}</div>
        <span className="text-xs text-muted-foreground">Vaga aberta</span>
      </div>
      <div className="space-y-1">
        {candidates.length === 0 && (
          <div className="text-xs text-muted-foreground">Sem candidatos disponíveis.</div>
        )}
        {candidates.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5 text-xs"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">
                {c.name} <Stars n={c.overall} />
              </div>
              <div className="text-muted-foreground truncate">
                {c.party} · {c.age}a · Lealdade {c.loyalty}% · Pot. {c.potential}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-muted-foreground">{fmtBRL(c.salary)}/m</span>
              <button
                className="px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => onHire(c.id)}
              >
                Contratar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvisorsPanelImpl({ state, actions }: Props) {
  const [open, setOpen] = useState(false);
  const advisors = useMemo(() => {
    // Não muta o state real: apenas garante defaults leitura-only.
    if (state.advisors) return state.advisors;
    // Fallback consistente para render inicial.
    const clone = { ...state } as GameState;
    return ensureAdvisors(clone);
  }, [state]);

  const totalPayroll = useMemo(
    () =>
      Object.values(advisors.hired).reduce((sum, a) => sum + (a?.salary ?? 0), 0),
    [advisors.hired],
  );
  const hiredCount = Object.values(advisors.hired).filter(Boolean).length;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Gabinete — Assessores Diretos</h2>
          <p className="text-xs text-muted-foreground">
            {hiredCount}/5 pastas · folha {fmtBRL(totalPayroll)}/mês
          </p>
        </div>
        <button
          className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Recolher" : "Abrir"}
        </button>
      </header>

      {open && (
        <div className="space-y-3">
          {(() => {
            const top = getTopRecommendations(state, 3);
            if (top.length === 0) return null;
            return (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prioridades do gabinete agora
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {top.map((r) => (
                    <div key={r.portfolio} className="space-y-1">
                      <div className="text-[11px] text-muted-foreground">{PORTFOLIO_LABEL[r.portfolio]}</div>
                      <AdviceBlock rec={r} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PORTFOLIOS.map((p) => {
              const a = advisors.hired[p];
              if (a) {
                return (
                  <AdvisorCard
                    key={p}
                    a={a}
                    rec={buildRecommendation(state, p)}
                    onFire={() => actions.fire(p)}
                    onTrain={() => actions.train(p)}
                    onRetain={() => actions.retain(p)}
                    onRelease={() => actions.release(p)}
                  />
                );
              }
              const cands = advisors.roster.filter((c) => c.portfolio === p);
              return (
                <VacantCard
                  key={p}
                  portfolio={p}
                  candidates={cands}
                  onHire={(id) => actions.hire(id, p)}
                />
              );
            })}
          </div>

          {advisors.events.length > 0 && (
            <div className="rounded border border-border/60 bg-muted/30 p-2">
              <div className="text-xs font-semibold mb-1">Últimos movimentos</div>
              <ul className="text-xs space-y-0.5 max-h-32 overflow-auto">
                {advisors.events.slice(0, 8).map((e, i) => (
                  <li key={i} className="text-muted-foreground">• {e}</li>
                ))}
              </ul>
            </div>
          )}

          <HistorySection state={state} />
        </div>
      )}
    </section>
  );
}

/* ---------------- Histórico de recomendações ---------------- */

const MONTHS_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const fmtDate = (d: { month: number; year: number }) =>
  `${MONTHS_PT[(d.month - 1) % 12]}/${String(d.year).slice(-2)}`;

function fmtMetric(value: number, unit?: string) {
  if (unit === "R$") return `R$ ${Math.round(value / 1e6)}M`;
  if (unit === "%") return `${value.toFixed(1)}%`;
  const v = Math.abs(value) >= 100 ? Math.round(value) : value.toFixed(1);
  return unit ? `${v} ${unit}` : `${v}`;
}

const OUTCOME_STYLES = {
  improved:  { label: "Melhorou",   cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/40", icon: "▲" },
  worsened:  { label: "Piorou",     cls: "text-red-600 bg-red-500/10 border-red-500/40",             icon: "▼" },
  unchanged: { label: "Sem mudança", cls: "text-muted-foreground bg-muted border-border",             icon: "–" },
} as const;

function OutcomeBadge({ e }: { e: AdviceHistoryEntry }) {
  if (!e.closedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-blue-500/40 bg-blue-500/10 text-blue-600 px-1.5 py-0.5 text-[10px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        Em aberto
      </span>
    );
  }
  const o = OUTCOME_STYLES[e.outcome ?? "unchanged"];
  const then = e.metric.value;
  const now = e.metricAtClose ?? then;
  const base = Math.max(1, Math.abs(then));
  const deltaPct = ((now - then) / base) * 100;
  const sign = deltaPct > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${o.cls}`}>
      <span>{o.icon}</span>{o.label}
      <span className="opacity-70">({sign}{deltaPct.toFixed(0)}%)</span>
    </span>
  );
}

function HistorySection({ state }: { state: GameState }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "improved" | "worsened">("all");
  const history = getAdviceHistory(state);

  const filtered = useMemo(() => {
    if (filter === "all") return history;
    if (filter === "open") return history.filter((h) => !h.closedAt);
    return history.filter((h) => h.outcome === filter);
  }, [history, filter]);

  const stats = useMemo(() => {
    let improved = 0, worsened = 0, open = 0;
    for (const h of history) {
      if (!h.closedAt) open++;
      else if (h.outcome === "improved") improved++;
      else if (h.outcome === "worsened") worsened++;
    }
    return { improved, worsened, open, total: history.length };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="rounded border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">
        Histórico de recomendações vazio. À medida que o mês avança, cada
        conselho aparece aqui com sua métrica-gatilho e desfecho.
      </div>
    );
  }

  const visible = expanded ? filtered : filtered.slice(0, 6);

  return (
    <div className="rounded-lg border border-border bg-card/60">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div>
          <div className="text-xs font-semibold">Histórico de Recomendações</div>
          <div className="text-[11px] text-muted-foreground">
            {stats.total} total · <span className="text-emerald-600">{stats.improved} melhoraram</span>
            {" · "}<span className="text-red-600">{stats.worsened} pioraram</span>
            {" · "}<span className="text-blue-600">{stats.open} em aberto</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(["all","open","improved","worsened"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`text-[11px] px-1.5 py-0.5 rounded ${
                filter === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/70 text-muted-foreground"
              }`}
            >
              {k === "all" ? "Tudo" : k === "open" ? "Abertos" : k === "improved" ? "↑" : "↓"}
            </button>
          ))}
        </div>
      </header>

      <ul className="divide-y divide-border/60 max-h-64 overflow-auto">
        {visible.map((e) => (
          <li key={e.id} className="px-3 py-2 text-xs space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {PORTFOLIO_LABEL[e.portfolio]}
                  </span>
                  <span className="font-medium truncate">{e.headline}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Gatilho: <strong>{e.metric.label}</strong> {fmtMetric(e.metric.value, e.metric.unit)}
                  {e.closedAt && e.metricAtClose != null && (
                    <> → {fmtMetric(e.metricAtClose, e.metric.unit)}</>
                  )}
                  {" · "}
                  {fmtDate(e.openedAt)}
                  {e.closedAt && <> → {fmtDate(e.closedAt)}</>}
                </div>
              </div>
              <OutcomeBadge e={e} />
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-3 text-xs text-muted-foreground text-center">
            Nenhuma recomendação neste filtro.
          </li>
        )}
      </ul>

      {filtered.length > 6 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-[11px] py-1.5 text-muted-foreground hover:bg-muted/40 border-t border-border/60"
        >
          {expanded ? "Recolher" : `Ver todas (${filtered.length})`}
        </button>
      )}
    </div>
  );
}

export const AdvisorsPanel = /*#__PURE__*/ memo(AdvisorsPanelImpl);
