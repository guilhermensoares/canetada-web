type Props = {
  className?: string;
};

/**
 * Logo Canetada — chancela de gabinete oficial.
 * Texto serifado imponente em creme, dupla linha dourada com selo central.
 * Sem caneta cartoon, sem faixa amarela curvada, sem subtítulo institucional.
 */
export const CanetadaLogo = ({ className = "w-full max-w-md h-auto" }: Props) => (
  <svg
    viewBox="0 0 520 130"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Canetada"
  >
    <defs>
      <filter id="canetada-shadow" x="-5%" y="-20%" width="110%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
        <feOffset dx="0" dy="2" result="off" />
        <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* CANETADA — serifa imponente, caixa alta, creme com sombra sutil */}
    <text
      x="260"
      y="72"
      textAnchor="middle"
      fill="#F1EFEA"
      fontSize="62"
      fontWeight="900"
      fontFamily="'Playfair Display', 'Cinzel', 'Times New Roman', serif"
      letterSpacing="6"
      filter="url(#canetada-shadow)"
    >
      CANETADA
    </text>

    {/* Linha dupla dourada com selo central */}
    <g stroke="#C5A059" strokeLinecap="square">
      <line x1="60" y1="94" x2="240" y2="94" strokeWidth="1.2" />
      <line x1="60" y1="98" x2="240" y2="98" strokeWidth="0.6" opacity="0.7" />
      <line x1="280" y1="94" x2="460" y2="94" strokeWidth="1.2" />
      <line x1="280" y1="98" x2="460" y2="98" strokeWidth="0.6" opacity="0.7" />
    </g>

    {/* Selo central — losango com estrela */}
    <g transform="translate(260 96)">
      <rect
        x="-14"
        y="-14"
        width="28"
        height="28"
        transform="rotate(45)"
        fill="none"
        stroke="#C5A059"
        strokeWidth="1.2"
      />
      <path
        d="M0 -7 L1.8 -2.2 L7 -2.2 L2.8 0.9 L4.4 6 L0 3 L-4.4 6 L-2.8 0.9 L-7 -2.2 L-1.8 -2.2 Z"
        fill="#C5A059"
      />
    </g>
  </svg>
);
