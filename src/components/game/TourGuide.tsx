/**
 * TourGuide — first-run onboarding overlay for the city cockpit.
 *
 * Why this exists
 * ---------------
 * Prefeito 2026 has ~10 hub panels, a live event system, a share button, time
 * controls and a scrolling news feed. Dropping a brand-new player straight
 * into that is overwhelming and, because the monthly event roll fires from
 * month 1, they'd usually get a crisis modal before they even parsed the KPI
 * grid. That was killing first-session retention (which is the whole point
 * of a "Braslol-style" viral browser game).
 *
 * How it works
 * ------------
 * - Persistent state lives on `GameState.tutorialStep` (see src/game/types.ts):
 *     undefined → legacy save, tour skipped
 *     0..N-1    → currently on that step
 *     >= 999    → tour done or skipped
 * - While `tutorialStep < 999`, `dayTick()` in src/game/logic.ts suppresses
 *   the random-event roll so nothing crashes the party.
 * - Each step optionally names a `target` — the id of a `data-tour=""` DOM
 *   anchor rendered by the shell. We measure it with `getBoundingClientRect`
 *   and draw a highlight ring + tooltip near it. If the target isn't in the
 *   DOM (yet), the step degrades gracefully to a centred modal card.
 *
 * Intentional non-goals
 * ---------------------
 * - No overlay dimming/clipping mask. That'd force us to poll layout on every
 *   scroll/resize and fight React re-renders. A soft border + arrow reads
 *   fine and stays cheap.
 * - No "click this exact button to continue" gating. Steps are read-and-next;
 *   the player is free to poke around in parallel.
 */
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { GameState, Lang } from "@/game/types";
import { MayorAvatar } from "./MayorAvatar";

/** Sentinel meaning "the tour is done". Stored on `GameState.tutorialStep`. */
export const TUTORIAL_DONE = 999;

type Copy = { pt: string; en: string };
interface Step {
  /** `data-tour` id of the element to highlight. Undefined → centred. */
  target?: string;
  /** Preferred placement of the tooltip relative to the target. */
  placement?: "top" | "bottom" | "left" | "right";
  title: Copy;
  body: Copy;
}

