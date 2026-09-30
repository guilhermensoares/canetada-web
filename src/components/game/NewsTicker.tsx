/**
 * NewsTicker — rolling LED-style marquee of city headlines.
 *
 * Replaces the previously static "Manchetes recentes" list with a
 * right-to-left ticker (news-marquee CSS in styles.css). Speed is
 * player-adjustable and persisted. Clicking any headline opens a
 * detail dialog with the full media context.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NewsIcon, PauseIcon, PlayIcon, GaugeIcon, ExternalIcon } from "@/components/icons";
import { t, monthName } from "@/game/i18n";
import type { NewsItem } from "@/game/types";

interface Props {
  news: NewsItem[];
  lang: "pt" | "en";
  onOpenMedia?: () => void;
}

const KIND_DOT: Record<NewsItem["kind"], string> = {
  info:    "bg-sky-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger:  "bg-rose-500",
};

const KIND_BADGE: Record<NewsItem["kind"], string> = {
  info:    "border-sky-500/40 bg-sky-500/10 text-sky-300",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  danger:  "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

const KIND_LABEL: Record<NewsItem["kind"], { pt: string; en: string }> = {
  info:    { pt: "Informe",    en: "Info" },
  success: { pt: "Boa nova",   en: "Good news" },
  warning: { pt: "Alerta",     en: "Warning" },
  danger:  { pt: "Crise",      en: "Crisis" },
};

const SPEED_KEY = "ludusstadt.newsTickerSpeed";
const PAUSE_KEY = "ludusstadt.newsTickerPaused";

/** px per second — 30 (calm) … 220 (frantic). */
const DEFAULT_SPEED = 90;

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch { return fallback; }
}

