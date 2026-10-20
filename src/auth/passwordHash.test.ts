import { describe, expect, it } from 'vitest';
import { derivePassword } from './passwordHash';

describe('derivePassword', () => {
  it('não envia a senha em texto puro e não depende de maiúsculas/espaços no e-mail', async () => {
    const derived = await derivePassword('Ana@Teste.com ', 'estudos2026');
    expect(derived).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(derived).not.toContain('estudos');
    expect(await derivePassword('ana@teste.com', 'estudos2026')).toBe(derived);
  });

  it('a mesma senha em contas diferentes gera valores diferentes', async () => {
    expect(await derivePassword('ana@teste.com', 'estudos2026')).not.toBe(
      await derivePassword('bia@teste.com', 'estudos2026'),
    );
  });
});
