/**
 * AchievementsPanel — modal gallery showing every achievement in the game.
 *
 * Secret achievements are shown as blurred "???" cards until unlocked, which
 * is the whole point of the mechanic (curiosity + community talk). Rendered
 * on top of the cockpit via a shadcn Dialog — no route change needed.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENTS, getUnlockedAchievements, type Achievement } from "@/game/achievements";
import type { Lang } from "@/game/types";
import { Lock } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  lang: Lang;
}

const TIER_STYLE: Record<NonNullable<Achievement["tier"]>, string> = {
  bronze:    "border-amber-700/60 bg-amber-950/40",
  silver:    "border-slate-400/60 bg-slate-800/40",
  gold:      "border-yellow-500/60 bg-yellow-950/40",
  legendary: "border-fuchsia-500/60 bg-fuchsia-950/40",
};
const TIER_LABEL: Record<NonNullable<Achievement["tier"]>, { pt: string; en: string }> = {
  bronze:    { pt: "Bronze",    en: "Bronze" },
  silver:    { pt: "Prata",     en: "Silver" },
  gold:      { pt: "Ouro",      en: "Gold" },
  legendary: { pt: "Lendária",  en: "Legendary" },
};

export function AchievementsPanel({ open, onClose, lang }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    window.addEventListener("achievement:unlocked", handler);
    window.addEventListener("achievement:reset", handler);
    return () => {
      window.removeEventListener("achievement:unlocked", handler);
      window.removeEventListener("achievement:reset", handler);
    };
  }, []);

  const unlocked = useMemo(() => getUnlockedAchievements(), [tick, open]);
  const total = ACHIEVEMENTS.length;
  const unlockedCount = Object.keys(unlocked).length;
  const pct = total === 0 ? 0 : Math.round((unlockedCount / total) * 100);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden bg-slate-950/95 p-0">
        <DialogHeader className="border-b border-border/60 p-5">
          <DialogTitle className="flex items-center gap-2 text-lg">
            🏆 {lang === "pt" ? "Conquistas" : "Achievements"}
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {unlockedCount}/{total} · {pct}%
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {lang === "pt"
              ? "Progresso salvo entre mandatos e reinicializações. Algumas conquistas são secretas — explore o jogo para descobri-las."
              : "Progress persists across terms and resets. Some achievements are secret — explore the game to uncover them."}
          </DialogDescription>
          <Progress value={pct} className="mt-2 h-1.5" />
        </DialogHeader>

        <div className="max-h-[65vh] overflow-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => {
              const isUnlocked = a.id in unlocked;
              const hidden = a.secret && !isUnlocked;
              const tier = a.tier ?? "bronze";
              return (
                <div
                  key={a.id}
                  className={[
                    "flex gap-3 rounded-lg border p-3 transition-colors",
                    isUnlocked ? TIER_STYLE[tier] : "border-border/40 bg-slate-900/60",
                    !isUnlocked && "opacity-70",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div
                    className={[
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-2xl",
                      isUnlocked ? "bg-slate-950/50" : "bg-slate-950/70 text-muted-foreground",
                    ].join(" ")}
                    aria-hidden
                  >
                    {hidden ? <Lock className="h-5 w-5" /> : a.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-bold">
                        {hidden
                          ? lang === "pt" ? "Conquista secreta" : "Secret achievement"
                          : a.title[lang]}
                      </div>
                      {isUnlocked && (
                        <Badge variant="secondary" className="ml-auto text-[9px] uppercase tracking-wider">
                          {TIER_LABEL[tier][lang]}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {hidden
                        ? lang === "pt"
                          ? "Desbloqueie explorando o jogo…"
                          : "Unlock by exploring the game…"
                        : a.description[lang]}
                    </div>
                    {isUnlocked && (
                      <div className="mt-1 text-[10px] text-muted-foreground/70">
                        {lang === "pt" ? "Desbloqueada em " : "Unlocked "}
                        {new Date(unlocked[a.id]).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
