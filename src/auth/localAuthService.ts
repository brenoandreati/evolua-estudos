import { createId } from '../state/id';
import { deriveHash, randomSalt, safeEqual } from './crypto';
import { GOOGLE_CLIENT_ID, parseGoogleCredential } from './google';
import { AuthError, type AuthField, type AuthService, type RegisterInput, type User } from './types';
import { emailError, nameError, normalizeEmail, passwordError } from './validation';

export const ACCOUNTS_KEY = 'evolua-estudos:contas:v1';
export const SESSION_KEY = 'evolua-estudos:sessao:v1';

const PASSWORD_ITERATIONS = 210_000;

/** Conta como fica salva: a senha só como hash com sal. */
interface StoredAccount {
  id: string;
  name: string;
  email: string;
  provider: 'password' | 'google';
  /** Ausentes em contas criadas pelo Google. */
  passwordHash?: string;
  passwordSalt?: string;
  passwordIterations?: number;
  /** Identificador da conta Google, quando vinculada. */
  googleSub?: string;
  createdAt: string;
  updatedAt: string;
}

interface Session {
  userId: string;
  startedAt: string;
}

interface LocalAuthOptions {
  persistent?: Storage;
  temporary?: Storage;
  googleClientId?: string;
  /** Chamado ao criar a primeira conta deste aparelho (ex.: adotar dados antigos). */
  onFirstAccount?: (userId: string) => void;
}

function toUser(account: StoredAccount): User {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    provider: account.provider === 'google' ? 'google' : 'password',
  };
}

/**
 * Acesso com e-mail e senha (ou Google) guardado neste navegador.
 * As contas ficam no `localStorage`; a sessão fica no `localStorage`
 * ("manter conectado") ou no `sessionStorage` (até fechar o navegador).
 */
export class LocalAuthService implements AuthService {
  private readonly persistent: Storage;
  private readonly temporary: Storage;
  private readonly googleClientId: string;
  private readonly onFirstAccount?: (userId: string) => void;

  constructor(options: LocalAuthOptions = {}) {
    this.persistent = options.persistent ?? globalThis.localStorage;
    this.temporary = options.temporary ?? globalThis.sessionStorage;
    this.googleClientId = options.googleClientId ?? GOOGLE_CLIENT_ID;
    this.onFirstAccount = options.onFirstAccount;
  }

  // ----- armazenamento -----

