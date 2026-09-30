import { useState, useMemo, memo } from "react";
import type { GameState } from "@/game/types";
import type { ZapZapState, ZapMessage } from "@/game/zapzap";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Shield, AlertTriangle, CheckCircle2, X, Camera, Video } from "lucide-react";

interface Props {
  state: GameState;
  actions: {
    setBudget: (value: number) => void;
    debunk: (id: string) => void;
    markRead: () => void;
  };
}

const BUDGET_STEPS = [0, 60_000, 120_000, 240_000, 360_000, 480_000, 600_000];

function fmtBRL(n: number) {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(0)}k`;
  return `R$ ${n}`;
}

function timeAgo(m: ZapMessage, s: GameState, pt: boolean) {
  const diff = (s.year - m.year) * 360 + (s.month - m.month) * 30 + (s.day - m.day);
  if (diff <= 0) return pt ? "agora" : "now";
  if (diff < 30) return pt ? `há ${diff}d` : `${diff}d ago`;
  const mo = Math.floor(diff / 30);
  return pt ? `há ${mo}mês` : `${mo}mo ago`;
}

/** Floating WhatsApp-style neighborhood group chat. */
function ZapZapPanelImpl({ state, actions }: Props) {
  const [open, setOpen] = useState(false);
  const pt = state.lang === "pt";
  const z: ZapZapState | undefined = state.zapzap;
  if (!z) return null;

  const misTone =
    z.misinformation > 65 ? "text-destructive"
    : z.misinformation > 40 ? "text-warning"
    : "text-success";

  const protestTone =
    z.protestRisk > 70 ? "bg-destructive text-destructive-foreground animate-pulse"
    : z.protestRisk > 45 ? "bg-warning/80 text-warning-foreground"
    : "bg-success/60 text-success-foreground";

  const staff = Math.floor(z.commsBudget / 60_000);

  const openChat = () => {
    setOpen(true);
    if (z.unread > 0) actions.markRead();
  };

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          onClick={openChat}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#25D366] text-white rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-2 hover:scale-105 transition"
          aria-label={pt ? "Abrir grupo ZapZap" : "Open ZapZap group"}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-semibold">ZapZap</span>
          {z.unread > 0 && (
            <span className="ml-1 bg-white text-[#25D366] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {z.unread > 99 ? "99+" : z.unread}
            </span>
          )}
          {z.protestRisk > 70 && (
            <AlertTriangle className="w-4 h-4 text-yellow-200 animate-pulse" />
          )}
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[380px] flex flex-col shadow-2xl bg-[#efeae2] text-black border-l-2 border-black/20">
          {/* Header */}
          <div className="bg-[#075E54] text-white px-3 py-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">👨‍👩‍👧</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {pt ? "Grupo: Família & Vizinhos" : "Group: Family & Neighbors"}
              </div>
              <div className="text-[10px] opacity-80 truncate">
                {z.messages.length} {pt ? "mensagens" : "messages"} · {pt ? "10 participantes" : "10 members"}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Comms panel */}
          <Card className="m-2 p-2 rounded-lg border border-black/20 bg-white text-black">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <Shield className="w-3.5 h-3.5 text-primary" />
                {pt ? "Coord. de Comunicação" : "Comms Office"}
              </div>
              <div className={`text-[10px] px-1.5 py-0.5 rounded ${protestTone}`}>
                {pt ? "Risco protesto" : "Protest risk"}: {Math.round(z.protestRisk)}%
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className={misTone}>
                {pt ? "Desinformação" : "Misinformation"}: {Math.round(z.misinformation)}%
              </span>
              <span className="opacity-70">
                {pt ? "Equipe" : "Staff"}: {staff} · {pt ? "desmentidos" : "debunked"}: {z.debunkedTotal}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {BUDGET_STEPS.map(v => (
                <button
                  key={v}
                  onClick={() => actions.setBudget(v)}
                  className={`text-[10px] px-2 py-1 rounded border transition ${
                    z.commsBudget === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white border-black/20 hover:bg-primary/10"
                  }`}
                >
                  {v === 0 ? (pt ? "Ignorar" : "Ignore") : `${fmtBRL(v)}/mês`}
                </button>
              ))}
            </div>
          </Card>

          {/* Message list */}
          <div
            className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.04) 0, transparent 40%), radial-gradient(circle at 80% 60%, rgba(0,0,0,0.04) 0, transparent 40%)",
            }}
          >
            {z.messages.length === 0 && (
              <div className="text-center text-xs opacity-60 pt-8">
                {pt ? "Nenhuma mensagem ainda. O grupo tá quieto…" : "No messages yet. The chat is quiet…"}
              </div>
            )}
            {z.messages.map(m => (
              <MessageBubble key={m.id} m={m} state={state} onDebunk={() => actions.debunk(m.id)} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({
  m, state, onDebunk,
}: { m: ZapMessage; state: GameState; onDebunk: () => void }) {
  const pt = state.lang === "pt";
  const isOfficial = m.kind === "official";
  const isFake = m.kind === "fake";
  const bg =
    isOfficial ? "bg-[#dcf8c6] border-[#25D366]/50"
    : isFake && !m.debunked ? "bg-white border-destructive/40"
    : "bg-white border-black/10";

  const author = pt ? m.authorPt : m.authorEn;
  const text = pt ? m.textPt : m.textEn;
  const ago = timeAgo(m, state, pt);
  const canDebunk = isFake && !m.debunked && state.treasury >= 30_000;

  return (
    <div className={`rounded-lg border px-2 py-1.5 shadow-sm text-[12px] leading-snug ${bg} max-w-[90%]`}
         style={{ marginLeft: isOfficial ? "auto" : 0 }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
          style={{ background: `hsl(${m.hue} 60% 45%)` }}
        >{author.charAt(0)}</span>
        <span className="text-[10px] font-semibold" style={{ color: `hsl(${m.hue} 60% 35%)` }}>
          {author}
        </span>
        {isFake && !m.debunked && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-destructive/15 text-destructive font-bold uppercase">
            {pt ? "boato" : "rumor"}
          </span>
        )}
        {m.debunked && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-success/20 text-success font-bold uppercase flex items-center gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" /> {pt ? "desmentido" : "debunked"}
          </span>
        )}
        {isOfficial && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-primary/20 text-primary font-bold uppercase">
            {pt ? "prefeitura" : "city hall"}
          </span>
        )}
      </div>

      {m.media && (
        <div className="mb-1 rounded bg-black/10 aspect-video flex items-center justify-center text-black/40">
          {m.media === "photo" ? <Camera className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </div>
      )}

      <div className={m.debunked ? "line-through opacity-60" : ""}>{text}</div>

      <div className="mt-1 flex items-center justify-between text-[9px] opacity-70">
        <span>👍 {m.reactions} · {pt ? "viral" : "viral"} {m.viral}%</span>
        <span>{ago}</span>
      </div>

      {canDebunk && (
        <Button
          size="sm"
          variant="outline"
          className="mt-1 h-6 w-full text-[10px]"
          onClick={onDebunk}
        >
          {pt ? "Desmentir (R$ 30k)" : "Debunk (R$ 30k)"}
        </Button>
      )}
    </div>
  );
}

export const ZapZapPanel = /*#__PURE__*/ memo(ZapZapPanelImpl);
