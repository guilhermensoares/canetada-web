import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, Dices, Sparkles, Check, ChevronDown, ChevronRight, Shuffle, Landmark, Wrench } from "lucide-react";
import { CITY_PRESETS, type CityPreset } from "@/game/presets";

import { CITIES as METRO_CITIES, METRO_CITY_IDS, type City } from "@/game/cityPresets";
import { CITY_SCALES, ECONOMIC_SCENARIOS, intrinsicScaleForPopulation, intrinsicScenarioForDifficulty, findScale, findScenario, type SandboxOverrides } from "@/game/scenarios";
import { generateCityFromSeed } from "@/game/proceduralCity";
import { DIFFICULTY_ORDER, DIFFICULTY_PROFILES, type DifficultyLevel } from "@/game/difficulty";
import { t, type DictKey } from "@/game/i18n";
import { formatMoney, formatNumber } from "@/game/logic";
import { randomSeed } from "@/game/rng";
import type { Lang } from "@/game/types";
import { cn } from "@/lib/utils";

const CUSTOM_ID = "__custom__";
const SEED_ID = "__seed__";

export function CityPicker({
  lang,
  onStart,
  onCancel,
  initialMode = "mayor",
}: {
  lang: Lang;
  onStart: (opts: {
    presetId?: string;
    cityName: string;
    seed: string;
    scaleId?: string;
    scenarioId?: string;
    sandbox?: SandboxOverrides;
    growthMode?: boolean;
    mode?: "sandbox" | "mayor";
    difficulty?: DifficultyLevel;
  }) => void;
  onCancel?: () => void;
  initialMode?: "sandbox" | "mayor";
}) {
  // Sandbox mode defaults to the "Custom" card; Mayor mode defaults to the
  // first predefined metropolitan city.
  const [selected, setSelected] = useState<string>(
    initialMode === "sandbox" ? CUSTOM_ID : CITY_PRESETS[0].id,
  );
  const [customName, setCustomName] = useState("");
  const [seed, setSeed] = useState(randomSeed());
  const [scaleId, setScaleId] = useState("medium");
  const [scenarioId, setScenarioId] = useState("stability");
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sb, setSb] = useState<SandboxOverrides>({});
  const [growthMode, setGrowthMode] = useState(false);
  const [mode, setMode] = useState<"sandbox" | "mayor">(initialMode);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("normal");
  // No mobile o Passo 1 ocupa ~70% da primeira dobra e empurra o Passo 2
  // (escolha da cidade) para muito abaixo. Assim que o jogador escolhe um
  // modo, colapsamos automaticamente no mobile mantendo apenas um resumo
  // clicável. Desktop sempre mostra os dois cartões (há espaço vertical).
  const [step1CollapsedMobile, setStep1CollapsedMobile] = useState(false);
  const pickMode = (m: "sandbox" | "mayor") => {
    setMode(m);
    setStep1CollapsedMobile(true);
  };


  const isCustom = selected === CUSTOM_ID;
  const isSeed = selected === SEED_ID;
  const preset = CITY_PRESETS.find((p) => p.id === selected);

  // Procedural city derived from the seed field — recomputed whenever seed
  // changes. Only relevant when the "Gerador" card is selected.
  const generated = useMemo(() => generateCityFromSeed(seed), [seed]);

  const cityName = isCustom
    ? customName.trim() || (lang === "pt" ? "Minha Cidade" : "My City")
    : isSeed
      ? generated.name
      : preset?.overrides.cityName ?? "Nova Aurora";

  // Cidades pré-definidas têm escala e cenário INTRÍNSECOS — o jogador não
  // pode alterá-los. Sandbox libera a edição; Gerador deriva do seed.
  const intrinsicScale = preset
    ? intrinsicScaleForPopulation(preset.overrides.population ?? 42_000)
    : undefined;
  const intrinsicScenario = preset
    ? intrinsicScenarioForDifficulty(preset.difficulty)
    : undefined;
  const effectiveScaleId = isCustom
    ? scaleId
    : isSeed
      ? generated.scaleId
      : intrinsicScale!;
  const effectiveScenarioId = isCustom
    ? scenarioId
    : isSeed
      ? generated.scenarioId
      : intrinsicScenario!;

  const canStart = isCustom ? customName.trim().length > 0 : isSeed ? true : !!preset;

  const numField = (k: keyof SandboxOverrides, placeholder: string) => (
    <Input
      type="number"
      placeholder={placeholder}
      value={sb[k] ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        setSb((prev) => ({ ...prev, [k]: v === "" ? undefined : Number(v) }));
      }}
      className="h-8 text-xs"
    />
  );

  // When the mode changes, snap the selection to a card that belongs to that
  // mode. Otherwise the player can land in Modo Prefeito with the Generator
  // selected (or vice-versa) and see contradictory config panels.
  useEffect(() => {
    if (mode === "mayor") {
      const first = CITY_PRESETS[0]?.id;
      if (first && selected !== first && !CITY_PRESETS.some((p) => p.id === selected)) {
        setSelected(first);
      } else if (selected === CUSTOM_ID || selected === SEED_ID) {
        setSelected(CITY_PRESETS[0].id);
      }
    } else {
      // Modo Livre: Custom or Seed only.
      if (selected !== CUSTOM_ID && selected !== SEED_ID) {
        setSelected(CUSTOM_ID);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t(lang, "appTitle")}
              </div>
              <h1 className="text-2xl font-semibold">{t(lang, "pickerTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t(lang, "pickerSubtitle")}</p>
            </div>
          </div>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              {lang === "pt" ? "Cancelar" : "Cancel"}
            </Button>
          )}
        </header>

        {/* ============================================================
            STEP 1 — Escolha do MODO DE JOGO. Ficava escondido no rodapé,
            o que fazia o jogador confundir cartões de Modo Livre
            (Custom + Gerador) com cartões do Modo Prefeito (cidades
            pré-definidas). Agora é a primeira decisão da tela: cada
            modo esconde os cartões que não pertencem a ele.
            ============================================================ */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {lang === "pt" ? "Passo 1 — Modo de jogo" : "Step 1 — Game mode"}
          </div>
          {step1CollapsedMobile && (
            <button
              type="button"
              onClick={() => setStep1CollapsedMobile(false)}
              className="text-[11px] font-semibold uppercase tracking-widest text-primary underline-offset-2 hover:underline sm:hidden"
            >
              {lang === "pt" ? "Trocar" : "Change"}
            </button>
          )}
        </div>
        {step1CollapsedMobile && (
          // Resumo compacto mobile-only. No desktop os dois cartões continuam
          // visíveis (sm:hidden), então essa faixa não aparece.
          <button
            type="button"
            onClick={() => setStep1CollapsedMobile(false)}
            className={cn(
              "mb-4 flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left sm:hidden",
              mode === "mayor"
                ? "border-primary/50 bg-primary/10"
                : "border-info/50 bg-info/10",
            )}
            aria-label={lang === "pt" ? "Trocar modo de jogo" : "Change game mode"}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  mode === "mayor" ? "bg-primary/20 text-primary" : "bg-info/20 text-info",
                )}
              >
                {mode === "mayor" ? <Landmark className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {lang === "pt" ? "Modo selecionado" : "Selected mode"}
                </div>
                <div className="truncate text-sm font-semibold">
                  {mode === "mayor"
                    ? (lang === "pt" ? "Modo Prefeito" : "Mayor Mode")
                    : (lang === "pt" ? "Modo Livre" : "Free Mode")}
                </div>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}
        <div
          className={cn(
            "mb-6 grid gap-3 sm:grid-cols-2",
            // No mobile some quando colapsado; desktop sempre visível.
            step1CollapsedMobile ? "hidden sm:grid" : "grid",
          )}
        >
          <ModeCard
            active={mode === "mayor"}
            tone="mayor"
            onSelect={() => pickMode("mayor")}
            icon={<Landmark className="h-5 w-5" />}
            title={lang === "pt" ? "Modo Prefeito" : "Mayor Mode"}
            subtitle={
              lang === "pt"
                ? "Cidades reais pré-definidas com licitações e crescimento autônomo."
                : "Real, curated cities with biddings and autonomous growth."
            }
            bullets={
              lang === "pt"
                ? [
                    "6 municípios da Grande Santo Paulo + presets clássicos",
                    "Tamanho, mapa e dificuldade fixos por cidade",
                    "Você abre licitações — empreiteiras têm risco de atraso e corrupção",
                  ]
                : [
                    "6 Greater Santo Paulo cities + classic presets",
                    "Size, map and difficulty are fixed per city",
                    "You open biddings — contractors risk delay and corruption",
                  ]
            }
          />
          <ModeCard
            active={mode === "sandbox"}
            tone="free"
            onSelect={() => pickMode("sandbox")}
            icon={<Wrench className="h-5 w-5" />}
            title={lang === "pt" ? "Modo Livre" : "Free Mode"}
            subtitle={
              lang === "pt"
                ? "Crie uma cidade do zero ou gere uma proceduralmente por seed."
                : "Design a city from scratch or generate one procedurally from a seed."
            }
            bullets={
              lang === "pt"
                ? [
                    "Personalizada: você define escala, cenário e recursos iniciais",
                    "Gerador: um seed determinístico monta a cidade inteira",
                    "Dificuldade ajustável (Fácil → Extremo) no modo Gerador",
                  ]
                : [
                    "Custom: pick scale, scenario and starting resources",
                    "Generator: a deterministic seed builds the whole city",
                    "Adjustable difficulty (Easy → Extreme) in Generator mode",
                  ]
            }
          />

        </div>

        {/* ============================================================
            STEP 2 — Cartões de CIDADE, envelopados por um "trilho"
            colorido pelo modo ativo (âmbar = Prefeito, ciano = Livre).
            Um cabeçalho colorido reforça a que modo os cartões abaixo
            pertencem, eliminando confusão visual entre presets e Custom.
            ============================================================ */}
        {(() => {
          const isMayor = mode === "mayor";
          const railTone = isMayor
            ? "border-primary/45 bg-primary/[0.04]"
            : "border-info/45 bg-info/[0.04]";
          const ribbonTone = isMayor
            ? "bg-primary/10 text-primary border-primary/40"
            : "bg-info/10 text-info border-info/40";
          const chipTone = isMayor
            ? "bg-primary text-primary-foreground"
            : "bg-info text-info-foreground";
          return (
            <div className={cn("mb-4 rounded-xl border p-4 sm:p-5", railTone)}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest",
                    chipTone,
                  )}
                >
                  {isMayor ? <Landmark className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                  {isMayor
                    ? lang === "pt" ? "Modo Prefeito" : "Mayor Mode"
                    : lang === "pt" ? "Modo Livre" : "Free Mode"}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                    ribbonTone,
                  )}
                >
                  {lang === "pt" ? "Passo 2 · Cidade" : "Step 2 · City"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {isMayor
                    ? lang === "pt"
                      ? "Cidades reais pré-definidas — mapa e dificuldade fixos."
                      : "Curated real cities — fixed map and difficulty."
                    : lang === "pt"
                      ? "Criar do zero ou gerar por seed — tudo ajustável."
                      : "Build from scratch or seed-generate — fully tunable."}
                </span>
              </div>

              {isMayor ? (
                <>
                  <section className="mb-5">
                    <div className="mb-3 flex items-baseline justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        {lang === "pt" ? "Grande Santo Paulo" : "Greater Santo Paulo"}
                      </h2>
                      <span className="text-[11px] text-muted-foreground">
                        {lang === "pt"
                          ? "6 municípios da região metropolitana"
                          : "6 metropolitan municipalities"}
                      </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {METRO_CITY_IDS.map((id) => {
                        const city = METRO_CITIES.find((c) => c.id === id)!;
                        const preset = CITY_PRESETS.find((p) => p.id === id);
                        if (!preset) return null;
                        return (
                          <MetroCityCard
                            key={id}
                            lang={lang}
                            city={city}
                            preset={preset}
                            selected={selected === id}
                            onSelect={() => setSelected(id)}
                          />
                        );
                      })}
                    </div>
                  </section>

                  <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                    {lang === "pt" ? "Outras cidades pré-definidas" : "Other predefined cities"}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {CITY_PRESETS.filter((p) => !METRO_CITY_IDS.includes(p.id)).map((p) => (
                      <PresetCard
                        key={p.id}
                        lang={lang}
                        preset={p}
                        selected={selected === p.id}
                        onSelect={() => setSelected(p.id)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <CustomCard
                    lang={lang}
                    selected={isCustom}
                    onSelect={() => setSelected(CUSTOM_ID)}
                    name={customName}
                    onName={setCustomName}
                  />
                  <SeedGeneratorCard
                    lang={lang}
                    selected={isSeed}
                    onSelect={() => setSelected(SEED_ID)}
                    generated={generated}
                    seed={seed}
                    onReroll={() => setSeed(randomSeed())}
                  />
                </div>
              )}
            </div>
          );
        })()}



        {/* Painel de configuração — só aparece no Modo Livre e depende
            da variante (Personalizada vs Gerador). No Modo Prefeito
            mostramos apenas o resumo das características intrínsecas. */}
        {isCustom ? (
          <Card className="mt-6 border-border/60 bg-panel/70 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                {lang === "pt" ? "Modo Livre · Personalizada" : "Free Mode · Custom"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {lang === "pt"
                  ? "Personalize tamanho, dificuldade, população e recursos iniciais."
                  : "Customize size, difficulty, population and starting resources."}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  {t(lang, "scale")}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {CITY_SCALES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setScaleId(s.id)}
                      className={cn(
                        "rounded-md border p-2 text-left text-xs transition-all",
                        scaleId === s.id
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                          : "border-border/50 bg-background/30 hover:border-primary/40",
                      )}
                    >
                      <div className="font-semibold">{t(lang, s.labelKey as DictKey)}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {t(lang, s.descKey as DictKey)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  {t(lang, "scenario")}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ECONOMIC_SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setScenarioId(s.id)}
                      className={cn(
                        "rounded-md border p-2 text-left text-xs transition-all",
                        scenarioId === s.id
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                          : "border-border/50 bg-background/30 hover:border-primary/40",
                      )}
                    >
                      <div className="font-semibold">
                        {s.emoji} {t(lang, s.labelKey as DictKey)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {t(lang, s.descKey as DictKey)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSandboxOpen((v) => !v)}
              className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {sandboxOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t(lang, "sandbox_toggle")}
            </button>
            {sandboxOpen && (
              <div className="mt-3 rounded-md border border-dashed border-border/60 bg-background/30 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t(lang, "sandbox_title")} — <span className="normal-case">{t(lang, "sandbox_hint")}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  <Field label={t(lang, "population")}>{numField("population", "42000")}</Field>
                  <Field label={t(lang, "treasury")}>{numField("treasury", "850000")}</Field>
                  <Field label={t(lang, "debt")}>{numField("debt", "0")}</Field>
                  <Field label={t(lang, "inflation") + " %"}>{numField("inflation", "3.2")}</Field>
                  <Field label={t(lang, "unemployment") + " %"}>{numField("unemployment", "7.4")}</Field>
                  <Field label={t(lang, "happiness") + " %"}>{numField("happiness", "62")}</Field>
                  <Field label={t(lang, "businesses")}>{numField("businesses", "320")}</Field>
                  <Field label={t(lang, "incomeTax") + " %"}>{numField("taxIncome", "12")}</Field>
                  <Field label={t(lang, "propertyTax") + " %"}>{numField("taxProperty", "6")}</Field>
                  <Field label={t(lang, "businessTax") + " %"}>{numField("taxBusiness", "10")}</Field>
                </div>
              </div>
            )}
          </Card>
        ) : isSeed ? (
          <Card className="mt-6 border-border/60 bg-panel/70 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                {lang === "pt" ? "Modo Livre · Gerador" : "Free Mode · Generator"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {lang === "pt"
                  ? `Cidade derivada do seed "${seed}" — mesmo seed sempre gera a mesma cidade.`
                  : `City derived from seed "${seed}" — same seed always yields the same city.`}
              </span>
              <span className="ml-auto rounded border border-border/50 bg-background/40 px-2 py-0.5 text-[11px]">
                {t(lang, "scale")}: <b>{t(lang, findScale(generated.scaleId).labelKey as DictKey)}</b>
              </span>
              <span className="rounded border border-border/50 bg-background/40 px-2 py-0.5 text-[11px]">
                {t(lang, "scenario")}: <b>{findScenario(generated.scenarioId).emoji} {t(lang, findScenario(generated.scenarioId).labelKey as DictKey)}</b>
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-1.5 text-[11px] md:grid-cols-4">
              <Stat label={t(lang, "population")} value={formatNumber(generated.sandbox.population ?? 0)} />
              <Stat label={t(lang, "treasury")} value={formatMoney(generated.sandbox.treasury ?? 0)} />
              <Stat label={t(lang, "debt")} value={formatMoney(generated.sandbox.debt ?? 0)} />
              <Stat label={t(lang, "happiness")} value={`${(generated.sandbox.happiness ?? 0).toFixed(0)}%`} />
              <Stat label={t(lang, "inflation") + " %"} value={`${(generated.sandbox.inflation ?? 0).toFixed(1)}`} />
              <Stat label={t(lang, "unemployment") + " %"} value={`${(generated.sandbox.unemployment ?? 0).toFixed(1)}`} />
              <Stat label={t(lang, "businesses")} value={formatNumber(generated.sandbox.businesses ?? 0)} />
              <Stat label={t(lang, "incomeTax") + " %"} value={`${(generated.sandbox.taxIncome ?? 0).toFixed(1)}`} />
            </dl>

            {/* Difficulty picker — exclusive to Modo Gerador. */}
            <div className="mt-4 border-t border-border/40 pt-4">
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {lang === "pt" ? "Dificuldade" : "Difficulty"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {DIFFICULTY_PROFILES[difficulty][lang === "pt" ? "descPt" : "descEn"]}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {DIFFICULTY_ORDER.map((lvl) => {
                  const p = DIFFICULTY_PROFILES[lvl];
                  const active = difficulty === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-md border p-2 text-left transition-colors",
                        active
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                          : "border-border/60 bg-background/30 hover:border-border",
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <span>{p.emoji}</span>
                        <span>{lang === "pt" ? p.labelPt : p.labelEn}</span>
                      </div>
                      <div className="text-[10px] leading-tight text-muted-foreground">
                        {lang === "pt"
                          ? `Eventos ×${p.eventChanceMult.toFixed(2)} · Reação ×${p.reactionMult.toFixed(2)}`
                          : `Events ×${p.eventChanceMult.toFixed(2)} · Reaction ×${p.reactionMult.toFixed(2)}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="mt-6 border-border/60 bg-panel/70 p-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {lang === "pt" ? "Modo Prefeito · Características intrínsecas" : "Mayor Mode · Intrinsic settings"}
              </span>
              <span className="text-muted-foreground">
                {lang === "pt"
                  ? "Tamanho, mapa e dificuldade fixos para esta cidade."
                  : "Size, map and difficulty are fixed for this city."}
              </span>
              <span className="ml-auto rounded border border-border/50 bg-background/40 px-2 py-0.5 text-[11px]">
                {t(lang, "scale")}: <b>{t(lang, findScale(intrinsicScale!).labelKey as DictKey)}</b>
              </span>
              <span className="rounded border border-border/50 bg-background/40 px-2 py-0.5 text-[11px]">
                {t(lang, "scenario")}: <b>{findScenario(intrinsicScenario!).emoji} {t(lang, findScenario(intrinsicScenario!).labelKey as DictKey)}</b>
              </span>
            </div>
          </Card>
        )}

        {/* Growth Mode toggle — vale para os dois modos. */}
        <Card className="mt-4 border-border/60 bg-panel/70 p-4">
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
              growthMode
                ? "border-primary/60 bg-primary/10"
                : "border-border/60 bg-background/30 hover:border-border",
            )}
          >
            <input
              type="checkbox"
              checked={growthMode}
              onChange={(e) => setGrowthMode(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-foreground">
                {lang === "pt" ? "Modo Crescimento (opcional)" : "Growth Mode (optional)"}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {lang === "pt"
                  ? "Começa como uma vila (~2.500 hab, R$ 250 mil). Pastas administrativas (finanças, urbanismo, câmara, crise) desbloqueiam conforme a cidade cresce. Vale para os dois modos."
                  : "Start as a village (~2,500 pop, R$ 250k). Administrative departments (finance, urbanism, council, crisis) unlock as the city grows. Works in both modes."}
              </div>
            </div>
          </label>
        </Card>


        <Card className="mt-6 border-border/60 bg-panel/70 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] flex-1">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t(lang, "cityName")}
              </label>
              {isCustom ? (
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={lang === "pt" ? "Ex: Vila Nova" : "e.g. New Haven"}
                  className="mt-1"
                  autoFocus
                />
              ) : (
                <div className="mt-1 text-lg font-semibold">{cityName}</div>
              )}
            </div>
            {/* Seed é um conceito exclusivo do Modo Livre (Custom + Gerador).
                No Modo Prefeito o mapa é determinístico pela cidade escolhida,
                então esconder o campo evita confusão semântica. */}
            {(isCustom || isSeed) && (
              <div className="min-w-[180px] flex-1">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {t(lang, "seed")}
                </label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={seed}
                    onChange={(e) => setSeed(e.target.value.toUpperCase())}
                    className="text-mono tracking-wider"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setSeed(randomSeed())}
                    title={t(lang, "seedRandom")}
                  >
                    <Dices className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <Button
              size="lg"
              className="gap-2"
              disabled={!canStart}
              onClick={() => {
                // Strip undefined so we only send explicit overrides.
                const cleanSb: SandboxOverrides = {};
                (Object.keys(sb) as (keyof SandboxOverrides)[]).forEach((k) => {
                  const v = sb[k];
                  if (typeof v === "number" && !Number.isNaN(v)) cleanSb[k] = v;
                });
                onStart({
                  presetId: isCustom || isSeed ? undefined : selected,
                  cityName,
                  seed: seed.trim() || randomSeed(),
                  scaleId: effectiveScaleId,
                  scenarioId: effectiveScenarioId,
                  // Sandbox overrides SÓ se aplicam ao modo Sandbox (cidade custom).
                  // No modo Gerador, os overrides vêm do seed procedural.
                  sandbox: isSeed
                    ? generated.sandbox
                    : isCustom && Object.keys(cleanSb).length
                      ? cleanSb
                      : undefined,
                  growthMode: growthMode || undefined,
                  mode,
                  // Difficulty currently only surfaces UI in the Generator card;
                  // presets and sandbox stay on "normal" until they get pickers.
                  difficulty: isSeed ? difficulty : undefined,
                });
              }}
            >
              <Sparkles className="h-4 w-4" />
              {t(lang, "pickerStart")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/**
 * ModeCard — cartão grande de escolha de MODO DE JOGO, exibido como
 * primeiro passo da tela. Deixa explícito que Modo Prefeito e Modo Livre
 * têm cartões de cidade completamente diferentes.
 */
function ModeCard({
  active,
  tone,
  onSelect,
  icon,
  title,
  subtitle,
  bullets,
}: {
  active: boolean;
  tone: "mayor" | "free";
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
}) {
  // Mayor Mode veste âmbar (primary), Modo Livre veste ciano (info).
  // Cada modo carrega uma cor própria mesmo quando inativo — um leve tint
  // na borda e um badge colorido — pra ficar óbvio que são caminhos
  // distintos e não duas variações do mesmo cartão.
  const isMayor = tone === "mayor";
  const activeCls = isMayor
    ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
    : "border-info bg-info/10 shadow-[0_0_0_1px_hsl(var(--info)/0.35)]";
  const idleCls = isMayor
    ? "border-primary/25 bg-panel/40 hover:border-primary/60 hover:bg-primary/[0.04]"
    : "border-info/25 bg-panel/40 hover:border-info/60 hover:bg-info/[0.04]";
  const iconCls = active
    ? isMayor ? "bg-primary/20 text-primary" : "bg-info/20 text-info"
    : isMayor ? "bg-primary/10 text-primary/80" : "bg-info/10 text-info/80";
  const dotCls = active
    ? isMayor ? "bg-primary" : "bg-info"
    : "bg-muted-foreground/50";
  const checkCls = isMayor ? "text-primary" : "text-info";
  const ringCls = isMayor ? "focus-visible:ring-primary" : "focus-visible:ring-info";
  const badgeCls = isMayor
    ? "bg-primary/15 text-primary border-primary/30"
    : "bg-info/15 text-info border-info/30";
  const badgeText = isMayor
    ? { pt: "Cidades reais", en: "Real cities" }
    : { pt: "Sandbox / Seed", en: "Sandbox / Seed" };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        // pt-9 no mobile abre espaço para o badge que fica absoluto no topo
        // direito e antes encostava no ícone/título; sm: volta ao padding
        // padrão porque no desktop já há espaço lateral sobrando.
        "group relative flex flex-col items-start gap-2 rounded-lg border p-4 pt-9 text-left transition-all focus:outline-none focus-visible:ring-2 sm:pt-4",
        ringCls,
        active ? activeCls : idleCls,
      )}
      aria-pressed={active}
    >
      <span
        className={cn(
          "absolute right-3 top-3 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
          badgeCls,
        )}
      >
        {badgeText.pt /* label is short and stable; kept in PT for consistency */}
      </span>
      <div className="flex w-full items-center gap-2 sm:pr-24">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors", iconCls)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        {active && <Check className={cn("h-4 w-4 shrink-0", checkCls)} />}
      </div>
      <ul className="mt-1 space-y-1.5 pl-1 pr-2 text-[11px] text-muted-foreground">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-1.5">
            <span className={cn("mt-1 h-1 w-1 shrink-0 rounded-full", dotCls)} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}



function accentClass(a: CityPreset["accent"]) {
  switch (a) {
    case "success":
      return "border-success/60 shadow-[0_0_0_1px_hsl(var(--success)/0.25)]";
    case "warning":
      return "border-warning/60 shadow-[0_0_0_1px_hsl(var(--warning)/0.25)]";
    case "danger":
      return "border-destructive/60 shadow-[0_0_0_1px_hsl(var(--destructive)/0.25)]";
    case "info":
      return "border-info/60 shadow-[0_0_0_1px_hsl(var(--info)/0.25)]";
    default:
      return "border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]";
  }
}

function PresetCard({
  lang,
  preset,
  selected,
  onSelect,
}: {
  lang: Lang;
  preset: CityPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const o = preset.overrides;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card
        className={cn(
          "h-full border-border/60 bg-panel/70 p-4 transition-all hover:border-primary/50",
          selected && accentClass(preset.accent),
        )}
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{preset.emoji}</span>
            <div>
              <div className="font-semibold">{t(lang, preset.nameKey as DictKey)}</div>
              <div className="text-xs text-muted-foreground">
                {t(lang, preset.taglineKey as DictKey)}
              </div>
            </div>
          </div>
          {selected && <Check className="h-4 w-4 text-primary" />}
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t(lang, "difficulty")}
          </span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-3 rounded-sm",
                  i <= preset.difficulty ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          {t(lang, preset.descriptionKey as DictKey)}
        </p>

        <dl className="grid grid-cols-2 gap-1.5 text-[11px]">
          <Stat label={t(lang, "population")} value={formatNumber(o.population ?? 0)} />
          <Stat label={t(lang, "treasury")} value={formatMoney(o.treasury ?? 0)} />
          <Stat label={t(lang, "happiness")} value={`${(o.happiness ?? 0).toFixed(0)}%`} />
          <Stat label={t(lang, "debt")} value={formatMoney(o.debt ?? 0)} />
        </dl>
      </Card>
    </button>
  );
}

function CustomCard({
  lang,
  selected,
  onSelect,
  name,
  onName,
}: {
  lang: Lang;
  selected: boolean;
  onSelect: () => void;
  name: string;
  onName: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card
        className={cn(
          "flex h-full flex-col border-dashed border-border/60 bg-panel/40 p-4 transition-all hover:border-primary/50",
          selected && "border-primary/60 bg-panel/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]",
        )}
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">✨</span>
            <div>
              <div className="font-semibold">{t(lang, "preset_custom_name")}</div>
              <div className="text-xs text-muted-foreground">
                {t(lang, "preset_custom_tag")}
              </div>
            </div>
          </div>
          {selected && <Check className="h-4 w-4 text-primary" />}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {t(lang, "preset_custom_desc")}
        </p>
        {selected && (
          <Input
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder={lang === "pt" ? "Nome da cidade" : "City name"}
            className="mt-auto"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </Card>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-border/40 bg-background/30 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-mono font-medium">{value}</span>
    </div>
  );
}

/* ==============================================================
   Cartão dedicado à Região Metropolitana da Grande Santo Paulo.
   Consome METADADOS de `game/cityPresets.ts` (slogan, envelhecimento,
   base industrial, transporte, informalidade, congestionamento) e o
   preset numérico correspondente para arrancar a partida.
   ============================================================== */

function transitLabel(lang: Lang, t: City["transitType"]): string {
  // Kept intentionally short (≤6 chars) so the value never wraps inside the
  // dense 2-col Stat grid and every card stays visually aligned.
  if (lang === "pt") {
    switch (t) {
      case "metro_rail_heavy": return "Metrô";
      case "rail_dependent":   return "Trens";
      case "bus_only":         return "Ônibus";
    }
  }
  switch (t) {
    case "metro_rail_heavy": return "Metro";
    case "rail_dependent":   return "Rail";
    case "bus_only":         return "Bus";
  }
}

function industryLabel(lang: Lang, k: City["industrialBaseType"][number]): string {
  const pt: Record<string, string> = {
    chemical: "Química",
    automotive: "Automotiva",
    petrochemical: "Petroquímica",
    corporate_services: "Serviços corp.",
    retail_services: "Comércio",
    logistics: "Logística",
    auto_parts: "Autopeças",
    tech_innovation: "Tecnologia",
    informal_commerce: "Comércio informal",
  };
  const en: Record<string, string> = {
    chemical: "Chemical",
    automotive: "Automotive",
    petrochemical: "Petrochemical",
    corporate_services: "Corp. services",
    retail_services: "Retail",
    logistics: "Logistics",
    auto_parts: "Auto parts",
    tech_innovation: "Tech",
    informal_commerce: "Informal retail",
  };
  return (lang === "pt" ? pt : en)[k] ?? k;
}

function riskTone(v: number): string {
  if (v >= 0.66) return "border-destructive/50 bg-destructive/10 text-destructive";
  if (v >= 0.33) return "border-warning/50 bg-warning/10 text-warning";
  return "border-success/50 bg-success/10 text-success";
}

function MetroCityCard({
  lang,
  city,
  preset,
  selected,
  onSelect,
}: {
  lang: Lang;
  city: City;
  preset: CityPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card
        className={cn(
          "h-full border-border/60 bg-panel/70 p-4 transition-all hover:border-primary/50",
          selected && accentClass(preset.accent),
        )}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{preset.emoji}</span>
            <div>
              <div className="font-semibold">{city.name}</div>
              <div className="text-[11px] italic text-muted-foreground">
                “{city.slogan}”
              </div>
            </div>
          </div>
          {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t(lang, "difficulty")}
          </span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-3 rounded-sm",
                  i <= preset.difficulty ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>

        <dl className="mb-3 grid grid-cols-2 gap-1.5 text-[11px]">
          <Stat label={t(lang, "population")} value={formatNumber(city.population)} />
          <Stat label={t(lang, "treasury")} value={formatMoney(city.initialBudget)} />
          <Stat
            label={lang === "pt" ? "Envelhec." : "Aging"}
            value={`${city.agingIndex}/100`}
          />
          <Stat label={lang === "pt" ? "Transporte" : "Transit"} value={transitLabel(lang, city.transitType)} />
        </dl>

        <div className="mb-2 flex flex-wrap gap-1">
          {city.industrialBaseType.slice(0, 4).map((k) => (
            <span
              key={k}
              className="rounded border border-border/50 bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {industryLabel(lang, k)}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px] font-medium",
              riskTone(city.informalSettlementRisk),
            )}
            title={lang === "pt" ? "Risco de ocupação informal" : "Informal settlement risk"}
          >
            {lang === "pt" ? "Informalidade" : "Informality"} {pct(city.informalSettlementRisk)}
          </span>
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px] font-medium",
              riskTone(city.trafficCongestionBase),
            )}
            title={lang === "pt" ? "Congestionamento basal" : "Base congestion"}
          >
            {lang === "pt" ? "Trânsito" : "Traffic"} {pct(city.trafficCongestionBase)}
          </span>
        </div>
      </Card>
    </button>
  );
}

/* ==============================================================
   Cartão do Gerador Procedural. O jogador vê uma prévia da cidade
   derivada do seed atual e pode rerolar. Mesmo seed → mesma cidade.
   ============================================================== */
function SeedGeneratorCard({
  lang,
  selected,
  onSelect,
  generated,
  seed,
  onReroll,
}: {
  lang: Lang;
  selected: boolean;
  onSelect: () => void;
  generated: ReturnType<typeof generateCityFromSeed>;
  seed: string;
  onReroll: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card
        className={cn(
          "flex h-full flex-col border-dashed border-border/60 bg-panel/40 p-4 transition-all hover:border-primary/50",
          selected && "border-primary/60 bg-panel/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]",
        )}
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🎲</span>
            <div>
              <div className="font-semibold">
                {lang === "pt" ? "Gerador de Cidades" : "City Generator"}
              </div>
              <div className="text-xs text-muted-foreground">
                {lang === "pt" ? "Cidade procedural por seed" : "Procedural seed-based city"}
              </div>
            </div>
          </div>
          {selected && <Check className="h-4 w-4 text-primary" />}
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          {lang === "pt"
            ? "Um motor determinístico transforma o seed em uma cidade única — nome, população, cenário econômico, dívida e impostos."
            : "A deterministic engine turns the seed into a unique city — name, population, economy, debt and taxes."}
        </p>

        <div className="mb-2 flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">{lang === "pt" ? "Cidade" : "City"}:</span>
          <b className="truncate">{generated.name}</b>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t(lang, "difficulty")}
          </span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-3 rounded-sm",
                  i <= generated.difficulty ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>

        <dl className="mb-3 grid grid-cols-2 gap-1.5 text-[11px]">
          <Stat label={t(lang, "population")} value={formatNumber(generated.sandbox.population ?? 0)} />
          <Stat label={t(lang, "treasury")} value={formatMoney(generated.sandbox.treasury ?? 0)} />
          <Stat label={t(lang, "debt")} value={formatMoney(generated.sandbox.debt ?? 0)} />
          <Stat label={t(lang, "happiness")} value={`${(generated.sandbox.happiness ?? 0).toFixed(0)}%`} />
        </dl>

        {selected && (
          <div className="mt-auto flex items-center gap-2 rounded border border-border/50 bg-background/40 px-2 py-1.5 text-[11px]">
            <span className="text-muted-foreground">Seed:</span>
            <b className="text-mono flex-1 tracking-wider">{seed}</b>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                onReroll();
              }}
            >
              <Shuffle className="h-3 w-3" />
              {lang === "pt" ? "Rerolar" : "Reroll"}
            </Button>
          </div>
        )}
      </Card>
    </button>
  );
}

