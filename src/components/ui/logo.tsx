/**
 * Logo oficial do MontaJE (SVG embutido).
 * Símbolo: urna com cédula inserida e selo de "concluído".
 * Versão clara: corpo branco com detalhes no gradiente da marca —
 * legível sobre os tiles índigo do rail e do login.
 * ViewBox já cortado rente ao desenho (sem margens mortas).
 * Tamanho controlado via className (ex.: size-6, size-7, size-8).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="136 176 292 264"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="montaje-glyph-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7B83EB" />
          <stop offset="55%" stopColor="#5B5FC7" />
          <stop offset="100%" stopColor="#464EB8" />
        </linearGradient>
      </defs>

      {/* Pés da urna */}
      <rect x="171" y="404" width="26" height="16" rx="8" fill="#FFFFFF" />
      <rect x="315" y="404" width="26" height="16" rx="8" fill="#FFFFFF" />

      {/* Corpo da urna */}
      <rect x="156" y="300" width="200" height="110" rx="22" fill="#FFFFFF" />

      {/* Fenda da cédula */}
      <rect x="191" y="288" width="130" height="22" rx="11" fill="url(#montaje-glyph-grad)" />

      {/* Cédula inserida */}
      <g transform="rotate(-14 268 246)">
        <rect x="233" y="196" width="70" height="96" rx="10" fill="#FFFFFF" />
        <line x1="248" y1="220" x2="288" y2="220" stroke="url(#montaje-glyph-grad)" strokeWidth="6" strokeLinecap="round" />
        <line x1="248" y1="238" x2="278" y2="238" stroke="url(#montaje-glyph-grad)" strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* Selo de atividade concluída */}
      <circle cx="358" cy="404" r="50" fill="#FFFFFF" stroke="url(#montaje-glyph-grad)" strokeWidth="6" />
      <path d="M336 404 L352 420 L382 386" fill="none" stroke="url(#montaje-glyph-grad)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}