import { createId } from '../state/id';
import { maskCpf, onlyDigits } from './cpf';
import { deriveHash, randomSalt, safeEqual } from './crypto';
import {
  AuthError,
  type AuthField,
  type AuthService,
  type RegisterInput,
  type ResetPasswordInput,
  type User,
} from './types';
import { cpfError, emailError, normalizeEmail, passwordError } from './validation';

export const ACCOUNTS_KEY = 'evolua-estudos:contas:v1';
export const SESSION_KEY = 'evolua-estudos:sessao:v1';

const PASSWORD_ITERATIONS = 210_000;
const CPF_ITERATIONS = 60_000;

/** Conta como fica salva: senha e CPF apenas como hash com sal. */
interface StoredAccount {
  id: string;
  name: string;
  email: string;
  cpfMasked: string;
  cpfHash: string;
  cpfSalt: string;
  cpfIterations: number;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
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
  /** Chamado ao criar a primeira conta deste aparelho (ex.: adotar dados antigos). */
  onFirstAccount?: (userId: string) => void;
}

function toUser(account: StoredAccount): User {
  return { id: account.id, name: account.name, email: account.email, cpfMasked: account.cpfMasked };
}

/**
 * Acesso com e-mail, CPF e senha guardado neste navegador.
 * As contas ficam no `localStorage`; a sessão fica no `localStorage`
 * ("manter conectado") ou no `sessionStorage` (até fechar o navegador).
 */
export class LocalAuthService implements AuthService {
  private readonly persistent: Storage;
  private readonly temporary: Storage;
  private readonly onFirstAccount?: (userId: string) => void;

  constructor(options: LocalAuthOptions = {}) {
    this.persistent = options.persistent ?? globalThis.localStorage;
    this.temporary = options.temporary ?? globalThis.sessionStorage;
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

  private async findByCpf(accounts: StoredAccount[], cpf: string): Promise<StoredAccount | undefined> {
    const digits = onlyDigits(cpf);
    for (const account of accounts) {
      const hash = await deriveHash(digits, account.cpfSalt, account.cpfIterations);
      if (safeEqual(hash, account.cpfHash)) return account;
    }
    return undefined;
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
      [emailError(email), 'email'],
      [cpfError(input.cpf), 'cpf'],
      [passwordError(input.password), 'password'],
    ];
    for (const [message, field] of problems) if (message) throw new AuthError(message, field);

    const accounts = this.readAccounts();
    if (accounts.some((a) => a.email === email)) {
      throw new AuthError('Já existe uma conta com este e-mail neste aparelho. Use “Entrar”.', 'email');
    }
    if (await this.findByCpf(accounts, input.cpf)) {
      throw new AuthError('Já existe uma conta com este CPF neste aparelho. Use “Entrar”.', 'cpf');
    }

    const now = new Date().toISOString();
    const cpfSalt = randomSalt();
    const passwordSalt = randomSalt();
    const account: StoredAccount = {
      id: createId('conta'),
      name: input.name.trim(),
      email,
      cpfMasked: maskCpf(input.cpf),
      cpfHash: await deriveHash(onlyDigits(input.cpf), cpfSalt, CPF_ITERATIONS),
      cpfSalt,
      cpfIterations: CPF_ITERATIONS,
      passwordHash: await deriveHash(input.password, passwordSalt, PASSWORD_ITERATIONS),
      passwordSalt,
      passwordIterations: PASSWORD_ITERATIONS,
      createdAt: now,
      updatedAt: now,
    };

    this.writeAccounts([...accounts, account]);
    if (accounts.length === 0) this.onFirstAccount?.(account.id);
    this.startSession(account.id, options.remember);
    return toUser(account);
  }

  async login(identifier: string, password: string, options: { remember: boolean }): Promise<User> {
    const wrong = new AuthError('E-mail/CPF ou senha incorretos.', 'identifier');
    if (!identifier.trim()) throw new AuthError('Informe seu e-mail ou CPF.', 'identifier');
    if (!password) throw new AuthError('Informe sua senha.', 'password');

    const accounts = this.readAccounts();
    const account = identifier.includes('@')
      ? accounts.find((a) => a.email === normalizeEmail(identifier))
      : onlyDigits(identifier).length === 11
        ? await this.findByCpf(accounts, identifier)
        : undefined;
    if (!account) throw wrong;

    const hash = await deriveHash(password, account.passwordSalt, account.passwordIterations);
    if (!safeEqual(hash, account.passwordHash)) throw wrong;

    this.startSession(account.id, options.remember);
    return toUser(account);
  }

  async logout(): Promise<void> {
    this.clearSession();
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const problem = passwordError(input.password);
    if (problem) throw new AuthError(problem, 'password');

    const accounts = this.readAccounts();
    const account = accounts.find((a) => a.email === normalizeEmail(input.email));
    const notFound = new AuthError('Não encontramos uma conta com este e-mail e CPF neste aparelho.', 'email');
    if (!account) throw notFound;
    const cpfHash = await deriveHash(onlyDigits(input.cpf), account.cpfSalt, account.cpfIterations);
    if (!safeEqual(cpfHash, account.cpfHash)) throw notFound;

    const passwordSalt = randomSalt();
    const updated: StoredAccount = {
      ...account,
      passwordSalt,
      passwordIterations: PASSWORD_ITERATIONS,
      passwordHash: await deriveHash(input.password, passwordSalt, PASSWORD_ITERATIONS),
      updatedAt: new Date().toISOString(),
    };
    this.writeAccounts(accounts.map((a) => (a.id === account.id ? updated : a)));
  }

  async updateProfile(userId: string, profile: { name: string }): Promise<User> {
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