function NewsTickerImpl({ news, lang, onOpenMedia }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState<number>(() => readNumber(SPEED_KEY, DEFAULT_SPEED));
  const [paused, setPaused] = useState<boolean>(() => {
    try { return localStorage.getItem(PAUSE_KEY) === "1"; } catch { return false; }
  });
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => { try { localStorage.setItem(SPEED_KEY, String(speed)); } catch { /* ignore */ } }, [speed]);
  useEffect(() => { try { localStorage.setItem(PAUSE_KEY, paused ? "1" : "0"); } catch { /* ignore */ } }, [paused]);

  // Re-measure whenever the news array (length/content) changes so duration
  // is recomputed and no headlines "jump".
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // The duplicated content means offsetWidth already covers both loops.
    setTrackWidth(el.scrollWidth / 2);
  }, [news]);

  // The keyframes shift by -50% (one full copy). Duration = width/speed.
  const duration = useMemo(() => {
    if (!trackWidth || speed <= 0) return 60;
    return Math.max(6, Math.min(600, trackWidth / speed));
  }, [trackWidth, speed]);

  // Duplicate the list so the loop is seamless.
  const loopItems = useMemo(() => [...news, ...news], [news]);

  const empty = news.length === 0;

  const handleClick = useCallback((n: NewsItem) => {
    setPaused(true);
    setSelected(n);
  }, []);

  return (
    <Card className="paper-bg flex min-h-0 flex-col overflow-hidden border-2 border-[var(--color-ink)] shadow-[3px_3px_0_0_var(--color-ink)]" data-tour="news">
      {/* header — Diário Oficial */}
      <div className="diario-bar flex items-center gap-2 px-4 py-3">
        <NewsIcon className="h-5 w-5" />
        <div className="font-serif-display text-xs font-semibold uppercase tracking-[0.25em] text-foreground">
          {lang === "pt" ? "Diário da Cidade" : "City Gazette"}
        </div>
        <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[var(--color-stamp)]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-stamp)]" />
          {lang === "pt" ? "AO VIVO" : "LIVE"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "play" : "pause"}
          >
            {paused ? <PlayIcon className="h-3.5 w-3.5" /> : <PauseIcon className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* ticker rail */}
      <div className="relative border-b border-border/60 bg-slate-950/70">
        {empty ? (
          <div className="px-4 py-4 text-center text-xs text-muted-foreground">
            {lang === "pt" ? "Sem manchetes ainda…" : "No headlines yet…"}
          </div>
        ) : (
          <div className="news-marquee-mask overflow-hidden py-3">
            <div
              ref={trackRef}
              className="news-marquee-track whitespace-nowrap font-serif-display text-[15px]"
              data-paused={paused ? "true" : "false"}
              style={{ ["--marquee-duration" as string]: `${duration}s` }}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => {
                // only auto-resume if user hasn't manually paused via button
                if (localStorage.getItem(PAUSE_KEY) !== "1") setPaused(false);
              }}
            >
              {loopItems.map((n, i) => (
                <button
                  key={`${n.id}-${i}`}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`group inline-flex shrink-0 items-center gap-2 rounded px-1 text-left transition-colors ${
                    n.highlight
                      ? "text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)] hover:text-amber-100"
                      : "text-slate-100 hover:text-cyan-300"
                  }`}
                >
                  {n.highlight ? (
                    <span className="inline-block shrink-0 animate-pulse text-amber-300">★</span>
                  ) : (
                    <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[n.kind]}`} />
                  )}
                  <span className="text-[10px] tabular-nums text-slate-500">
                    {String(n.month).padStart(2, "0")}/{n.year}
                  </span>
                  <span className={`group-hover:underline ${n.highlight ? "font-bold uppercase tracking-wider" : "font-semibold"}`}>
                    {t(lang, n.titleKey as never, n.titleKey)}
                  </span>
                  <span className="mx-2 text-slate-700">•</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* speed control */}
      <div className="flex items-center gap-3 px-4 py-2">
        <GaugeIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {lang === "pt" ? "Velocidade" : "Speed"}
        </span>
        <Slider
          value={[speed]}
          min={20}
          max={220}
          step={5}
          onValueChange={(v) => setSpeed(v[0] ?? DEFAULT_SPEED)}
          className="flex-1"
          aria-label={lang === "pt" ? "Velocidade do letreiro" : "Ticker speed"}
        />
        <span className="w-12 text-right text-[10px] tabular-nums text-muted-foreground">
          {speed} px/s
        </span>
      </div>

      {/* detail dialog */}
      <Dialog
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            if (localStorage.getItem(PAUSE_KEY) !== "1") setPaused(false);
          }
        }}
      >
        <DialogContent className="max-w-lg border-border/60 bg-slate-900">
          {selected && (
            <>
              <DialogHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Badge className={`border text-[10px] uppercase tracking-widest ${KIND_BADGE[selected.kind]}`}>
                    {KIND_LABEL[selected.kind][lang]}
                  </Badge>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {monthName(lang, selected.month)} {selected.year}
                  </span>
                </div>
                <DialogTitle className="text-lg leading-snug">
                  {t(lang, selected.titleKey as never, selected.titleKey)}
                </DialogTitle>
                {selected.detail && (
                  <DialogDescription className="pt-2 text-sm leading-relaxed text-slate-300">
                    {selected.detail}
                  </DialogDescription>
                )}
              </DialogHeader>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <p className="text-[11px] text-muted-foreground">
                  {lang === "pt"
                    ? "Abra o painel de mídia para ver a repercussão completa (veículos, viés e trending topics)."
                    : "Open the media panel to see the full spread (outlets, bias and trending topics)."}
                </p>
                {onOpenMedia && (
                  <Button
                    size="sm"
                    onClick={() => { onOpenMedia(); setSelected(null); }}
                    className="shrink-0"
                  >
                    <ExternalIcon className="mr-1.5 h-3.5 w-3.5" />
                    {lang === "pt" ? "Painel de mídia" : "Media panel"}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export const NewsTicker = /*#__PURE__*/ memo(NewsTickerImpl);
