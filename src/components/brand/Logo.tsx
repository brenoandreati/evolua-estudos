/**
 * Identidade visual: capelo de formatura e barras crescentes em azul,
 * redesenhados em SVG a partir dos materiais da marca.
 */

export function CapIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={(size * 672) / 792}
      viewBox="-12 0 792 672"
      fill="currentColor"
      aria-hidden
    >
      {/* Tampo do capelo */}
      <path
        d="M383 14 L748 172 Q766 185 748 198 L383 352 L20 198 Q2 185 20 172 Z"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinejoin="round"
      />
      {/* Base */}
      <path
        d="M190 342 L383 412 L578 342 Q596 336 602 354 L620 428 Q624 446 606 454 L392 546 Q383 550 374 546 L162 454 Q144 446 148 428 L166 354 Q172 336 190 342 Z"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      {/* Cordão e borla */}
      <rect x="670" y="200" width="48" height="340" />
      <path d="M623 576 Q623 527 672 527 L718 527 Q767 527 767 576 L767 672 L623 672 Z" />
    </svg>
  );
}

/** Três barras crescentes — símbolo de evolução. */
export function BarsMark({ width = 32, className }: { width?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={width}
      height={(width * 348) / 337}
      viewBox="0 0 337 348"
      fill="currentColor"
      aria-hidden
    >
      <rect className="bars-mark__bar" x="0" y="0" width="221" height="65" />
      <rect className="bars-mark__bar" x="0" y="141" width="283" height="65" />
      <rect className="bars-mark__bar" x="0" y="283" width="337" height="65" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <span className="logo__mark">
        <CapIcon size={26} />
      </span>
      {!compact && (
        <span className="logo__text">
          <span className="logo__name">Evolua Meus Estudos</span>
          <span className="logo__tagline">Seu curso em um só lugar</span>
        </span>
      )}
    </span>
  );
}

/** Assinatura da marca-mãe: barras crescentes + "Evolua Meu Negócio". */
export function EvoluaNegocioLogo({ tone = 'brand' }: { tone?: 'brand' | 'light' }) {
  return (
    <span className={`evolua-negocio evolua-negocio--${tone}`}>
      <span className="evolua-negocio__label">Uma iniciativa</span>
      <span className="evolua-negocio__lockup">
        <BarsMark width={28} className="evolua-negocio__mark" />
        <span className="evolua-negocio__name">
          <strong>Evolua</strong> Meu Negócio
        </span>
      </span>
    </span>
  );
}
