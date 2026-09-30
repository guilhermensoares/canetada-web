/**
 * PoliceShowModal — "Hora da Verdade" (Datena-style).
 *
 * Aparece quando há um broadcast ativo no `policeShow`. Mostra o apresentador
 * gritando ao vivo, cronômetro para a cadeira quebrar e ações do prefeito:
 * enviar viaturas (custa dinheiro + capital político) ou ignorar (continua no ar).
 */

import { useMemo, useState, useEffect, memo } from "react";
import type { GameState } from "@/game/types";
import type { PoliceShowState } from "@/game/policeShow";
import {
  BROADCAST_TIMER,
  DISPATCH_COST,
  DISPATCH_CP,
  hoodLabel,
} from "@/game/policeShow";
import { polExt } from "@/game/legislature";
import { Button } from "@/components/ui/button";
import { AlertCircle, Radio, Zap } from "lucide-react";

interface Props {
  state: GameState;
  onDispatch: () => void;
}

const T = (lang: "pt" | "en") => ({
  title: lang === "pt" ? "HORA DA VERDADE" : "TRUTH HOUR",
  live: lang === "pt" ? "AO VIVO" : "LIVE",
  channel: lang === "pt" ? "Canal Recordar" : "Recall Channel",
  target: lang === "pt" ? "Bairro em pânico" : "Panic zone",
  crime: lang === "pt" ? "Crime" : "Crime",
  fear: lang === "pt" ? "Medo" : "Fear",
  countdown: lang === "pt" ? "Até quebrar a cadeira" : "Until chair breaks",
  days: lang === "pt" ? "dias" : "days",
  dispatch: lang === "pt" ? "🚔 Enviar viaturas" : "🚔 Dispatch units",
  ignore: lang === "pt" ? "Ignorar (segue no ar)" : "Ignore (stays live)",
  cost: lang === "pt" ? "Custo" : "Cost",
  cp: lang === "pt" ? "Capital político" : "Political capital",
  noFunds: lang === "pt" ? "Sem verba ou capital político suficientes" : "Not enough funds or political capital",
  angerCalm: lang === "pt" ? "Preocupado" : "Concerned",
  angerLoud: lang === "pt" ? "Gritando" : "Screaming",
  angerFurious: lang === "pt" ? "FURIOSO" : "FURIOUS",
  angerChair: lang === "pt" ? "QUEBROU A CADEIRA!" : "BROKE THE CHAIR!",
});

