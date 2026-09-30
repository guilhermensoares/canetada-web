/**
 * Tela de montagem do gabinete inicial — pool global de assessores.
 *
 * Em vez de listas separadas por pasta, o jogador vê um único roster de
 * candidatos e atribui livremente cada um a qualquer uma das 5 pastas.
 * As "pastas compatíveis" (herdadas do arquétipo) aparecem como dica visual
 * e alimentam o filtro por especialidade, mas não são uma restrição rígida.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PORTFOLIOS,
  PORTFOLIO_LABEL,
  initialCabinetRoster,
  assignCandidateToPortfolio,
  salaryFor,
  type Advisor,
  type CabinetCandidate,
  type PortfolioId,
} from "@/game/advisors";
import type { Lang } from "@/game/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Filter,
  HelpCircle,
  Plus,
  RefreshCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionTour, type SectionTourConfig } from "./SectionTour";
import { FictionDisclaimer } from "./FictionDisclaimer";

interface Props {
  seed: string;
  mayorPersonaId?: string;
  lang: Lang;
  onBack: () => void;
  onConfirm: (picks: Partial<Record<PortfolioId, Advisor>>) => void;
}

const fmtBRL = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-500 text-xs">
      {"★".repeat(n)}
      <span className="text-muted-foreground/60">{"☆".repeat(5 - n)}</span>
    </span>
  );
}

type FilterId = PortfolioId | "all";

const FILTER_OPTIONS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "health", label: PORTFOLIO_LABEL.health },
  { id: "works", label: PORTFOLIO_LABEL.works },
  { id: "finance", label: PORTFOLIO_LABEL.finance },
  { id: "mobility", label: PORTFOLIO_LABEL.mobility },
  { id: "articulation", label: PORTFOLIO_LABEL.articulation },
];

/** Card do candidato no pool global. */
function AffinityBadge({ affinity }: { affinity: number }) {
  const pct = Math.round(affinity * 100);
  const label =
    affinity >= 0.6 ? "Aliado ideológico" :
    affinity >= 0.2 ? "Alinhado" :
    affinity >= -0.2 ? "Neutro" :
    affinity >= -0.6 ? "Divergente" :
    "Adversário";
  const tone =
    affinity >= 0.6 ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500" :
    affinity >= 0.2 ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500/90" :
    affinity >= -0.2 ? "border-border/60 bg-secondary/40 text-muted-foreground" :
    affinity >= -0.6 ? "border-amber-500/40 bg-amber-500/10 text-amber-500" :
    "border-red-500/50 bg-red-500/10 text-red-500";
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide",
        tone,
      )}
      title={`Afinidade ideológica com o(a) prefeito(a): ${pct >= 0 ? "+" : ""}${pct}. Impacta lealdade inicial e risco de sabotagem.`}
    >
      {label} {pct >= 0 ? `+${pct}` : pct}
    </span>
  );
}

