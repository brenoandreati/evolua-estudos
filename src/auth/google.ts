import { AuthError } from './types';

/**
 * Login com Google (Google Identity Services).
 *
 * Só fica ativo quando o site tem um Client ID do Google configurado em
 * `VITE_GOOGLE_CLIENT_ID` (veja o README). Sem ele, o botão não aparece.
 */
export const GOOGLE_CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

export function isGoogleEnabled(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  givenName: string;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill';
      logo_alignment?: 'left' | 'center';
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

let scriptPromise: Promise<GoogleIdApi> | null = null;

/** Carrega o script oficial do Google uma única vez. */
export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  scriptPromise ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const api = window.google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error('Não foi possível iniciar o login do Google.'));
    };
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error('Não foi possível carregar o login do Google. Verifique sua conexão.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function decodeBase64Url(part: string): string {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Lê a credencial (token JWT) devolvida pelo Google e confere para quem ela
 * foi emitida, quem emitiu, a validade e o e-mail verificado.
 *
 * Observação: a assinatura do token só pode ser verificada com segurança em
 * um servidor. Ao migrar para contas em servidor, valide o token lá.
 */
export function parseGoogleCredential(
  credential: string,
  clientId: string = GOOGLE_CLIENT_ID,
  now: number = Date.now(),
): GoogleProfile {
  const invalid = new AuthError('Não foi possível entrar com o Google. Tente novamente.');
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(decodeBase64Url(credential.split('.')[1] ?? ''));
  } catch {
    throw invalid;
  }
  if (!clientId || claims.aud !== clientId) throw invalid;
  if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') throw invalid;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) {
    throw new AuthError('O login com o Google expirou. Tente novamente.');
  }
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') throw invalid;
  if (claims.email_verified !== true) {
    throw new AuthError('Sua conta Google precisa ter o e-mail verificado.');
  }
  const name = typeof claims.name === 'string' ? claims.name : '';
  const givenName = typeof claims.given_name === 'string' ? claims.given_name : name.split(' ')[0] ?? '';
  return { sub: claims.sub, email: claims.email, name, givenName };
}
