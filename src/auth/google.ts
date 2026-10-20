import { api } from '../api/client';

/**
 * Login com Google (Google Identity Services).
 *
 * O botão só aparece quando o servidor tem um Client ID do Google configurado
 * (variável GOOGLE_CLIENT_ID na Cloudflare — veja o README). A credencial
 * devolvida pelo Google é conferida pelo servidor.
 */

let clientIdPromise: Promise<string | null> | null = null;

export function getGoogleClientId(): Promise<string | null> {
  clientIdPromise ??= api<{ googleClientId: string | null }>('/api/config')
    .then((config) => config.googleClientId)
    .catch(() => {
      clientIdPromise = null;
      return null;
    });
  return clientIdPromise;
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
