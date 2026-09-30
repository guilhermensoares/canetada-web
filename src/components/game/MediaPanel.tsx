import { memo, useState } from "react";
import type { GameState } from "@/game/types";
import type { MediaState, MediaBias, CoverageTopic } from "@/game/media";
import { biasLabel, topicLabelPublic, BRIEFING_COST, BRIEFING_CP } from "@/game/media";
import type { VideosphereState, VideoAngle } from "@/game/videosphere";
import { channelBiasLabel, videoFormatLabel, markAllVideosSeen } from "@/game/videosphere";
import { formatMoney } from "@/game/logic";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, Megaphone, Flame, TrendingDown, Youtube, ChevronDown, ChevronRight } from "lucide-react";
import { outletLogo } from "@/assets/media";
import { INFLUENCER_SPRITES } from "@/assets/influencers";

interface Props {
  state: GameState;
  actions: { briefing: () => void };
}

const BIAS_COLOR: Record<MediaBias, string> = {
  sensationalist: "bg-destructive/15 text-destructive border-destructive/30",
  government:     "bg-primary/15 text-primary border-primary/30",
  economic:       "bg-warning/15 text-warning border-warning/30",
  community:      "bg-success/15 text-success border-success/30",
  opposition:     "bg-muted text-foreground border-border",
  mainstream:     "bg-primary/20 text-primary border-primary/40",
  welfare:        "bg-success/20 text-success border-success/40",
  police:         "bg-destructive/20 text-destructive border-destructive/40",
  urbanNews:         "bg-warning/20 text-warning border-warning/40",
  favelaRadio:       "bg-success/10 text-success border-success/30",
  neighborhoodPaper: "bg-muted/60 text-foreground border-border",
};


function angleGlyph(a: -1 | 0 | 1) {
  return a < 0 ? "▼" : a > 0 ? "▲" : "◆";
}
function angleTone(a: -1 | 0 | 1) {
  return a < 0 ? "text-destructive" : a > 0 ? "text-success" : "text-muted-foreground";
}

