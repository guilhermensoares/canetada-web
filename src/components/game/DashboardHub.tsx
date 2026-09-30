import { memo, type ReactElement } from "react";
import { X } from "lucide-react";
import {
  GridIcon,
  CoinIcon,
  LandmarkIcon,
  BuildingIcon,
  BusIcon,
  PeopleIcon,
  VoteIcon,
  WarningIcon,
  HammerIcon,
  LockIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export type HubSection =
  | "overview"
  | "finance"
  | "policies"
  | "urbanism"
  | "mobility"
  | "society"
  | "politics"
  | "crisis"
  | "build"
  | "bidding";

type Lang = "pt" | "en";

const LABELS: Record<HubSection, { pt: string; en: string; hint: { pt: string; en: string } }> = {
  overview:  { pt: "Visão geral",  en: "Overview",   hint: { pt: "Indicadores, notícias e favelas",             en: "KPIs, news and slums" } },
  finance:   { pt: "Finanças",     en: "Finance",    hint: { pt: "Receitas, despesas, LRF e razão fiscal",      en: "Revenue, expenses, LRF & ledger" } },
  policies:  { pt: "Políticas",    en: "Policies",   hint: { pt: "Políticas públicas, impostos, meio ambiente", en: "Public policy, taxes, environment" } },
  urbanism:  { pt: "Urbanismo",    en: "Urbanism",   hint: { pt: "Plano diretor, habitação, demografia",        en: "Zoning, housing, demography" } },
  mobility:  { pt: "Mobilidade",   en: "Mobility",   hint: { pt: "Transporte, clima e saneamento",              en: "Transport, climate & sanitation" } },
  society:   { pt: "Sociedade",    en: "Society",    hint: { pt: "Justiça espacial, educação, informalidade",   en: "Spatial justice, education, informality" } },
  politics:  { pt: "Política",     en: "Politics",   hint: { pt: "Câmara, gabinete, oversight, corrupção",      en: "Council, cabinet, oversight, corruption" } },
  crisis:    { pt: "Crise & Mídia", en: "Crisis & Media", hint: { pt: "Desastres, eventos e imprensa",         en: "Disasters, events, press" } },
  build:     { pt: "Construir",    en: "Build",      hint: { pt: "Zoneamento, edifícios e vias",                en: "Zoning, buildings and roads" } },
  bidding:   { pt: "Licitações",   en: "Biddings",   hint: { pt: "Obras públicas via empreiteiras (Modo Prefeito)", en: "Public works via contractors (Mayor Mode)" } },
};

const ICONS: Record<HubSection, (p: { className?: string }) => ReactElement> = {
  overview: GridIcon,
  finance: CoinIcon,
  policies: LandmarkIcon,
  urbanism: BuildingIcon,
  mobility: BusIcon,
  society: PeopleIcon,
  politics: VoteIcon,
  crisis: WarningIcon,
  build: HammerIcon,
  bidding: HammerIcon,
};

const ORDER: HubSection[] = [
  "overview", "finance", "policies", "urbanism",
  "mobility", "society", "politics", "crisis", "build", "bidding",
];

// Prefetch dos chunks lazy assim que o cursor toca o botão. Como cada Painel
// vira um chunk separado, disparar o import() no hover/touch faz o JS chegar
// antes do clique — a troca de aba fica instantânea sem inflar o initial bundle.
const PANEL_PREFETCH: Partial<Record<HubSection, () => Promise<unknown>>> = {
  finance:  () => Promise.all([import("./FiscalLedger"), import("./LRFPanel")]),
  policies: () => import("./EnvironmentPanel"),
  urbanism: () => Promise.all([
    import("./LandUsePanel"), import("./HousingPanel"),
    import("./DemographyPanel"), import("./LandConflictPanel"),
  ]),
  mobility: () => Promise.all([
    import("./TransportPanel"), import("./ClimatePanel"), import("./SanitationSNISPanel"),
  ]),
  society:  () => Promise.all([
    import("./WellbeingPanel"), import("./SpatialJusticePanel"),
    import("./EducationPanel"), import("./InformalityPanel"), import("./ParallelPowerPanel"),
  ]),
  politics: () => Promise.all([
    import("./PoliticsPanel"), import("./LegislaturePanel"),
    import("./AdvisorsPanel"), import("./OversightPanel"), import("./CorruptionPanel"),
  ]),
  crisis:   () => Promise.all([
    import("./DisasterPanel"), import("./MassEventsPanel"), import("./MediaPanel"),
  ]),
};
const prefetched = new Set<HubSection>();
function prefetchSection(id: HubSection) {
  if (prefetched.has(id)) return;
  prefetched.add(id);
  PANEL_PREFETCH[id]?.().catch(() => prefetched.delete(id));
}

function DashboardHubImpl({
  lang,
  active,
  onSelect,
  className,
  unlockedSections,
  lockedHints,
}: {
  lang: Lang;
  active: HubSection | null;
  onSelect: (s: HubSection | null) => void;
  className?: string;
  /** When provided, sections NOT in the set render as locked (disabled + tooltip).
   *  Omit to keep the classic "everything unlocked" behaviour. */
  unlockedSections?: ReadonlySet<HubSection>;
  /** Per-section tooltip shown when locked (e.g. "Desbloqueia em 20.000 hab"). */
  lockedHints?: Partial<Record<HubSection, string>>;
}) {
  return (
    <div
      className={cn(
        // Mobile portrait: barra horizontal com scroll — encaixa em qualquer largura.
        // Mobile landscape (mland): rail vertical no lado direito, alcançável com o polegar.
        // sm+: barra vertical flutuante como antes.
        "pointer-events-auto flex gap-1 rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-lg backdrop-blur",
        "no-scrollbar overflow-x-auto sm:overflow-visible",
        "sm:flex-col",
        "mland:flex-col mland:overflow-x-visible mland:overflow-y-auto mland:max-h-[86vh] mland:p-1",
        className,
      )}
      role="toolbar"
      aria-label={lang === "pt" ? "Central de painéis" : "Panel hub"}
    >
      {ORDER.map((id) => {
        const Icon = ICONS[id];
        const meta = LABELS[id];
        const on = active === id;
        const locked = unlockedSections ? !unlockedSections.has(id) : false;
        const lockHint = locked ? lockedHints?.[id] : undefined;
        return (
          <button
            key={id}
            type="button"
            disabled={locked}
            onClick={() => { if (!locked) onSelect(on ? null : id); }}
            onMouseEnter={() => { if (!locked) prefetchSection(id); }}
            onFocus={() => { if (!locked) prefetchSection(id); }}
            onTouchStart={() => { if (!locked) prefetchSection(id); }}
            title={locked ? lockHint ?? meta[lang] : meta[lang]}
            aria-pressed={on}
            aria-label={meta[lang]}
            aria-disabled={locked}
            className={cn(
              // 44px em mobile portrait (alvo touch acessível) — 40px no desktop —
              // 36px em landscape para caber mais opções na altura reduzida.
              "group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-all sm:h-10 sm:w-10 mland:h-9 mland:w-9",
              "touch-manipulation",
              locked
                ? "cursor-not-allowed text-muted-foreground/50 opacity-60"
                : on
                  ? "bg-primary text-primary-foreground shadow-[2px_2px_0_0_var(--color-ink)] ring-2 ring-[var(--color-ink)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted",
            )}
          >
            <Icon className="h-5 w-5 sm:h-[18px] sm:w-[18px] mland:h-4 mland:w-4" />
            {locked && (
              <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border/60 bg-background text-foreground/80">
                <LockIcon className="h-2 w-2" />
              </span>
            )}
            {/* Tooltip lateral: só faz sentido na coluna vertical (sm+). */}
            <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md border border-border/60 bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-md sm:group-hover:block">
              {meta[lang]}
              {locked && lockHint ? (
                <span className="ml-1 text-muted-foreground">· {lockHint}</span>
              ) : (
                <span className="ml-1 text-muted-foreground">· {meta.hint[lang]}</span>
              )}
            </span>
          </button>
        );
      })}
      {active && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          title={lang === "pt" ? "Fechar painel" : "Close panel"}
          className="ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground sm:ml-0 sm:mt-1 sm:h-8 sm:w-10 mland:ml-0 mland:mt-1 mland:h-8 mland:w-9"
        >
          <X className="h-5 w-5 sm:h-4 sm:w-4" />
        </button>
      )}
    </div>
  );
}

export const DashboardHub = /*#__PURE__*/ memo(DashboardHubImpl);
export const HUB_LABELS = LABELS;
