import { useState, memo } from "react";
import type { GameState } from "@/game/types";
import type { PiuPiuPost, PiuPiuTrend, CancelTrigger } from "@/game/piupiu";
import { RESPONSE_COST } from "@/game/piupiu";
import type { AgencyId, BotTactic, InfluencerCampaign, BotFarmOp, InfluencerOp } from "@/game/covertOps";
import { AGENCIES, findAgency, getInfluencerFee, labelCampaign } from "@/game/covertOps";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bird, Flame, Heart, Repeat2, MessageCircle, TrendingUp, Send, Smile, Truck, BadgeCheck, AlertTriangle, Skull, Sparkles, ShieldAlert } from "lucide-react";

interface Actions {
  respond: (triggerId: string, response: "official_note" | "humor" | "field_team") => void;
  markRead: () => void;
  covertOps: {
    hire: (agency: AgencyId) => void;
    fire: (agency: AgencyId) => void;
    launchBot: (agency: AgencyId, tactic: BotTactic, monthlyBudget: number, target?: string) => void;
    cancelBot: (opId: string) => void;
    hireInfluencer: (agency: AgencyId, campaign: InfluencerCampaign) => void;
  };
}

const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M`
  : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);

const SENT_COLOR = {
  positive: "text-green-500",
  neutral: "text-muted-foreground",
  negative: "text-orange-500",
  outrage: "text-red-500",
};

function PiuPiuAppImpl({ state, actions }: { state: GameState; actions: Actions }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"feed" | "trending" | "crisis" | "covert">("feed");
  const p = state.piupiu;
  const pt = state.lang === "pt";
  if (!p) return null;

  const activeCrises = p.triggers.filter(t => !t.responded && !t.expired);
  const escalated = activeCrises.filter(t => t.escalated).length;
  const unread = p.unread;
  const topCancel = p.trends.find(t => t.isCancelWave && t.amplifiedByPress);

  const buttonClass = escalated > 0
    ? "bg-red-500 text-white animate-pulse"
    : unread > 0
    ? "bg-sky-500 text-white"
    : "bg-muted text-muted-foreground";

  return (
    <>
      <button
        onClick={() => { setOpen(true); actions.markRead(); }}
        className={`fixed bottom-4 right-60 z-40 rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-2 hover:scale-105 transition ${buttonClass}`}
        title={topCancel ? topCancel.hashtag : "PiuPiu"}
      >
        <Bird className="w-5 h-5" />
        <span className="text-sm font-bold">PiuPiu</span>
        {unread > 0 && (
          <span className="bg-white text-red-600 rounded-full text-[10px] font-bold px-1.5 min-w-[18px] text-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        {escalated > 0 && <Flame className="w-4 h-4" />}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] p-0 overflow-hidden flex flex-col bg-black text-white">
          <DialogHeader className="p-3 border-b border-gray-800 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Bird className="w-5 h-5 text-sky-400" />
              <span className="font-black text-lg">PiuPiu</span>
              <span className="text-xs opacity-60 font-normal">
                {pt ? "conectando a cidade" : "connecting the city"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-4 rounded-none bg-gray-900 shrink-0">
              <TabsTrigger value="feed">
                {pt ? "Para você" : "For you"}
              </TabsTrigger>
              <TabsTrigger value="trending">
                <TrendingUp className="w-3 h-3 mr-1" />
                {pt ? "Assuntos" : "Trending"}
              </TabsTrigger>
              <TabsTrigger value="crisis">
                {pt ? "Crises" : "Crises"}
                {activeCrises.length > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full text-[9px] px-1 min-w-[14px] text-center">
                    {activeCrises.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="covert">
                <Skull className="w-3 h-3 mr-1" />
                {pt ? "Op. Sombra" : "Shadow Ops"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="flex-1 overflow-y-auto m-0 p-0">
              <FeedView posts={p.posts} lang={state.lang} />
            </TabsContent>

            <TabsContent value="trending" className="flex-1 overflow-y-auto m-0 p-0">
              <TrendingView trends={p.trends} lang={state.lang} />
            </TabsContent>

            <TabsContent value="crisis" className="flex-1 overflow-y-auto m-0 p-0">
              <CrisisView
                state={state}
                triggers={p.triggers}
                humorStock={p.humorStock}
                onRespond={actions.respond}
              />
            </TabsContent>

            <TabsContent value="covert" className="flex-1 overflow-y-auto m-0 p-0">
              <CovertOpsView state={state} actions={actions.covertOps} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------ Feed ------------------ */

function FeedView({ posts, lang }: { posts: PiuPiuPost[]; lang: string }) {
  const pt = lang === "pt";
  const rev = [...posts].reverse();
  return (
    <div>
      {rev.length === 0 && (
        <div className="p-6 text-center text-sm opacity-60">
          {pt ? "Nenhum piu ainda. A cidade está calma." : "No piu yet. The city is quiet."}
        </div>
      )}
      {rev.map(post => <PostCard key={post.id} post={post} lang={lang} />)}
    </div>
  );
}

function PostCard({ post, lang }: { post: PiuPiuPost; lang: string }) {
  const pt = lang === "pt";
  const text = pt ? post.textPt : post.textEn;
  return (
    <div className="border-b border-gray-800 p-3 hover:bg-gray-950 transition">
      <div className="flex items-start gap-2">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xl shrink-0">
          {post.author.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm flex-wrap">
            <span className="font-bold truncate">{post.author.name}</span>
            {post.author.verified && <BadgeCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
            <span className="text-gray-500 truncate">{post.author.handle}</span>
            <span className="text-gray-600 text-xs">· {fmtNum(post.author.followers)} {pt ? "seg." : "flw"}</span>
          </div>
          <div className={`text-sm mt-1 whitespace-pre-wrap ${SENT_COLOR[post.sentiment]}`}>
            {text}
          </div>
          {post.hashtags.length > 0 && (
            <div className="mt-1 text-sm text-sky-400">
              {post.hashtags.join(" ")}
            </div>
          )}
          {post.mediaKind && post.mediaKind !== "none" && (
            <div className="mt-2 h-24 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-3xl border border-gray-700">
              {post.mediaKind === "video" ? "🎬" : "📷"}
            </div>
          )}
          <div className="flex items-center gap-6 mt-2 text-gray-500 text-xs">
            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {fmtNum(post.replies)}</span>
            <span className="flex items-center gap-1"><Repeat2 className="w-3.5 h-3.5" /> {fmtNum(post.reposts)}</span>
            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {fmtNum(post.likes)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------ Trending ------------------ */

function TrendingView({ trends, lang }: { trends: PiuPiuTrend[]; lang: string }) {
  const pt = lang === "pt";
  const top = trends.slice(0, 10);
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="font-black text-lg">{pt ? "Assuntos do momento" : "Trending Topics"}</div>
        <div className="text-xs opacity-60">
          {pt ? "Atualização em tempo real" : "Real-time update"}
        </div>
      </div>
      {top.length === 0 && (
        <div className="p-6 text-center text-sm opacity-60">
          {pt ? "Nenhum trending topic. Você está gerenciando bem." : "No trends. You're doing well."}
        </div>
      )}
      {top.map((t, i) => (
        <div key={t.hashtag} className="border-b border-gray-800 px-4 py-3 hover:bg-gray-950">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500">
                {i + 1} · {pt ? "Trending na cidade" : "Trending in the city"}
              </div>
              <div className={`font-bold text-base truncate ${SENT_COLOR[t.sentiment]}`}>
                {t.hashtag}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                <span>{fmtNum(t.volume)} pius</span>
                {t.isCancelWave && <span className="text-red-500 flex items-center gap-0.5"><Flame className="w-3 h-3" /> {pt ? "PICO DE CANCELAMENTO" : "CANCEL WAVE"}</span>}
                {t.amplifiedByPress && <span className="text-orange-500">📺 {pt ? "Amplificado pela mídia" : "Amplified by press"}</span>}
              </div>
            </div>
            <div className="w-16 shrink-0">
              <div className="text-right text-[10px] text-gray-500">heat</div>
              <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, (t.heat / 10))}%`,
                    background: t.sentiment === "outrage" ? "#ef4444" : t.sentiment === "positive" ? "#22c55e" : "#0ea5e9",
                  }}
                />
              </div>
              {t.hoursInTop5 > 0 && (
                <div className="text-right text-[9px] text-gray-600 mt-0.5">
                  {t.hoursInTop5.toFixed(0)}h top5
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------ Crisis ------------------ */

function CrisisView({
  state, triggers, humorStock, onRespond,
}: {
  state: GameState;
  triggers: CancelTrigger[];
  humorStock: number;
  onRespond: Actions["respond"];
}) {
  const pt = state.lang === "pt";
  const pending  = triggers.filter(t => !t.responded && !t.escalated && !t.expired);
  const viral    = triggers.filter(t => !t.responded && t.escalated && !t.expired);
  const resolved = triggers.filter(t => t.responded).slice(-8).reverse();
  const expired  = triggers.filter(t => t.expired).slice(-8).reverse();

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-950">
        <div className="font-black text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          {pt ? "Gabinete de Comunicação" : "Communications Office"}
        </div>
        <div className="text-[11px] opacity-70 mt-1">
          {pt
            ? "Responda rápido para evitar amplificação da mídia clássica (Rede Cubo, Hora da Verdade)."
            : "Respond fast to prevent classic media amplification."}
        </div>
        <div className="text-[10px] opacity-60 mt-1">
          {pt ? "Humor disponível" : "Humor available"}: <b>{humorStock}/3</b>
        </div>
        <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
          <StatusChip color="yellow" label={pt ? "Pendentes" : "Pending"} n={pending.length} />
          <StatusChip color="red"    label={pt ? "Escaladas" : "Viral"}   n={viral.length} />
          <StatusChip color="green"  label={pt ? "Resolvidas" : "Resolved"} n={resolved.length} />
          <StatusChip color="gray"   label={pt ? "Perdidas" : "Missed"}   n={expired.length} />
        </div>
      </div>

      {/* Pendentes */}
      <SectionHeader label={pt ? "Pendentes — aguardando decisão" : "Pending — awaiting decision"} count={pending.length} />
      {pending.length === 0 && (
        <div className="p-4 text-center text-xs opacity-50">
          {pt ? "Nada pendente no momento." : "Nothing pending right now."}
        </div>
      )}
      {pending.map(trg => (
        <CrisisRow key={trg.id} state={state} trg={trg} humorStock={humorStock} onRespond={onRespond} />
      ))}

      {/* Escaladas */}
      {viral.length > 0 && (
        <>
          <SectionHeader label={pt ? "Escaladas — viralizou, ainda dá pra conter" : "Viral — still recoverable"} count={viral.length} tone="red" />
          {viral.map(trg => (
            <CrisisRow key={trg.id} state={state} trg={trg} humorStock={humorStock} onRespond={onRespond} />
          ))}
        </>
      )}

      {/* Resolvidas */}
      {resolved.length > 0 && (
        <>
          <SectionHeader label={pt ? "Resolvidas" : "Resolved"} count={resolved.length} tone="green" />
          {resolved.map(trg => (
            <div key={trg.id} className="border-b border-gray-800 px-4 py-2 text-xs opacity-75">
              <div>✓ {pt ? trg.descPt : trg.descEn}</div>
              <div className="text-[10px] opacity-60">
                {pt ? "Respondido com" : "Responded with"}: <b>{trg.responseKind}</b>
                {trg.escalated && <span className="ml-2 text-orange-400">{pt ? "(após escalar)" : "(after escalation)"}</span>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Perdidas / Expiradas */}
      {expired.length > 0 && (
        <>
          <SectionHeader label={pt ? "Perdidas — prazo estourou sem resposta" : "Missed — deadline expired"} count={expired.length} tone="gray" />
          {expired.map(trg => (
            <div key={trg.id} className="border-b border-gray-800 px-4 py-2 text-xs opacity-60">
              <div>✗ {pt ? trg.descPt : trg.descEn}</div>
              <div className="text-[10px] opacity-60">
                {pt ? "Sev." : "Sev."} {trg.severity} · {pt ? "prazo era" : "deadline was"} {trg.deadlineHours}h
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StatusChip({ color, label, n }: { color: "yellow" | "red" | "green" | "gray"; label: string; n: number }) {
  const cls = {
    yellow: "bg-yellow-600/20 text-yellow-300 border-yellow-700/50",
    red:    "bg-red-600/20 text-red-300 border-red-700/50",
    green:  "bg-green-600/20 text-green-300 border-green-700/50",
    gray:   "bg-gray-600/20 text-gray-400 border-gray-700/50",
  }[color];
  return (
    <span className={`px-2 py-0.5 rounded border ${cls} flex items-center gap-1`}>
      {label}: <b>{n}</b>
    </span>
  );
}

function SectionHeader({ label, count, tone = "neutral" }: { label: string; count: number; tone?: "neutral" | "red" | "green" | "gray" }) {
  const toneCls =
    tone === "red"   ? "text-red-400" :
    tone === "green" ? "text-green-400" :
    tone === "gray"  ? "text-gray-500" :
    "text-gray-300";
  return (
    <div className={`px-4 py-2 border-b border-gray-800 text-[11px] uppercase font-bold tracking-wide bg-gray-950/60 ${toneCls}`}>
      {label} <span className="opacity-60">({count})</span>
    </div>
  );
}

function CrisisRow({
  state, trg, humorStock, onRespond,
}: {
  state: GameState;
  trg: CancelTrigger;
  humorStock: number;
  onRespond: Actions["respond"];
}) {
  const pt = state.lang === "pt";
  const desc = pt ? trg.descPt : trg.descEn;
  const canAfford = {
    official_note: state.treasury >= RESPONSE_COST.official_note,
    humor: humorStock > 0,
    field_team: state.treasury >= RESPONSE_COST.field_team,
  };
  return (
    <div className={`border-b border-gray-800 p-3 ${trg.escalated ? "bg-red-950/40" : ""}`}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
          trg.severity === 3 ? "bg-red-500 text-white"
          : trg.severity === 2 ? "bg-orange-500 text-white"
          : "bg-yellow-600 text-white"
        }`}>
          {pt ? "SEV" : "SEV"} {trg.severity}
        </span>
        {trg.escalated && (
          <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
            <Flame className="w-3 h-3" /> {pt ? "VIRALIZOU" : "VIRAL"}
          </span>
        )}
        <span className="text-[10px] opacity-60">
          {pt ? "Prazo" : "Deadline"}: {trg.deadlineHours}h
        </span>
      </div>
      <div className="text-sm mb-2">{desc}</div>
      <div className="text-xs text-red-400 mb-2">
        {trg.hashtags.join(" ")}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          size="sm" variant="outline"
          disabled={!canAfford.official_note}
          onClick={() => onRespond(trg.id, "official_note")}
          className="h-auto py-1.5 flex flex-col gap-0.5 text-[10px] bg-gray-900 border-gray-700 hover:bg-gray-800"
        >
          <Send className="w-3 h-3" />
          <span>{pt ? "Nota oficial" : "Official note"}</span>
          <span className="opacity-60">R$ {RESPONSE_COST.official_note.toLocaleString()}</span>
        </Button>
        <Button
          size="sm" variant="outline"
          disabled={!canAfford.humor}
          onClick={() => onRespond(trg.id, "humor")}
          className="h-auto py-1.5 flex flex-col gap-0.5 text-[10px] bg-gray-900 border-gray-700 hover:bg-gray-800"
        >
          <Smile className="w-3 h-3" />
          <span>{pt ? "Humor/sarcasmo" : "Humor/sarcasm"}</span>
          <span className="opacity-60">{pt ? "grátis" : "free"}</span>
        </Button>
        <Button
          size="sm" variant="outline"
          disabled={!canAfford.field_team}
          onClick={() => onRespond(trg.id, "field_team")}
          className="h-auto py-1.5 flex flex-col gap-0.5 text-[10px] bg-gray-900 border-gray-700 hover:bg-gray-800"
        >
          <Truck className="w-3 h-3" />
          <span>{pt ? "Equipe no local" : "Field team"}</span>
          <span className="opacity-60">R$ {(RESPONSE_COST.field_team/1000).toFixed(0)}k</span>
        </Button>
      </div>
    </div>
  );
}

/* ------------------ Covert Ops (Guerra Digital) ------------------ */

const TACTIC_LABEL: Record<BotTactic, { pt: string; en: string; icon: string }> = {
  attack_opponent: { pt: "Atacar oponente",         en: "Attack opponent",     icon: "🎯" },
  support_hashtag: { pt: "Hashtag de apoio",        en: "Support hashtag",     icon: "📣" },
  distraction:     { pt: "Pauta de distração",      en: "Distraction topic",   icon: "🎪" },
  flood_negative:  { pt: "Afogar hashtag negativa", en: "Flood negative tag",  icon: "🌊" },
};

const CAMPAIGN_LABEL: Record<InfluencerCampaign, { pt: string; en: string }> = {
  park_opening:      { pt: "Inauguração de parque",     en: "Park opening" },
  public_lighting:   { pt: "Iluminação pública",         en: "Public lighting" },
  transport_upgrade: { pt: "Modernização do transporte", en: "Transport upgrade" },
  health_clinic:     { pt: "Nova UBS",                   en: "New clinic" },
  school_program:    { pt: "Programa escolar",           en: "School program" },
};

function CovertOpsView({ state, actions }: { state: GameState; actions: Actions["covertOps"] }) {
  const pt = state.lang === "pt";
  const co = state.covertOps;
  const [subTab, setSubTab] = useState<"agencies" | "bots" | "influ">("agencies");
  const [agencyChoice, setAgencyChoice] = useState<AgencyId>("voxbots");
  const [tactic, setTactic] = useState<BotTactic>("support_hashtag");
  const [target, setTarget] = useState<string>("");
  const [budget, setBudget] = useState<number>(50_000);
  const [influChoice, setInfluChoice] = useState<InfluencerCampaign>("park_opening");

  const contracted = co?.contractedAgencies ?? [];
  const opponents = state.campaign?.opponents ?? [];

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-red-950 to-gray-950">
        <div className="font-black text-base flex items-center gap-2">
          <Skull className="w-4 h-4 text-red-400" />
          {pt ? "Operações Clandestinas de Comunicação" : "Covert Communications Ops"}
        </div>
        <div className="text-[11px] opacity-70 mt-1">
          {pt
            ? "Uso do caixa municipal em ações não declaradas. Alto risco político. Se descoberto: CPI, improbidade e risco de impeachment."
            : "Municipal cash on undeclared ops. High political risk. If exposed: inquiry, misconduct and impeachment risk."}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px]">
          <span className="flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-orange-400" />
            {pt ? "Risco global" : "Global risk"}: <b className={
              (co?.globalRisk ?? 0) > 60 ? "text-red-400" : (co?.globalRisk ?? 0) > 30 ? "text-orange-400" : "text-green-400"
            }>{co?.globalRisk ?? 0}%</b>
          </span>
          <span>{pt ? "Expostos" : "Exposed"}: <b>{co?.totalExposed ?? 0}</b></span>
          <span>{pt ? "CPIs geradas" : "Inquiries triggered"}: <b>{co?.totalCpisTriggered ?? 0}</b></span>
        </div>
      </div>

      <Tabs value={subTab} onValueChange={v => setSubTab(v as typeof subTab)}>
        <TabsList className="grid grid-cols-3 rounded-none bg-gray-900">
          <TabsTrigger value="agencies">{pt ? "Agências" : "Agencies"}</TabsTrigger>
          <TabsTrigger value="bots">
            {pt ? "Fazenda de Bots" : "Bot Farms"}
            {(co?.botOps.filter(o => o.active).length ?? 0) > 0 && (
              <span className="ml-1 bg-red-500 text-white rounded-full text-[9px] px-1">
                {co!.botOps.filter(o => o.active).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="influ">
            {pt ? "Influencers" : "Influencers"}
            {(co?.influencerOps.filter(o => o.active).length ?? 0) > 0 && (
              <span className="ml-1 bg-purple-500 text-white rounded-full text-[9px] px-1">
                {co!.influencerOps.filter(o => o.active).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ---- Agências ---- */}
        <TabsContent value="agencies" className="p-3 space-y-2 m-0">
          {AGENCIES.map(ag => {
            const isHired = contracted.includes(ag.id);
            const canAfford = state.treasury >= ag.retainer;
            return (
              <Card key={ag.id} className="p-3 bg-gray-900 border-gray-800 text-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{pt ? ag.namePt : ag.nameEn}</div>
                    <div className="text-[11px] opacity-70 mt-0.5">{pt ? ag.descPt : ag.descEn}</div>
                    <div className="flex flex-wrap gap-2 mt-1.5 text-[10px]">
                      <span className="bg-gray-800 px-1.5 py-0.5 rounded">
                        {pt ? "Retainer" : "Retainer"}: R$ {ag.retainer.toLocaleString()}/mês
                      </span>
                      <span className="bg-gray-800 px-1.5 py-0.5 rounded">
                        {pt ? "Foco" : "Focus"}: {ag.focus}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded ${ag.stealth < 0.9 ? "bg-green-800" : "bg-orange-800"}`}>
                        {pt ? "Discrição" : "Stealth"}: {(1 / ag.stealth * 100).toFixed(0)}%
                      </span>
                      <span className="bg-purple-800 px-1.5 py-0.5 rounded">
                        {pt ? "Potência" : "Potency"}: {(ag.potency * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {isHired ? (
                    <Button size="sm" variant="destructive" onClick={() => actions.fire(ag.id)}>
                      {pt ? "Encerrar" : "End"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canAfford}
                      onClick={() => actions.hire(ag.id)}
                      className="bg-red-700 hover:bg-red-600"
                    >
                      {pt ? "Contratar" : "Hire"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </TabsContent>

        {/* ---- Bots ---- */}
        <TabsContent value="bots" className="p-3 space-y-3 m-0">
          {contracted.length === 0 ? (
            <div className="text-center text-xs opacity-60 p-6">
              {pt ? "Contrate ao menos uma agência para operar bots." : "Hire at least one agency to run bots."}
            </div>
          ) : (
            <Card className="p-3 bg-gray-900 border-gray-800 text-white space-y-2">
              <div className="text-xs font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-red-400" />
                {pt ? "Nova operação" : "New operation"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px]">
                  {pt ? "Agência" : "Agency"}
                  <select
                    value={agencyChoice}
                    onChange={e => setAgencyChoice(e.target.value as AgencyId)}
                    className="w-full mt-0.5 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs"
                  >
                    {contracted.map(id => (
                      <option key={id} value={id}>{findAgency(id).namePt}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px]">
                  {pt ? "Tática" : "Tactic"}
                  <select
                    value={tactic}
                    onChange={e => setTactic(e.target.value as BotTactic)}
                    className="w-full mt-0.5 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs"
                  >
                    {Object.keys(TACTIC_LABEL).map(k => (
                      <option key={k} value={k}>
                        {TACTIC_LABEL[k as BotTactic].icon} {TACTIC_LABEL[k as BotTactic][pt ? "pt" : "en"]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {tactic === "attack_opponent" && (
                <label className="text-[10px] block">
                  {pt ? "Alvo (oponente)" : "Target (opponent)"}
                  <select
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    className="w-full mt-0.5 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs"
                  >
                    <option value="">—</option>
                    {opponents.map(o => (
                      <option key={o.id} value={o.id}>{o.namePt}</option>
                    ))}
                  </select>
                </label>
              )}
              {tactic === "flood_negative" && (
                <label className="text-[10px] block">
                  {pt ? "Hashtag alvo" : "Target hashtag"}
                  <input
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    placeholder="#ForaPrefeito"
                    className="w-full mt-0.5 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs"
                  />
                </label>
              )}
              <label className="text-[10px] block">
                {pt ? "Verba mensal" : "Monthly budget"}: <b>R$ {budget.toLocaleString()}</b>
                <input
                  type="range" min={10_000} max={300_000} step={10_000}
                  value={budget} onChange={e => setBudget(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <Button
                size="sm"
                disabled={state.treasury < budget || (tactic === "attack_opponent" && !target)}
                onClick={() => {
                  actions.launchBot(agencyChoice, tactic, budget, target || undefined);
                  setTarget("");
                }}
                className="w-full bg-red-700 hover:bg-red-600"
              >
                {pt ? "🕵 Ativar operação" : "🕵 Launch op"}
              </Button>
            </Card>
          )}

          {(co?.botOps ?? []).slice().reverse().map(op => (
            <BotOpCard key={op.id} op={op} pt={pt} onCancel={() => actions.cancelBot(op.id)} state={state} />
          ))}
        </TabsContent>

        {/* ---- Influencers ---- */}
        <TabsContent value="influ" className="p-3 space-y-3 m-0">
          {contracted.length === 0 ? (
            <div className="text-center text-xs opacity-60 p-6">
              {pt ? "Contrate uma agência com foco em influencers." : "Hire an agency with influencer focus."}
            </div>
          ) : (
            <Card className="p-3 bg-gray-900 border-gray-800 text-white space-y-2">
              <div className="text-xs font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                {pt ? "Contratar publi (Choque de Notícias)" : "Hire ad (News Shock)"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px]">
                  {pt ? "Agência" : "Agency"}
                  <select
                    value={agencyChoice}
                    onChange={e => setAgencyChoice(e.target.value as AgencyId)}
                    className="w-full mt-0.5 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs"
                  >
                    {contracted.map(id => (
                      <option key={id} value={id}>{findAgency(id).namePt}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px]">
                  {pt ? "Campanha" : "Campaign"}
                  <select
                    value={influChoice}
                    onChange={e => setInfluChoice(e.target.value as InfluencerCampaign)}
                    className="w-full mt-0.5 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs"
                  >
                    {Object.keys(CAMPAIGN_LABEL).map(k => (
                      <option key={k} value={k}>
                        {CAMPAIGN_LABEL[k as InfluencerCampaign][pt ? "pt" : "en"]} — R$ {(getInfluencerFee(k as InfluencerCampaign)/1000).toFixed(0)}k
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="text-[10px] opacity-60">
                {pt
                  ? "Se o serviço promovido estiver com desempenho ruim, a publi vira meme e vira cancelamento."
                  : "If the promoted service is failing, the ad backfires into a cancellation."}
              </div>
              <Button
                size="sm"
                disabled={state.treasury < getInfluencerFee(influChoice)}
                onClick={() => actions.hireInfluencer(agencyChoice, influChoice)}
                className="w-full bg-purple-700 hover:bg-purple-600"
              >
                {pt ? "💸 Pagar publi" : "💸 Pay ad"}
              </Button>
            </Card>
          )}

          {(co?.influencerOps ?? []).slice().reverse().map(op => (
            <InfluOpCard key={op.id} op={op} pt={pt} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BotOpCard({ op, pt, onCancel, state }: { op: BotFarmOp; pt: boolean; onCancel: () => void; state: GameState }) {
  const ag = findAgency(op.agency);
  const t = TACTIC_LABEL[op.tactic];
  const targetLabel = op.tactic === "attack_opponent"
    ? state.campaign?.opponents.find(o => o.id === op.target)?.namePt ?? op.target
    : op.target;
  return (
    <Card className={`p-2.5 border text-white ${op.active ? "bg-gray-900 border-red-900/60" : "bg-gray-950 border-gray-800 opacity-60"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span>{t.icon}</span>
          <span>{t[pt ? "pt" : "en"]}</span>
          {targetLabel && <span className="opacity-70">→ {targetLabel}</span>}
        </div>
        {op.active && (
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 text-[10px] px-2">
            {pt ? "Encerrar" : "Stop"}
          </Button>
        )}
      </div>
      <div className="text-[10px] opacity-70 mt-1">
        {ag.namePt} · R$ {op.monthlyBudget.toLocaleString()}/mês · {op.postsInjected} {pt ? "posts" : "posts"}
      </div>
      <div className="mt-1">
        <div className="text-[9px] opacity-60 flex justify-between">
          <span>{pt ? "Risco de exposição" : "Exposure risk"}</span>
          <span>{op.exposureRisk.toFixed(0)}%</span>
        </div>
        <div className="h-1 bg-gray-800 rounded overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${op.exposureRisk}%`,
              background: op.exposureRisk > 70 ? "#dc2626" : op.exposureRisk > 40 ? "#f97316" : "#16a34a",
            }}
          />
        </div>
      </div>
    </Card>
  );
}

function InfluOpCard({ op, pt }: { op: InfluencerOp; pt: boolean }) {
  const ag = findAgency(op.agency);
  return (
    <Card className={`p-2.5 border text-white ${op.backlashed ? "bg-red-950/50 border-red-800" : op.active ? "bg-gray-900 border-purple-900/60" : "bg-gray-950 border-gray-800 opacity-60"}`}>
      <div className="text-xs font-bold flex items-center gap-1.5">
        💸 <span>{labelCampaign(op.campaign, pt ? "pt" : "en")}</span>
        {op.backlashed && <span className="text-red-400 text-[10px]">{pt ? "· BACKLASH" : "· BACKLASH"}</span>}
      </div>
      <div className="text-[10px] opacity-70 mt-1">
        {ag.namePt} · R$ {op.fee.toLocaleString()} · {op.monthsLeft} {pt ? "meses restantes" : "months left"}
      </div>
      <div className="mt-1">
        <div className="text-[9px] opacity-60 flex justify-between">
          <span>{pt ? "Risco de autenticidade" : "Authenticity risk"}</span>
          <span>{op.authenticityRisk.toFixed(0)}%</span>
        </div>
        <div className="h-1 bg-gray-800 rounded overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${op.authenticityRisk}%`,
              background: op.authenticityRisk > 60 ? "#dc2626" : op.authenticityRisk > 30 ? "#f97316" : "#a855f7",
            }}
          />
        </div>
      </div>
    </Card>
  );
}

export const PiuPiuApp = /*#__PURE__*/ memo(PiuPiuAppImpl);
