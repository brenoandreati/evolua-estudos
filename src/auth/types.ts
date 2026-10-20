/** Dados da pessoa conectada que as telas podem usar. */
export interface User {
  id: string;
  name: string;
  email: string;
  /** CPF parcialmente oculto, só para exibição (***.982.247-**). */
  cpfMasked: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  cpf: string;
  password: string;
}

export interface ResetPasswordInput {
  email: string;
  cpf: string;
  password: string;
}

export type AuthField = 'name' | 'email' | 'cpf' | 'password' | 'identifier';

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
  login(identifier: string, password: string, options: { remember: boolean }): Promise<User>;
  logout(): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  updateProfile(userId: string, profile: { name: string }): Promise<User>;
  /** Avisa quando a sessão muda em outra aba. */
  subscribe?(listener: () => void): () => void;
}
