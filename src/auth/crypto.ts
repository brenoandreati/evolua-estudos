/**
 * Hash da senha com PBKDF2-SHA-256 e sal aleatório, via
 * Web Crypto. Nada sensível é guardado em texto puro.
 */

export class InsecureContextError extends Error {
  constructor() {
    super('Abra o painel por um endereço seguro (https) para criar ou acessar a conta.');
    this.name = 'InsecureContextError';
  }
}

function subtle(): SubtleCrypto {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new InsecureContextError();
  return api;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

export function randomSalt(size = 16): string {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

export async function deriveHash(secret: string, salt: string, iterations: number): Promise<string> {
  const api = subtle();
  const key = await api.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await api.deriveBits(
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
