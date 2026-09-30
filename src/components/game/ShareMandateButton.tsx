/**
 * "Compartilhar mandato" button — the viral primitive of the game.
 *
 * Renders a 1080×1350 vertical PNG summarising the current run (mayor
 * portrait, city, approval, treasury, month, ideology tag) and pushes it
 * through `navigator.share` when available. Falls back to a plain download
 * for desktop browsers that don't expose Web Share.
 *
 * The card is composed entirely in Canvas 2D so it works offline and never
 * touches the DOM — a shareable moment shouldn't require html2canvas & co.
 */
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Loader2 } from "lucide-react";
import type { GameState } from "@/game/types";
import { formatMoney, formatNumber } from "@/game/logic";
import { portraitFor } from "@/assets/politicians";
import { t } from "@/game/i18n";

const W = 1080;
const H = 1350;

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function ideologyLabel(ideology: number | undefined, lang: "pt" | "en"): string {
  if (typeof ideology !== "number") return lang === "pt" ? "Independente" : "Independent";
  if (ideology <= -0.4) return lang === "pt" ? "Esquerda" : "Left";
  if (ideology <= -0.1) return lang === "pt" ? "Centro-esquerda" : "Center-left";
  if (ideology < 0.1) return lang === "pt" ? "Centro" : "Center";
  if (ideology < 0.4) return lang === "pt" ? "Centro-direita" : "Center-right";
  return lang === "pt" ? "Direita" : "Right";
}

async function buildCard(state: GameState): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background gradient — dusk over São Paulo palette.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0b1220");
  grad.addColorStop(0.55, "#1e293b");
  grad.addColorStop(1, "#0f172a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent bar.
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(0, 0, W, 12);

  // Header eyebrow.
  ctx.fillStyle = "rgba(148,163,184,0.9)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("PREFEITO 2026 · MEU MANDATO", 60, 60);

  // Mayor portrait.
  const portrait = portraitFor(state.mayor.personaId);
  const portraitSize = 360;
  const px = 60;
  const py = 130;
  ctx.fillStyle = "rgba(15,23,42,0.6)";
  ctx.fillRect(px - 6, py - 6, portraitSize + 12, portraitSize + 12);
  if (portrait) {
    const img = await loadImage(portrait);
    if (img) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, px, py, portraitSize, portraitSize);
      ctx.imageSmoothingEnabled = true;
    }
  } else {
    ctx.fillStyle = "#334155";
    ctx.fillRect(px, py, portraitSize, portraitSize);
  }

  // Mayor name + city.
  const textX = px + portraitSize + 40;
  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 64px system-ui, sans-serif";
  ctx.fillText(state.mayor.name, textX, py);
  ctx.fillStyle = "rgba(226,232,240,0.8)";
  ctx.font = "500 32px system-ui, sans-serif";
  ctx.fillText(state.mayor.title, textX, py + 76);

  ctx.fillStyle = "#22d3ee";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText(state.cityName, textX, py + 140);

  ctx.fillStyle = "rgba(148,163,184,0.9)";
  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillText(
    `${ideologyLabel((state.mayor as any).ideology, state.lang)} · Mês ${state.month}`,
    textX,
    py + 200,
  );

  // Stats grid — approval, happiness, treasury, population.
  const stats: Array<[string, string, string]> = [
    [state.lang === "pt" ? "Aprovação" : "Approval", `${Math.round(state.approval)}%`, "#f472b6"],
    [state.lang === "pt" ? "Felicidade" : "Happiness", `${Math.round(state.happiness)}%`, "#fbbf24"],
    [state.lang === "pt" ? "População" : "Population", formatNumber(state.population ?? 0), "#a3e635"],
    [state.lang === "pt" ? "Tesouro" : "Treasury", formatMoney(state.treasury), "#38bdf8"],
  ];
  const gridY = 580;
  const cellW = (W - 120 - 30) / 2;
  const cellH = 190;
  stats.forEach(([label, value, color], i) => {
    const cx = 60 + (i % 2) * (cellW + 30);
    const cy = gridY + Math.floor(i / 2) * (cellH + 24);
    ctx.fillStyle = "rgba(15,23,42,0.75)";
    ctx.fillRect(cx, cy, cellW, cellH);
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cellW, cellH);

    ctx.fillStyle = "rgba(148,163,184,0.9)";
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), cx + 24, cy + 22);
    ctx.fillStyle = color;
    ctx.font = "800 76px system-ui, sans-serif";
    ctx.fillText(value, cx + 24, cy + 68);
  });

  // Footer.
  ctx.fillStyle = "rgba(148,163,184,0.85)";
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText(
    state.lang === "pt"
      ? "Jogue você também · prefeito2026.lovable.app"
      : "Play it yourself · prefeito2026.lovable.app",
    60,
    H - 60,
  );

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export function ShareMandateButton({ state }: { state: GameState }) {
  const [busy, setBusy] = useState(false);
  const lang = state.lang;

  const onClick = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await buildCard(state);
      if (!blob) return;
      const fileName = `prefeito2026-${state.cityName.toLowerCase().replace(/\s+/g, "-")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };
      const shareData: ShareData = {
        files: [file],
        title: `${state.mayor.name} — ${state.cityName}`,
        text:
          lang === "pt"
            ? `Meu mandato em ${state.cityName} — aprovação ${Math.round(state.approval)}%.`
            : `My term in ${state.cityName} — approval ${Math.round(state.approval)}%.`,
      };
      if (nav.share && (!nav.canShare || nav.canShare(shareData))) {
        try {
          await nav.share(shareData);
          return;
        } catch {
          // fall through to download
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }, [state, lang]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
      title={t(lang, "appTitle")}
      className="gap-1.5"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
      {lang === "pt" ? "Compartilhar mandato" : "Share term"}
    </Button>
  );
}
