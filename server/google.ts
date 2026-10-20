import { HttpError } from './http';

/**
 * Confere a credencial (token JWT) devolvida pelo botão "Continuar com o Google":
 * assinatura RSA com as chaves públicas do Google, destinatário (Client ID),
 * emissor, validade e e-mail verificado.
 */

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  givenName: string;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cachedKeys: { keys: Jwk[]; expiresAt: number } | null = null;

async function googleKeys(fetcher: typeof fetch): Promise<Jwk[]> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  const response = await fetcher(CERTS_URL);
  if (!response.ok) throw new HttpError(502, 'Não foi possível confirmar o login com o Google. Tente novamente.');
  const body = (await response.json()) as { keys?: Jwk[] };
  cachedKeys = { keys: body.keys ?? [], expiresAt: Date.now() + 60 * 60_000 };
  return cachedKeys.keys;
}

function base64UrlToBytes(part: string): Uint8Array {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function decodeJson(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part))) as Record<string, unknown>;
}

export async function verifyGoogleCredential(
  credential: string,
  clientId: string,
  options: { keys?: Jwk[]; fetcher?: typeof fetch; now?: number } = {},
): Promise<GoogleProfile> {
  const invalid = new HttpError(401, 'Não foi possível entrar com o Google. Tente novamente.');
  const parts = credential.split('.');
  if (parts.length !== 3 || !clientId) throw invalid;

  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = decodeJson(parts[0]);
    claims = decodeJson(parts[1]);
  } catch {
    throw invalid;
  }
  if (header.alg !== 'RS256') throw invalid;

  const keys = options.keys ?? (await googleKeys(options.fetcher ?? fetch));
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw invalid;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'verify',
  ]);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw invalid;

  const now = options.now ?? Date.now();
  if (claims.aud !== clientId) throw invalid;
  if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') throw invalid;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) {
    throw new HttpError(401, 'O login com o Google expirou. Tente novamente.');
  }
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') throw invalid;
  if (claims.email_verified !== true) {
    throw new HttpError(401, 'Sua conta Google precisa ter o e-mail verificado.');
  }

  const name = typeof claims.name === 'string' ? claims.name : '';
  const givenName = typeof claims.given_name === 'string' ? claims.given_name : (name.split(' ')[0] ?? '');
  return { sub: claims.sub, email: claims.email, name, givenName };
}