function MediaPanelImpl({ state, actions }: Props) {
  const m = (state as GameState & { media?: MediaState }).media;
  if (!m) return null;
  const isPt = state.lang === "pt";
  const pc = (state.politics as unknown as { politicalCapital?: number } | undefined)?.politicalCapital ?? 0;

  const topics = (Object.keys(m.topicHeat) as CoverageTopic[])
    .map(t => ({ t, h: m.topicHeat[t] }))
    .filter(x => x.h > 5)
    .sort((a, b) => b.h - a.h)
    .slice(0, 6);

  const canBriefing = state.treasury >= BRIEFING_COST && pc >= BRIEFING_CP && m.briefingCooldown === 0;

  return (
    <Card className="mt-3 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Newspaper className="h-4 w-4 text-primary" />
            {isPt ? "Mídia & Opinião Pública" : "Media & Public Opinion"}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isPt
              ? "Cada veículo cobre com seu viés. Barulho midiático vira realidade política."
              : "Each outlet spins with its bias. Media noise becomes political reality."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
          <span>{isPt ? "Manchetes" : "Headlines"}: <b className="text-foreground">{m.stats.totalHeadlines}</b></span>
          <span>{isPt ? "Efeitos manada" : "Herd events"}: <b className="text-foreground">{m.stats.herdEvents}</b></span>
          <span>{isPt ? "Pronunciamentos" : "Briefings"}: <b className="text-foreground">{m.stats.briefings}</b></span>
        </div>
      </div>

      {/* Outlets bar */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {m.outlets.map(o => (
          <Badge key={o.id} variant="outline" className={`text-[10px] ${BIAS_COLOR[o.bias]}`}>
            <span className="font-semibold">{isPt ? o.namePt : o.nameEn}</span>
            <span className="ml-1 opacity-70">· {biasLabel(o.bias, state.lang)}</span>
          </Badge>
        ))}
      </div>

      {/* Herd alert */}
      {m.lastHerd && m.lastHerd.year * 12 + m.lastHerd.month >= state.year * 12 + state.month - 2 && (
        <div className="mb-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px]">
          <div className="flex items-center gap-1 font-semibold text-destructive">
            <TrendingDown className="h-3.5 w-3.5" />
            {isPt ? "Efeito Manada ativo" : "Herd effect active"}
          </div>
          <div className="mt-0.5 text-muted-foreground">
            {isPt
              ? `${m.lastHerd.outlets} veículos cobrindo "${topicLabelPublic(m.lastHerd.topic, "pt")}" — -${m.lastHerd.approvalHit.toFixed(1)} aprovação`
              : `${m.lastHerd.outlets} outlets piling on "${topicLabelPublic(m.lastHerd.topic, "en")}" — -${m.lastHerd.approvalHit.toFixed(1)} approval`}
          </div>
        </div>
      )}

      {/* Topic heat */}
      {topics.length > 0 && (
        <div className="mb-3 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {isPt ? "Temperatura das pautas" : "Topic heat"}
          </div>
          {topics.map(({ t, h }) => (
            <div key={t} className="flex items-center gap-2 text-[11px]">
              <Flame className={`h-3 w-3 ${h > 60 ? "text-destructive" : h > 30 ? "text-warning" : "text-muted-foreground"}`} />
              <span className="w-24 capitalize">{topicLabelPublic(t, state.lang)}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className={`h-full ${h > 60 ? "bg-destructive" : h > 30 ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, h)}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums text-muted-foreground">{Math.round(h)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Headlines */}
      <div className="mb-3 space-y-1">
        <div className="text-[11px] font-semibold text-muted-foreground">
          {isPt ? "Últimas manchetes" : "Latest headlines"}
        </div>
        {m.headlines.length === 0 && (
          <div className="rounded border border-dashed border-border p-2 text-[11px] text-muted-foreground">
            {isPt ? "A imprensa ainda não se pronunciou." : "The press has not weighed in yet."}
          </div>
        )}
        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {m.headlines.slice(0, 12).map(h => {
            const outlet = m.outlets.find(o => o.id === h.outletId);
            return (
              <div key={h.id} className="rounded border border-border/60 bg-card/40 p-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs ${angleTone(h.angle)}`}>{angleGlyph(h.angle)}</span>
                  <span className="flex-1 truncate font-medium">
                    {state.lang === "pt" ? h.textPt : h.textEn}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {outlet && outletLogo(outlet.id) && (
                    <img src={outletLogo(outlet.id)} alt="" loading="lazy" className="w-4 h-4 object-contain shrink-0" />
                  )}
                  <Badge variant="outline" className={`text-[9px] ${outlet ? BIAS_COLOR[outlet.bias] : ""}`}>
                    {outlet ? (isPt ? outlet.namePt : outlet.nameEn) : h.outletId}
                  </Badge>
                  <span>· {h.month}/{h.year}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-col gap-1.5">
        <Button size="sm" variant="secondary" disabled={!canBriefing} onClick={actions.briefing}>
          <Megaphone className="mr-1 h-3.5 w-3.5" />
          {isPt ? "Pronunciamento oficial" : "Official briefing"} · {formatMoney(BRIEFING_COST)} · {BRIEFING_CP} CP
        </Button>
        {m.briefingCooldown > 0 && (
          <div className="text-[10px] text-muted-foreground">
            {isPt
              ? `Trégua midiática por mais ${m.briefingCooldown} mês(es).`
              : `Media truce lasts ${m.briefingCooldown} more month(s).`}
          </div>
        )}
      </div>

      <VideosphereBlock state={state} />
    </Card>
  );
}

function VideosphereBlock({ state }: { state: GameState }) {
  const v = (state as GameState & { videosphere?: VideosphereState }).videosphere;
  const isPt = state.lang === "pt";
  const [openId, setOpenId] = useState<string | null>(null);

  // Kenny Katacoco não aparece como influencer se o jogador estiver usando ele
  // como prefeito ou o tiver contratado como assessor — quebra imersão.
  const kennyIsPlayer = state.mayor?.personaId === "kenny_katacoco";
  const hired = state.advisors?.hired ?? {};
  const kennyIsAdvisor = Object.values(hired).some(
    (a) => a && (a as { archetypeId?: string }).archetypeId === "arq_kenny_katacoco",
  );
  const hideKenny = kennyIsPlayer || kennyIsAdvisor;
  const visibleChannels = v ? v.channels.filter(c => !(hideKenny && c.id === "vs_kennykatacoco")) : [];
  const visibleVideos = v ? v.videos.filter(p => !(hideKenny && p.channelId === "vs_kennykatacoco")) : [];

  if (!v || visibleVideos.length === 0) {
    return (
      <div className="mt-3 rounded border border-dashed border-border p-2 text-[11px] text-muted-foreground">
        <div className="mb-0.5 flex items-center gap-1 font-semibold text-foreground">
          <Youtube className="h-3.5 w-3.5 text-destructive" />
          YouTubi
        </div>
        {isPt
          ? "Nenhum vídeo ainda. Assim que uma pauta esquentar, os influencers publicam aqui."
          : "No videos yet. As topics heat up, the influencers will post here."}
      </div>
    );
  }
  const unseen = visibleVideos.filter(p => !p.seen).length;
  const angleTone = (a: VideoAngle) => a < 0 ? "text-destructive" : a > 0 ? "text-success" : "text-muted-foreground";
  const angleGlyph = (a: VideoAngle) => a < 0 ? "▼" : a > 0 ? "▲" : "◆";
  return (
    <div className="mt-3 rounded border border-border/60 bg-card/40 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold">
          <Youtube className="h-4 w-4 text-destructive" />
          YouTubi
          {unseen > 0 && (
            <Badge variant="outline" className="ml-1 border-destructive/40 bg-destructive/10 text-[9px] text-destructive">
              {unseen} {isPt ? "novo(s)" : "new"}
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {isPt ? "Vlogs, podcasts e reacts" : "Vlogs, podcasts and reacts"} · {v.stats.totalVideos} · {Math.round(v.stats.totalViewsK / 1000)}M views
        </div>
      </div>

      {/* Channels */}
      <div className="mb-2 flex flex-wrap gap-1">
        {visibleChannels.map(ch => (
          <Badge
            key={ch.id}
            variant="outline"
            className="text-[9px]"
            title={`${ch.host} — ${isPt ? ch.bioPt : ch.bioEn}`}
          >
            {INFLUENCER_SPRITES[ch.id] ? (
              <img src={INFLUENCER_SPRITES[ch.id]} alt="" loading="lazy" className="mr-1 inline-block h-4 w-4 rounded-full object-cover" />
            ) : (
              <span className="mr-1">{ch.avatar}</span>
            )}
            <span className="font-semibold">{isPt ? ch.namePt : ch.nameEn}</span>
            <span className="ml-1 opacity-70">· {channelBiasLabel(ch.bias, state.lang)}</span>
          </Badge>
        ))}
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
        {visibleVideos.slice(0, 10).map(p => {
          const ch = visibleChannels.find(c => c.id === p.channelId);
          const open = openId === p.id;
          return (
            <div key={p.id} className={`rounded border p-1.5 text-[11px] ${p.seen ? "border-border/50 bg-transparent" : "border-primary/30 bg-primary/5"}`}>
              <button
                type="button"
                onClick={() => { setOpenId(open ? null : p.id); if (!p.seen) { p.seen = true; markAllVideosSeen; } }}
                className="flex w-full items-start gap-1.5 text-left"
              >
                {open ? <ChevronDown className="mt-0.5 h-3 w-3 shrink-0" /> : <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />}
                <span className={`text-xs ${angleTone(p.angle)}`}>{angleGlyph(p.angle)}</span>
                <span className="flex-1">
                  <span className="font-medium">{isPt ? p.titlePt : p.titleEn}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    {ch && (
                      <span className="flex items-center gap-1">
                        {INFLUENCER_SPRITES[ch.id] ? (
                          <img src={INFLUENCER_SPRITES[ch.id]} alt="" loading="lazy" className="inline-block h-3.5 w-3.5 rounded-full object-cover" />
                        ) : (
                          <span>{ch.avatar}</span>
                        )}
                        <b className="text-foreground">{ch.host}</b>
                      </span>
                    )}
                    <span>· {videoFormatLabel(p.format, state.lang)}</span>
                    <span>· {p.durationMin} min</span>
                    <span>· {p.viewsK >= 1000 ? `${(p.viewsK / 1000).toFixed(1)}M` : `${p.viewsK}K`} views</span>
                    <span>· {p.month}/{p.year}</span>
                  </span>
                </span>
              </button>
              {open && (
                <div className="mt-1.5 border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
                  {isPt ? p.summaryPt : p.summaryEn}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const MediaPanel = /*#__PURE__*/ memo(MediaPanelImpl);