  private readAccounts(): StoredAccount[] {
    try {
      const raw = this.persistent.getItem(ACCOUNTS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
    } catch {
      return [];
    }
  }

  private writeAccounts(accounts: StoredAccount[]): void {
    try {
      this.persistent.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      throw new AuthError('Não foi possível salvar a conta neste navegador. Verifique se o armazenamento está liberado.');
    }
  }

  private readSession(): Session | null {
    for (const storage of [this.temporary, this.persistent]) {
      try {
        const raw = storage.getItem(SESSION_KEY);
        if (raw) return JSON.parse(raw) as Session;
      } catch {
        // tenta o próximo armazenamento
      }
    }
    return null;
  }

  private startSession(userId: string, remember: boolean): void {
    this.clearSession();
    const session: Session = { userId, startedAt: new Date().toISOString() };
    try {
      (remember ? this.persistent : this.temporary).setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      throw new AuthError('Não foi possível iniciar a sessão neste navegador.');
    }
  }

  private clearSession(): void {
    for (const storage of [this.temporary, this.persistent]) {
      try {
        storage.removeItem(SESSION_KEY);
      } catch {
        // nada a limpar
      }
    }
  }

  private addAccount(accounts: StoredAccount[], account: StoredAccount): void {
    this.writeAccounts([...accounts, account]);
    if (accounts.length === 0) this.onFirstAccount?.(account.id);
  }

  // ----- operações -----

  async currentUser(): Promise<User | null> {
    const session = this.readSession();
    if (!session) return null;
    const account = this.readAccounts().find((a) => a.id === session.userId);
    if (!account) {
      this.clearSession();
      return null;
    }
    return toUser(account);
  }

  async register(input: RegisterInput, options: { remember: boolean }): Promise<User> {
    const email = normalizeEmail(input.email);
    const problems: [string | undefined, AuthField][] = [
      [nameError(input.name), 'name'],
      [emailError(email), 'email'],
      [passwordError(input.password), 'password'],
    ];
    for (const [message, field] of problems) if (message) throw new AuthError(message, field);

    const accounts = this.readAccounts();
    if (accounts.some((a) => a.email === email)) {
      throw new AuthError('Já existe uma conta com este e-mail neste aparelho. Use “Entrar”.', 'email');
    }

    const now = new Date().toISOString();
    const passwordSalt = randomSalt();
    const account: StoredAccount = {
      id: createId('conta'),
      name: input.name.trim(),
      email,
      provider: 'password',
      passwordHash: await deriveHash(input.password, passwordSalt, PASSWORD_ITERATIONS),
      passwordSalt,
      passwordIterations: PASSWORD_ITERATIONS,
      createdAt: now,
      updatedAt: now,
    };

    this.addAccount(accounts, account);
    this.startSession(account.id, options.remember);
    return toUser(account);
  }

  async login(email: string, password: string, options: { remember: boolean }): Promise<User> {
    if (!email.trim()) throw new AuthError('Informe seu e-mail.', 'email');
    if (!password) throw new AuthError('Informe sua senha.', 'password');

    const account = this.readAccounts().find((a) => a.email === normalizeEmail(email));
    if (account && !account.passwordHash) {
      throw new AuthError('Esta conta foi criada com o Google. Use “Continuar com Google”.', 'email');
    }
    const wrong = new AuthError('E-mail ou senha incorretos.', 'email');
    if (!account?.passwordHash || !account.passwordSalt || !account.passwordIterations) throw wrong;

    const hash = await deriveHash(password, account.passwordSalt, account.passwordIterations);
    if (!safeEqual(hash, account.passwordHash)) throw wrong;

    this.startSession(account.id, options.remember);
    return toUser(account);
  }

  async signInWithGoogle(credential: string, options: { remember: boolean }): Promise<User> {
    const profile = parseGoogleCredential(credential, this.googleClientId);
    const email = normalizeEmail(profile.email);
    const accounts = this.readAccounts();
    const existing = accounts.find((a) => a.googleSub === profile.sub) ?? accounts.find((a) => a.email === email);

    if (existing) {
      // E-mail confirmado pelo Google: pode vincular a uma conta já criada com o mesmo e-mail.
      const linked = existing.googleSub ? existing : { ...existing, googleSub: profile.sub, updatedAt: new Date().toISOString() };
      if (linked !== existing) this.writeAccounts(accounts.map((a) => (a.id === existing.id ? linked : a)));
      this.startSession(linked.id, options.remember);
      return toUser(linked);
    }

    const now = new Date().toISOString();
    const account: StoredAccount = {
      id: createId('conta'),
      name: profile.givenName || profile.name || email.split('@')[0],
      email,
      provider: 'google',
      googleSub: profile.sub,
      createdAt: now,
      updatedAt: now,
    };
    this.addAccount(accounts, account);
    this.startSession(account.id, options.remember);
    return toUser(account);
  }

  async logout(): Promise<void> {
    this.clearSession();
  }

  async updateProfile(userId: string, profile: { name: string }): Promise<User> {
    const problem = nameError(profile.name);
    if (problem) throw new AuthError(problem, 'name');
    const accounts = this.readAccounts();
    const account = accounts.find((a) => a.id === userId);
    if (!account) throw new AuthError('Conta não encontrada.');
    const updated = { ...account, name: profile.name.trim(), updatedAt: new Date().toISOString() };
    this.writeAccounts(accounts.map((a) => (a.id === userId ? updated : a)));
    return toUser(updated);
  }

  subscribe(listener: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY || event.key === ACCOUNTS_KEY) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }
}
