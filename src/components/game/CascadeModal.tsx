import { memo } from "react";
import type { GameState } from "@/game/types";
import type { CascadeState } from "@/game/cascade";
import type { CovertOpsState } from "@/game/covertOps";

interface Props {
  state: GameState;
  lang: "pt" | "en";
  onTow: () => void;
  onBot: () => void;
  onIgnore: () => void;
}

/**
 * Modal disparado quando um CascadeIncident está aberto. Apresenta o game loop
 * integrado (Fato → PiuPiu → Mídia → Decisão) descrito no roteiro.
 */
function CascadeModalImpl({ state, lang, onTow, onBot, onIgnore }: Props) {
  const c = (state as GameState & { cascade?: CascadeState }).cascade;
  const inc = c?.active;
  if (!inc || !inc.open) return null;

  const co = (state as GameState & { covertOps?: CovertOpsState }).covertOps;
  const hasAgency = (co?.contractedAgencies.length ?? 0) > 0;
  const towCost = 180_000;
  const botCost = 80_000;
  const canTow = state.treasury >= towCost;
  const canBot = hasAgency && state.treasury >= botCost;

  const pt = lang === "pt";
  const T = {
    title: pt ? "🚨 CASCATA MIDIÁTICA EM CURSO" : "🚨 MEDIA CASCADE UNDERWAY",
    fact:  pt ? "1. Fato urbano" : "1. Urban fact",
    piupiu: pt ? "2. #CaosNoTrânsito é #1 nos Trending Topics do PiuPiu" : "2. #CaosNoTrânsito trending #1 on PiuPiu",
    npcs:  pt ? "3. @MilitanteDoPLab e @PatriotaCidadão viralizam o meme" : "3. @MilitanteDoPLab and @PatriotaCidadão pile on",
    tv:    pt ? "4. Rede Cubo entra AO VIVO direto do viaduto 🔴📺" : "4. Rede Cubo goes LIVE from the viaduct 🔴📺",
    decide: pt ? "5. Decisão do Prefeito" : "5. Mayor's Call",
    aTitle: pt ? "A. Guincho + assumir a falha" : "A. Dispatch tow & own the mistake",
    aDesc:  pt ? `Custo R$ ${towCost.toLocaleString("pt-BR")} · +3 aprovação · resfria a hashtag` : `Cost R$ ${towCost.toLocaleString("en-US")} · +3 approval · cools hashtag`,
    bTitle: pt ? "B. Fazenda de Bots (#TudoNormalNaCidade)" : "B. Bot Farm (#TudoNormalNaCidade)",
    bDesc:  pt
      ? `Custo R$ ${botCost.toLocaleString("pt-BR")} · exige agência contratada · +45 risco de exposição · pode virar CPI`
      : `Cost R$ ${botCost.toLocaleString("en-US")} · needs contracted agency · +45 exposure risk · CPI possible`,
    cTitle: pt ? "C. Ignorar a crise" : "C. Ignore the crisis",
    cDesc:  pt ? "−7 aprovação · 55% de chance da Câmara abrir CPI" : "−7 approval · 55% chance of a Council inquiry (CPI)",
    noCash: pt ? "Sem caixa" : "No funds",
    noAg:   pt ? "Sem agência contratada" : "No agency contracted",
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border-2 border-destructive bg-card shadow-2xl overflow-hidden">
        <div className="bg-destructive/15 border-b-2 border-destructive px-5 py-3">
          <div className="text-xs font-mono text-destructive tracking-widest">BREAKING · PIUPIU · REDE CUBO</div>
          <h2 className="text-xl font-bold text-destructive mt-1">{T.title}</h2>
        </div>

        <div className="p-5 space-y-3 text-sm">
          <div className="rounded-lg bg-muted/50 p-3 border-l-4 border-primary">
            <div className="text-xs font-semibold uppercase text-muted-foreground">{T.fact}</div>
            <div className="mt-1">{pt ? inc.descPt : inc.descEn}</div>
          </div>

          <ol className="space-y-1.5 text-muted-foreground pl-1">
            <li>📱 {T.piupiu}</li>
            <li>🚩🇧🇷 {T.npcs}</li>
            <li>📺 {T.tv}</li>
          </ol>

          <div className="pt-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">{T.decide}</div>

            <button
              onClick={onTow}
              disabled={!canTow}
              className="w-full text-left p-3 rounded-lg border-2 border-green-500/40 bg-green-500/5 hover:bg-green-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition mb-2"
            >
              <div className="font-semibold text-green-700 dark:text-green-400">{T.aTitle}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{T.aDesc}</div>
              {!canTow && <div className="text-xs text-destructive mt-1">⚠ {T.noCash}</div>}
            </button>

            <button
              onClick={onBot}
              disabled={!canBot}
              className="w-full text-left p-3 rounded-lg border-2 border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition mb-2"
            >
              <div className="font-semibold text-amber-700 dark:text-amber-400">{T.bTitle}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{T.bDesc}</div>
              {!hasAgency && <div className="text-xs text-destructive mt-1">⚠ {T.noAg}</div>}
              {hasAgency && !canBot && <div className="text-xs text-destructive mt-1">⚠ {T.noCash}</div>}
            </button>

            <button
              onClick={onIgnore}
              className="w-full text-left p-3 rounded-lg border-2 border-destructive/40 bg-destructive/5 hover:bg-destructive/15 transition"
            >
              <div className="font-semibold text-destructive">{T.cTitle}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{T.cDesc}</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const CascadeModal = /*#__PURE__*/ memo(CascadeModalImpl);