function PoliceShowModalImpl({ state, onDispatch }: Props) {
  const ext = state as GameState & { policeShow?: PoliceShowState };
  const ps = ext.policeShow;
  const b = ps?.broadcast;
  const [hidden, setHidden] = useState(false);
  const lang = (state.lang ?? "pt") as "pt" | "en";
  const t = useMemo(() => T(lang), [lang]);

  // Reset "hidden" whenever a new broadcast starts.
  useEffect(() => {
    if (b) setHidden(false);
  }, [b?.targetHood, b?.active]);

  if (!b || !b.active || hidden) return null;

  const hood = ps!.neighborhoods.find(h => h.id === b.targetHood);
  const pc = polExt(state).politicalCapital ?? 0;
  const canDispatch = state.treasury >= DISPATCH_COST && pc >= DISPATCH_CP;
  const timerPct = Math.max(0, Math.min(100, (b.timerDays / BROADCAST_TIMER) * 100));
  const angerLabel =
    b.anger === "chair_break" ? t.angerChair :
    b.anger === "furious" ? t.angerFurious :
    b.anger === "loud" ? t.angerLoud : t.angerCalm;
  const angerColor =
    b.anger === "chair_break" ? "text-red-500 animate-pulse" :
    b.anger === "furious" ? "text-red-400" :
    b.anger === "loud" ? "text-orange-400" : "text-amber-300";
  const quote = lang === "pt" ? b.quotePt : b.quoteEn;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm p-4 sm:items-center">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg border-2 border-red-600 bg-neutral-950 shadow-[0_0_40px_rgba(220,38,38,0.5)]">
        {/* TV header bar */}
        <div className="flex items-center justify-between border-b border-red-600/60 bg-gradient-to-r from-red-900/80 to-red-700/60 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-red-100">{t.live}</span>
            <span className="text-xs text-red-200/80">· {t.channel}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-red-100">
            <Radio className="h-3 w-3" />
            <span className="font-bold tracking-wider">{t.title}</span>
          </div>
        </div>

        {/* Host area */}
        <div className="flex gap-4 p-5">
          {/* Host avatar (CSS-only, no assets) */}
          <div className="flex-shrink-0">
            <div className="relative h-24 w-20 rounded-md bg-gradient-to-b from-neutral-800 to-neutral-900 ring-1 ring-red-900/50">
              {/* silhouette */}
              <div className="absolute inset-x-2 top-2 h-8 rounded-full bg-neutral-700" />
              <div className="absolute inset-x-1 bottom-1 top-10 rounded-md bg-neutral-800" />
              {/* tie */}
              <div className="absolute left-1/2 top-11 h-6 w-2 -translate-x-1/2 bg-red-700" />
              {/* shouting mouth */}
              <div className={`absolute left-1/2 top-6 h-2 w-4 -translate-x-1/2 rounded-full bg-red-900 ${b.anger === "furious" || b.anger === "chair_break" ? "h-3 w-5 animate-pulse" : ""}`} />
            </div>
            <div className={`mt-1 text-center text-[10px] font-bold uppercase ${angerColor}`}>
              {angerLabel}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs text-neutral-400">
              <AlertCircle className="h-3 w-3 text-red-500" />
              <span>{t.target}: <span className="font-bold text-red-300">{hood ? hoodLabel(hood.id, lang) : ""}</span></span>
            </div>
            <blockquote className={`rounded border-l-4 border-red-600 bg-neutral-900/60 px-3 py-2 text-sm italic leading-snug ${angerColor}`}>
              "{quote}"
            </blockquote>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-neutral-900 px-2 py-1.5">
                <div className="text-neutral-400">{t.crime}</div>
                <div className="font-mono text-red-300">{Math.round(hood?.crimeIndex ?? 0)}</div>
              </div>
              <div className="rounded bg-neutral-900 px-2 py-1.5">
                <div className="text-neutral-400">{t.fear}</div>
                <div className="font-mono text-orange-300">{Math.round(hood?.fear ?? 0)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="border-t border-neutral-800 bg-neutral-900/60 px-5 py-3">
          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider">
            <span className="text-neutral-400">{t.countdown}</span>
            <span className={`font-mono font-bold ${timerPct < 25 ? "text-red-400 animate-pulse" : timerPct < 50 ? "text-orange-300" : "text-neutral-200"}`}>
              {b.timerDays} {t.days}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className={`h-full transition-all ${timerPct < 25 ? "bg-red-500" : timerPct < 50 ? "bg-orange-500" : "bg-amber-500"}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-neutral-800 bg-neutral-950 px-5 py-4 sm:flex-row sm:justify-between">
          <div className="text-[11px] text-neutral-400">
            <div>{t.cost}: <span className="font-mono text-red-300">R$ {(DISPATCH_COST / 1000).toFixed(0)}k</span></div>
            <div>{t.cp}: <span className="font-mono text-red-300">{DISPATCH_CP}</span> (você tem {Math.round(pc)})</div>
            {!canDispatch && <div className="mt-1 text-red-400">{t.noFunds}</div>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:text-neutral-200"
              onClick={() => setHidden(true)}
            >
              {t.ignore}
            </Button>
            <Button
              size="sm"
              disabled={!canDispatch}
              onClick={() => { onDispatch(); setHidden(false); }}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              <Zap className="mr-1 h-4 w-4" />
              {t.dispatch}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PoliceShowModal = /*#__PURE__*/ memo(PoliceShowModalImpl);
