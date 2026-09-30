/**
 * GameIcon — wrapper for Lucide icons used in secondary panels.
 *
 * Applies the "Canetada" stroke weight (2.5) and a consistent color so
 * lucide-react icons don't look like generic dashboard clipart next to the
 * chunky sprite/icon art. Prefer the bespoke icons in `./canetada` for
 * high-traffic UI; use GameIcon for the long tail of secondary panels.
 */
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  /** Stroke weight override — defaults to 2.5 to match sprite outlines. */
  weight?: number;
};

export function GameIcon({ icon: Icon, weight = 2.5, className, ...rest }: Props) {
  return (
    <Icon
      strokeWidth={weight}
      className={cn("shrink-0 [&>*]:stroke-linecap-round [&>*]:stroke-linejoin-round", className)}
      {...rest}
    />
  );
}
