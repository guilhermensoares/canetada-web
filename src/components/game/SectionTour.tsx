/**
 * SectionTour — mini-tour genérico disparado na primeira vez que o jogador
 * abre uma seção do hub (Políticas, Urbanismo, Mobilidade, etc.).
 *
 * Persistência por chave em localStorage — independente do save do jogo,
 * roda uma vez por navegador por seção. Reaproveita as primitivas visuais
 * do TourGuide principal (spotlight, ring, card com seta, layout inteligente).
 */
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { Lang } from "@/game/types";
import {
  SpotlightBackdrop,
  TargetHighlight,
  computeCardLayout,
  useTargetRect,
  Arrow,
} from "./TourGuide";

export type SectionTourCopy = { pt: string; en: string };
export interface SectionTourStep {
  target?: string;
  placement?: "top" | "bottom" | "left" | "right";
  title: SectionTourCopy;
  body: SectionTourCopy;
}

export interface SectionTourConfig {
  /** Chave em localStorage — deve ser única por seção. */
  storageKey: string;
  /** Ícone Lucide exibido no header do card. */
  Icon: ComponentType<{ className?: string }>;
  /** Rótulo curto no header (ex.: "Guia — Políticas"). */
  headerLabel: SectionTourCopy;
  /** Cor de destaque (tailwind color name — ex.: "sky", "amber"). */
  accent: string;
  steps: SectionTourStep[];
}

interface Props {
  lang: Lang;
  active: boolean;
  config: SectionTourConfig;
}

export function SectionTour({ lang, active, config }: Props) {
  const [step, setStep] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(config.storageKey) ? null : -1;
    } catch {
      return -1;
    }
  });

  useEffect(() => {
    if (!active) return;
    if (step === -1) {
      const t = window.setTimeout(() => setStep(0), 250);
      return () => window.clearTimeout(t);
    }
  }, [active, step]);

  if (step === null || step < 0) return null;

  const current = config.steps[step];
  const isLast = step === config.steps.length - 1;

  const finish = () => {
    try { window.localStorage.setItem(config.storageKey, "1"); } catch { /* ignore */ }
    setStep(null);
  };
  const next = () => (isLast ? finish() : setStep(step + 1));
  const prev = () => setStep(Math.max(0, step - 1));

  return (
    <>
      <SpotlightBackdrop targetId={current.target} />
      <TargetHighlight targetId={current.target} />
      <SectionTourCard
        step={step}
        total={config.steps.length}
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
        Icon={config.Icon}
        headerLabel={config.headerLabel[lang]}
        accent={config.accent}
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
  Icon: ComponentType<{ className?: string }>;
  headerLabel: string;
  accent: string;
}

