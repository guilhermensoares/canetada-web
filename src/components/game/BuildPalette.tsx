// F1: read-only CS2-style build palette. Selection is local — placement,
// utilities, coverage and growth land in later phases (F2-F5).
//
// Keeps the existing WebP art (per user's decision); the palette itself is
// dense and categorical like Cities: Skylines 2's build menu.

import { useMemo, useState } from "react";
import type { Lang } from "@/game/types";
import {
  PALETTE_GROUPS,
  entryCost,
  isBuilding,
  isRoad,
  isZone,
  type BuildCategory,
  type CatalogEntry,
} from "@/game/build/catalog";
import { formatMoney } from "@/game/logic";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<BuildCategory, string> = {
  road: "🛣️",
  zone: "🏙️",
  power: "⚡",
  water: "💧",
  education: "🎓",
  health: "➕",
  safety: "🛡️",
  parks: "🌳",
  research: "🔬",
};

function label(e: CatalogEntry, lang: Lang): string {
  return lang === "pt" ? e.label.pt : e.label.en;
}
function desc(e: CatalogEntry, lang: Lang): string {
  return lang === "pt" ? e.desc.pt : e.desc.en;
}

function entrySwatch(e: CatalogEntry): string {
  if (isRoad(e) || isZone(e)) return e.color;
  switch (e.category) {
    case "power": return "#f0b429";
    case "water": return "#2f6b86";
    case "education": return "#8a3c2f";
    case "health": return "#3a6ea5";
    case "safety": return "#c93c2a";
    case "parks": return "#22c55e";
    case "research": return "#8b5cf6";
    default: return "#888";
  }
}

function EntryChip({
  entry,
  active,
  affordable,
  lang,
  onPick,
}: {
  entry: CatalogEntry;
  active: boolean;
  affordable: boolean;
  lang: Lang;
  onPick: () => void;
}) {
  const cost = entryCost(entry);
  const costLabel = isRoad(entry)
    ? `${formatMoney(cost)}/tile`
    : isZone(entry)
      ? "—"
      : formatMoney(cost);
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!affordable}
      title={`${label(entry, lang)} — ${desc(entry, lang)}`}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "border-primary/80 bg-primary/10 text-foreground"
          : "border-border/50 bg-panel/30 text-muted-foreground hover:bg-panel/70 hover:text-foreground",
      )}
    >
      <span
        className="h-3 w-3 shrink-0 rounded-sm border border-border/50"
        style={{ backgroundColor: entrySwatch(entry) }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{label(entry, lang)}</span>
      <span className="text-mono shrink-0 text-[10px] text-muted-foreground/80">
        {costLabel}
      </span>
    </button>
  );
}

function EntryDetail({ entry, lang }: { entry: CatalogEntry; lang: Lang }) {
  const rows: Array<[string, string]> = [];
  if (isRoad(entry)) {
    rows.push(["Largura", `${entry.widthTiles} tiles`]);
    rows.push(["Velocidade", `${entry.speedKph} km/h`]);
    rows.push(["Capacidade", `${entry.capacityVph} v/h`]);
    rows.push(["Custo", `${formatMoney(entry.costPerTile)}/tile`]);
    rows.push(["Manutenção", `${formatMoney(entry.upkeepPerTile)}/tile/mês`]);
    rows.push(["Energia/Água", entry.carriesPower ? "Sim" : "Não"]);
  } else if (isZone(entry)) {
    rows.push(["Tipo", entry.kind]);
    rows.push(["Densidade", entry.density]);
  } else if (isBuilding(entry)) {
    rows.push(["Área", `${entry.footprint[0]}×${entry.footprint[1]}`]);
    rows.push(["Custo", formatMoney(entry.cost)]);
    rows.push(["Manutenção", `${formatMoney(entry.upkeep)}/mês`]);
    if (entry.capacity != null) rows.push(["Capacidade", `${entry.capacity}`]);
    if (entry.coverageRadius != null) rows.push(["Raio", `${entry.coverageRadius} tiles`]);
    if (entry.requires.power) rows.push(["Consome", `${entry.requires.power} MW`]);
    if (entry.requires.water) rows.push(["Água", `${entry.requires.water} m³/s`]);
    if (entry.produces?.power) rows.push(["Produz", `${entry.produces.power} MW`]);
    if (entry.produces?.water) rows.push(["Produz", `${entry.produces.water} m³/s`]);
    if (entry.pollution) rows.push(["Poluição", `ar ${entry.pollution.air}, ruído ${entry.pollution.noise}`]);
  }
  return (
    <div className="rounded-md border border-border/50 bg-panel/40 p-2 text-xs">
      <div className="mb-1 font-semibold text-foreground">{label(entry, lang)}</div>
      <div className="mb-2 text-muted-foreground">{desc(entry, lang)}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-border/20 py-0.5">
            <span>{k}</span>
            <span className="text-foreground/90">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BuildPalette({
  lang,
  treasury,
}: {
  lang: Lang;
  treasury: number;
}) {
  const [activeCat, setActiveCat] = useState<BuildCategory>("road");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const group = useMemo(
    () => PALETTE_GROUPS.find((g) => g.id === activeCat) ?? PALETTE_GROUPS[0],
    [activeCat],
  );
  const selected = useMemo(
    () => group.entries.find((e) => e.id === selectedId) ?? null,
    [group, selectedId],
  );

  return (
    <div className="rounded-md border border-border/60 bg-panel/40 p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {lang === "pt" ? "Construção (CS2)" : "Build (CS2)"}
        </div>
        <div className="text-mono text-[10px] text-muted-foreground">
          {lang === "pt" ? "Tesouro" : "Treasury"}: {formatMoney(treasury)}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {PALETTE_GROUPS.map((g) => {
          const active = g.id === activeCat;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setActiveCat(g.id);
                setSelectedId(null);
              }}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
                active
                  ? "border-primary/80 bg-primary/10 text-foreground"
                  : "border-border/50 bg-transparent text-muted-foreground hover:bg-panel/70 hover:text-foreground",
              )}
              title={lang === "pt" ? g.label.pt : g.label.en}
            >
              <span aria-hidden>{CATEGORY_ICON[g.id]}</span>
              <span className="hidden md:inline">
                {lang === "pt" ? g.label.pt : g.label.en}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
          {group.entries.map((entry) => {
            const cost = isRoad(entry) ? entry.costPerTile : isZone(entry) ? 0 : entry.cost;
            const affordable = treasury >= cost;
            return (
              <EntryChip
                key={entry.id}
                entry={entry}
                lang={lang}
                active={selectedId === entry.id}
                affordable={affordable}
                onPick={() => setSelectedId(entry.id)}
              />
            );
          })}
        </div>
        <div className="min-h-[140px]">
          {selected ? (
            <EntryDetail entry={selected} lang={lang} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/50 p-3 text-[11px] text-muted-foreground">
              {lang === "pt"
                ? "Selecione um item para ver detalhes."
                : "Pick an item to see details."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
