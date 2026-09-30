/**
 * AchievementsHost — floating trophy button + panel + global watchers.
 *
 * Watches the game state and evaluates achievement predicates after every
 * change. Also listens for easter-egg triggers (Konami code, logo clicks)
 * and shows toasts on unlock.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { AchievementsPanel } from "./AchievementsPanel";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  findAchievement,
  getUnlockedAchievements,
  unlockAchievement,
} from "@/game/achievements";
import { playSfx } from "@/game/sfx";
import type { GameState } from "@/game/types";

interface Props {
  state: GameState;
  /** Called when Konami is entered AND the player is eligible for a rewind
   *  (election lost + snapshot available + not yet used). */
  onSecondChance?: () => void;
}

const KONAMI = [
  "ArrowUp","ArrowUp","ArrowDown","ArrowDown",
  "ArrowLeft","ArrowRight","ArrowLeft","ArrowRight",
  "b","a",
];

export function AchievementsHost({ state, onSecondChance }: Props) {
  const [open, setOpen] = useState(false);
  const lang = state.lang;

  // Evaluate achievements on every state change (cheap — ~10 predicates).
  useEffect(() => {
    evaluateAchievements(state);
  }, [state]);

  // Konami-code listener → easter-egg achievement + "second chance" rewind.
  const buf = useRef<string[]>([]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      buf.current.push(k);
      if (buf.current.length > KONAMI.length) buf.current.shift();
      if (buf.current.join(",") === KONAMI.join(",")) {
        evaluateAchievements(state, { flag: "konami" });
        buf.current = [];

        // "Segunda chance": rewind 1 year if the player just lost an election
        // and a snapshot is available (and hasn't been used yet).
        const pending = state.politics?.election?.pendingResult;
        const eligible =
          pending && !pending.won &&
          !!state.secondChance?.snapshot &&
          !state.secondChance?.used;
        if (eligible && onSecondChance) {
          onSecondChance();
          toast.success(
            lang === "pt"
              ? "🎮 Segunda chance concedida"
              : "🎮 Second chance granted",
            {
              description: lang === "pt"
                ? "Você voltou para 1 ano antes da eleição. Faça diferente."
                : "You rewound to 1 year before the election. Do it differently.",
              duration: 6000,
            },
          );
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, onSecondChance, lang]);

  // Global "unlocked" listener → toast + haptic feedback.
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      const a = id ? findAchievement(id) : undefined;
      if (!a) return;
      playSfx("achievement");
      toast.success(
        `🏆 ${lang === "pt" ? "Conquista desbloqueada" : "Achievement unlocked"}: ${a.title[lang]}`,
        { description: a.description[lang], duration: 5000 },
      );
    };
    window.addEventListener("achievement:unlocked", handler);
    return () => window.removeEventListener("achievement:unlocked", handler);
  }, [lang]);

  // Expose a tiny debug helper on window so devs / speedrunners can inspect.
  useEffect(() => {
    const w = window as unknown as { __achievements?: unknown };
    w.__achievements = {
      list: () => ACHIEVEMENTS,
      unlocked: () => getUnlockedAchievements(),
      unlock: (id: string) => unlockAchievement(id),
    };
  }, []);

  const total = ACHIEVEMENTS.length;
  const unlockedCount = Object.keys(getUnlockedAchievements()).length;

  return (
    <>
      <div className="pointer-events-auto fixed right-3 top-16 z-40">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5 border-amber-500/40 bg-slate-950/80 text-amber-300 shadow-lg hover:bg-amber-500/10"
          title={lang === "pt" ? "Conquistas" : "Achievements"}
          aria-label={lang === "pt" ? "Abrir conquistas" : "Open achievements"}
        >
          <Trophy className="h-3.5 w-3.5" />
          <span className="tabular-nums text-xs">{unlockedCount}/{total}</span>
        </Button>
      </div>

      <AchievementsPanel open={open} onClose={() => setOpen(false)} lang={lang} />
    </>
  );
}
