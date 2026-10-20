// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nextAttempt } from './accounts';
import { PASSWORD_ITERATIONS, hashPassword, isDerivedPassword, randomSalt, randomToken, safeEqual, sha256 } from './crypto';
import { clearSessionCookie, readCookie, sessionCookie } from './http';

describe('senhas', () => {
  it('o mesmo segredo com o mesmo sal gera o mesmo hash; sal diferente, hash diferente', async () => {
    const salt = randomSalt();
    const a = await hashPassword('estudos2026', salt, PASSWORD_ITERATIONS);
    expect(await hashPassword('estudos2026', salt, PASSWORD_ITERATIONS)).toBe(a);
    expect(await hashPassword('estudos2027', salt, PASSWORD_ITERATIONS)).not.toBe(a);
    expect(await hashPassword('estudos2026', randomSalt(), PASSWORD_ITERATIONS)).not.toBe(a);
    expect(a).not.toContain('estudos');
  });

  it('aceita só a senha derivada pelo site (nunca a senha em texto puro)', () => {
    expect(isDerivedPassword(btoa(String.fromCharCode(...new Uint8Array(32).fill(7))))).toBe(true);
    expect(isDerivedPassword('estudos2026')).toBe(false);
    expect(isDerivedPassword('')).toBe(false);
  });

  it('compara em tempo constante', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('gera tokens de sessão únicos e guarda só o hash', async () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(token);
    expect(await sha256(token)).not.toContain(token);
  });
});

describe('bloqueio após tentativas com senha errada', () => {
  const start = new Date('2026-10-20T12:00:00Z');
  const later = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

  it('bloqueia por 15 minutos na 8ª falha dentro de 15 minutos', () => {
    let state = nextAttempt(null, start);
    for (let i = 2; i <= 7; i++) state = nextAttempt(state, later(i));
    expect(state).toMatchObject({ failures: 7, locked_until: null });
    state = nextAttempt(state, later(8));
    expect(state.failures).toBe(8);
    expect(state.locked_until).toBe(later(23).toISOString());
  });

  it('recomeça a contagem depois de 15 minutos sem falhas', () => {
    const state = nextAttempt(nextAttempt(null, start), later(20));
    expect(state).toMatchObject({ failures: 1, first_failure_at: later(20).toISOString() });
  });
});

describe('cookie de sessão', () => {
  const https = new Request('https://evolua-meus-estudos.pages.dev/api/auth/login');
  const http = new Request('http://127.0.0.1:4173/api/auth/login');

  it('é HttpOnly, SameSite=Lax e Secure em https', () => {
    expect(sessionCookie(https, 'abc', true)).toBe(
      'evolua_sessao=abc; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000',
    );
    expect(sessionCookie(http, 'abc', false)).toBe('evolua_sessao=abc; Path=/; HttpOnly; SameSite=Lax');
    expect(clearSessionCookie(https)).toContain('Max-Age=0');
  });

  it('lê o cookie da requisição', () => {
    const request = new Request('https://x.dev', { headers: { Cookie: 'outro=1; evolua_sessao=tok%3D; a=b' } });
    expect(readCookie(request, 'evolua_sessao')).toBe('tok=');
    expect(readCookie(request, 'nao-existe')).toBeNull();
  });
});
