/**
 * Canetada icon set — inline SVG icons drawn in the same visual language as
 * the character sprites and the CANETADA! stamp: thick #0F172A outlines,
 * flat amber / cream / silver fills, no gradients, geometric silhouettes.
 *
 * Every icon renders at 24×24. Pass `className` to size/tint the outer <svg>
 * (stroke stays hard-coded so contrast never drifts against panel bg).
 */
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { title?: string };

const INK = "#0F172A";
const AMBER = "#F59E0B";
const CREAM = "#F8F5EC";
const SILVER = "#CBD5E1";
const STAMP = "#DC2626";

function Base({
  children,
  className = "w-5 h-5",
  title,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke={INK}
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      shapeRendering="geometricPrecision"
      role={title ? "img" : "presentation"}
      aria-label={title}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CoinIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" fill={AMBER} />
    <path d="M12 7v10 M9 9.5c1-1 5-1 6 0 M9 14.5c1 1 5 1 6 0" />
  </Base>
);

export const ChartIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="1.5" fill={CREAM} />
    <path d="M6 16l4-4 3 3 5-6" stroke={STAMP} />
    <circle cx="18" cy="9" r="1.2" fill={STAMP} stroke="none" />
  </Base>
);

export const PeopleIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="3" fill={AMBER} />
    <circle cx="16" cy="9" r="2.5" fill={CREAM} />
    <path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" fill={AMBER} />
    <path d="M13 20c.3-2.5 2-4 3.5-4s3.2 1.5 3.5 4" fill={CREAM} />
  </Base>
);

export const BuildingIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 21V7l7-3 7 3v14" fill={CREAM} />
    <rect x="7" y="10" width="2.5" height="2.5" fill={INK} stroke="none" />
    <rect x="12.5" y="10" width="2.5" height="2.5" fill={INK} stroke="none" />
    <rect x="7" y="15" width="2.5" height="2.5" fill={INK} stroke="none" />
    <rect x="12.5" y="15" width="2.5" height="2.5" fill={AMBER} stroke="none" />
  </Base>
);

export const BusIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="10" rx="1.5" fill={AMBER} />
    <rect x="5" y="8" width="4" height="3" fill={CREAM} stroke="none" />
    <rect x="10" y="8" width="4" height="3" fill={CREAM} stroke="none" />
    <rect x="15" y="8" width="4" height="3" fill={CREAM} stroke="none" />
    <circle cx="7" cy="18" r="1.8" fill={INK} />
    <circle cx="17" cy="18" r="1.8" fill={INK} />
  </Base>
);

export const RainIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 12a4 4 0 010-8 5 5 0 0110-1 4 4 0 011 7.9" fill={CREAM} />
    <path d="M8 16l-1 3 M12 16l-1 3 M16 16l-1 3" stroke={STAMP} />
  </Base>
);

export const TrashIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6h16 M9 6V4h6v2" />
    <path d="M6 6l1 14h10l1-14" fill={CREAM} />
    <path d="M10 10v6 M14 10v6" />
  </Base>
);

export const SchoolIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l10 4-10 4-10-4z" fill={AMBER} />
    <path d="M6 9v5c0 2 3 3 6 3s6-1 6-3V9" fill={CREAM} />
    <path d="M22 7v6" />
  </Base>
);

export const HealthIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="14" rx="1.5" fill={CREAM} />
    <path d="M12 10v6 M9 13h6" stroke={STAMP} strokeWidth={2.5} />
    <path d="M8 6V4h8v2" />
  </Base>
);

export const PoliceIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6z" fill={AMBER} />
    <path d="M9 12l2 2 4-4" stroke={INK} strokeWidth={2.5} />
  </Base>
);

export const VoteIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="10" width="18" height="10" rx="1.5" fill={CREAM} />
    <path d="M8 10V6l4-3 4 3v4" fill={AMBER} />
    <path d="M12 13v4" />
  </Base>
);

export const NewsIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" fill={CREAM} />
    <path d="M6 8h9 M6 12h12 M6 16h8" />
    <rect x="15" y="7" width="4" height="4" fill={AMBER} stroke="none" />
  </Base>
);

export const MegaphoneIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 10v4l14 5V5z" fill={AMBER} />
    <path d="M18 8l3-1v10l-3-1" fill={CREAM} />
    <path d="M8 15v3a2 2 0 004 0" />
  </Base>
);

export const WarningIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l10 17H2z" fill={STAMP} />
    <path d="M12 10v5 M12 17.5v.1" stroke={CREAM} strokeWidth={2.5} />
  </Base>
);

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" fill={AMBER} />
    <path d="M7 12l3.5 3.5L17 9" stroke={INK} strokeWidth={2.5} />
  </Base>
);

export const XIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" fill={CREAM} />
    <path d="M8 8l8 8 M16 8l-8 8" stroke={STAMP} strokeWidth={2.5} />
  </Base>
);

export const PlayIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 4l13 8-13 8z" fill={AMBER} />
  </Base>
);

export const PauseIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="6" y="4" width="4.5" height="16" fill={AMBER} />
    <rect x="13.5" y="4" width="4.5" height="16" fill={AMBER} />
  </Base>
);

export const SettingsIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.5" fill={AMBER} />
    <path d="M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.5 4.5l2.1 2.1 M17.4 17.4l2.1 2.1 M4.5 19.5l2.1-2.1 M17.4 6.6l2.1-2.1" />
  </Base>
);

export const TrophyIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 4h8v6a4 4 0 01-8 0z" fill={AMBER} />
    <path d="M8 6H5v2a3 3 0 003 3 M16 6h3v2a3 3 0 01-3 3" />
    <path d="M10 14h4v3l2 3H8l2-3z" fill={SILVER} />
  </Base>
);

export const LandmarkIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 20h18 M3 10l9-6 9 6" fill={CREAM} />
    <path d="M5 10v9 M9 10v9 M15 10v9 M19 10v9" />
    <path d="M3 20h18" strokeWidth={2.5} />
  </Base>
);

export const SparklesIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill={AMBER} />
    <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" fill={CREAM} />
  </Base>
);

export const BookIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z" fill={CREAM} />
    <path d="M12 6v14" />
  </Base>
);

export const LanguagesIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6h10 M8 4v2 M5 12s2-6 3-6 3 6 3 6 M6 10h4" />
    <path d="M14 20l4-10 4 10 M15.5 17h5" stroke={STAMP} />
  </Base>
);

export const HammerIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 2l8 8-3 3-8-8z" fill={SILVER} />
    <path d="M11 5l-8 8 4 4 8-8" fill={AMBER} />
  </Base>
);

export const LockIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="10" width="14" height="11" rx="1.5" fill={AMBER} />
    <path d="M8 10V7a4 4 0 018 0v3" />
  </Base>
);

export const GridIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="8" height="8" fill={AMBER} />
    <rect x="13" y="3" width="8" height="8" fill={CREAM} />
    <rect x="3" y="13" width="8" height="8" fill={CREAM} />
    <rect x="13" y="13" width="8" height="8" fill={AMBER} />
  </Base>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12h14 M13 6l6 6-6 6" strokeWidth={2.5} />
  </Base>
);

export const GaugeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 15a9 9 0 0118 0" fill={CREAM} />
    <path d="M12 15l5-4" stroke={STAMP} strokeWidth={2.5} />
    <circle cx="12" cy="15" r="1.2" fill={INK} stroke="none" />
  </Base>
);

export const ExternalIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 4h6v6 M20 4l-9 9" strokeWidth={2.5} />
    <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" fill={CREAM} />
  </Base>
);
