/**
 * FinanceTour — mini-tour disparado na primeira vez que o jogador abre o
 * painel de Finanças. Persistência simples via localStorage (independente do
 * save do jogo, para tocar apenas uma vez por navegador).
 *
 * Reaproveita as primitivas visuais do TourGuide principal (spotlight, ring,
 * card com seta, layout inteligente) para manter identidade visual.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, CircleDollarSign } from "lucide-react";
import type { Lang } from "@/game/types";
import {
  SpotlightBackdrop,
  TargetHighlight,
  computeCardLayout,
  useTargetRect,
  Arrow,
} from "./TourGuide";

const STORAGE_KEY = "prefeito2026:financeTourSeen";

type Copy = { pt: string; en: string };
interface Step {
  target?: string;
  placement?: "top" | "bottom" | "left" | "right";
  title: Copy;
  body: Copy;
}

const STEPS: Step[] = [
  {
    title: { pt: "Bem-vindo(a) ao Painel de Finanças", en: "Welcome to the Finance Panel" },
    body: {
      pt: "Aqui você acompanha a saúde fiscal da cidade em tempo real: receitas, despesas, dívida, empréstimos, razão fiscal detalhada e o semáforo da LRF. Vou apresentar cada bloco.",
      en: "This is where you track the city's fiscal health in real time: revenue, expenses, debt, loans, a detailed ledger and the LRF traffic-light. Let me walk you through each block.",
    },
  },
  {
    target: "fin-summary",
    placement: "bottom",
    title: { pt: "Resumo do mês", en: "Month summary" },
    body: {
      pt: "Receita e despesa do último tick, saldo em caixa (Tesouro), dívida acumulada, inflação e desemprego. Se o Tesouro fica vermelho, os juros começam a corroer sua próxima folha.",
      en: "Last tick's revenue and expenses, cash on hand (Treasury), accumulated debt, inflation and unemployment. Red Treasury means interest starts eating your next payroll.",
    },
  },
  {
    target: "fin-actions",
    placement: "bottom",
    title: { pt: "Empréstimo & pagamento de dívida", en: "Loans & debt repayment" },
    body: {
      pt: "Contrate empréstimo para tapar buraco de curto prazo (juros conforme o cenário) ou quite dívida quando o caixa permitir. Endividar demais eleva risco fiscal e atrai o TCE.",
      en: "Take a loan to plug short-term holes (interest depends on scenario) or pay down debt when cash allows. Over-borrowing raises fiscal risk and attracts the audit court.",
    },
  },
  {
    target: "fin-ledger",
    placement: "top",
    title: { pt: "Razão fiscal — o porquê dos números", en: "Fiscal ledger — the 'why'" },
    body: {
      pt: "Decomposição de receitas (IPTU, ISS, outorga, farebox, transferências…) e despesas (educação, saúde, subsídio de transporte, saneamento, juros…). Cada linha mostra o driver que a moveu.",
      en: "Breakdown of revenues (IPTU, ISS, outorga, farebox, transfers…) and expenses (education, health, transit subsidy, sanitation, interest…). Each row shows the driver that moved it.",
    },
  },
  {
    target: "fin-ledger-balance",
    placement: "top",
    title: { pt: "Saldo do mês", en: "Monthly balance" },
    body: {
      pt: "Verde = superávit, vermelho = déficit. Meses vermelhos consecutivos disparam alertas e pressão da imprensa. Use empréstimos com parcimônia.",
      en: "Green = surplus, red = deficit. Consecutive red months trigger alerts and press pressure. Use loans sparingly.",
    },
  },
  {
    target: "fin-lrf",
    placement: "top",
    title: { pt: "Lei de Responsabilidade Fiscal (LRF)", en: "Fiscal Responsibility Law (LRF)" },
    body: {
      pt: "Semáforo com limites de folha (54% RCL), dívida consolidada e regra de ouro. Estourar limites abre CPI e pode levar a impeachment. Fique de olho na cor.",
      en: "Traffic light with payroll (54% RCL), consolidated debt and golden-rule limits. Breaching limits opens CPI and can lead to impeachment. Watch the color.",
    },
  },
  {
    title: { pt: "Pronto para governar as contas", en: "Ready to run the numbers" },
    body: {
      pt: "Dica: abra este painel após crises grandes para ver o impacto no caixa e ajustar tarifas/verbas antes que a inflação estoure.",
      en: "Tip: open this panel after major crises to see the cash impact and adjust tariffs/budgets before inflation spikes.",
    },
  },
];

interface Props {
  lang: Lang;
  /** Nome do gestor exibido no header do card. */
  mayorName?: string;
  /** Ativo: renderiza o tour. Só é passado como true quando a seção está visível. */
  active: boolean;
}

