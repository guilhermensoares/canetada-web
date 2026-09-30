import { WarningIcon } from "@/components/icons/canetada";
import { cn } from "@/lib/utils";
import type { Lang } from "@/game/types";
import { t } from "@/game/i18n";

interface Props {
  lang: Lang;
  variant?: "compact" | "banner";
  className?: string;
}

export function FictionDisclaimer({ lang, variant = "banner", className }: Props) {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 text-[11px] text-muted-foreground",
          className,
        )}
      >
        <WarningIcon className="h-3.5 w-3.5 shrink-0 text-stamp" />
        <span>{t(lang, "fictionDisclaimerShort")}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-stamp/30 bg-stamp/10 p-3 text-sm",
        "ink-border-sm",
        className,
      )}
    >
      <WarningIcon className="mt-0.5 h-5 w-5 shrink-0 text-stamp" />
      <div>
        <div className="font-semibold text-foreground">{t(lang, "fictionDisclaimerTitle")}</div>
        <div className="mt-0.5 leading-snug text-muted-foreground">
          {t(lang, "fictionDisclaimerBody")}
        </div>
      </div>
    </div>
  );
}
