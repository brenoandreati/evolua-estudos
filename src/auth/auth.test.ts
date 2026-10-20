import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, adoptLegacyData, storageKeyFor } from '../data/localStorageRepository';
import { parseGoogleCredential } from './google';
import { ACCOUNTS_KEY, LocalAuthService, SESSION_KEY } from './localAuthService';
import { AuthError } from './types';

const PASSWORD = 'estudos2026';
const CLIENT_ID = 'teste.apps.googleusercontent.com';

/** Monta uma credencial no formato do Google (o painel lê as informações, não a assinatura). */
function googleCredential(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const payload = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '1234567890',
    email: 'ana@gmail.com',
    email_verified: true,
    name: 'Ana Souza',
    given_name: 'Ana',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.assinatura`;
}

const service = () => new LocalAuthService({ googleClientId: CLIENT_ID });

describe('cadastro e entrada com e-mail e senha', () => {
  it('cadastra com nome de usuário, mantém a sessão e não guarda a senha em texto puro', async () => {
    const user = await service().register(
      { name: ' Ana ', email: ' Ana@Email.com ', password: PASSWORD },
      { remember: true },
    );
    expect(user).toMatchObject({ name: 'Ana', email: 'ana@email.com', provider: 'password' });
    expect(await service().currentUser()).toEqual(user);
    expect(localStorage.getItem(ACCOUNTS_KEY)).not.toContain(PASSWORD);
  });

  it('exige nome de usuário, e-mail válido e senha forte', async () => {
    const auth = service();
    await expect(auth.register({ name: '', email: 'ana@email.com', password: PASSWORD }, { remember: true })).rejects.toMatchObject({ field: 'name' });
    await expect(auth.register({ name: 'Ana', email: 'ana@', password: PASSWORD }, { remember: true })).rejects.toMatchObject({ field: 'email' });
    await expect(auth.register({ name: 'Ana', email: 'ana@email.com', password: 'curta' }, { remember: true })).rejects.toMatchObject({ field: 'password' });
    await expect(auth.register({ name: 'Ana', email: 'ana@email.com', password: 'somenteletras' }, { remember: true })).rejects.toBeInstanceOf(AuthError);
  });

  it('entra com e-mail e senha e recusa senha errada', async () => {
    const auth = service();
    await auth.register({ name: 'Ana', email: 'ana@email.com', password: PASSWORD }, { remember: true });
    await auth.logout();
    expect(await auth.currentUser()).toBeNull();

    await expect(auth.login('ana@email.com', 'outraSenha1', { remember: true })).rejects.toThrow('E-mail ou senha incorretos.');
    await expect(auth.login('bia@email.com', PASSWORD, { remember: true })).rejects.toThrow('E-mail ou senha incorretos.');
    expect((await auth.login('ANA@email.com', PASSWORD, { remember: true })).name).toBe('Ana');
  });

  it('impede e-mail repetido', async () => {
    const auth = service();
    await auth.register({ name: 'Ana', email: 'ana@email.com', password: PASSWORD }, { remember: true });
    await expect(
      auth.register({ name: 'Outra', email: 'ana@email.com', password: PASSWORD }, { remember: true }),
    ).rejects.toMatchObject({ field: 'email' });
  });

  it('"manter conectado" desligado usa a sessão temporária', async () => {
    await service().register({ name: 'Ana', email: 'ana@email.com', password: PASSWORD }, { remember: false });
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('altera o nome de usuário', async () => {
    const auth = service();
    const user = await auth.register({ name: 'Ana', email: 'ana@email.com', password: PASSWORD }, { remember: true });
    expect((await auth.updateProfile(user.id, { name: 'Aninha' })).name).toBe('Aninha');
    await expect(auth.updateProfile(user.id, { name: '  ' })).rejects.toMatchObject({ field: 'name' });
  });
});

describe('conta Google', () => {
  it('cria a conta com o primeiro nome do Google e entra de novo na mesma conta', async () => {
    const auth = service();
    const first = await auth.signInWithGoogle(googleCredential({}), { remember: true });
    expect(first).toMatchObject({ name: 'Ana', email: 'ana@gmail.com', provider: 'google' });
    await auth.logout();
    const again = await auth.signInWithGoogle(googleCredential({}), { remember: true });
    expect(again.id).toBe(first.id);
  });

  it('conta criada pelo Google não entra com senha', async () => {
    const auth = service();
    await auth.signInWithGoogle(googleCredential({}), { remember: true });
    await auth.logout();
    await expect(auth.login('ana@gmail.com', PASSWORD, { remember: true })).rejects.toThrow('criada com o Google');
  });

  it('vincula ao cadastro feito antes com o mesmo e-mail', async () => {
    const auth = service();
    const byEmail = await auth.register({ name: 'Ana', email: 'ana@gmail.com', password: PASSWORD }, { remember: true });
    await auth.logout();
    const byGoogle = await auth.signInWithGoogle(googleCredential({}), { remember: true });
    expect(byGoogle.id).toBe(byEmail.id);
    // A senha continua funcionando.
    await auth.logout();
    expect((await auth.login('ana@gmail.com', PASSWORD, { remember: true })).id).toBe(byEmail.id);
  });

  it('recusa credenciais de outro site, expiradas ou sem e-mail verificado', () => {
    expect(() => parseGoogleCredential(googleCredential({ aud: 'outro-site' }), CLIENT_ID)).toThrow(AuthError);
    expect(() => parseGoogleCredential(googleCredential({ iss: 'https://falso.com' }), CLIENT_ID)).toThrow(AuthError);
    expect(() => parseGoogleCredential(googleCredential({ exp: 1 }), CLIENT_ID)).toThrow('expirou');
    expect(() => parseGoogleCredential(googleCredential({ email_verified: false }), CLIENT_ID)).toThrow('verificado');
    expect(() => parseGoogleCredential('lixo', CLIENT_ID)).toThrow(AuthError);
    expect(() => parseGoogleCredential(googleCredential({}), '')).toThrow(AuthError);
  });

  it('lê nomes com acento', () => {
    expect(parseGoogleCredential(googleCredential({ given_name: 'João', name: 'João Antônio' }), CLIENT_ID)).toMatchObject({
      givenName: 'João',
      name: 'João Antônio',
    });
  });
});

describe('dados de quem já usava o painel', () => {
  it('a primeira conta herda os dados salvos antes do login; as demais começam do zero', async () => {
    localStorage.setItem(STORAGE_KEY, '{"dados":"antigos"}');
    const auth = new LocalAuthService({ onFirstAccount: adoptLegacyData, googleClientId: CLIENT_ID });
    const first = await auth.register({ name: 'Ana', email: 'ana@email.com', password: PASSWORD }, { remember: true });
    expect(localStorage.getItem(storageKeyFor(first.id))).toBe('{"dados":"antigos"}');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    const second = await auth.register({ name: 'Bia', email: 'bia@email.com', password: PASSWORD }, { remember: true });
    expect(localStorage.getItem(storageKeyFor(second.id))).toBeNull();
  });
});
