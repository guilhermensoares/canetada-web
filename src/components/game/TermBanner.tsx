/**
 * TermBanner — narrative anchor for the "Dois Mandatos" arc.
 *
 * Shows which of the 2 mandates the player is on, the year within the term,
 * and a countdown/urgency signal as the October election approaches.
 */
import { memo } from "react";
import { Card } from "@/components/ui/card";
import type { GameState } from "@/game/types";
import { monthsUntilElection, currentTermNumber } from "@/game/journey";
import { VoteIcon, LandmarkIcon, TrophyIcon } from "@/components/icons";

interface Props { state: GameState }

function TermBannerImpl({ state }: Props) {
  const lang = state.lang;
  const term = currentTermNumber(state);
  const canRerun = state.politics?.election?.reelectionAllowed ?? true;
  const monthsLeft = Math.max(0, monthsUntilElection(state));
  const yearInTerm = Math.min(
    4,
    Math.max(1, state.year - (state.politics?.election?.termStartYear ?? state.year) + 1),
  );
  const campaign = monthsLeft <= 6 && canRerun;
  const finalStretch = term === 2 && !canRerun;

  const tone =
    finalStretch ? "border-fuchsia-500/40 bg-fuchsia-500/5 text-fuchsia-100"
    : campaign  ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
    :             "border-cyan-500/25 bg-cyan-500/5 text-cyan-100";

  const Icon = finalStretch ? TrophyIcon : campaign ? VoteIcon : LandmarkIcon;

  const title =
    finalStretch
      ? (lang === "pt" ? "Segundo mandato — o legado se define aqui" : "Second term — your legacy is set here")
      : term === 2
        ? (lang === "pt" ? "Mandato 2 de 2" : "Term 2 of 2")
        : (lang === "pt" ? "Mandato 1 de 2" : "Term 1 of 2");

  const sub = campaign
    ? (lang === "pt"
        ? `Fase de campanha ativa — eleição em ${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"}. Cuide da aprovação e do caixa.`
        : `Campaign phase active — election in ${monthsLeft} ${monthsLeft === 1 ? "month" : "months"}. Watch approval and cash.`)
    : finalStretch
      ? (lang === "pt"
          ? "Você não pode se reeleger. Complete o mandato para consagrar sua carreira."
          : "You cannot run again. Finish this term to seal your career.")
      : (lang === "pt"
          ? `Ano ${yearInTerm} de 4 · Eleição em ${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"}`
          : `Year ${yearInTerm} of 4 · Election in ${monthsLeft} ${monthsLeft === 1 ? "month" : "months"}`);

  return (
    <Card className={`diario-bar flex items-center gap-3 rounded-sm p-3 ${tone}`}>
      <div className="ink-border-sm rounded-sm bg-background/40 p-2">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-serif-display text-[10px] uppercase tracking-[0.3em] opacity-80">
          {lang === "pt" ? "Diário Oficial" : "Official Gazette"} · {state.cityName}
        </div>
        <div className="stamp-text text-base leading-tight">{title}</div>
        <div className="mt-0.5 text-[11px] opacity-80">{sub}</div>
      </div>
      <div className="hidden shrink-0 text-right md:block">
        <div className="font-serif-display text-[10px] uppercase tracking-[0.25em] opacity-70">
          {lang === "pt" ? "Mês do mandato" : "Term month"}
        </div>
        <div className="font-serif-display text-2xl font-black tabular-nums leading-none">
          {String(((state.year - (state.politics?.election?.termStartYear ?? state.year)) * 12) + state.month).padStart(2, "0")}
          <span className="text-xs opacity-60">/48</span>
        </div>
      </div>
    </Card>
  );
}

export const TermBanner = /*#__PURE__*/ memo(TermBannerImpl);
