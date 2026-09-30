/**
 * CityCockpit — the panel-first "hero" that replaces the isometric map.
 *
 * The project's positioning is now Football-Manager-for-Brazilian-cities:
 * depth of political simulation over visual spectacle. The map became a
 * costly ornament that added little to the actual gameplay loop (decisions,
 * news, elections), so the shell now devotes its central real-estate to a
 * clean cockpit: mayor identity, KPI grid, recent news feed, and — when
 * present — the active event that needs the player's attention.
 *
 * All content is pure Tailwind / DOM; no canvases, no sprites, no pan/zoom.
 */
import { memo, useState } from "react";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MayorAvatar } from "./MayorAvatar";
import { NewsTicker } from "./NewsTicker";
import { ShareMandateButton } from "./ShareMandateButton";
import { TermBanner } from "./TermBanner";
import { MayorStatsScreen } from "./MayorStatsScreen";
import { formatMoney, formatNumber } from "@/game/logic";
import { monthName, t } from "@/game/i18n";
import { findPolitician } from "@/game/politicianPresets";
import type { GameState } from "@/game/types";
import {
  TrendingUp,
  TrendingDown,
  Users,
  HeartPulse,
  Vote,
  Wallet,
  Briefcase,
  AlertTriangle,
  IdCard,
} from "lucide-react";

interface Props {
  state: GameState;
  onOpenMedia?: () => void;
}

function CityCockpitImpl({ state, onOpenMedia }: Props) {
  const lang = state.lang;
  const preset = state.mayor.personaId ? findPolitician(state.mayor.personaId) : undefined;
  const balance = state.lastRevenue - state.lastExpenses;
  const insolvent = state.treasury < -400_000;
  const news = (state.news ?? []).slice(0, 24);
  const active = state.activeEvent;
  const [statsOpen, setStatsOpen] = useState(false);
  const isMobile = useIsMobile();
  const dragRef = useDragScroll<HTMLDivElement>();
  // Drag-to-scroll e "grab" só fazem sentido em telas de toque — no desktop
  // roubam cliques e podem deixar a página ancorada em scroll horizontal sem
  // scrollbar visível para o usuário reverter.
  const scrollRef = isMobile ? dragRef : undefined;

  return (
    <div
      ref={scrollRef}
      className={`canetada-scroll h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pb-24 sm:pb-4 ${isMobile ? "cursor-grab" : ""}`}
    >
      <div className="mx-auto grid max-w-[1400px] gap-3 p-3 sm:gap-4 sm:p-4 lg:p-6 xl:grid-cols-[380px_1fr_360px]">
        {/* -------- Left column: mayor identity + share -------- */}
        <div className="flex flex-col gap-4" data-tour="mayor">
          <TermBanner state={state} />

          <Card className="border-cyan-500/20 bg-slate-900/70 p-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-xl bg-slate-950/60 p-1.5 shadow-lg ring-1 ring-cyan-500/20">
                <MayorAvatar
                  personaId={state.mayor.personaId}
                  archetypeId={state.mayor.archetypeId}
                  size={140}
                  className="rounded-lg sm:!h-[200px] sm:!w-[200px]"
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {state.mayor.title}
                </div>
                <h2 className="text-2xl font-black leading-tight">{state.mayor.name}</h2>
                <div className="mt-1 text-sm text-cyan-300">{state.cityName}</div>
              </div>

              {preset && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {preset.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-wider">
                      {translateTag(tag, lang)}
                    </Badge>
                  ))}
                </div>
              )}

              {preset?.quote && (
                <blockquote className="mt-1 border-l-2 border-cyan-500/40 pl-3 text-left text-xs italic text-muted-foreground">
                  “{preset.quote[lang]}”
                </blockquote>
              )}

              <Button
                variant="outline"
                size="sm"
                className="mt-1 gap-2 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10"
                onClick={() => setStatsOpen(true)}
              >
                <IdCard className="h-3.5 w-3.5" />
                {lang === "pt" ? "Ver dossier" : "Open dossier"}
              </Button>
            </div>
          </Card>

          <MayorStatsScreen state={state} open={statsOpen} onClose={() => setStatsOpen(false)} />

          <Card className="border-border/60 bg-slate-900/60 p-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <TermStat
                label={lang === "pt" ? "Data" : "Date"}
                value={`${monthName(lang, state.month)} / ${state.year}`}
              />
              <TermStat
                label={lang === "pt" ? "Mandato" : "Term"}
                value={`${String(state.month).padStart(2, "0")}/48`}
              />
              <TermStat
                label={lang === "pt" ? "Balanço mensal" : "Monthly balance"}
                value={formatMoney(balance)}
                tone={balance >= 0 ? "up" : "down"}
              />
              <TermStat
                label={lang === "pt" ? "Modo" : "Mode"}
                value={state.mode === "mayor" ? (lang === "pt" ? "Prefeito" : "Mayor") : (lang === "pt" ? "Livre" : "Free")}
              />
            </div>
            <div className="mt-3">
              <ShareMandateButton state={state} />
            </div>
          </Card>

          {insolvent && (
            <Card className="border-destructive/60 bg-destructive/10 p-3">
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">{t(lang, "bankruptcyTitle")}</div>
                  <div className="mt-1 text-destructive/80">
                    {lang === "pt"
                      ? "O caixa municipal está abaixo do limite crítico. Ajuste impostos ou corte gastos."
                      : "The municipal cash is below the critical threshold. Adjust taxes or cut spending."}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* -------- Middle: KPI grid + active event -------- */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-tour="kpis">
            <Kpi
              label={lang === "pt" ? "Aprovação" : "Approval"}
              value={`${Math.round(state.approval)}%`}
              icon={Vote}
              accent="cyan"
              bar={state.approval}
            />
            <Kpi
              label={lang === "pt" ? "Felicidade" : "Happiness"}
              value={`${Math.round(state.happiness)}%`}
              icon={HeartPulse}
              accent="rose"
              bar={state.happiness}
            />
            <Kpi
              label={lang === "pt" ? "Tesouro" : "Treasury"}
              value={formatMoney(state.treasury)}
              icon={Wallet}
              accent={state.treasury >= 0 ? "emerald" : "red"}
            />
            <Kpi
              label={lang === "pt" ? "População" : "Population"}
              value={formatNumber(state.population)}
              icon={Users}
              accent="amber"
            />
            <Kpi
              label={lang === "pt" ? "Desemprego" : "Unemployment"}
              value={`${state.unemployment.toFixed(1)}%`}
              icon={Briefcase}
              accent="orange"
              bar={Math.min(100, state.unemployment * 5)}
              inverted
            />
            <Kpi
              label={lang === "pt" ? "Inflação" : "Inflation"}
              value={`${state.inflation.toFixed(1)}%`}
              icon={state.inflation >= 0 ? TrendingUp : TrendingDown}
              accent={state.inflation > 6 ? "red" : "sky"}
            />
          </div>

          {active && (
            <Card className="border-amber-500/40 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-amber-500/15 p-2 text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-amber-300/80">
                    {lang === "pt" ? "Decisão pendente" : "Pending decision"}
                  </div>
                  <div className="text-sm font-semibold">
                    {t(lang, active.def.titleKey as never, active.def.titleKey)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t(lang, active.def.descriptionKey as never, active.def.descriptionKey)}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {lang === "pt"
                      ? "Abra o painel Crise para responder."
                      : "Open the Crisis panel to respond."}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* -------- Right column: news marquee ticker -------- */}
        <NewsTicker news={news} lang={lang} onOpenMedia={onOpenMedia} />
      </div>
    </div>
  );
}

function TermStat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-foreground";
  return (
    <div className="rounded border border-border/40 bg-slate-950/40 p-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

const ACCENT: Record<string, { text: string; ring: string; bar: string }> = {
  cyan:    { text: "text-cyan-300",    ring: "ring-cyan-500/20",    bar: "bg-cyan-400" },
  rose:    { text: "text-rose-300",    ring: "ring-rose-500/20",    bar: "bg-rose-400" },
  emerald: { text: "text-emerald-300", ring: "ring-emerald-500/20", bar: "bg-emerald-400" },
  red:     { text: "text-red-300",     ring: "ring-red-500/30",     bar: "bg-red-400" },
  amber:   { text: "text-amber-300",   ring: "ring-amber-500/20",   bar: "bg-amber-400" },
  orange:  { text: "text-orange-300",  ring: "ring-orange-500/20",  bar: "bg-orange-400" },
  sky:     { text: "text-sky-300",     ring: "ring-sky-500/20",     bar: "bg-sky-400" },
};

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
  bar,
  inverted,
}: {
  label: string;
  value: string;
  icon: typeof Vote;
  accent: keyof typeof ACCENT;
  bar?: number;
  inverted?: boolean;
}) {
  const a = ACCENT[accent];
  return (
    <div className={`rounded-lg border border-border/40 bg-slate-900/70 p-3 shadow-sm ring-1 ${a.ring}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className={`h-3.5 w-3.5 ${a.text}`} />
      </div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${a.text}`}>{value}</div>
      {typeof bar === "number" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-950/60">
          <div
            className={`h-full ${a.bar} transition-[width] duration-300`}
            style={{ width: `${Math.max(0, Math.min(100, inverted ? 100 - bar : bar))}%` }}
          />
          {/* Keep Progress import a viable alt: <Progress value={bar} /> */}
        </div>
      )}
    </div>
  );
}


