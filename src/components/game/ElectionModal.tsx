import { memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { t } from "@/game/i18n";
import type { GameState } from "@/game/types";
import { ShareMandateButton } from "./ShareMandateButton";

interface Props {
  state: GameState;
  onAck: () => void;
  onReset: () => void;
}

function ElectionModalImpl({ state, onAck, onReset }: Props) {
  const lang = state.lang;
  const pending = state.politics.election.pendingResult;
  const open = !!pending;
  if (!pending) return null;
  const { voteShare, won, breakdown } = pending;
  const canRerun = state.politics.election.reelectionAllowed;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(lang, "electionTitle")}</DialogTitle>
          <DialogDescription>{t(lang, "electionSubtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded border border-border/60 bg-panel/60 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {t(lang, "electionYou")}
              </span>
              <span className={`text-mono text-2xl ${won ? "text-success" : "text-destructive"}`}>
                {voteShare.toFixed(1)}%
              </span>
            </div>
            <Progress value={voteShare} className="mt-2 h-2" />
            <div className={`mt-2 text-sm font-medium ${won ? "text-success" : "text-destructive"}`}>
              {won ? t(lang, "electionWon") : t(lang, "electionLost")}
            </div>
            {won && !canRerun && (
              <div className="mt-1 text-xs text-muted-foreground">
                {t(lang, "electionEndOfTerm")}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              {t(lang, "electionBreakdown")}
            </div>
            <div className="space-y-1 text-xs">
              <BreakdownRow label="Approval" value={breakdown.approval} />
              <BreakdownRow label="Coalition" value={breakdown.coalition} />
              <BreakdownRow label="Corruption" value={breakdown.corruption} />
              <BreakdownRow label="Campaign" value={breakdown.campaign} />
              <BreakdownRow label="Inflation" value={breakdown.inflation} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <ShareMandateButton state={state} />
          {won ? (
            <Button onClick={onAck}>{t(lang, "electionContinue")}</Button>
          ) : (
            <Button variant="destructive" onClick={onReset}>{t(lang, "electionRestart")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  const positive = value >= 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-muted-foreground">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={positive ? "absolute left-1/2 h-full bg-success" : "absolute right-1/2 h-full bg-destructive"}
          style={{ width: `${Math.min(50, Math.abs(value) * 3)}%` }}
        />
        <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
      </div>
      <span className={`text-mono w-10 text-right ${positive ? "text-success" : "text-destructive"}`}>
        {positive ? "+" : ""}{value.toFixed(1)}
      </span>
    </div>
  );
}

export const ElectionModal = /*#__PURE__*/ memo(ElectionModalImpl);
