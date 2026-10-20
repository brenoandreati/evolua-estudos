import { ApiError, api } from '../api/client';
import { derivePassword } from './passwordHash';
import { AuthError, type AuthField, type AuthService, type RegisterInput, type User } from './types';
import { passwordError } from './validation';

const FIELDS = new Set<AuthField>(['name', 'email', 'password']);

/** Converte erros do servidor em erros de acesso com o campo certo destacado. */
async function call<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      const field = FIELDS.has(error.field as AuthField) ? (error.field as AuthField) : undefined;
      throw new AuthError(error.message, field);
    }
    throw error;
  }
}

/** Contas guardadas no servidor (Cloudflare), com sessão em cookie seguro. */
export class HttpAuthService implements AuthService {
  async currentUser(): Promise<User | null> {
    const { user } = await api<{ user: User | null }>('/api/auth/me');
    return user;
  }

  async register(input: RegisterInput, { remember }: { remember: boolean }): Promise<User> {
    // A regra da senha é conferida aqui: o servidor nunca recebe a senha em texto puro.
    const problem = passwordError(input.password);
    if (problem) throw new AuthError(problem, 'password');
    const password = await derivePassword(input.email, input.password);
    const { user } = await call(
      api<{ user: User }>('/api/auth/register', {
        method: 'POST',
        body: { name: input.name, email: input.email, password, remember },
        quietUnauthorized: true,
      }),
    );
    return user;
  }

  async login(email: string, password: string, { remember }: { remember: boolean }): Promise<User> {
    const { user } = await call(
      api<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: { email, password: await derivePassword(email, password), remember },
        quietUnauthorized: true,
      }),
    );
    return user;
  }

  async signInWithGoogle(credential: string, { remember }: { remember: boolean }): Promise<User> {
    const { user } = await call(
      api<{ user: User }>('/api/auth/google', {
        method: 'POST',
        body: { credential, remember },
        quietUnauthorized: true,
      }),
    );
    return user;
  }

  async logout(): Promise<void> {
    await api('/api/auth/logout', { method: 'POST', quietUnauthorized: true });
  }

  async updateProfile(profile: { name: string }): Promise<User> {
    const { user } = await call(api<{ user: User }>('/api/auth/profile', { method: 'PATCH', body: profile }));
    return user;
  }

  async deleteAccount(): Promise<void> {
    await call(api('/api/auth/account', { method: 'DELETE' }));
  }
}
