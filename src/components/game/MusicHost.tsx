import { useSyncExternalStore } from "react";
import {
  getGlobalMood,
  getMusicLang,
  subscribeMood,
  subscribeMusicLang,
} from "@/game/soundtrack";
import { MusicControl } from "./MusicControl";

/**
 * Player global da trilha: fica montado acima de todas as telas (menu,
 * seleção de cidade, jogo), então a música nunca reinicia ao trocar de tela.
 * Clima e idioma vêm dos stores publicados pelo GameShell.
 */
export function MusicHost() {
  const mood = useSyncExternalStore(subscribeMood, getGlobalMood, getGlobalMood);
  const lang = useSyncExternalStore(subscribeMusicLang, getMusicLang, getMusicLang);
  return (
    <div className="pointer-events-auto fixed bottom-2 right-2 z-[60] rounded-md border border-border/60 bg-panel/85 px-1 shadow-sm backdrop-blur-sm">
      <MusicControl mood={mood} lang={lang} />
    </div>
  );
}
