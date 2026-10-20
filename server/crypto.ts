/**
 * O site já envia a senha derivada (PBKDF2 com 200 mil iterações feito no
 * aparelho da pessoa — veja src/auth/passwordHash.ts). Aqui ela recebe mais
 * uma camada PBKDF2-SHA-256 com sal aleatório antes de ir para o banco.
 * 10 mil iterações cabem no limite de processamento do plano gratuito.
 */
export const PASSWORD_ITERATIONS = 10_000;

/** Formato da senha derivada enviada pelo site: 32 bytes em base64. */
export function isDerivedPassword(value: string): boolean {
  return /^[A-Za-z0-9+/]{43}=$/.test(value);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

export function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function randomSalt(): string {
  return toBase64(randomBytes(16));
}

/** Token aleatório para o cookie de sessão (base64url, 256 bits). */
export function randomToken(): string {
  return toBase64(randomBytes(32)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toBase64(new Uint8Array(digest));
}

export async function hashPassword(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

/** Comparação em tempo constante. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