/**
 * Renderiza o tour de finanças na primeira vez que `active` vira true.
 * Após concluído ou pulado, grava flag no localStorage e some para sempre.
 */
export function FinanceTour({ lang, active }: Props) {
  // Só inicia se ativo e nunca visto.
  const [step, setStep] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(STORAGE_KEY) ? null : -1;
    } catch {
      return -1;
    }
  });

  // Quando a seção de finanças abre pela primeira vez, arranca o passo 0.
  useEffect(() => {
    if (!active) return;
    if (step === -1) {
      // Pequeno delay para o painel montar (evita medir rect vazio).
      const t = window.setTimeout(() => setStep(0), 250);
      return () => window.clearTimeout(t);
    }
  }, [active, step]);

  if (step === null || step < 0) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setStep(null);
  };
  const next = () => (isLast ? finish() : setStep(step + 1));
  const prev = () => setStep(Math.max(0, step - 1));

  return (
    <>
      <SpotlightBackdrop targetId={current.target} />
      <TargetHighlight targetId={current.target} />
      <FinanceTourCard
        step={step}
        total={STEPS.length}
        title={current.title[lang]}
        body={current.body[lang]}
        target={current.target}
        placement={current.placement ?? "bottom"}
        lang={lang}
        onNext={next}
        onPrev={prev}
        onSkip={finish}
        isFirst={step === 0}
        isLast={isLast}
      />
    </>
  );
}

interface CardProps {
  step: number;
  total: number;
  title: string;
  body: string;
  target?: string;
  placement: "top" | "bottom" | "left" | "right";
  lang: Lang;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function FinanceTourCard(p: CardProps) {
  const rect = useTargetRect(p.target);
  useEffect(() => {
    if (!p.target) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${p.target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [p.target]);

  const layout = useMemo(() => computeCardLayout(rect, p.placement), [rect, p.placement]);

  return (
    <Card
      className="pointer-events-auto fixed z-[71] w-[340px] max-w-[calc(100vw-32px)] border-emerald-500/40 bg-slate-950/95 p-4 shadow-2xl ring-1 ring-emerald-500/30 backdrop-blur"
      style={{ top: layout.top, left: layout.left }}
      role="dialog"
      aria-live="polite"
    >
      {layout.arrow && <Arrow side={layout.arrow.side} offset={layout.arrow.offset} />}
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-md bg-emerald-500/10 p-2 ring-1 ring-emerald-500/30">
          <CircleDollarSign className="h-6 w-6 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-400/90">
            {p.lang === "pt" ? "Guia — Finanças" : "Guide — Finance"}
            <span className="ml-auto tabular-nums text-muted-foreground">
              {p.step + 1}/{p.total}
            </span>
          </div>
          <h3 className="mt-1 text-base font-bold leading-tight">{p.title}</h3>
        </div>
        <button
          type="button"
          onClick={p.onSkip}
          className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          title={p.lang === "pt" ? "Pular tour" : "Skip tour"}
          aria-label={p.lang === "pt" ? "Pular tour" : "Skip tour"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>

      <div className="mt-3 flex items-center justify-center gap-1">
        {Array.from({ length: p.total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === p.step ? "w-6 bg-emerald-400" : i < p.step ? "w-1.5 bg-emerald-400/50" : "w-1.5 bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={p.onSkip}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {p.lang === "pt" ? "Pular" : "Skip"}
        </Button>
        <div className="flex items-center gap-1.5">
          {!p.isFirst && (
            <Button size="sm" variant="outline" onClick={p.onPrev} className="gap-1">
              <ChevronLeft className="h-3.5 w-3.5" />
              {p.lang === "pt" ? "Voltar" : "Back"}
            </Button>
          )}
          <Button size="sm" onClick={p.onNext} className="gap-1 bg-emerald-500 hover:bg-emerald-500/90 text-slate-950">
            {p.isLast ? (p.lang === "pt" ? "Concluir" : "Finish") : p.lang === "pt" ? "Próximo" : "Next"}
            {!p.isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
