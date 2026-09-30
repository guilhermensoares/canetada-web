import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gavel, RotateCcw } from "lucide-react";
import type { GameState } from "@/game/types";
import { MayorAvatar } from "./MayorAvatar";
import { ShareMandateButton } from "./ShareMandateButton";

interface Props {
  state: GameState;
  onReset: () => void;
}

/**
 * Cutscene de cassação. Aparece quando oversight.impeachment.verdict === "removed".
 * Fundo escuro, vaias em ASCII, prefeito saindo entre protestos, botão para reiniciar.
 */
export function ImpeachmentGameOver({ state, onReset }: Props) {
  const removed =
    state.oversight?.impeachment?.verdict === "removed" &&
    state.oversight?.impeachment?.phase === "closed";
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!removed) { setStep(0); return; }
    const t1 = setTimeout(() => setStep(1), 900);
    const t2 = setTimeout(() => setStep(2), 2400);
    const t3 = setTimeout(() => setStep(3), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [removed]);

  if (!removed) return null;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-2xl border-destructive bg-black text-red-100 [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="space-y-5 py-4">
          <div className="flex items-center gap-3 text-destructive">
            <Gavel className="h-8 w-8 animate-pulse" />
            <div>
              <div className="text-xs uppercase tracking-widest opacity-70">
                Sessão extraordinária — Câmara Municipal
              </div>
              <h2 className="text-2xl font-black">CASSAÇÃO APROVADA</h2>
            </div>
          </div>

          <div className="rounded border border-destructive/50 bg-destructive/10 p-3 font-mono text-xs leading-relaxed">
            <div className={step >= 0 ? "opacity-100" : "opacity-0"}>
              &gt; Plenário aprova, por maioria, a perda do mandato do(a) prefeito(a).
            </div>
            <div className={step >= 1 ? "opacity-100" : "opacity-0"}>
              &gt; Base aliada não bloqueou o processo — P-CENTRO retirou apoio.
            </div>
            <div className={step >= 2 ? "opacity-100" : "opacity-0"}>
              &gt; Vice assume interinamente. Você é escoltado para a saída lateral.
            </div>
            <div className={`${step >= 3 ? "opacity-100" : "opacity-0"} text-red-300`}>
              &gt; Do lado de fora: buzinaço, faixas, panelaço. "FORA, {(state.mayor?.name ?? "PREFEITO").toUpperCase()}!"
            </div>
          </div>

          {/* Cena cinematográfica em pixel */}
          <div className="relative h-40 overflow-hidden rounded border border-red-900/40 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-700">
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
            {/* Multidão */}
            <div className="absolute inset-x-0 bottom-2 flex justify-around text-2xl">
              <span>😡</span><span>🪧</span><span>😠</span><span>📢</span>
              <span>🤬</span><span>🪧</span><span>😤</span><span>🥁</span>
              <span>😾</span><span>🪧</span><span>👺</span>
            </div>
            {/* Prefeito saindo — retrato do mayor real, não mais emoji. */}
            <div
              className="absolute bottom-4 transition-all duration-[3000ms] ease-linear"
              style={{ left: step >= 2 ? "5%" : "42%" }}
              aria-label="Prefeito saindo da prefeitura"
            >
              <MayorAvatar
                personaId={state.mayor.personaId}
                  archetypeId={state.mayor.archetypeId}
                size={56}
                className="rounded shadow-[0_0_0_2px_rgba(0,0,0,0.4)]"
              />
            </div>
            {/* Prédio da prefeitura */}
            <div className="absolute right-4 bottom-2 text-4xl opacity-80">🏛️</div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-red-900/40 bg-red-950/30 p-2">
              <div className="text-[10px] uppercase opacity-70">Aprovação final</div>
              <div className="text-lg font-bold text-red-300">{Math.round(state.approval)}%</div>
            </div>
            <div className="rounded border border-red-900/40 bg-red-950/30 p-2">
              <div className="text-[10px] uppercase opacity-70">Data</div>
              <div className="text-lg font-bold text-red-300">
                {String(state.month).padStart(2, "0")}/{state.year}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <ShareMandateButton state={state} />
            <Button
              onClick={onReset}
              variant="destructive"
              className="gap-2"
              disabled={step < 3}
            >
              <RotateCcw className="h-4 w-4" />
              Nova eleição — reiniciar campanha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
