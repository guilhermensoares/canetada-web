import { useState, memo } from "react";
import type { GameState } from "@/game/types";
import type { InboxEmail, InboxDecision } from "@/game/inbox";
import { PORTFOLIO_LABEL } from "@/game/advisors";
import { Button } from "@/components/ui/button";
import { Mail, X, AlertTriangle, CheckCircle2, MinusCircle, XCircle, ShieldAlert, ArrowLeft, DoorOpen, Flame, UserX } from "lucide-react";

interface Props {
  state: GameState;
  actions: {
    decide: (id: string, decision: InboxDecision) => void;
    markRead: () => void;
  };
}

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${Math.round(n / 1000)}k`;
  return `R$ ${n}`;
}

const SEV_STYLE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/40",
  warning: "bg-warning/20 text-warning-foreground border-warning/40",
  info: "bg-muted text-muted-foreground border-border",
  ok: "bg-muted text-muted-foreground border-border",
};

/** Caixa de e-mails do gabinete — relatórios dos assessores pedindo aprovação. */
function InboxPanelImpl({ state, actions }: Props) {
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const pt = state.lang === "pt";
  const inbox = state.inbox;
  if (!inbox) return null;

  const emails = inbox.emails ?? [];
  const pending = emails.filter(e => e.status === "pending");
  const selected = emails.find(e => e.id === openId) ?? null;

  const openBox = () => {
    setOpen(true);
    if (inbox.unread > 0) actions.markRead();
  };

  return (
    <>
      {!open && (
        <button
          onClick={openBox}
          className="fixed bottom-4 left-4 z-40 bg-primary text-primary-foreground rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-2 hover:scale-105 transition"
          aria-label={pt ? "Abrir caixa de e-mails" : "Open mailbox"}
        >
          <Mail className="w-5 h-5" />
          <span className="text-sm font-semibold">{pt ? "Gabinete" : "Inbox"}</span>
          {inbox.unread > 0 && (
            <span className="ml-1 bg-background text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {inbox.unread > 99 ? "99+" : inbox.unread}
            </span>
          )}
          {pending.some(e => e.severity === "critical") && (
            <AlertTriangle className="w-4 h-4 text-warning animate-pulse" />
          )}
        </button>
      )}

      {open && (
        <div className="fixed left-0 top-0 bottom-0 z-50 w-full sm:w-[420px] flex flex-col shadow-2xl bg-card text-card-foreground border-r border-border">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-3 py-2 flex items-center gap-3">
            {selected && (
              <button onClick={() => setOpenId(null)} className="p-1 hover:bg-background/10 rounded">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Mail className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {pt ? "Caixa de Entrada — Gabinete" : "Inbox — Mayor's Office"}
              </div>
              <div className="text-[10px] opacity-80 truncate">
                {pending.length} {pt ? "aguardando despacho" : "awaiting decision"} ·{" "}
                {inbox.approvedTotal} {pt ? "deferidos" : "approved"} · {inbox.rejectedTotal}{" "}
                {pt ? "indeferidos" : "denied"}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-background/10 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {(inbox.vacancies?.length ?? 0) > 0 && (
            <div className="mx-2 mt-2 rounded-lg border border-destructive/45 bg-destructive/10 text-destructive px-2.5 py-2 text-[11px] flex gap-2">
              <UserX className="w-4 h-4 shrink-0 mt-px" />
              <div>
                <div className="font-bold uppercase tracking-wide text-[10px]">
                  {pt ? "Pasta(s) sem titular" : "Vacant portfolio(s)"}
                </div>
                <div className="opacity-90">
                  {inbox.vacancies!.map(p => PORTFOLIO_LABEL[p]).join(" · ")} —{" "}
                  {pt
                    ? "nomeie um substituto no painel de Assessores."
                    : "appoint a replacement in the Advisors panel."}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {emails.length === 0 && (
              <div className="text-center text-xs text-muted-foreground pt-10">
                {pt
                  ? "Nenhum relatório ainda. Contrate assessores para receber pedidos de autorização."
                  : "No reports yet. Hire advisors to start receiving authorization requests."}
              </div>
            )}

            {!selected &&
              emails.map(e => (
                <EmailRow key={e.id} e={e} pt={pt} onOpen={() => setOpenId(e.id)} />
              ))}

            {selected && (
              <EmailDetail
                e={selected}
                pt={pt}
                treasury={state.treasury}
                onDecide={d => {
                  actions.decide(selected.id, d);
                  setOpenId(null);
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function statusChip(e: InboxEmail, pt: boolean) {
  if (e.kind === "resignation")
    return (
      <span className="text-[9px] px-1 py-0.5 rounded bg-destructive/20 text-destructive font-bold uppercase flex items-center gap-0.5">
        <DoorOpen className="w-2.5 h-2.5" /> {pt ? "demissão" : "resigned"}
      </span>
    );
  if (e.kind === "warning")
    return (
      <span className="text-[9px] px-1 py-0.5 rounded bg-warning/25 text-warning-foreground font-bold uppercase flex items-center gap-0.5">
        <Flame className="w-2.5 h-2.5" /> {pt ? "ultimato" : "ultimatum"}
      </span>
    );
  switch (e.status) {
    case "pending":
      return null;
    case "approve":
      return (
        <span className="text-[9px] px-1 py-0.5 rounded bg-success/20 text-success font-bold uppercase flex items-center gap-0.5">
          <CheckCircle2 className="w-2.5 h-2.5" /> {pt ? "deferido" : "approved"}
        </span>
      );
    case "partial":
      return (
        <span className="text-[9px] px-1 py-0.5 rounded bg-warning/25 text-warning-foreground font-bold uppercase flex items-center gap-0.5">
          <MinusCircle className="w-2.5 h-2.5" /> {pt ? "parcial" : "partial"}
        </span>
      );
    case "reject":
      return (
        <span className="text-[9px] px-1 py-0.5 rounded bg-destructive/15 text-destructive font-bold uppercase flex items-center gap-0.5">
          <XCircle className="w-2.5 h-2.5" /> {pt ? "indeferido" : "denied"}
        </span>
      );
    default:
      return (
        <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-bold uppercase">
          {pt ? "vencido" : "expired"}
        </span>
      );
  }
}

function EmailRow({ e, pt, onOpen }: { e: InboxEmail; pt: boolean; onOpen: () => void }) {
  const done = e.status !== "pending";
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-lg border px-2.5 py-2 transition hover:bg-primary/5 ${
        done ? "opacity-60 border-border" : SEV_STYLE[e.severity]
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[11px] font-semibold truncate flex-1">{e.fromName}</span>
        {e.suspicious && !done && <ShieldAlert className="w-3.5 h-3.5 text-destructive" />}
        {statusChip(e, pt)}
        <span className="text-[9px] opacity-70">
          {String(e.createdAt.month).padStart(2, "0")}/{e.createdAt.year}
        </span>
      </div>
      <div className="text-[12px] font-medium leading-snug">{pt ? e.subjectPt : e.subjectEn}</div>
      <div className="text-[10px] opacity-75 truncate mt-0.5">
        {PORTFOLIO_LABEL[e.portfolio]}
        {e.kind && e.kind !== "request" ? "" : ` · ${fmtBRL(e.cost)}`}
      </div>
    </button>
  );
}

function EmailDetail({
  e, pt, treasury, onDecide,
}: { e: InboxEmail; pt: boolean; treasury: number; onDecide: (d: InboxDecision) => void }) {
  const done = e.status !== "pending";
  const letter = !!e.kind && e.kind !== "request";
  const half = Math.round(e.cost / 2);
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-sm font-semibold leading-snug">{pt ? e.subjectPt : e.subjectEn}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 mb-2">
        {e.fromName} · {PORTFOLIO_LABEL[e.portfolio]} · {e.fromOverall}★ ·{" "}
        {pt ? "lealdade" : "loyalty"} {e.fromLoyalty}%
      </div>

      {e.suspicious && !done && (
        <div className="mb-2 text-[10px] rounded border border-destructive/40 bg-destructive/10 text-destructive px-2 py-1.5 flex gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
          {pt
            ? "A assessoria jurídica achou o valor acima do mercado. Aprovar sem cortes pode virar processo no MP."
            : "Legal staff flagged the price as above market. Approving in full may draw a prosecution."}
        </div>
      )}

      <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-foreground/90">
        {pt ? e.bodyPt : e.bodyEn}
      </pre>

      <div className={`mt-3 rounded border px-2 py-1.5 text-[11px] ${
        letter ? "border-destructive/40 bg-destructive/10" : "border-border bg-muted/40"
      }`}>
        <div className="font-semibold mb-0.5">
          {letter
            ? (pt ? "Providência necessária" : "Required action")
            : (pt ? "Medida solicitada" : "Requested measure")}
        </div>
        <div className="opacity-85">{pt ? e.askPt : e.askEn}</div>
        {!letter && <div className="mt-1 opacity-70">
          {pt ? "Custo integral" : "Full cost"}: <b>{fmtBRL(e.cost)}</b> · {pt ? "Prazo" : "Deadline"}:{" "}
          {e.deadlineMonths} {pt ? "meses" : "months"}
        </div>}
      </div>

      {done ? (
        <div className="mt-3 text-[11px] rounded border border-border bg-muted/30 px-2 py-1.5">
          {pt ? e.outcomePt : e.outcomeEn}
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          <Button
            size="sm"
            className="w-full h-8 text-[11px]"
            disabled={treasury < e.cost}
            onClick={() => onDecide("approve")}
          >
            {pt ? `Deferir integralmente (${fmtBRL(e.cost)})` : `Approve in full (${fmtBRL(e.cost)})`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-[11px]"
            disabled={treasury < half}
            onClick={() => onDecide("partial")}
          >
            {pt ? `Deferir pela metade (${fmtBRL(half)})` : `Approve half (${fmtBRL(half)})`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-[11px]"
            onClick={() => onDecide("reject")}
          >
            {pt ? "Indeferir o pedido" : "Deny the request"}
          </Button>
          {treasury < half && (
            <div className="text-[10px] text-destructive text-center">
              {pt ? "Caixa insuficiente para autorizar." : "Not enough treasury to authorize."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const InboxPanel = /*#__PURE__*/ memo(InboxPanelImpl);
