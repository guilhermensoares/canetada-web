import { Button } from "@/components/ui/button";
import {
  SparklesIcon,
  LandmarkIcon,
  PlayIcon,
  BookIcon,
  LanguagesIcon,
} from "@/components/icons";
import { useState } from "react";
import type { Lang } from "@/game/types";
import { cn } from "@/lib/utils";
import { CanetadaLogo } from "./CanetadaLogo";
import { FictionDisclaimer } from "./FictionDisclaimer";

type Props = {
  lang: Lang;
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: (mode: "mayor" | "sandbox") => void;
  onToggleLang: () => void;
};

type SectionId = "continue" | "mayor" | "sandbox" | "tutorial" | "config";

export function StartScreen({ lang, hasSave, onContinue, onNewGame, onToggleLang }: Props) {
  const [howto, setHowto] = useState(false);
  const initial: SectionId = hasSave ? "continue" : "mayor";
  const [focus, setFocus] = useState<SectionId>(initial);

  const items: { id: SectionId; label: string; action?: () => void; show: boolean; primary?: boolean }[] = [
    {
      id: "continue",
      label: lang === "pt" ? "Continuar mandato" : "Continue term",
      action: onContinue,
      show: hasSave,
      primary: true,
    },
    {
      id: "mayor",
      label: lang === "pt" ? "Novo mandato — Modo Prefeito" : "New term — Mayor Mode",
      action: () => onNewGame("mayor"),
      show: true,
      primary: !hasSave,
    },
    {
      id: "sandbox",
      label: lang === "pt" ? "Modo Laboratório (Livre)" : "Laboratory Mode (Free)",
      action: () => onNewGame("sandbox"),
      show: true,
    },
    {
      id: "tutorial",
      label: lang === "pt" ? "Tutorial & Regras" : "Tutorial & Rules",
      action: () => {
        setFocus("tutorial");
        setHowto(true);
      },
      show: true,
    },
    {
      id: "config",
      label: lang === "pt" ? "Configurações" : "Settings",
      action: () => setFocus("config"),
      show: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto gabinete-bg text-[#F1EFEA]">
      {/* Vignette radial reforço (bordas escuras) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* Paper noise / grain — textura de papel timbrado */}
      <div aria-hidden className="pointer-events-none fixed inset-0 gabinete-grain" />
      {/* Grade sutil (sem gradiente azul) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(115deg, #F1EFEA 1px, transparent 1px), linear-gradient(65deg, #F1EFEA 1px, transparent 1px)",
          backgroundSize: "56px 32px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-6 py-8 lg:px-10">




        {/* Corpo em 2 colunas assimétricas */}
        <main className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[minmax(280px,_35%)_1fr] lg:gap-10">
          {/* ===== COLUNA ESQUERDA — MENU DE COMANDOS ===== */}
          <aside className="flex flex-col">
            <div className="mb-8">
              <CanetadaLogo className="h-24 w-auto" />
            </div>


            <nav className="flex flex-col gap-1.5" aria-label={lang === "pt" ? "Menu principal" : "Main menu"}>
              {items
                .filter((it) => it.show)
                .map((it, i) => (
                  <CommandRow
                    key={it.id}
                    index={i + 1}
                    label={it.label}
                    active={focus === it.id}
                    primary={it.primary}
                    onHover={() => setFocus(it.id)}
                    onFocus={() => setFocus(it.id)}
                    onClick={it.action}
                  />
                ))}
            </nav>


            <div className="mt-auto pt-6">
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">
                {lang === "pt" ? "Idioma do sistema" : "System language"}
              </div>
              <button
                type="button"
                onClick={onToggleLang}
                className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-foreground"
              >
                <LanguagesIcon className="h-4 w-4" />
                {lang === "pt" ? "Português · alternar para EN" : "English · switch to PT"}
              </button>
            </div>
          </aside>

          {/* ===== COLUNA DIREITA — DOSSIÊ ===== */}
          <section
            className="relative flex min-h-[560px] flex-col rounded-none border border-amber-900/20 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] lg:p-8"
            style={{
              backgroundColor: "#161920",
              backgroundImage:
                "repeating-linear-gradient(180deg, transparent 0 26px, rgba(241,239,234,0.035) 26px 27px)",
            }}
          >
            {/* Cantos tipo pasta — latão envelhecido */}
            <span aria-hidden className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-[#C5A059]/70" />
            <span aria-hidden className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-[#C5A059]/70" />
            <span aria-hidden className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#C5A059]/70" />
            <span aria-hidden className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#C5A059]/70" />


            <Dossier
              section={focus}
              lang={lang}
              howto={howto}
              onCloseHowto={() => setHowto(false)}
              onContinue={onContinue}
              onNewGame={onNewGame}
            />
          </section>

        </main>

        {/* Rodapé */}
        <footer className="mt-10 border-t border-amber-900/30 pt-4">
          <FictionDisclaimer lang={lang} variant="compact" />
        </footer>

      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function CommandRow({
  index,
  label,
  active,
  primary,
  onHover,
  onFocus,
  onClick,
}: {
  index: number;
  label: string;
  active: boolean;
  primary?: boolean;
  onHover: () => void;
  onFocus: () => void;
  onClick?: () => void;
}) {
  const num = String(index).padStart(2, "0");
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onFocus={onFocus}
      className={cn(
        "group relative flex items-center justify-between rounded-none py-3 pl-4 pr-3 text-left transition-all duration-200",
        "font-mono text-[12.5px] uppercase tracking-[0.22em]",
        // borda esquerda em latão que só "acende" no foco/hover
        "border-l-4 border-transparent bg-black/40",
        active
          ? "border-l-[#C5A059] bg-black/60 text-[#F1EFEA]"
          : "text-[#F1EFEA]/55 hover:border-l-[#C5A059] hover:bg-black/55 hover:text-[#F1EFEA]",
      )}
    >
      <span className="flex items-baseline gap-3">
        <span
          className={cn(
            "inline-block w-2 text-[#C5A059] transition-opacity",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-80",
          )}
          aria-hidden
        >
          &gt;
        </span>
        <span
          className={cn(
            "text-[10px] font-bold tracking-[0.28em] transition-colors",
            active ? "text-[#C5A059]" : "text-[#F1EFEA]/35 group-hover:text-[#C5A059]/80",
          )}
        >
          {num}.
        </span>
        <span>{label}</span>
      </span>
      {primary && (
        <span
          className={cn(
            "rounded-none border px-1.5 py-0.5 text-[9px] font-bold tracking-widest transition-colors",
            active
              ? "border-[#C5A059]/70 text-[#C5A059]"
              : "border-amber-900/40 text-[#F1EFEA]/45 group-hover:text-[#C5A059]/80",
          )}
        >
          ★
        </span>
      )}
    </button>
  );
}


/* ---------------------------------------------------------------- */

function Dossier({
  section,
  lang,
  howto,
  onCloseHowto,
  onContinue,
  onNewGame,
}: {
  section: SectionId;
  lang: Lang;
  howto: boolean;
  onCloseHowto: () => void;
  onContinue: () => void;
  onNewGame: (mode: "mayor" | "sandbox") => void;
}) {
  const meta = DOSSIER_META[section](lang);

  const confirm: { label: string; onClick: () => void } | null =
    section === "continue"
      ? {
          label: lang === "pt" ? "Retomar mandato em curso" : "Resume ongoing term",
          onClick: onContinue,
        }
      : section === "mayor"
        ? {
            label: lang === "pt" ? "Assinar termo de posse e iniciar" : "Sign oath and begin",
            onClick: () => onNewGame("mayor"),
          }
        : section === "sandbox"
          ? {
              label:
                lang === "pt"
                  ? "Abrir laboratório experimental"
                  : "Open experimental laboratory",
              onClick: () => onNewGame("sandbox"),
            }
          : null;

  return (
    <>
      {/* Carimbo topo: DOCUMENTO OFICIAL DE POSSE */}
      <div className="mb-4 flex justify-center">
        <div
          className="relative -rotate-1 select-none border-2 border-double border-[#991B1B] px-4 py-1.5 font-mono text-[11px] font-black uppercase tracking-[0.35em] text-[#DC2626]"
          style={{
            backgroundColor: "rgba(153,27,27,0.06)",
            boxShadow: "inset 0 0 0 1px rgba(153,27,27,0.4)",
          }}
        >
          [ {lang === "pt" ? "Documento Oficial de Posse" : "Official Instrument of Office"} ]
        </div>
      </div>

      {/* Cabeçalho do processo */}
      <div className="flex items-start justify-between gap-4 border-b border-dashed border-amber-900/40 pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-[#F1EFEA]/55">
            {lang === "pt" ? "Processo Administrativo" : "Administrative File"}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#F1EFEA]/60">
            Nº {meta.code} · {lang === "pt" ? "Vol. I" : "Vol. I"}
          </div>
          <h2 className="mt-2 font-serif text-2xl font-black leading-tight text-[#F1EFEA] lg:text-3xl">
            {meta.title}
          </h2>
          <div className="mt-1 text-xs italic text-[#F1EFEA]/60">{meta.subtitle}</div>
        </div>
        <Stamp label={meta.stamp} tone={meta.stampTone} />
      </div>

      {/* Corpo */}
      <div className="mt-5 flex-1">
        {section === "continue" && <ContinueBody lang={lang} />}
        {section === "mayor" && <MayorBody lang={lang} />}
        {section === "sandbox" && <SandboxBody lang={lang} />}
        {section === "tutorial" && <TutorialBody lang={lang} open={howto} onClose={onCloseHowto} />}
        {section === "config" && <ConfigBody lang={lang} />}
      </div>

      {/* Botão de assinatura — carimbo de termo */}
      {confirm && (
        <div className="mt-6">
          <SignatureStamp label={confirm.label} onClick={confirm.onClick} lang={lang} />
        </div>
      )}

      {/* Assinatura */}
      <div className="mt-6 flex items-end justify-between border-t border-dashed border-amber-900/40 pt-3 text-[10px] uppercase tracking-[0.28em] text-[#F1EFEA]/50">
        <span>
          {lang === "pt" ? "Autuado por" : "Filed by"}: {meta.filedBy}
        </span>
        <span className="font-mono">{meta.date}</span>
      </div>
    </>
  );
}

function SignatureStamp({
  label,
  onClick,
  lang,
}: {
  label: string;
  onClick: () => void;
  lang: Lang;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative block w-full rounded-none border-2 border-double border-[#C5A059] bg-black/40 py-3 px-4",
        "font-mono text-[13px] font-bold uppercase tracking-[0.32em] text-[#C5A059]",
        "transition-all duration-200 hover:bg-[#C5A059]/10 hover:text-[#F1EFEA] hover:shadow-[inset_0_0_0_1px_#C5A059]",
      )}
      style={{ boxShadow: "inset 0 0 0 1px rgba(197,160,89,0.35)" }}
    >
      <span className="flex items-center justify-between gap-4">
        <span className="text-[10px] tracking-[0.35em] text-[#C5A059]/70">
          {lang === "pt" ? "[ Ass. ]" : "[ Sig. ]"}
        </span>
        <span>&raquo; {label}</span>
        <span className="text-[10px] tracking-[0.35em] text-[#C5A059]/70">✒</span>
      </span>
    </button>
  );
}


function Stamp({
  label,
  tone,
}: {
  label: string;
  tone: "official" | "experimental" | "manual" | "config" | "active";
}) {
  const toneCls: Record<typeof tone, string> = {
    official: "border-[#C5A059]/80 text-[#C5A059]",
    experimental: "border-[#F1EFEA]/70 text-[#F1EFEA]",
    manual: "border-[#F1EFEA]/50 text-[#F1EFEA]/80",
    config: "border-[#F1EFEA]/40 text-[#F1EFEA]/60",
    active: "border-[#991B1B] text-[#DC2626]",
  };
  return (
    <div
      className={cn(
        "shrink-0 -rotate-6 rounded-none border-2 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.28em]",
        toneCls[tone],
      )}
      style={{ boxShadow: "inset 0 0 0 1px currentColor" }}
    >
      {label}
    </div>
  );
}

/* ---------------------------------------------------------------- */

const DOSSIER_META: Record<
  SectionId,
  (lang: Lang) => {
    code: string;
    title: string;
    subtitle: string;
    stamp: string;
    stampTone: "official" | "experimental" | "manual" | "config" | "active";
    filedBy: string;
    date: string;
  }
> = {
  continue: (lang) => ({
    code: "2026/000-C",
    title: lang === "pt" ? "Mandato em andamento" : "Term in progress",
    subtitle: lang === "pt" ? "Retorne ao gabinete e siga assinando." : "Return to the cabinet and keep signing.",
    stamp: lang === "pt" ? "EM CURSO" : "ONGOING",
    stampTone: "active",
    filedBy: lang === "pt" ? "Chefe de Gabinete" : "Chief of Staff",
    date: "—",
  }),
  mayor: (lang) => ({
    code: "2026/001-P",
    title: lang === "pt" ? "Modo Prefeito" : "Mayor Mode",
    subtitle:
      lang === "pt"
        ? "Cidades reais da Grande Santo Paulo · mapa fixo · dificuldade intrínseca."
        : "Real Greater Santo Paulo cities · fixed map · intrinsic difficulty.",
    stamp: lang === "pt" ? "OFICIAL" : "OFFICIAL",
    stampTone: "official",
    filedBy: lang === "pt" ? "Secretaria de Governo" : "Government Secretariat",
    date: "07 · 2026",
  }),
  sandbox: (lang) => ({
    code: "2026/002-L",
    title: lang === "pt" ? "Laboratório de Políticas" : "Policy Laboratory",
    subtitle:
      lang === "pt"
        ? "Sem cidade fixa. Você calibra tamanho, tesouro, dívida, tributos."
        : "No fixed city. You calibrate size, treasury, debt, taxes.",
    stamp: lang === "pt" ? "EXPERIMENTAL" : "EXPERIMENTAL",
    stampTone: "experimental",
    filedBy: lang === "pt" ? "Núcleo de Estudos Urbanos" : "Urban Studies Unit",
    date: lang === "pt" ? "sem data" : "no date",
  }),
  tutorial: (lang) => ({
    code: "MAN/2026",
    title: lang === "pt" ? "Manual de Procedimento" : "Procedure Manual",
    subtitle:
      lang === "pt"
        ? "Regras, ciclos e o que uma canetada faz."
        : "Rules, cycles and what a pen stroke does.",
    stamp: lang === "pt" ? "MANUAL" : "MANUAL",
    stampTone: "manual",
    filedBy: lang === "pt" ? "Instrução Normativa" : "Standing Order",
    date: "v.1",
  }),
  config: (lang) => ({
    code: "CFG/GAB",
    title: lang === "pt" ? "Configurações do Gabinete" : "Cabinet Settings",
    subtitle:
      lang === "pt"
        ? "Ajustes de idioma e apresentação."
        : "Language and presentation settings.",
    stamp: lang === "pt" ? "INTERNO" : "INTERNAL",
    stampTone: "config",
    filedBy: lang === "pt" ? "Assessoria Técnica" : "Technical Advisory",
    date: "—",
  }),
};

/* ---------------------------------------------------------------- */

function ContinueBody({ lang }: { lang: Lang }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          {lang === "pt"
            ? "Há um mandato salvo neste gabinete. Retomar preserva orçamento, base parlamentar, calendário eleitoral e todo o histórico da mídia."
            : "A saved term is on file. Resuming keeps the budget, legislative coalition, election calendar and full media history."}
        </p>
        <FieldRow
          k={lang === "pt" ? "Status" : "Status"}
          v={lang === "pt" ? "Aguardando o(a) titular" : "Awaiting incumbent"}
        />
        <FieldRow
          k={lang === "pt" ? "Ação sugerida" : "Suggested action"}
          v={lang === "pt" ? "Retomar do último tique mensal" : "Resume from last monthly tick"}
        />
      </div>
      <MiniCrest lang={lang} />
    </div>
  );
}

function MayorBody({ lang }: { lang: Lang }) {
  return (
    <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {lang === "pt"
            ? "Você assume o Executivo de uma cidade real da Grande Santo Paulo. Herda dívida, base parlamentar e vícios de um município que continua crescendo por conta própria."
            : "You take over a real Greater Santo Paulo city. You inherit debt, coalition and vices of a municipality that keeps growing on its own."}
        </p>
        <ThinLineMap />
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">
          {lang === "pt" ? "Malha urbana · esquema" : "Urban grid · schematic"}
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-sm border border-border/70 p-3">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            {lang === "pt" ? "Dificuldade intrínseca" : "Intrinsic difficulty"}
          </div>
          <div className="mt-2 space-y-1.5">
            <Bar label={lang === "pt" ? "Fiscal" : "Fiscal"} value={0.7} />
            <Bar label={lang === "pt" ? "Câmara" : "Council"} value={0.55} />
            <Bar label={lang === "pt" ? "Clima" : "Climate"} value={0.6} />
            <Bar label={lang === "pt" ? "Mídia" : "Media"} value={0.8} />
          </div>
        </div>
        <FieldRow k={lang === "pt" ? "Mapa" : "Map"} v={lang === "pt" ? "Fixo" : "Fixed"} />
        <FieldRow
          k={lang === "pt" ? "Licitações" : "Biddings"}
          v={lang === "pt" ? "Ativas · empreiteiras" : "Active · contractors"}
        />
        <FieldRow
          k={lang === "pt" ? "Calendário" : "Calendar"}
          v={lang === "pt" ? "Dois mandatos possíveis" : "Up to two terms"}
        />
      </div>
    </div>
  );
}

function SandboxBody({ lang }: { lang: Lang }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {lang === "pt"
            ? "Um laboratório aberto: sem cidade pré-definida, sem eleição obrigatória. Ideal para testar hipóteses — o que acontece se a dívida começar impagável? E se a mídia começar hostil?"
            : "An open lab: no fixed city, no forced election. Great to test hypotheses — what if debt starts impossible? What if the press starts hostile?"}
        </p>
        <div className="space-y-2">
          <FieldRow k={lang === "pt" ? "Tamanho do mapa" : "Map size"} v="P · M · G" />
          <FieldRow
            k={lang === "pt" ? "População inicial" : "Starting population"}
            v={lang === "pt" ? "livre" : "free"}
          />
          <FieldRow k={lang === "pt" ? "Tesouro" : "Treasury"} v={lang === "pt" ? "livre" : "free"} />
          <FieldRow k={lang === "pt" ? "Dívida" : "Debt"} v={lang === "pt" ? "livre" : "free"} />
        </div>
      </div>
      <div className="rounded-sm border border-dashed border-accent/60 p-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.28em] text-accent">
          {lang === "pt" ? "Parâmetros experimentais" : "Experimental parameters"}
        </div>
        <div className="space-y-2">
          <ParamRow label="IPTU" />
          <ParamRow label={lang === "pt" ? "ISS · serviços" : "Service tax"} />
          <ParamRow label={lang === "pt" ? "Saúde" : "Health"} />
          <ParamRow label={lang === "pt" ? "Educação" : "Education"} />
          <ParamRow label={lang === "pt" ? "Segurança" : "Security"} />
        </div>
        <div className="mt-3 text-[10px] italic text-muted-foreground">
          {lang === "pt"
            ? "Ajustes finais na tela de configuração do cenário."
            : "Final tuning on the scenario setup screen."}
        </div>
      </div>
    </div>
  );
}

function TutorialBody({ lang, open, onClose }: { lang: Lang; open: boolean; onClose: () => void }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        {lang === "pt"
          ? "O jogo roda em tiques mensais. Cada canetada assina políticas, altera tributos e move a base parlamentar."
          : "The game runs in monthly ticks. Each pen stroke signs policies, changes taxes and moves the coalition."}
      </p>
      <ol className="space-y-2">
        <li className="flex gap-3">
          <span className="font-mono text-primary">01</span>
          <span className="text-muted-foreground">
            {lang === "pt"
              ? "Escolha cidade e prefeito(a). Ideologia e traços definem bônus e vetos."
              : "Pick city and mayor. Ideology and traits set bonuses and vetoes."}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-primary">02</span>
          <span className="text-muted-foreground">
            {lang === "pt"
              ? "Ajuste tributos e políticas públicas. Vigie o caixa, a LRF e a satisfação por bairro."
              : "Tune taxes and public policies. Watch cash, fiscal law and neighborhood satisfaction."}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-primary">03</span>
          <span className="text-muted-foreground">
            {lang === "pt"
              ? "Negocie na Câmara, responda à imprensa e sobreviva à próxima eleição."
              : "Deal with the council, face the press and survive the next election."}
          </span>
        </li>
      </ol>
      {open && (
        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          {lang === "pt" ? "fechar aviso" : "close note"}
        </button>
      )}
    </div>
  );
}

function ConfigBody({ lang }: { lang: Lang }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        {lang === "pt"
          ? "Ajustes rápidos. Configurações completas ficam disponíveis a partir do momento em que o mandato começa."
          : "Quick settings. Full settings are available once the term starts."}
      </p>
      <div className="space-y-2">
        <FieldRow
          k={lang === "pt" ? "Idioma" : "Language"}
          v={lang === "pt" ? "Português (BR)" : "English"}
        />
        <FieldRow
          k={lang === "pt" ? "Modo visual" : "Visual mode"}
          v={lang === "pt" ? "Dossiê institucional" : "Institutional dossier"}
        />
        <FieldRow
          k={lang === "pt" ? "Tema" : "Theme"}
          v={lang === "pt" ? "Automático · segue o sistema" : "Auto · follows system"}
        />
      </div>
      <p className="text-[11px] italic text-muted-foreground">
        {lang === "pt"
          ? "Use o botão de idioma no rodapé da coluna esquerda para alternar PT ⇄ EN."
          : "Use the language button at the bottom of the left column to switch PT ⇄ EN."}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function FieldRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border/50 pb-1 text-xs">
      <span className="uppercase tracking-[0.22em] text-muted-foreground/80">{k}</span>
      <span className="font-mono text-foreground">{v}</span>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{Math.round(value * 100)}</span>
      </div>
      <div className="mt-0.5 h-1.5 w-full rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  );
}

function ParamRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-4 rounded-sm border",
              i < 2 ? "border-accent/70 bg-accent/50" : "border-border/60",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function MiniCrest({ lang }: { lang: Lang }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-border/70 p-4">
      <PlayIcon className="h-6 w-6 text-success" />
      <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-success">
        {lang === "pt" ? "Sessão salva" : "Saved session"}
      </div>
      <div className="mt-3 flex gap-1">
        <LandmarkIcon className="h-4 w-4 text-muted-foreground" />
        <BookIcon className="h-4 w-4 text-muted-foreground" />
        <SparklesIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

/**
 * Mapa esquemático em linhas finas — malha viária abstrata + rio, sem
 * identificar município real. Puramente decorativo.
 */
function ThinLineMap() {
  return (
    <svg
      viewBox="0 0 240 140"
      className="w-full text-foreground/60"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.6"
      aria-hidden
    >
      {/* Rio */}
      <path
        d="M0 90 C 40 70, 80 110, 130 88 S 220 70, 240 82"
        stroke="hsl(var(--primary))"
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      {/* Avenidas radiais */}
      <path d="M120 70 L 0 20" />
      <path d="M120 70 L 240 20" />
      <path d="M120 70 L 60 140" />
      <path d="M120 70 L 200 140" />
      <path d="M120 70 L 120 0" />
      {/* Anéis */}
      <circle cx="120" cy="70" r="24" />
      <circle cx="120" cy="70" r="46" />
      <circle cx="120" cy="70" r="66" strokeDasharray="2 3" />
      {/* Ponto do centro */}
      <circle cx="120" cy="70" r="2" fill="hsl(var(--primary))" stroke="none" />
      {/* Grid periférico */}
      {[20, 40, 60, 80, 100, 120].map((y) => (
        <line key={`h${y}`} x1="10" x2="230" y1={y} y2={y} strokeOpacity="0.15" />
      ))}
      {[20, 60, 100, 140, 180, 220].map((x) => (
        <line key={`v${x}`} x1={x} x2={x} y1="10" y2="130" strokeOpacity="0.15" />
      ))}
    </svg>
  );
}
