import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Lang } from "@/game/types";
import { t } from "@/game/i18n";
import { MayorAvatar as MayorAvatarPortrait } from "./MayorAvatar";
import { DEFAULT_MAYOR, type Mayor } from "@/game/mayor";
import { ARCHETYPES, DEFAULT_ARCHETYPE_ID, type ArchetypeId } from "@/assets/archetypes";
import { POLITICIAN_PRESETS, politicianToMayor, type PoliticianPreset } from "@/game/politicianPresets";
import { loadHall, playedPersonaIds, type HallEntry } from "@/game/journey";
import { ArrowLeft, Check, User, Trophy, Gavel, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FictionDisclaimer } from "./FictionDisclaimer";

interface Props {
  lang: Lang;
  initial?: Mayor;
  onBack?: () => void;
  onConfirm: (mayor: Mayor) => void;
}

export function MayorCreator({ lang, initial, onBack, onConfirm }: Props) {
  const [mayor, setMayor] = useState<Mayor>(initial ?? DEFAULT_MAYOR);
  const [hall] = useState<HallEntry[]>(() => loadHall());
  const [played] = useState<Set<string>>(() => playedPersonaIds());

  const pickPersona = (p: PoliticianPreset) => setMayor(politicianToMayor(p));
  const pickCustom = () =>
    setMayor((m) => ({
      ...m,
      personaId: undefined,
      archetypeId: m.archetypeId ?? DEFAULT_ARCHETYPE_ID,
    }));
  const pickArchetype = (id: ArchetypeId) =>
    setMayor((m) => ({ ...m, personaId: undefined, archetypeId: id }));

  const canSubmit = mayor.name.trim().length > 0;
  const isCustom = !mayor.personaId;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {t(lang, "mayorCreatorTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t(lang, "mayorCreatorSubtitle")}
            </p>
          </div>
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t(lang, "back")}
            </Button>
          )}
        </header>

        {hall.length > 0 && (
          <Card className="mb-6 border-fuchsia-500/20 bg-slate-900/50 p-4 backdrop-blur">
            <div className="mb-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-fuchsia-300" />
              <h2 className="text-sm font-semibold text-fuchsia-200">
                {lang === "pt" ? "Hall dos Prefeitos" : "Hall of Mayors"}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {lang === "pt" ? `· últimas ${Math.min(5, hall.length)} carreiras` : `· last ${Math.min(5, hall.length)} careers`}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {hall.slice(0, 5).map((h, i) => (
                <HallCard key={i} entry={h} lang={lang} />
              ))}
            </div>
          </Card>
        )}

        <FictionDisclaimer lang={lang} variant="banner" className="mb-6" />

        <Card className="mb-6 border-cyan-500/20 bg-slate-900/60 p-6 backdrop-blur">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">{t(lang, "personaGalleryTitle")}</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">{t(lang, "personaGallerySubtitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <PersonaTile
              lang={lang}
              custom
              active={isCustom}
              onClick={pickCustom}
            />
            {POLITICIAN_PRESETS.map((p) => (
              <PersonaTile
                key={p.id}
                lang={lang}
                preset={p}
                active={mayor.personaId === p.id}
                onClick={() => pickPersona(p)}
                played={played.has(p.id)}
              />
            ))}
          </div>
        </Card>

        <div className={cn("grid gap-6", isCustom ? "md:grid-cols-[320px_1fr]" : "md:grid-cols-1")}>
          {/* Preview card */}
          <Card className="flex flex-col items-center gap-4 border-cyan-500/20 bg-slate-900/60 p-6 backdrop-blur">
            <MayorAvatarPortrait
              personaId={mayor.personaId}
              archetypeId={mayor.archetypeId}
              size={240}
              className="rounded-2xl shadow-2xl"
            />
            <div className="w-full space-y-3">
              <div>
                <Label htmlFor="mayor-name" className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t(lang, "mayorName")}
                </Label>
                <Input
                  id="mayor-name"
                  value={mayor.name}
                  onChange={(e) => setMayor((m) => ({ ...m, name: e.target.value }))}
                  placeholder={t(lang, "mayorNamePlaceholder")}
                  maxLength={40}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="mayor-title" className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t(lang, "mayorTitle")}
                </Label>
                <Input
                  id="mayor-title"
                  value={mayor.title}
                  onChange={(e) => setMayor((m) => ({ ...m, title: e.target.value }))}
                  maxLength={30}
                  className="mt-1"
                />
              </div>
            </div>
            {!isCustom && (
              <Button
                size="lg"
                className="w-full"
                disabled={!canSubmit}
                onClick={() => onConfirm({ ...mayor, name: mayor.name.trim() })}
              >
                <Check className="mr-2 h-4 w-4" />
                {t(lang, "takeOffice")}
              </Button>
            )}
          </Card>

          {/* Archetype grid — only for custom mayors */}
          {isCustom && (
            <Card className="border-cyan-500/20 bg-slate-900/60 p-6 backdrop-blur">
              <h2 className="mb-1 text-lg font-semibold">{t(lang, "archetypeTitle")}</h2>
              <p className="mb-4 text-xs text-muted-foreground">{t(lang, "archetypeSubtitle")}</p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {ARCHETYPES.map((a) => {
                  const active = mayor.archetypeId === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => pickArchetype(a.id)}
                      className={cn(
                        "group flex flex-col items-center gap-2 rounded-xl border p-2 text-left transition-all",
                        active
                          ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_0_2px_rgba(34,211,238,0.25)]"
                          : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10",
                      )}
                      title={lang === "pt" ? a.descPt : a.descEn}
                    >
                      <img
                        src={a.portrait}
                        alt=""
                        width={88}
                        height={88}
                        loading="lazy"
                        className="h-[88px] w-[88px] rounded-lg object-cover"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <div className="w-full text-center text-[11px] font-semibold leading-tight">
                        {lang === "pt" ? a.namePt : a.nameEn}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  size="lg"
                  disabled={!canSubmit}
                  onClick={() => onConfirm({ ...mayor, name: mayor.name.trim() })}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {t(lang, "takeOffice")}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonaTile({
  lang,
  preset,
  custom,
  active,
  onClick,
  played,
}: {
  lang: Lang;
  preset?: PoliticianPreset;
  custom?: boolean;
  active: boolean;
  onClick: () => void;
  played?: boolean;
}) {
  const ideologyLabel = (v: number) =>
    v < -0.2
      ? t(lang, "personaIdeologyLeft")
      : v > 0.2
        ? t(lang, "personaIdeologyRight")
        : t(lang, "personaIdeologyCenter");
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-xl border p-3 text-left transition-all",
        active
          ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_0_2px_rgba(34,211,238,0.25)]"
          : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10",
      )}
    >
      {custom || !preset ? (
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-dashed border-white/20 bg-slate-800/60">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
      ) : (
        <div className="relative">
          <MayorAvatarPortrait personaId={preset.id} size={72} className="rounded-full" />
          {played && (
            <span className="absolute -right-1 -top-1 rounded-full bg-fuchsia-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow">
              {lang === "pt" ? "Jogado" : "Played"}
            </span>
          )}
        </div>
      )}
      <div className="w-full text-center">
        <div className="truncate text-sm font-semibold">
          {custom || !preset ? t(lang, "personaCustom") : preset.name}
        </div>
        <div
          className={cn(
            "mt-0.5 text-[11px] leading-snug text-muted-foreground",
            active ? "" : "line-clamp-2",
          )}
          title={custom || !preset ? undefined : preset.bio[lang]}
        >
          {custom || !preset ? t(lang, "personaCustomDesc") : preset.bio[lang]}
        </div>
        {preset && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                preset.ideology < -0.2
                  ? "bg-rose-400"
                  : preset.ideology > 0.2
                    ? "bg-sky-400"
                    : "bg-amber-400",
              )}
            />
            {ideologyLabel(preset.ideology)}
          </div>
        )}
      </div>
    </button>
  );
}

function HallCard({ entry, lang }: { entry: HallEntry; lang: Lang }) {
  const icon =
    entry.endReason === "victory" ? <Trophy className="h-3.5 w-3.5 text-amber-300" /> :
    entry.endReason === "impeached" ? <Gavel className="h-3.5 w-3.5 text-rose-400" /> :
    <X className="h-3.5 w-3.5 text-slate-400" />;
  const label =
    entry.endReason === "victory" ? (lang === "pt" ? "2 mandatos" : "2 terms") :
    entry.endReason === "impeached" ? (lang === "pt" ? "Impeachment" : "Impeached") :
    (lang === "pt" ? "Derrotado" : "Defeated");
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
        {icon}
        <span className="truncate">{entry.name}</span>
      </div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{entry.cityName}</div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(entry.monthsInOffice / 12)}a·{Math.round(entry.finalApproval)}%</span>
      </div>
    </div>
  );
}