function CandidateCard({
  c,
  assignedTo,
  onAssign,
  onUnassign,
  onDragStart,
  onDragEnd,
  dragging,
  isSample,
}: {
  c: CabinetCandidate;
  /** Se atribuído, indica a pasta atual. */
  assignedTo: PortfolioId | null;
  onAssign: (p: PortfolioId) => void;
  onUnassign: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
  isSample?: boolean;
}) {
  const loyaltyTone =
    c.loyalty >= 70 ? "text-emerald-500" : c.loyalty >= 45 ? "text-amber-500" : "text-red-500";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", c.id);
        } catch {
          /* Safari quirks */
        }
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-md border p-3 flex flex-col gap-2 transition-all cursor-grab active:cursor-grabbing",
        assignedTo
          ? "border-primary/70 bg-primary/10 ring-1 ring-primary/40"
          : "border-border/60 bg-background/40 hover:border-primary/40",
        dragging && "opacity-40 scale-[0.98]",
      )}
      data-tour={isSample ? "cabinet-candidate-sample" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{c.name}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {c.party} · {c.age}a
          </div>
        </div>
        <Stars n={c.overall} />
      </div>
      {c.bio && (
        <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
          {c.bio}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {(c.traits ?? []).slice(0, 3).map((t, i) => (
          <span
            key={i}
            className="rounded bg-secondary/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className={cn("font-medium", loyaltyTone)}>Lealdade {c.loyalty}</span>
        <AffinityBadge affinity={c.affinity ?? 0} />
      </div>
      <div className="text-[10px] text-muted-foreground">
        base {fmtBRL(salaryFor(c.overall, c.compatible[0] ?? "articulation", c.party))}/mês
      </div>
      <div className="flex flex-wrap gap-1 text-[10px]">
        <span className="text-muted-foreground">Combina com:</span>
        {c.compatible.map((p) => (
          <span
            key={p}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-500"
          >
            {PORTFOLIO_LABEL[p]}
          </span>
        ))}
      </div>
      {assignedTo ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-medium text-primary">
            Atribuído: {PORTFOLIO_LABEL[assignedTo]}
          </span>
          <button
            type="button"
            onClick={onUnassign}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Remover
          </button>
        </div>
      ) : (
        <div className="pt-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            Atribuir a uma pasta (ou arraste o card)
          </div>
          <div className="flex flex-wrap gap-1">
            {PORTFOLIOS.map((p) => {
              const compat = c.compatible.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onAssign(p)}
                  title={compat ? "Pasta compatível — clique para atribuir" : "Fora do perfil (permitido) — clique para atribuir"}
                  className={cn(
                    // Distinto dos chips de filtro: fundo sólido tipo botão,
                    // com ícone de "+" à esquerda, para deixar claro que é
                    // uma ação de atribuição e não um toggle de filtro.
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium shadow-sm transition-colors",
                    compat
                      ? "border-amber-500/70 bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400"
                      : "border-dashed border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <Plus className="h-2.5 w-2.5" />
                  {PORTFOLIO_LABEL[p]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const TOUR_STORAGE_KEY = "tour:cabinet-setup:v2";

const CABINET_TOUR: SectionTourConfig = {
  storageKey: TOUR_STORAGE_KEY,
  Icon: Users,
  headerLabel: { pt: "Guia — Gabinete", en: "Guide — Cabinet" },
  accent: "amber",
  steps: [
    {
      target: "cabinet-header",
      placement: "bottom",
      title: { pt: "Monte seu gabinete", en: "Build your cabinet" },
      body: {
        pt: "Todos os candidatos aparecem em uma única lista. Escolha quem quiser para cada pasta — ou deixe vagas para preencher depois em Gabinete → Assessores Diretos.",
        en: "All candidates appear in a single roster. Assign anyone to any portfolio — or leave slots empty to fill later under Cabinet → Direct Advisors.",
      },
    },
    {
      target: "cabinet-slots",
      placement: "bottom",
      title: { pt: "As 5 pastas", en: "The 5 portfolios" },
      body: {
        pt: "Saúde, Obras, Fazenda, Mobilidade e Articulação. Cada slot mostra quem está lá — clique no X para liberar a vaga.",
        en: "Health, Works, Finance, Mobility and Articulation. Each slot shows who's in — click X to free it.",
      },
    },
    {
      target: "cabinet-filters",
      placement: "bottom",
      title: { pt: "Filtro e busca", en: "Filter & search" },
      body: {
        pt: "Filtre por especialidade ou digite parte do nome / traço satírico para encontrar rápido o candidato certo.",
        en: "Filter by specialty or type part of the name / satirical trait to quickly find the right person.",
      },
    },
    {
      target: "cabinet-candidate-sample",
      placement: "right",
      title: { pt: "Leia o candidato", en: "Read the candidate" },
      body: {
        pt: "Estrelas (competência), lealdade e traços satíricos. O jogo permite atribuir qualquer pasta, mas as tags 'Combina com' indicam onde a pessoa realmente rende.",
        en: "Stars (skill), loyalty and satirical traits. You can assign any portfolio, but the 'Fits' tags mark where the person actually performs.",
      },
    },
    {
      target: "cabinet-summary",
      placement: "top",
      title: { pt: "Custo da folha", en: "Payroll cost" },
      body: {
        pt: "Quanto mais estrelas, mais salário. A folha inicial já entra na sua despesa mensal — equilibre talento e caixa antes de iniciar o governo.",
        en: "More stars, higher salary. Payroll enters your monthly expenses right away — balance talent and cash before starting.",
      },
    },
    {
      target: "cabinet-reroll",
      placement: "left",
      title: { pt: "Nova rodada", en: "Reroll" },
      body: {
        pt: "Não gostou dos nomes? Gere um pool inteiramente novo de candidatos. Suas atribuições atuais são limpas.",
        en: "Don't like the names? Reroll a whole new candidate pool. Current assignments are cleared.",
      },
    },
    {
      target: "cabinet-confirm",
      placement: "top",
      title: { pt: "Iniciar governo", en: "Start government" },
      body: {
        pt: "Quando estiver satisfeito, confirme para tomar posse. Pastas vazias podem ser preenchidas depois no painel Gabinete.",
        en: "When you're happy, confirm to take office. Empty portfolios can be filled later from the Cabinet panel.",
      },
    },
  ],
};

export function CabinetSetup({ seed, mayorPersonaId, lang, onBack, onConfirm }: Props) {
  const [rerollKey, setRerollKey] = useState(0);
  const roster = useMemo(
    () => initialCabinetRoster(`${seed}:${rerollKey}`, mayorPersonaId),
    [seed, rerollKey, mayorPersonaId],
  );

  // Mapa pasta → candidateId
  const [picks, setPicks] = useState<Partial<Record<PortfolioId, string>>>({});
  // Índice reverso candidateId → pasta (para exibição rápida)
  const assignedByCand = useMemo(() => {
    const m: Record<string, PortfolioId> = {};
    for (const p of PORTFOLIOS) {
      const id = picks[p];
      if (id) m[id] = p;
    }
    return m;
  }, [picks]);

  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [hideAssigned, setHideAssigned] = useState(false);

  const visibleRoster = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter((c) => {
      if (filter !== "all" && !c.compatible.includes(filter)) return false;
      if (hideAssigned && assignedByCand[c.id]) return false;
      if (!q) return true;
      const hay = [
        c.name,
        c.bio ?? "",
        c.party,
        ...(c.traits ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [roster, filter, query, hideAssigned, assignedByCand]);

  // Advisors finais (com salário recalculado para a pasta escolhida)
  const selectedAdvisors: Partial<Record<PortfolioId, Advisor>> = useMemo(() => {
    const out: Partial<Record<PortfolioId, Advisor>> = {};
    for (const p of PORTFOLIOS) {
      const id = picks[p];
      if (!id) continue;
      const cand = roster.find((c) => c.id === id);
      if (cand) out[p] = assignCandidateToPortfolio(cand, p);
    }
    return out;
  }, [picks, roster]);

  const totalSalary = useMemo(
    () =>
      PORTFOLIOS.reduce((sum, p) => sum + (selectedAdvisors[p]?.salary ?? 0), 0),
    [selectedAdvisors],
  );
  const filledCount = PORTFOLIOS.filter((p) => selectedAdvisors[p]).length;

  const assign = (candId: string, p: PortfolioId) => {
    setPicks((prev) => {
      const n: Partial<Record<PortfolioId, string>> = { ...prev };
      // Se este candidato já ocupa outra pasta, libera-a
      for (const key of PORTFOLIOS) {
        if (n[key] === candId) delete n[key];
      }
      n[p] = candId;
      return n;
    });
  };
  const unassign = (candId: string) => {
    setPicks((prev) => {
      const n: Partial<Record<PortfolioId, string>> = { ...prev };
      for (const key of PORTFOLIOS) {
        if (n[key] === candId) delete n[key];
      }
      return n;
    });
  };
  const clearPortfolio = (p: PortfolioId) => {
    setPicks((prev) => {
      const n = { ...prev };
      delete n[p];
      return n;
    });
  };

  // Drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PortfolioId | null>(null);
  const isComplete = filledCount === PORTFOLIOS.length;
  const startBlockedTitle = isComplete
    ? undefined
    : `Preencha as ${PORTFOLIOS.length} pastas antes de iniciar o governo (${filledCount}/${PORTFOLIOS.length}).`;


  const [tourNonce, setTourNonce] = useState(0);
  const replayTour = () => {
    try {
      window.localStorage.removeItem(TOUR_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setTourNonce((n) => n + 1);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <FictionDisclaimer lang={lang} variant="banner" />

        {/* Header */}
        <div
          className="flex items-start justify-between gap-4 flex-wrap"
          data-tour="cabinet-header"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/15 p-2 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Montagem do Gabinete</h1>
              <p className="text-xs md:text-sm text-muted-foreground max-w-xl">
                Escolha livremente quem ocupa cada pasta. Filtre por especialidade ou
                busque pelo nome. Deixar vaga é permitido — pode contratar depois em{" "}
                <b>Gabinete → Assessores Diretos</b>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={replayTour}
              className="gap-1.5"
              title="Rever tour do gabinete"
            >
              <HelpCircle className="h-4 w-4" /> Tour
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPicks({});
                setRerollKey((k) => k + 1);
              }}
              className="gap-1.5"
              data-tour="cabinet-reroll"
            >
              <RefreshCcw className="h-4 w-4" /> Nova rodada
            </Button>
          </div>
        </div>

        {/* Slots das pastas — também são drop-zones */}
        <div
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
          data-tour="cabinet-slots"
        >
          {PORTFOLIOS.map((p) => {
            const a = selectedAdvisors[p];
            const isOver = dropTarget === p;
            const handleDropForPortfolio = (candId: string) => {
              if (!candId) return;
              assign(candId, p);
            };
            return (
              <Card
                key={p}
                onDragOver={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dropTarget !== p) setDropTarget(p);
                }}
                onDragEnter={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  setDropTarget(p);
                }}
                onDragLeave={() => {
                  setDropTarget((cur) => (cur === p ? null : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || draggingId || "";
                  handleDropForPortfolio(id);
                  setDropTarget(null);
                  setDraggingId(null);
                }}
                className={cn(
                  "p-2.5 border-border/60 bg-panel/70 flex flex-col gap-1.5 transition-all",
                  a && "border-primary/50",
                  draggingId && !isOver && "border-dashed border-primary/40",
                  isOver && "border-primary ring-2 ring-primary/60 bg-primary/10 scale-[1.02]",
                )}
              >
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {PORTFOLIO_LABEL[p]}
                </div>
                {a ? (
                  <>
                    <div className="text-sm font-semibold truncate">{a.name}</div>
                    <div className="flex items-center justify-between text-[11px]">
                      <Stars n={a.overall} />
                      <span className="text-muted-foreground">{fmtBRL(a.salary)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => clearPortfolio(p)}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground self-start"
                    >
                      <X className="h-3 w-3" /> Liberar vaga
                    </button>
                  </>
                ) : (
                  <div className={cn(
                    "text-xs italic py-2",
                    isOver ? "text-primary font-medium not-italic" : "text-muted-foreground/70",
                  )}>
                    {isOver ? "Soltar aqui" : draggingId ? "Arraste até aqui" : "Vaga aberta"}
                  </div>
                )}
              </Card>
            );
          })}
        </div>


        {/* Resumo */}
        <Card
          className="p-3 border-border/60 bg-panel/70 flex flex-wrap items-center justify-between gap-3"
          data-tour="cabinet-summary"
        >
          <div className="flex items-center gap-4 text-sm">
            <span>
              <b>{filledCount}</b>/{PORTFOLIOS.length} pastas preenchidas
            </span>
            <span className="text-muted-foreground">
              Folha inicial: <b className="text-foreground">{fmtBRL(totalSalary)}/mês</b>
            </span>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => onConfirm(selectedAdvisors)}
            disabled={!isComplete}
            title={startBlockedTitle}
            data-tour="cabinet-confirm"
          >
            <Check className="h-4 w-4" />
            {isComplete
              ? "Iniciar governo"
              : `Faltam ${PORTFOLIOS.length - filledCount} pasta(s)`}
          </Button>
        </Card>

        {/* Filtros */}
        <div
          className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3"
          data-tour="cabinet-filters"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, partido ou traço…"
              className="pl-8 h-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Chip-funil neutro: visualmente distinto dos botões "+ Pasta"
                de atribuição dentro dos cards, para eliminar a ambiguidade
                relatada na validação (usuário clicava aqui achando que
                estava atribuindo o candidato à pasta). */}
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground pr-1">
              <Filter className="h-3 w-3" />
              Filtrar
            </span>
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  filter === f.id
                    ? "border-foreground/50 bg-foreground/10 text-foreground"
                    : "border-border/50 bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={hideAssigned}
              onChange={(e) => setHideAssigned(e.target.checked)}
              className="accent-primary"
            />
            Ocultar atribuídos
          </label>
        </div>

        {/* Roster global */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRoster.map((c, i) => (
            <CandidateCard
              key={c.id}
              c={c}
              assignedTo={assignedByCand[c.id] ?? null}
              onAssign={(p) => assign(c.id, p)}
              onUnassign={() => unassign(c.id)}
              onDragStart={() => setDraggingId(c.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTarget(null);
              }}
              dragging={draggingId === c.id}
              isSample={i === 0}
            />
          ))}
          {visibleRoster.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-8">
              Nenhum candidato encontrado com esses filtros.
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex flex-col items-end gap-1 pt-2">
          {!isComplete && (
            <span className="text-[11px] text-muted-foreground">
              {startBlockedTitle}
            </span>
          )}
          <Button
            size="lg"
            className="gap-2"
            onClick={() => onConfirm(selectedAdvisors)}
            disabled={!isComplete}
            title={startBlockedTitle}
          >
            <Check className="h-5 w-5" />
            {isComplete
              ? "Iniciar governo com este gabinete"
              : `Faltam ${PORTFOLIOS.length - filledCount} pasta(s) para iniciar`}
          </Button>
        </div>
      </div>

      <SectionTour key={tourNonce} lang="pt" active config={CABINET_TOUR} />
    </div>
  );
}