// Silence unused-import lint on Progress (kept as a documented alternative).
void Progress;

/** Human-readable label for a politician trait tag. */
const TAG_LABEL: Record<string, { pt: string; en: string }> = {
  leftPopulist:        { pt: "Populista de esquerda", en: "Left populist" },
  socialDemocrat:      { pt: "Social-democrata",       en: "Social democrat" },
  centristTechnocrat:  { pt: "Tecnocrata de centro",   en: "Centrist technocrat" },
  liberalReformist:    { pt: "Reformista liberal",     en: "Liberal reformist" },
  conservativeRight:   { pt: "Direita conservadora",   en: "Conservative right" },
  radicalRight:        { pt: "Direita radical",        en: "Radical right" },
  developmentalist:    { pt: "Desenvolvimentista",     en: "Developmentalist" },
  nationalist:         { pt: "Nacionalista",           en: "Nationalist" },
  environmentalist:    { pt: "Ambientalista",          en: "Environmentalist" },
  welfareFocus:        { pt: "Foco social",            en: "Welfare focus" },
  proBusiness:         { pt: "Pró-mercado",            en: "Pro-business" },
  moderate:            { pt: "Moderado",               en: "Moderate" },
};
function translateTag(tag: string, lang: "pt" | "en"): string {
  return TAG_LABEL[tag]?.[lang] ?? tag;
}

export const CityCockpit = /*#__PURE__*/ memo(CityCockpitImpl);
