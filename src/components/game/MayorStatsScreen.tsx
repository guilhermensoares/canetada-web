/**
 * MayorStatsScreen — dossier of the currently playing persona.
 *
 * Opens from a button next to the mayor avatar in `CityCockpit`. Shows the
 * caricature's ideology axis, tags, perks, coherence score, and recent key
 * decisions so the player can decide in a way that matches the character.
 */
import { memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MayorAvatar } from "./MayorAvatar";
import type { GameState } from "@/game/types";
import { findPolitician } from "@/game/politicianPresets";
import { currentTermNumber, monthsUntilElection } from "@/game/journey";
import { Scale } from "lucide-react";

interface Props {
  state: GameState;
  open: boolean;
  onClose: () => void;
}

function coherenceLabel(score: number, lang: "pt" | "en"): { text: string; color: string } {
  if (score >= 75) return { text: lang === "pt" ? "Fiel à linha" : "On brand", color: "text-emerald-300" };
  if (score >= 55) return { text: lang === "pt" ? "Alinhado" : "Aligned", color: "text-cyan-300" };
  if (score >= 40) return { text: lang === "pt" ? "Ambíguo" : "Ambiguous", color: "text-amber-300" };
  return { text: lang === "pt" ? "Fora da linha" : "Off-brand", color: "text-rose-300" };
}

function MayorStatsScreenImpl({ state, open, onClose }: Props) {
  const lang = state.lang;
  const preset = state.mayor.personaId ? findPolitician(state.mayor.personaId) : undefined;
  const ideo = preset?.ideology ?? 0;
  const ideoPct = ((ideo + 1) / 2) * 100;
  const coh = state.journey?.coherenceScore ?? 50;
  const cohLbl = coherenceLabel(coh, lang);
  const monthsLeft = monthsUntilElection(state);
  const term = currentTermNumber(state);
  const key = (state.journey?.keyDecisions ?? []).slice(0, 6);

  const tip = !preset
    ? (lang === "pt" ? "Prefeito(a) personalizado(a) — coerência baseada na ideologia neutra." : "Custom mayor — coherence uses neutral ideology.")
    : ideo < -0.3
      ? (lang === "pt" ? "Prospera investindo em serviços públicos, moradia social e regulação." : "Thrives investing in public services, social housing and regulation.")
      : ideo > 0.3
        ? (lang === "pt" ? "Prospera com concessões, corte de impostos e agilidade fiscal." : "Thrives on concessions, tax cuts and fiscal agility.")
        : (lang === "pt" ? "Prospera equilibrando bases opostas e evitando movimentos radicais." : "Thrives balancing opposing bases and avoiding radical moves.");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl border-cyan-500/25 bg-slate-950 text-foreground">
        <DialogHeader>
          <DialogTitle>{lang === "pt" ? "Dossier do prefeito" : "Mayor dossier"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[160px_1fr]">
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-xl bg-slate-900 p-1 ring-1 ring-cyan-500/20">
              <MayorAvatar personaId={state.mayor.personaId}
                  archetypeId={state.mayor.archetypeId} size={140} className="rounded-lg" />
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{state.mayor.title}</div>
              <div className="text-base font-bold leading-tight">{state.mayor.name}</div>
              <div className="text-xs text-cyan-300">{state.cityName}</div>
            </div>
          </div>

          <div className="space-y-3">
            {/* Term summary */}
            <div className="rounded border border-border/40 bg-slate-900/60 p-3 text-xs">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {lang === "pt" ? "Mandato" : "Term"}
              </div>
              <div className="flex justify-between">
                <span>{lang === "pt" ? `Mandato ${term} de 2` : `Term ${term} of 2`}</span>
                <span className="tabular-nums text-cyan-300">
                  {lang === "pt" ? "Eleição em" : "Election in"} {Math.max(0, monthsLeft)} {lang === "pt" ? "meses" : "months"}
                </span>
              </div>
            </div>

            {/* Ideology axis */}
            <div className="rounded border border-border/40 bg-slate-900/60 p-3">
              <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Scale className="h-3 w-3" /> {lang === "pt" ? "Ideologia" : "Ideology"}
              </div>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-rose-500/40 via-slate-500/30 to-sky-500/40">
                <div
                  className="absolute -top-1 h-4 w-1.5 rounded bg-white shadow"
                  style={{ left: `calc(${ideoPct}% - 3px)` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{lang === "pt" ? "Esquerda" : "Left"}</span>
                <span>{lang === "pt" ? "Centro" : "Center"}</span>
                <span>{lang === "pt" ? "Direita" : "Right"}</span>
              </div>
            </div>

            {/* Tags */}
            {preset && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {lang === "pt" ? "Perfil" : "Profile"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {preset.tags.map((tg) => (
                    <Badge key={tg} variant="secondary" className="text-[10px] uppercase tracking-wider">{tg}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Perks */}
            {preset?.perks && (
              <div className="rounded border border-border/40 bg-slate-900/60 p-3 text-xs">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {lang === "pt" ? "Vantagens iniciais" : "Starting perks"}
                </div>
                <ul className="space-y-0.5">
                  {typeof preset.perks.approval === "number" && (
                    <li>{lang === "pt" ? "Aprovação" : "Approval"}: <span className="tabular-nums">{preset.perks.approval > 0 ? "+" : ""}{preset.perks.approval}</span></li>
                  )}
                  {typeof preset.perks.happiness === "number" && (
                    <li>{lang === "pt" ? "Felicidade" : "Happiness"}: <span className="tabular-nums">{preset.perks.happiness > 0 ? "+" : ""}{preset.perks.happiness}</span></li>
                  )}
                  {typeof preset.perks.treasury === "number" && (
                    <li>{lang === "pt" ? "Tesouro" : "Treasury"}: <span className="tabular-nums">{preset.perks.treasury > 0 ? "+" : ""}{preset.perks.treasury.toLocaleString()}</span></li>
                  )}
                  {preset.perks.policies && Object.entries(preset.perks.policies).map(([k, v]) => (
                    <li key={k}>{k}: <span className="tabular-nums">{v}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {/* Coherence */}
            <div className="rounded border border-border/40 bg-slate-900/60 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {lang === "pt" ? "Coerência ideológica" : "Ideological coherence"}
                </span>
                <span className={`text-xs font-bold ${cohLbl.color}`}>{cohLbl.text}</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-slate-950">
                <div className={`h-full bg-current ${cohLbl.color}`} style={{ width: `${coh}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span className="tabular-nums">{Math.round(coh)}/100</span>
                <span>{state.journey?.taggedChoices ?? 0} {lang === "pt" ? "escolhas ideológicas" : "ideology choices"}</span>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{tip}</p>
            </div>

            {/* Key decisions */}
            {key.length > 0 && (
              <div className="rounded border border-border/40 bg-slate-900/60 p-3">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {lang === "pt" ? "Decisões marcantes" : "Key decisions"}
                </div>
                <ul className="space-y-1 text-xs">
                  {key.map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">{d.titleKey}</span>
                      <span className={d.matched >= 0.6 ? "text-emerald-300" : "text-rose-300"}>
                        {String(d.month).padStart(2, "0")}/{d.year} · {d.matched >= 0.6 ? "✓" : "✗"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const MayorStatsScreen = /*#__PURE__*/ memo(MayorStatsScreenImpl);
