// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { verifyGoogleCredential } from './google';
import { HttpError } from './http';

const CLIENT_ID = 'teste.apps.googleusercontent.com';
let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid: string };

const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encode = (value: object) => b64url(new TextEncoder().encode(JSON.stringify(value)));

/** Monta uma credencial assinada como as do Google, com uma chave gerada no teste. */
async function credential(claims: Record<string, unknown> = {}, key = privateKey, kid = 'chave-1'): Promise<string> {
  const header = encode({ alg: 'RS256', kid, typ: 'JWT' });
  const payload = encode({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '1234567890',
    email: 'ana@gmail.com',
    email_verified: true,
    name: 'Ana Souza',
    given_name: 'Ana',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(signature))}`;
}

const algorithm = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])) as CryptoKeyPair;
  privateKey = pair.privateKey;
  publicJwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'chave-1' };
});

const verify = (token: string) => verifyGoogleCredential(token, CLIENT_ID, { keys: [publicJwk] });

describe('verifyGoogleCredential', () => {
  it('aceita uma credencial válida e lê nome e e-mail (com acentos)', async () => {
    expect(await verify(await credential({ given_name: 'João', name: 'João Antônio' }))).toEqual({
      sub: '1234567890',
      email: 'ana@gmail.com',
      name: 'João Antônio',
      givenName: 'João',
    });
  });

  it('recusa assinatura de outra chave', async () => {
    const other = (await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])) as CryptoKeyPair;
    await expect(verify(await credential({}, other.privateKey))).rejects.toBeInstanceOf(HttpError);
  });

  it('recusa conteúdo alterado depois da assinatura', async () => {
    const [header, , signature] = (await credential()).split('.');
    const forged = `${header}.${encode({ aud: CLIENT_ID, email: 'invasor@gmail.com' })}.${signature}`;
    await expect(verify(forged)).rejects.toBeInstanceOf(HttpError);
  });

  it('recusa credencial de outro site, expirada ou sem e-mail verificado', async () => {
    await expect(verify(await credential({ aud: 'outro-site' }))).rejects.toThrow('Não foi possível entrar');
    await expect(verify(await credential({ iss: 'https://falso.com' }))).rejects.toThrow('Não foi possível entrar');
    await expect(verify(await credential({ exp: 1 }))).rejects.toThrow('expirou');
    await expect(verify(await credential({ email_verified: false }))).rejects.toThrow('verificado');
    await expect(verify(await credential({}, privateKey, 'chave-desconhecida'))).rejects.toBeInstanceOf(HttpError);
    await expect(verify('lixo')).rejects.toBeInstanceOf(HttpError);
  });
});