/** Kept short on purpose — 9 beats, ~20s of reading, then let them play. */
const STEPS: Step[] = [
  {
    title: {
      pt: "Bem-vindo(a), prefeito(a)!",
      en: "Welcome, mayor!",
    },
    body: {
      pt: "Você acabou de assumir a prefeitura. Vou te mostrar rapidamente o painel de comando antes de soltar o tempo. Nada vai explodir nesses 30 segundos, prometido.",
      en: "You just took office. Let me walk you through the command panel before I unpause the clock. Nothing will blow up in these 30 seconds, promise.",
    },
  },
  {
    target: "mayor",
    placement: "right",
    title: { pt: "Sua identidade", en: "Your identity" },
    body: {
      pt: "Aqui ficam seu nome, seu partido/ideologia e a cidade que você comanda. Cada personagem tem traços que afetam como o eleitorado reage.",
      en: "This card shows your name, ideology and the city you run. Each persona has traits that affect how voters react to your calls.",
    },
  },
  {
    target: "kpis",
    placement: "bottom",
    title: { pt: "Seus 6 indicadores", en: "The 6 core indicators" },
    body: {
      pt: "Aprovação, Felicidade, Tesouro, População, Desemprego e Inflação. Ganhe eleições cuidando dos três primeiros; sobreviva mantendo os três últimos sob controle.",
      en: "Approval, Happiness, Treasury, Population, Unemployment and Inflation. Win elections with the first three; stay afloat by keeping the last three in check.",
    },
  },
  {
    target: "time",
    placement: "bottom",
    title: { pt: "Controle do tempo", en: "Time controls" },
    body: {
      pt: "Pausa, play, 2× e turbo. O jogo pausa sozinho quando uma decisão importante aparece — você nunca vai perder uma manchete por estar em turbo.",
      en: "Pause, play, 2× and turbo. The sim auto-pauses when a real decision lands — you'll never miss a headline because you were fast-forwarding.",
    },
  },
  {
    target: "hub",
    placement: "right",
    title: { pt: "Painéis de gestão", en: "Management panels" },
    body: {
      pt: "Essa barra à esquerda abre cada área: Finanças, Políticas, Urbanismo, Mobilidade, Sociedade, Política, Crises… clique em uma e o painel desliza pela direita.",
      en: "This left rail opens every area: Finance, Policies, Urbanism, Mobility, Society, Politics, Crises… click one and the panel slides in from the right.",
    },
  },
  {
    target: "news",
    placement: "left",
    title: { pt: "Manchetes recentes", en: "Recent headlines" },
    body: {
      pt: "Cada tick mensal solta manchetes: contas fechadas, obras entregues, protestos, escândalos. É o pulso da cidade em texto.",
      en: "Every monthly tick drops headlines: budget closed, works delivered, protests, scandals. It's the city's pulse in plain text.",
    },
  },
  {
    title: { pt: "Decisões e crises", en: "Decisions & crises" },
    body: {
      pt: "De tempos em tempos surge uma decisão que exige sua resposta. O tempo pausa, um card destaca a situação e o painel Crise mostra as opções. Suas escolhas mexem em aprovação, cofres e humor dos grupos.",
      en: "Every so often a decision demands your call. The clock pauses, a card highlights it and the Crisis panel shows the options. Your picks move approval, treasury and interest-group mood.",
    },
  },
  {
    target: "share",
    placement: "bottom",
    title: { pt: "Compartilhe seu mandato", en: "Share your term" },
    body: {
      pt: "A qualquer momento (e principalmente no fim do mandato) você pode gerar um card viral com sua cara, aprovação e saldo. Ideal pra postar no PiuPiu da vida real.",
      en: "At any point (especially end of term) you can export a viral card with your face, approval and balance. Perfect for the real-world PiuPiu.",
    },
  },
  {
    title: { pt: "Pronto, é sua vez.", en: "You're on." },
    body: {
      pt: "O tempo já vai correr. As primeiras notícias vão chegar suaves — as crises entram em jogo depois que você tiver o pé no chão. Boa sorte, prefeito(a)!",
      en: "The clock is about to run. Early news will be gentle — real crises kick in once you've found your footing. Good luck, mayor!",
    },
  },
];

interface Props {
  state: GameState;
  onStep: (step: number) => void;
  /** Called by the last step so the shell can restart time (speed = 1). */
  onFinish?: () => void;
}

