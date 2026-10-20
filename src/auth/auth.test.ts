import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, adoptLegacyData, storageKeyFor } from '../data/localStorageRepository';
import { formatCpf, isValidCpf, maskCpf } from './cpf';
import { ACCOUNTS_KEY, LocalAuthService, SESSION_KEY } from './localAuthService';
import { AuthError } from './types';

const CPF_A = '529.982.247-25';
const CPF_B = '111.444.777-35';
const PASSWORD = 'estudos2026';

describe('CPF', () => {
  it('valida pelos dígitos verificadores', () => {
    expect(isValidCpf(CPF_A)).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf(CPF_B)).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('formata e oculta', () => {
    expect(formatCpf('5299822')).toBe('529.982.2');
    expect(formatCpf('52998224725999')).toBe('529.982.247-25');
    expect(maskCpf(CPF_A)).toBe('***.982.247-**');
  });
});

describe('LocalAuthService', () => {
  const service = () => new LocalAuthService();

  it('cadastra, mantém a sessão e não guarda senha nem CPF em texto puro', async () => {
    const auth = service();
    const user = await auth.register(
      { name: 'Ana Souza', email: ' Ana@Email.com ', cpf: CPF_A, password: PASSWORD },
      { remember: true },
    );
    expect(user).toMatchObject({ name: 'Ana Souza', email: 'ana@email.com', cpfMasked: '***.982.247-**' });
    expect(await service().currentUser()).toEqual(user);

    const stored = localStorage.getItem(ACCOUNTS_KEY)!;
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('52998224725');
    expect(stored).not.toContain(CPF_A);
  });

  it('entra com e-mail ou CPF e recusa senha errada', async () => {
    const auth = service();
    await auth.register({ name: '', email: 'ana@email.com', cpf: CPF_A, password: PASSWORD }, { remember: true });
    await auth.logout();
    expect(await auth.currentUser()).toBeNull();

    await expect(auth.login('ana@email.com', 'outraSenha1', { remember: true })).rejects.toThrow(
      'E-mail/CPF ou senha incorretos.',
    );
    expect((await auth.login('ANA@email.com', PASSWORD, { remember: true })).email).toBe('ana@email.com');
    await auth.logout();
    expect((await auth.login('52998224725', PASSWORD, { remember: false })).email).toBe('ana@email.com');
  });

  it('"manter conectado" desligado usa a sessão temporária', async () => {
    const auth = service();
    await auth.register({ name: '', email: 'ana@email.com', cpf: CPF_A, password: PASSWORD }, { remember: false });
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    sessionStorage.clear();
  });

  it('impede e-mail ou CPF repetidos e valida os campos', async () => {
    const auth = service();
    await auth.register({ name: '', email: 'ana@email.com', cpf: CPF_A, password: PASSWORD }, { remember: true });
    await expect(
      auth.register({ name: '', email: 'ana@email.com', cpf: CPF_B, password: PASSWORD }, { remember: true }),
    ).rejects.toMatchObject({ field: 'email' });
    await expect(
      auth.register({ name: '', email: 'bia@email.com', cpf: CPF_A, password: PASSWORD }, { remember: true }),
    ).rejects.toMatchObject({ field: 'cpf' });
    await expect(
      auth.register({ name: '', email: 'bia@email.com', cpf: '123.456.789-00', password: PASSWORD }, { remember: true }),
    ).rejects.toMatchObject({ field: 'cpf' });
    await expect(
      auth.register({ name: '', email: 'bia@email.com', cpf: CPF_B, password: 'curta' }, { remember: true }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('redefine a senha conferindo e-mail e CPF', async () => {
    const auth = service();
    await auth.register({ name: '', email: 'ana@email.com', cpf: CPF_A, password: PASSWORD }, { remember: true });
    await expect(
      auth.resetPassword({ email: 'ana@email.com', cpf: CPF_B, password: 'novaSenha9' }),
    ).rejects.toThrow('Não encontramos uma conta');
    await auth.resetPassword({ email: 'ana@email.com', cpf: CPF_A, password: 'novaSenha9' });
    await auth.logout();
    await expect(auth.login('ana@email.com', PASSWORD, { remember: true })).rejects.toThrow();
    expect((await auth.login('ana@email.com', 'novaSenha9', { remember: true })).email).toBe('ana@email.com');
  });

  it('a primeira conta herda os dados salvos antes do login; as demais começam do zero', async () => {
    localStorage.setItem(STORAGE_KEY, '{"dados":"antigos"}');
    const auth = new LocalAuthService({ onFirstAccount: adoptLegacyData });
    const first = await auth.register({ name: '', email: 'ana@email.com', cpf: CPF_A, password: PASSWORD }, { remember: true });
    expect(localStorage.getItem(storageKeyFor(first.id))).toBe('{"dados":"antigos"}');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    const second = await auth.register({ name: '', email: 'bia@email.com', cpf: CPF_B, password: PASSWORD }, { remember: true });
    expect(localStorage.getItem(storageKeyFor(second.id))).toBeNull();
  });
});
