import { memo } from "react";
import type { GameState } from "@/game/types";
import type {
  ActivityKey,
  ClassSegment,
  Posture,
  MassEventDef,
} from "@/game/massEvents";
import { EVENT_CATALOG } from "@/game/massEvents";
import { t } from "@/game/i18n";
import { formatMoney } from "@/game/logic";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  PartyPopper, Sparkles, ShieldAlert, Handshake, Megaphone,
  Users, ShoppingBag, Music2, Trash2, Landmark, AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  actions: {
    setPosture: (a: ActivityKey, p: Posture) => void;
    setSecurityRatio: (v: number) => void;
    setCultureBudget: (v: number) => void;
    fundSpot: () => void;
    resolveDilemma: (choiceIdx: number) => void;
  };
}

const SEG_LABEL: Record<ClassSegment, { pt: string; en: string; icon: typeof Users }> = {
  elite:     { pt: "Elite",         en: "Elite",         icon: Landmark },
  middle:    { pt: "Classe média",  en: "Middle class",  icon: Users },
  workers:   { pt: "Trabalhadores", en: "Workers",       icon: Users },
  informal:  { pt: "Informais",     en: "Informals",     icon: ShoppingBag },
  tourists:  { pt: "Turistas",      en: "Tourists",      icon: Sparkles },
};

const ACTIVITY_META: Record<ActivityKey, { pt: string; en: string; icon: typeof Music2 }> = {
  streetParty:   { pt: "Blocos de rua",  en: "Street blocos",  icon: PartyPopper },
  streetVendors: { pt: "Camelôs / feiras", en: "Vendors / fairs", icon: ShoppingBag },
  bailesFunk:    { pt: "Bailes / cenas noturnas", en: "Bailes / night scene", icon: Music2 },
};

const POSTURE_META: Record<Posture, { pt: string; en: string; icon: typeof ShieldAlert; tone: string }> = {
  repress:  { pt: "Reprimir",  en: "Repress",  icon: ShieldAlert, tone: "bg-destructive/80 text-destructive-foreground" },
  regulate: { pt: "Regular",   en: "Regulate", icon: Handshake,   tone: "bg-warning/70 text-foreground" },
  promote:  { pt: "Fomentar",  en: "Promote",  icon: Megaphone,   tone: "bg-success/70 text-foreground" },
};