export function TourGuide({ state, onStep, onFinish }: Props) {
  const step = state.tutorialStep;
  // Legacy saves + explicit done → render nothing.
  if (step === undefined || step >= TUTORIAL_DONE) return null;

  const clamped = Math.max(0, Math.min(STEPS.length - 1, step));
  const current = STEPS[clamped];
  const lang: Lang = state.lang;
  const isLast = clamped === STEPS.length - 1;

  const finish = () => {
    onStep(TUTORIAL_DONE);
    onFinish?.();
  };
  const next = () => (isLast ? finish() : onStep(clamped + 1));
  const prev = () => onStep(Math.max(0, clamped - 1));

  return (
    <>
      <SpotlightBackdrop targetId={current.target} />
      <TargetHighlight targetId={current.target} />
      <TourCard
        step={clamped}
        total={STEPS.length}
        title={current.title[lang]}
        body={current.body[lang]}
        target={current.target}
        placement={current.placement ?? "bottom"}
        lang={lang}
        mayorArchetypeId={state.mayor.archetypeId}
        mayorPersonaId={state.mayor.personaId}
        onNext={next}
        onPrev={prev}
        onSkip={finish}
        isFirst={clamped === 0}
        isLast={isLast}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Dim backdrop with a soft cut-out over the target — draws the eye without   */
/* blocking clicks. Uses four semi-transparent bands around the target rect.  */
/* -------------------------------------------------------------------------- */
export function SpotlightBackdrop({ targetId }: { targetId?: string }) {
  const rect = useTargetRect(targetId);
  // No target → dim the whole screen lightly (centred modal steps).
  if (!rect) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[68] bg-slate-950/55 backdrop-blur-[1px] transition-opacity" />
    );
  }
  const PAD = 8;
  const top = Math.max(0, rect.top - PAD);
  const left = Math.max(0, rect.left - PAD);
  const right = left + rect.width + PAD * 2;
  const bottom = top + rect.height + PAD * 2;
  const shade = "bg-slate-950/55";
  return (
    <>
      <div className={`pointer-events-none fixed left-0 right-0 top-0 z-[68] ${shade}`} style={{ height: top }} />
      <div className={`pointer-events-none fixed bottom-0 left-0 right-0 z-[68] ${shade}`} style={{ top: bottom }} />
      <div className={`pointer-events-none fixed z-[68] ${shade}`} style={{ top, left: 0, width: left, height: rect.height + PAD * 2 }} />
      <div className={`pointer-events-none fixed z-[68] ${shade}`} style={{ top, left: right, right: 0, height: rect.height + PAD * 2 }} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Highlight ring — a fixed-position outline around the current target.        */
/* -------------------------------------------------------------------------- */

export function TargetHighlight({ targetId }: { targetId?: string }) {
  const rect = useTargetRect(targetId);
  if (!rect) return null;
  return (
    <div
      className="pointer-events-none fixed z-[70] rounded-lg ring-4 ring-primary ring-offset-2 ring-offset-background transition-all duration-200 animate-pulse shadow-[0_0_40px_rgba(34,211,238,0.45)]"
      style={{
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Tour card — the actual bubble.                                              */
/* -------------------------------------------------------------------------- */

interface CardProps {
  step: number;
  total: number;
  title: string;
  body: string;
  target?: string;
  placement: "top" | "bottom" | "left" | "right";
  lang: Lang;
  mayorArchetypeId?: GameState["mayor"]["archetypeId"];
  mayorPersonaId?: string;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function TourCard(p: CardProps) {
  const rect = useTargetRect(p.target);
  // Scroll target into view when it changes.
  useEffect(() => {
    if (!p.target) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${p.target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [p.target]);

  const layout = useMemo(() => computeCardLayout(rect, p.placement), [rect, p.placement]);

  return (
    <Card
      className="pointer-events-auto fixed z-[71] w-[340px] max-w-[calc(100vw-32px)] border-primary/40 bg-slate-950/95 p-4 shadow-2xl ring-1 ring-primary/30 backdrop-blur"
      style={{ top: layout.top, left: layout.left }}
      role="dialog"
      aria-live="polite"
    >
      {layout.arrow && <Arrow side={layout.arrow.side} offset={layout.arrow.offset} />}
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-md bg-slate-900/80 p-1 ring-1 ring-primary/30">
          <MayorAvatar
            personaId={p.mayorPersonaId}
            archetypeId={p.mayorArchetypeId}
            size={48}
            className="rounded-md"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary/80">
            <Sparkles className="h-3 w-3" />
            {p.lang === "pt" ? "Guia do Prefeito" : "Mayor's Guide"}
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
          title={p.lang === "pt" ? "Pular tutorial" : "Skip tutorial"}
          aria-label={p.lang === "pt" ? "Pular tutorial" : "Skip tutorial"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>

      {/* Progress dots */}
      <div className="mt-3 flex items-center justify-center gap-1">
        {Array.from({ length: p.total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === p.step ? "w-6 bg-primary" : i < p.step ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"
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
          <Button size="sm" onClick={p.onNext} className="gap-1">
            {p.isLast ? (p.lang === "pt" ? "Começar" : "Start") : p.lang === "pt" ? "Próximo" : "Next"}
            {!p.isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Small triangle arrow that visually connects the card to the target. */
export function Arrow({ side, offset }: { side: "top" | "bottom" | "left" | "right"; offset: number }) {
  const base = "absolute h-3 w-3 rotate-45 bg-slate-950 border-primary/40";
  const map: Record<string, string> = {
    top:    "-top-1.5 border-l border-t",
    bottom: "-bottom-1.5 border-r border-b",
    left:   "-left-1.5 border-l border-b",
    right:  "-right-1.5 border-r border-t",
  };
  const style: React.CSSProperties =
    side === "top" || side === "bottom"
      ? { left: offset }
      : { top: offset };
  return <div className={`${base} ${map[side]}`} style={style} aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                              */
/* -------------------------------------------------------------------------- */

export function useTargetRect(targetId?: string): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!targetId) { setRect(null); return; }
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${targetId}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    const el = document.querySelector<HTMLElement>(`[data-tour="${targetId}"]`);
    if (el && ro) ro.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const id = window.setInterval(measure, 250);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearInterval(id);
      ro?.disconnect();
    };
  }, [targetId]);
  return rect;
}

interface CardLayout {
  top: number;
  left: number;
  arrow?: { side: "top" | "bottom" | "left" | "right"; offset: number };
}

/** Smart placement: try preferred side, else pick the side with most room.
 *  Returns final coords + arrow anchor pointing back at the target. */
export function computeCardLayout(
  rect: DOMRect | null,
  preferred: "top" | "bottom" | "left" | "right",
): CardLayout {
  const CARD_W = 340;
  const CARD_H = 280;
  const GAP = 18;
  const MARGIN = 16;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  if (!rect) {
    return {
      top: Math.max(MARGIN, vh / 2 - CARD_H / 2),
      left: Math.max(MARGIN, vw / 2 - CARD_W / 2),
    };
  }

  // Room available on each side of the target.
  const room = {
    top:    rect.top - MARGIN,
    bottom: vh - rect.bottom - MARGIN,
    left:   rect.left - MARGIN,
    right:  vw - rect.right - MARGIN,
  };
  const need = {
    top: CARD_H + GAP,
    bottom: CARD_H + GAP,
    left: CARD_W + GAP,
    right: CARD_W + GAP,
  };
  // Try the preferred side first; if it doesn't fit, fall back to the side
  // with the most absolute room.
  const order: Array<"top" | "bottom" | "left" | "right"> = [
    preferred,
    ...(["bottom", "right", "top", "left"] as const).filter((s) => s !== preferred),
  ];
  let side = order.find((s) => room[s] >= need[s]) ?? order.sort((a, b) => room[b] - room[a])[0];

  let top = 0;
  let left = 0;
  switch (side) {
    case "top":
      top = rect.top - CARD_H - GAP;
      left = rect.left + rect.width / 2 - CARD_W / 2;
      break;
    case "bottom":
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - CARD_W / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - CARD_H / 2;
      left = rect.left - CARD_W - GAP;
      break;
    case "right":
      top = rect.top + rect.height / 2 - CARD_H / 2;
      left = rect.right + GAP;
      break;
  }
  // Clamp inside viewport.
  const clampedTop  = Math.max(MARGIN, Math.min(vh - CARD_H - MARGIN, top));
  const clampedLeft = Math.max(MARGIN, Math.min(vw - CARD_W - MARGIN, left));

  // Arrow anchor: project the target centre onto the card edge, clamped.
  let arrow: CardLayout["arrow"];
  if (side === "top" || side === "bottom") {
    const targetCx = rect.left + rect.width / 2;
    const offset = Math.max(16, Math.min(CARD_W - 24, targetCx - clampedLeft));
    arrow = { side: side === "top" ? "bottom" : "top", offset };
  } else {
    const targetCy = rect.top + rect.height / 2;
    const offset = Math.max(16, Math.min(CARD_H - 24, targetCy - clampedTop));
    arrow = { side: side === "left" ? "right" : "left", offset };
  }

  return { top: clampedTop, left: clampedLeft, arrow };
}

// Silence lint for imported-but-conditionally-used effect.
void useEffect;
