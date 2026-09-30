import { useSyncExternalStore } from "react";
import { Bell, BellOff, Music2, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MOOD_LABEL, type Mood } from "@/game/soundtrack";
import { getSfxPrefs, playSfx, setSfxMuted, subscribeSfx } from "@/game/sfx";
import { useSoundtrack } from "@/hooks/useSoundtrack";

function useSfxMuted(): boolean {
  return useSyncExternalStore(
    subscribeSfx,
    () => getSfxPrefs().muted,
    () => false,
  );
}

/**
 * Controle compacto da trilha adaptativa: mute, volume, pular faixa e
 * indicação do clima musical atual. Vive na TopBar (ou no rodapé do menu).
 */
export function MusicControl({
  mood,
  lang,
  compact = false,
}: {
  mood: Mood;
  lang: "pt" | "en";
  compact?: boolean;
}) {
  const music = useSoundtrack(mood);
  const sfxMuted = useSfxMuted();
  const label = MOOD_LABEL[mood][lang];
  const title = music.current
    ? `${music.current.title} — ${label}`
    : lang === "pt"
      ? "Trilha sonora"
      : "Soundtrack";

  return (
    <div className="flex items-center gap-1" title={title}>
      <Button
        size="sm"
        variant="ghost"
        data-sfx="none"
        onClick={() => { setSfxMuted(!sfxMuted); if (sfxMuted) playSfx("tap"); }}
        className="px-2"
        aria-label={
          sfxMuted
            ? (lang === "pt" ? "Ativar efeitos sonoros" : "Unmute sound effects")
            : (lang === "pt" ? "Silenciar efeitos sonoros" : "Mute sound effects")
        }
        title={lang === "pt" ? "Efeitos sonoros" : "Sound effects"}
      >
        {sfxMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={music.toggleMute}
        className="gap-1"
        aria-label={music.muted ? (lang === "pt" ? "Ativar música" : "Unmute music") : (lang === "pt" ? "Silenciar música" : "Mute music")}
      >
        {music.muted ? <VolumeX className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}
        {!compact && (
          <span className="hidden text-mono text-[10px] uppercase tracking-wide text-muted-foreground lg:inline">
            {label}
          </span>
        )}
      </Button>

      {!compact && (
        <div className="hidden w-20 items-center md:flex">
          <Slider
            value={[Math.round(music.volume * 100)]}
            onValueChange={(v) => music.setVolume((v[0] ?? 0) / 100)}
            max={100}
            step={5}
            aria-label={lang === "pt" ? "Volume da música" : "Music volume"}
          />
        </div>
      )}

      {!compact && (
        <Button
          size="sm"
          variant="ghost"
          onClick={music.skip}
          className="px-2"
          aria-label={lang === "pt" ? "Próxima faixa" : "Next track"}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      )}

      {compact && !music.muted && (
        <Volume2 className="h-3 w-3 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}