function MassEventsPanelImpl({ state, actions }: Props) {
  const lang = state.lang;
  const m = (state as GameState & { massEvents?: import("@/game/massEvents").MassEventsState }).massEvents;
  if (!m) return null;

  const nextEvents = upcomingEvents(state.month, 3);

  return (
    <Card className="mt-3 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <PartyPopper className="h-4 w-4 text-primary" />
            {t(lang, "mev.title")}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t(lang, "mev.subtitle")}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
          <span>
            {t(lang, "mev.culturalCapital")}: <b className="text-foreground">{Math.round(m.culturalCapital)}</b>
          </span>
          <span>
            {t(lang, "mev.cleaning")}: <b className="text-foreground">{Math.round(m.cleaningCapacity)}%</b>
          </span>
        </div>
      </div>

      {/* Active dilemma */}
      {m.activeDilemma && (
        <div className="mb-3 rounded-md border-2 border-warning/70 bg-warning/10 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-warning-foreground">
            <AlertOctagon className="h-4 w-4" />
            {t(lang, "mev.dilemma")}
          </div>
          <div className="mb-0.5 text-[12px] font-semibold">
            {inline(lang, m.activeDilemma.titleKey)}
          </div>
          <div className="mb-2 text-[10px] text-muted-foreground">
            {inline(lang, m.activeDilemma.descKey)}
          </div>
          <div className="grid gap-1 sm:grid-cols-3">
            {m.activeDilemma.choices.map((c, i) => {
              const meta = POSTURE_META[c.posture];
              const Icon = meta.icon;
              return (
                <Button
                  key={i} size="sm" variant="outline"
                  className="h-auto flex-col items-start gap-0.5 px-2 py-1.5 text-left"
                  onClick={() => actions.resolveDilemma(i)}
                >
                  <span className="flex items-center gap-1 text-[10px] font-semibold">
                    <Icon className="h-3 w-3" /> {inline(lang, c.labelKey)}
                  </span>
                  <span className="text-[9px] font-normal text-muted-foreground">
                    {inline(lang, c.hintKey)}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Segmented reputation */}
      <div className="mb-3 rounded-md border border-border/50 bg-background/30 p-2">
        <div className="mb-1.5 text-[11px] font-medium">{t(lang, "mev.reputation")}</div>
        <div className="grid grid-cols-5 gap-1">
          {(Object.keys(m.reputation) as ClassSegment[]).map((seg) => {
            const meta = SEG_LABEL[seg];
            const Icon = meta.icon;
            const v = Math.round(m.reputation[seg]);
            const tone =
              v >= 65 ? "bg-success"
              : v >= 45 ? "bg-warning"
              : "bg-destructive";
            return (
              <div key={seg} className="rounded border border-border/40 bg-background/40 p-1">
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  <span className="truncate">{lang === "pt" ? meta.pt : meta.en}</span>
                </div>
                <div className="mt-0.5 text-xs font-semibold tabular-nums">{v}</div>
                <div className="mt-0.5 h-1 overflow-hidden rounded bg-muted/40">
                  <div className={cn("h-full", tone)} style={{ width: `${v}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Postures — repress vs regulate vs promote */}
      <div className="mb-3 rounded-md border border-border/50 bg-background/30 p-2">
        <div className="mb-1.5 text-[11px] font-medium">{t(lang, "mev.postures")}</div>
        <div className="space-y-1.5">
          {(Object.keys(m.posture) as ActivityKey[]).map((act) => {
            const meta = ACTIVITY_META[act];
            const Icon = meta.icon;
            return (
              <div key={act} className="flex items-center gap-2">
                <div className="flex min-w-[38%] items-center gap-1 text-[11px]">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{lang === "pt" ? meta.pt : meta.en}</span>
                </div>
                <div className="flex flex-1 gap-1">
                  {(Object.keys(POSTURE_META) as Posture[]).map((p) => {
                    const pm = POSTURE_META[p];
                    const PmIcon = pm.icon;
                    const active = m.posture[act] === p;
                    return (
                      <Button
                        key={p} size="sm" variant={active ? "default" : "outline"}
                        className={cn(
                          "h-6 flex-1 gap-0.5 px-1 text-[10px]",
                          active && pm.tone,
                        )}
                        onClick={() => actions.setPosture(act, p)}
                      >
                        <PmIcon className="h-3 w-3" />
                        {lang === "pt" ? pm.pt : pm.en}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Budgets */}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-border/50 bg-background/30 p-2">
          <label className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{t(lang, "mev.securityRatio")}</span>
            <span className="tabular-nums">{Math.round(m.securityRatio * 100)}%</span>
          </label>
          <Slider
            value={[Math.round(m.securityRatio * 100)]}
            min={0} max={80} step={5}
            onValueChange={([v]) => actions.setSecurityRatio(v / 100)}
          />
        </div>
        <div className="rounded border border-border/50 bg-background/30 p-2">
          <label className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{t(lang, "mev.cultureBudget")}</span>
            <span className="tabular-nums">{formatMoney(m.monthlyCultureBudget)}/mo</span>
          </label>
          <Slider
            value={[m.monthlyCultureBudget]}
            min={0} max={500_000} step={20_000}
            onValueChange={([v]) => actions.setCultureBudget(v)}
          />
        </div>
      </div>

      {/* Upcoming events + fund venue */}
      <div className="mb-3 rounded-md border border-border/50 bg-background/30 p-2">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-medium">{t(lang, "mev.upcoming")}</span>
          <Button
            size="sm" variant="outline" className="h-6 text-[10px]"
            disabled={state.treasury < 800_000}
            onClick={actions.fundSpot}
          >
            {t(lang, "mev.fundSpot")} · {formatMoney(800_000)}
          </Button>
        </div>
        <div className="grid gap-1 sm:grid-cols-3">
          {nextEvents.map((e) => (
            <div key={e.id} className="rounded border border-border/40 bg-background/40 p-1.5 text-[10px]">
              <div className="font-semibold text-foreground">{t(lang, e.nameKey)}</div>
              <div className="text-muted-foreground">
                {t(lang, `month${e.months[0]}` as `month${number}`)} · turistas base {e.baseTourists.toLocaleString("pt-BR")}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          {t(lang, "mev.spotsFunded")}: <b className="text-foreground">{m.culturalSpotsFunded}</b>
        </div>
      </div>

      {/* Last impact */}
      {m.lastImpact && (
        <div className="mb-2 grid grid-cols-3 gap-1 rounded-md border border-border/50 bg-background/30 p-2 text-[10px]">
          <Mini label={t(lang, "mev.tourism")}  value={`+${formatMoney(m.lastImpact.tourismRevenue)}`} tone="ok" />
          <Mini label={t(lang, "mev.commerce")} value={`+${formatMoney(m.lastImpact.commerceRevenue)}`} tone="ok" />
          <Mini label={t(lang, "mev.cleanup")}  value={`-${formatMoney(m.lastImpact.cleanupCost + m.lastImpact.securityCost)}`} tone="danger" />
        </div>
      )}

      {/* History */}
      {m.history.length > 0 && (
        <div className="rounded-md border border-border/50 bg-background/20 p-2 text-[10px]">
          <div className="mb-1 flex items-center gap-1 font-medium text-muted-foreground">
            <Trash2 className="h-3 w-3" /> {t(lang, "mev.history")}
          </div>
          <ul className="space-y-0.5">
            {m.history.slice(0, 5).map((h) => (
              <li key={h.id} className="flex justify-between text-muted-foreground">
                <span>
                  {String(h.month).padStart(2, "0")}/{h.year} · {t(lang, EVENT_CATALOG.find((d) => d.id === h.defId)?.nameKey ?? h.defId)}
                </span>
                <span className={cn(h.incidents > 4 ? "text-warning" : "text-success")}>
                  {h.tourists.toLocaleString("pt-BR")} turistas · {h.incidents} inc.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: "ok" | "danger" }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 p-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-xs font-semibold tabular-nums",
        tone === "ok" ? "text-success" : "text-destructive",
      )}>{value}</div>
    </div>
  );
}

function upcomingEvents(currentMonth: number, count: number): MassEventDef[] {
  const sorted = EVENT_CATALOG
    .flatMap((e) => e.months.map((m) => ({ e, m })))
    .map(({ e, m }) => ({ e, offset: (m - currentMonth + 12) % 12 }))
    .sort((a, b) => a.offset - b.offset);
  const seen = new Set<string>();
  const out: MassEventDef[] = [];
  for (const { e } of sorted) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
    if (out.length === count) break;
  }
  return out;
}

function inline(lang: GameState["lang"], key: string): string {
  if (key.includes("||")) {
    const [pt, en] = key.split("||");
    return lang === "pt" ? pt : en;
  }
  return key;
}

export const MassEventsPanel = /*#__PURE__*/ memo(MassEventsPanelImpl);
