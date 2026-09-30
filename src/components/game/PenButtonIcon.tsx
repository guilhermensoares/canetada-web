/**
 * Ícone "Canetada" no estilo dos sprites: caneta rechonchuda vista em diagonal,
 * contorno grosso escuro, corpo em bloco com anel âmbar e ponta prateada.
 * Usa currentColor apenas no traço de assinatura para herdar cor do botão.
 */
export const PenButtonIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    shapeRendering="geometricPrecision"
  >
    {/* Corpo da caneta (bloco chunky, diagonal) */}
    <g stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      {/* Tampa/topo */}
      <path d="M23 3 L29 9 L26 12 L20 6 Z" fill="#0F172A" />
      {/* Corpo principal */}
      <path d="M20 6 L26 12 L14 24 L8 18 Z" fill="#F8FAFC" />
      {/* Faixa/anel âmbar */}
      <path d="M17 9 L23 15 L20.5 17.5 L14.5 11.5 Z" fill="#F59E0B" />
      {/* Ponta prateada */}
      <path d="M14 24 L8 18 L6 26 Z" fill="#CBD5E1" />
      {/* Bico escuro */}
      <path d="M8 24 L6 26 L9 25 Z" fill="#0F172A" />
    </g>
    {/* Traço de assinatura (herda cor) */}
    <path
      d="M4 29 C 8 27, 12 30, 17 28 C 21 26.5, 25 29, 29 28"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      opacity="0.85"
    />
  </svg>
);