// Paletas estáticas (Tailwind v4 precisa dos literais presentes no source).
const ACCENTS: Record<string, {
  border: string; ring: string; iconBg: string; iconRing: string; iconColor: string;
  labelColor: string; dotActive: string; dotPast: string; btnBg: string;
}> = {

  emerald: { border: "border-emerald-500/40", ring: "ring-emerald-500/30", iconBg: "bg-emerald-500/10", iconRing: "ring-emerald-500/30", iconColor: "text-emerald-400", labelColor: "text-emerald-400/90", dotActive: "bg-emerald-400", dotPast: "bg-emerald-400/50", btnBg: "bg-emerald-500 hover:bg-emerald-500/90" },
  sky:     { border: "border-sky-500/40",     ring: "ring-sky-500/30",     iconBg: "bg-sky-500/10",     iconRing: "ring-sky-500/30",     iconColor: "text-sky-400",     labelColor: "text-sky-400/90",     dotActive: "bg-sky-400",     dotPast: "bg-sky-400/50",     btnBg: "bg-sky-500 hover:bg-sky-500/90" },
  amber:   { border: "border-amber-500/40",   ring: "ring-amber-500/30",   iconBg: "bg-amber-500/10",   iconRing: "ring-amber-500/30",   iconColor: "text-amber-400",   labelColor: "text-amber-400/90",   dotActive: "bg-amber-400",   dotPast: "bg-amber-400/50",   btnBg: "bg-amber-500 hover:bg-amber-500/90" },
  violet:  { border: "border-violet-500/40",  ring: "ring-violet-500/30",  iconBg: "bg-violet-500/10",  iconRing: "ring-violet-500/30",  iconColor: "text-violet-400",  labelColor: "text-violet-400/90",  dotActive: "bg-violet-400",  dotPast: "bg-violet-400/50",  btnBg: "bg-violet-500 hover:bg-violet-500/90" },
  rose:    { border: "border-rose-500/40",    ring: "ring-rose-500/30",    iconBg: "bg-rose-500/10",    iconRing: "ring-rose-500/30",    iconColor: "text-rose-400",    labelColor: "text-rose-400/90",    dotActive: "bg-rose-400",    dotPast: "bg-rose-400/50",    btnBg: "bg-rose-500 hover:bg-rose-500/90" },
  orange:  { border: "border-orange-500/40",  ring: "ring-orange-500/30",  iconBg: "bg-orange-500/10",  iconRing: "ring-orange-500/30",  iconColor: "text-orange-400",  labelColor: "text-orange-400/90",  dotActive: "bg-orange-400",  dotPast: "bg-orange-400/50",  btnBg: "bg-orange-500 hover:bg-orange-500/90" },
  teal:    { border: "border-teal-500/40",    ring: "ring-teal-500/30",    iconBg: "bg-teal-500/10",    iconRing: "ring-teal-500/30",    iconColor: "text-teal-400",    labelColor: "text-teal-400/90",    dotActive: "bg-teal-400",    dotPast: "bg-teal-400/50",    btnBg: "bg-teal-500 hover:bg-teal-500/90" },
  cyan:    { border: "border-cyan-500/40",    ring: "ring-cyan-500/30",    iconBg: "bg-cyan-500/10",    iconRing: "ring-cyan-500/30",    iconColor: "text-cyan-400",    labelColor: "text-cyan-400/90",    dotActive: "bg-cyan-400",    dotPast: "bg-cyan-400/50",    btnBg: "bg-cyan-500 hover:bg-cyan-500/90" },
  fuchsia: { border: "border-fuchsia-500/40", ring: "ring-fuchsia-500/30", iconBg: "bg-fuchsia-500/10", iconRing: "ring-fuchsia-500/30", iconColor: "text-fuchsia-400", labelColor: "text-fuchsia-400/90", dotActive: "bg-fuchsia-400", dotPast: "bg-fuchsia-400/50", btnBg: "bg-fuchsia-500 hover:bg-fuchsia-500/90" },
};

function SectionTourCard(p: CardProps) {
  const rect = useTargetRect(p.target);
  useEffect(() => {
    if (!p.target) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${p.target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [p.target]);

  const layout = useMemo(() => computeCardLayout(rect, p.placement), [rect, p.placement]);
  const a = ACCENTS[p.accent] ?? ACCENTS.emerald;

  return (
    <Card
      className={`pointer-events-auto fixed z-[71] w-[340px] max-w-[calc(100vw-32px)] ${a.border} bg-slate-950/95 p-4 shadow-2xl ring-1 ${a.ring} backdrop-blur`}
      style={{ top: layout.top, left: layout.left }}
      role="dialog"
      aria-live="polite"
    >
      {layout.arrow && <Arrow side={layout.arrow.side} offset={layout.arrow.offset} />}
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-md ${a.iconBg} p-2 ring-1 ${a.iconRing}`}>
          <p.Icon className={`h-6 w-6 ${a.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest ${a.labelColor}`}>
            {p.headerLabel}
            <span className="ml-auto tabular-nums text-muted-foreground">{p.step + 1}/{p.total}</span>
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
              i === p.step ? `w-6 ${a.dotActive}` : i < p.step ? `w-1.5 ${a.dotPast}` : "w-1.5 bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={p.onSkip} className="text-xs text-muted-foreground hover:text-foreground">
          {p.lang === "pt" ? "Pular" : "Skip"}
        </Button>
        <div className="flex items-center gap-1.5">
          {!p.isFirst && (
            <Button size="sm" variant="outline" onClick={p.onPrev} className="gap-1">
              <ChevronLeft className="h-3.5 w-3.5" />
              {p.lang === "pt" ? "Voltar" : "Back"}
            </Button>
          )}
          <Button size="sm" onClick={p.onNext} className={`gap-1 ${a.btnBg} text-slate-950`}>
            {p.isLast ? (p.lang === "pt" ? "Concluir" : "Finish") : p.lang === "pt" ? "Próximo" : "Next"}
            {!p.isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

