/**
 * LegacyScreen — end-of-career celebration after completing 2 consecutive
 * mandates. Offers "start over with another mayor" to keep the meta loop.
 */
import { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MayorAvatar } from "./MayorAvatar";
import { ShareMandateButton } from "./ShareMandateButton";
import type { GameState } from "@/game/types";
import { loadHall } from "@/game/journey";
import { findPolitician } from "@/game/politicianPresets";
import { Trophy, RotateCcw } from "lucide-react";

interface Props {
  state: GameState;
  onNewCareer: () => void;
}

export function LegacyScreen({ state, onNewCareer }: Props) {
  const open = state.journey?.careerEnded === "victory";
  const lang = state.lang;
  const monthsInOffice = (state.year - 2026) * 12 + (state.month - 1);
  const yearsInOffice = (monthsInOffice / 12).toFixed(1);
  const preset = state.mayor.personaId ? findPolitician(state.mayor.personaId) : undefined;

  // Hall history for peer-comparison. Snapshotted on render open.
  const hall = useMemo(() => (open ? loadHall() : []), [open]);
  const bestApproval = hall.reduce((m, h) => Math.max(m, h.finalApproval), 0);

  if (!open) return null;

  return (
    <Dialog open>
      <DialogContent className="max-w-xl border-fuchsia-500/40 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 text-fuchsia-300">
            <Trophy className="h-8 w-8 animate-pulse" />
            <div>
              <div className="text-[10px] uppercase tracking-widest opacity-70">
                {lang === "pt" ? "Fim da jornada" : "End of journey"}
              </div>
              <h2 className="text-2xl font-black">
                {lang === "pt" ? "LEGADO CONSAGRADO" : "LEGACY SEALED"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded border border-fuchsia-500/25 bg-slate-950/60 p-4">
            <MayorAvatar personaId={state.mayor.personaId}
                  archetypeId={state.mayor.archetypeId} size={96} className="rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {state.mayor.title} · {state.cityName}
              </div>
              <div className="text-xl font-bold leading-tight">{state.mayor.name}</div>
              <div className="mt-1 text-xs text-fuchsia-200/90">
                {lang === "pt"
                  ? `Dois mandatos completos · ${yearsInOffice} anos no cargo`
                  : `Two full terms · ${yearsInOffice} years in office`}
              </div>
              {preset?.quote && (
                <blockquote className="mt-2 border-l-2 border-fuchsia-500/40 pl-2 text-[11px] italic text-muted-foreground">
                  "{preset.quote[lang]}"
                </blockquote>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label={lang === "pt" ? "Aprovação final" : "Final approval"} value={`${Math.round(state.approval)}%`} />
            <Stat label={lang === "pt" ? "Coerência" : "Coherence"} value={`${Math.round(state.journey?.coherenceScore ?? 50)}`} />
            <Stat label={lang === "pt" ? "Tesouro" : "Treasury"} value={new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(state.treasury)} />
          </div>

          {hall.length > 0 && (
            <div className="rounded border border-border/40 bg-slate-900/60 p-3 text-xs">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {lang === "pt" ? "Comparado ao Hall dos Prefeitos" : "Hall of Mayors comparison"}
              </div>
              <div className="opacity-80">
                {lang === "pt"
                  ? `Melhor aprovação anterior: ${bestApproval}% · Você: ${Math.round(state.approval)}%`
                  : `Best prior approval: ${bestApproval}% · You: ${Math.round(state.approval)}%`}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <ShareMandateButton state={state} />
            <Button onClick={onNewCareer} className="gap-2 bg-fuchsia-600 hover:bg-fuchsia-500">
              <RotateCcw className="h-4 w-4" />
              {lang === "pt" ? "Jogar como outro prefeito" : "Play as another mayor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-fuchsia-500/25 bg-slate-950/60 p-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums text-fuchsia-200">{value}</div>
    </div>
  );
}
