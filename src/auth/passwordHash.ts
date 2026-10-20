import { normalizeEmail } from './validation';

/**
 * A parte pesada da proteção da senha roda no aparelho da pessoa: a senha
 * nunca sai daqui em texto puro. O servidor recebe esta "senha derivada" e
 * aplica mais uma camada (com sal aleatório) antes de guardar.
 *
 * Assim o servidor cabe no limite de processamento do plano gratuito da
 * Cloudflare, e quem tentasse adivinhar senhas a partir do banco ainda teria
 * que repetir todo esse trabalho para cada tentativa.
 */
const CLIENT_ITERATIONS = 200_000;
const SALT_PREFIX = 'evolua-meus-estudos:senha:';

export async function derivePassword(email: string, password: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Abra o site por um endereço seguro (https) para entrar.');
  const encoder = new TextEncoder();
  const key = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(SALT_PREFIX + normalizeEmail(email)), iterations: CLIENT_ITERATIONS },
    key,
    256,
  );
  let binary = '';
  new Uint8Array(bits).forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
