import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import negocioLayer from '../../assets/evolua-logo-negocio.png';
import voluaLayer from '../../assets/evolua-logo-volua.png';
import { CapIcon } from './Logo';

const INTRO_KEY = 'evolua-estudos:abertura-exibida';

/** A abertura aparece uma vez por visita (aba do navegador) depois de entrar. */
export function shouldShowIntro(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === null;
  } catch {
    return false;
  }
}

export function markIntroShown(): void {
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    // Sem armazenamento: a abertura pode aparecer de novo, sem problema.
  }
}

/** Ao sair da conta, a próxima entrada mostra a abertura novamente. */
export function resetIntro(): void {
  try {
    sessionStorage.removeItem(INTRO_KEY);
  } catch {
    // nada a limpar
  }
}

const DURATION_MS = 4200;
const REDUCED_DURATION_MS = 1800;
const EXIT_MS = 700;

/**
 * Abertura animada com a logo da Evolua Meu Negócio: as barras do "E" crescem,
 * o nome se revela e o painel Evolua Meus Estudos é apresentado com
 * boas-vindas para a pessoa.
 */
export function WelcomeSplash({ name, onDone }: { name: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  ).current;

  const leave = useCallback(() => setLeaving(true), []);

  useEffect(() => {
    skipRef.current?.focus();
    const timer = window.setTimeout(leave, reducedMotion ? REDUCED_DURATION_MS : DURATION_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        leave();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-modal');
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-modal');
    };
  }, [leave, reducedMotion]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, reducedMotion ? 200 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone, reducedMotion]);

  const layers = {
    '--logo-volua': `url(${voluaLayer})`,
    '--logo-negocio': `url(${negocioLayer})`,
  } as CSSProperties;

  return (
    <div
      className={`splash${leaving ? ' is-leaving' : ''}${reducedMotion ? ' is-reduced' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Boas-vindas ao Evolua Meus Estudos"
      onClick={leave}
      data-testid="welcome-splash"
    >
      <div className="splash__glow" aria-hidden />

      <div className="splash__stage">
        <div className="splash__logo" role="img" aria-label="Evolua Meu Negócio" style={layers}>
          <span className="splash__bar splash__bar--1" />
          <span className="splash__bar splash__bar--2" />
          <span className="splash__bar splash__bar--3" />
          <span className="splash__layer splash__layer--volua" />
          <span className="splash__layer splash__layer--negocio" />
        </div>

        <p className="splash__presents">apresenta</p>

        <div className="splash__product">
          <span className="splash__cap">
            <CapIcon size={34} />
          </span>
          <span className="splash__product-name">Evolua Meus Estudos</span>
        </div>

        <p className="splash__welcome">Que bom ter você aqui, {name}!</p>
      </div>

      <button
        ref={skipRef}
        type="button"
        className="splash__skip"
        onClick={(event) => {
          event.stopPropagation();
          leave();
        }}
        aria-label="Pular abertura"
      >
        Pular
      </button>
    </div>
  );
}
