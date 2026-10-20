/** Dados da pessoa conectada que as telas podem usar. */
export interface User {
  id: string;
  /** Nome de usuário: como a plataforma chama a pessoa. */
  name: string;
  email: string;
  /** Como a conta foi criada. */
  provider: 'password' | 'google';
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export type AuthField = 'name' | 'email' | 'password';

/** Erro de acesso com mensagem pronta para exibir e o campo relacionado. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly field?: AuthField,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Contrato de acesso ao painel.
 *
 * A primeira versão (`LocalAuthService`) guarda as contas neste navegador.
 * Para usar contas na internet (com servidor e acesso de qualquer aparelho),
 * basta criar outra implementação desta interface e trocá-la em
 * `src/auth/index.ts`.
 */
export interface AuthService {
  currentUser(): Promise<User | null>;
  register(input: RegisterInput, options: { remember: boolean }): Promise<User>;
  login(email: string, password: string, options: { remember: boolean }): Promise<User>;
  /** Entra (ou cria a conta) com a credencial devolvida pelo botão do Google. */
  signInWithGoogle(credential: string, options: { remember: boolean }): Promise<User>;
  logout(): Promise<void>;
  updateProfile(userId: string, profile: { name: string }): Promise<User>;
  /** Avisa quando a sessão muda em outra aba. */
  subscribe?(listener: () => void): () => void;
}
