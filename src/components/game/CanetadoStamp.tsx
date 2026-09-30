import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { playSfx } from "@/game/sfx";

export interface CanetadoStampProps {
  text?: string;
  subtitle?: string;
  color?: string;
}

export function CanetadoStampSVG({
  text = "CANETADO!",
  subtitle = "DECRETO PUBLICADO",
  color = "#DC2626",
}: CanetadoStampProps) {
  return (
    <svg
      viewBox="0 0 320 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-72 h-auto opacity-95 transform -rotate-6 select-none pointer-events-none drop-shadow-md"
    >
      {/* Moldura chunky com dupla borda tipo carimbo cartoon */}
      <rect
        x="6" y="6" width="308" height="98" rx="4"
        stroke={color}
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <rect
        x="16" y="16" width="288" height="78" rx="2"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Marcas de "tinta gasta" nas bordas */}
      <g fill={color} opacity="0.7">
        <rect x="40" y="2" width="18" height="4" />
        <rect x="180" y="4" width="30" height="3" />
        <rect x="60" y="104" width="40" height="4" />
        <rect x="220" y="103" width="24" height="4" />
        <rect x="2" y="50" width="4" height="20" />
        <rect x="314" y="30" width="4" height="26" />
      </g>
      {/* Texto Principal */}
      <text
        x="160"
        y="60"
        fill={color}
        fontSize="36"
        fontWeight="900"
        fontFamily="Impact, 'Arial Black', sans-serif"
        textAnchor="middle"
        letterSpacing="5"
      >
        {text}
      </text>
      {/* Subtítulo */}
      <text
        x="160"
        y="82"
        fill={color}
        fontSize="10"
        fontWeight="800"
        fontFamily="monospace, sans-serif"
        textAnchor="middle"
        letterSpacing="2"
      >
        {subtitle} — GABINETE MUNICIPAL
      </text>
      {/* Estrelas chunky (blocos) */}
      <g fill={color}>
        <path d="M28 54 h6 v-6 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 z" />
        <path d="M280 54 h6 v-6 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 z" />
      </g>
    </svg>
  );
}

export interface CanetadoBurstProps extends CanetadoStampProps {
  open?: boolean;
  onDone?: () => void;
  durationMs?: number;
}

export function CanetadoBurst({
  open = false,
  onDone,
  durationMs = 1600,
  ...stampProps
}: CanetadoBurstProps) {
  const [phase, setPhase] = useState<"idle" | "in" | "hold" | "out">("idle");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!open) {
      setPhase("idle");
      return;
    }
    setPhase("in");
    playSfx("stamp");
    const inTimer = window.setTimeout(() => setPhase("hold"), 350);
    const outTimer = window.setTimeout(() => setPhase("out"), durationMs - 350);
    const doneTimer = window.setTimeout(() => {
      setPhase("idle");
      onDoneRef.current?.();
    }, durationMs);
    return () => {
      window.clearTimeout(inTimer);
      window.clearTimeout(outTimer);
      window.clearTimeout(doneTimer);
    };
  }, [open, durationMs]);

  if (phase === "idle") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px]",
        "transition-opacity duration-300",
        phase === "in" && "opacity-0",
        (phase === "hold" || phase === "out") && "opacity-100",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "canetado-stamp",
          phase === "in" && "canetado-stamp-in",
          phase === "hold" && "canetado-stamp-hold",
          phase === "out" && "canetado-stamp-out",
        )}
      >
        <CanetadoStampSVG {...stampProps} />
      </div>
    </div>
  );
}
