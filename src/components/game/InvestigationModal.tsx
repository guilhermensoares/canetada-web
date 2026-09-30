import { memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Siren, Scale, ShieldOff, UserX } from "lucide-react";
import type { GameState } from "@/game/types";
import { formatMoney } from "@/game/logic";
import type { PleaChoice } from "@/game/corruption";

interface Props {
  state: GameState;
  onResolve: (choice: PleaChoice) => void;
  onDismiss: () => void;
}

/**
 * Modal de Delação Premiada / Busca & Apreensão.
 * Aparece quando o corruption.plea está aberto (o assessor foi conduzido
 * pela PF após uma operação matutina). O jogador escolhe:
 *   • bancar advogado top com o caixa 2 (protege se lealdade ≥ 60);
 *   • abandonar (assessor decide sozinho — geralmente delata);
 *   • ignorar por ora (fecha; assessor decide na virada do mês).
 */
function InvestigationModalImpl({ state, onResolve, onDismiss }: Props) {
  const c = state.corruption;
  if (!c || !c.plea) return null;
  const p = c.plea;
  const canAffordLawyer = c.slushFund >= p.legalFee;
  const loyaltyColor =
    p.loyalty >= 70 ? "bg-success" : p.loyalty >= 45 ? "bg-warning" : "bg-destructive";

  return (
    <Dialog open onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent className="max-w-lg border-destructive/60 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Siren className="h-5 w-5 animate-pulse" />
            Operação da PF — Delação Premiada em aberto
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{p.advisorName}</span> foi
            conduzido(a) coercitivamente da pasta{" "}
            <Badge variant="outline" className="ml-1">{p.portfolio}</Badge> e está sob
            pressão para assinar acordo com o Ministério Público.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Lealdade do assessor</span>
              <span className="font-mono">{p.loyalty}/100</span>
            </div>
            <Progress value={p.loyalty} className={`h-2 [&>div]:${loyaltyColor}`} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {p.loyalty >= 60
                ? "Provavelmente aguenta o silêncio se tiver defesa jurídica."
                : p.loyalty >= 40
                ? "Zona cinzenta — pode ceder sob pressão."
                : "Baixa lealdade: tende a delatar imediatamente."}
            </p>
          </div>

          <div className="rounded border border-border bg-muted/40 p-2 text-xs">
            <div className="flex justify-between">
              <span>Caixa 2 disponível:</span>
              <span className="font-mono">{formatMoney(c.slushFund)}</span>
            </div>
            <div className="flex justify-between">
              <span>Custo do escritório de defesa:</span>
              <span className="font-mono text-destructive">{formatMoney(p.legalFee)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            disabled={!canAffordLawyer}
            onClick={() => onResolve("lawyer")}
            className="w-full justify-start gap-2"
          >
            <Scale className="h-4 w-4" />
            Bancar advogado top ({formatMoney(p.legalFee)} do caixa 2)
            {!canAffordLawyer && <span className="ml-auto text-[10px]">insuficiente</span>}
          </Button>
          <Button
            variant="outline"
            onClick={() => onResolve("abandon")}
            className="w-full justify-start gap-2"
          >
            <UserX className="h-4 w-4" />
            Abandonar o assessor — que se vire sozinho
          </Button>
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="w-full justify-start gap-2 text-muted-foreground"
          >
            <ShieldOff className="h-4 w-4" />
            Deixar para depois (assessor decide na virada do mês)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const InvestigationModal = /*#__PURE__*/ memo(InvestigationModalImpl);
